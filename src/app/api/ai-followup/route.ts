import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { ADMIN_EMAILS } from '@/lib/admin/emails'
import {
  checkCaregiverContactAllowed,
  checkFamilyInterested,
  checkFamilyClosureNote,
  checkCaregiverClosureNote,
  detectsProseOnlyPromise,
  CONTACT_COOLDOWN_HOURS,
  CONTACT_WEEKLY_CAP,
  CONTACT_WINDOW_DAYS,
  type Block,
} from '@/lib/followup/guardrails'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic()

const MODEL = 'claude-opus-5'
const MAX_TOOL_CALLS = 25
const MAX_TURNS = 30

// Statuses that mean "this match is finished, stop looking at it".
// 'hired' and 'closed' are family-confirmed outcomes (B3); proposals await
// family approval and must not be worked either.
const TERMINAL_STATUSES = ['stalled', 'pending_family_approval', 'hired', 'closed']

// ---------------------------------------------------------------------------
// System prompt. States the goal, the guardrails, and the exit criteria.
// Deliberately contains no branching rules ("if N hours elapsed then ...") —
// deciding what each match needs is the agent's job, not the prompt's.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Ruah's matching operations agent for a caregiving marketplace. Once a day you review every open match and decide what, if anything, to do about each one.

GOAL
Drive every match to a definite outcome. A match is in a good place when the family and caregiver are talking and the match is progressing, or when the match is clearly closed and the family has been told where they stand. The failure case is a match sitting untouched with nobody informed.

THE ASYMMETRY THAT SHOULD SHAPE YOUR DECISIONS
Caregivers are the scarce side of this marketplace — there are far more families needing care than caregivers available to give it. A caregiver who feels pestered leaves the platform, and that loss is permanent and affects every future family. A family waiting an extra few days is a much smaller cost. When contacting a caregiver trades off against moving slowly, move slowly.

Families, by contrast, are waiting on you and would rather hear something than nothing — including "this one did not work out."

VISIBILITY, PROMISES, AND CLOSURE
- The family must be able to see what you did on their behalf. A silent status change is the same as not doing it — which is why closing a match (mark_stalled) always carries the note the family will receive.
- Never promise anything in prose that a future run cannot see. If a message says or implies "we'll close this if we don't hear back" or "we'll follow up", record the commitment by passing deadline on that message — it is written onto the match, and future runs will see it and act on it. A promise that exists only as words will be broken by whoever runs tomorrow.
- Honor what earlier runs committed to. Read each thread and the recorded deadline; if a recorded deadline has passed and nothing moved, do what was promised. (A deadline can also be a legacy 48-hour acceptance window from the admin flow — treat it as a commitment only when the thread corroborates it.)
- Caregivers are the scarce side, and also a side you owe an accounting. When you close a match on which the caregiver was previously contacted, she is told the outcome — mark_stalled requires your note to her. Closure notes are never blocked by the contact cooldown, but they count toward her future contact budget; factor that into what else you plan for her.

EXIT CRITERIA — a match is done when any of these is true:
- The family confirms they have what they need.
- The family tells you to stop.
- Roughly a week has passed with no progress, in which case close it out and make sure the family knows.
- Anything ambiguous, sensitive, or that you are not confident about — hand it to a human rather than guessing.

GUARDRAILS
These are enforced in the tools, not by you. A call that violates one is rejected and returned to you with the reason, and you can then choose a different action:
- A caregiver who has been contacted by the platform recently cannot be contacted again, whether or not the earlier contact was on this match.
- A caregiver cannot be contacted on behalf of a family that has not expressed interest.
- Proposing a new match never contacts the caregiver. It queues a proposal for the family to approve.
- Closing a match without a note to the family — or without a closure note to a previously-contacted caregiver — is rejected.
- A message that promises future action ("we'll close / follow up / if we don't hear back") without recording a deadline is rejected.
- You have a limited number of tool calls for this run. Call list_pending_matches once to see everything, then spend the remainder where they matter most.

Every tool that writes requires a reason. Write it for the human who will audit this run afterwards.`

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------
const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'list_pending_matches',
    description:
      'Return every match that may need attention, with its full message timeline, whether the underlying service request is still open, and — for each caregiver — every platform-initiated contact in the last 7 days across all of their matches. Call this first. One call returns the complete picture; you should not need it twice.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'search_caregivers',
    description:
      'Find caregivers who might fit a family\'s needs. Use when you are considering proposing a replacement caregiver for a match that is not working out. Returns up to 5 candidates, excluding banned and shadow-banned accounts.',
    input_schema: {
      type: 'object',
      properties: {
        services: { type: 'array', items: { type: 'string' }, description: 'Service types the family needs, e.g. ["childcare"].' },
        languages: { type: 'array', items: { type: 'string' }, description: 'Languages the family prefers.' },
        reason: { type: 'string', description: 'Why you are running this search.' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'message_caregiver',
    description:
      'Send a message to the caregiver on a match, written as Ruah on the family\'s behalf. This is the scarce action — the caregiver contact guardrails apply here. If the message promises future action ("we\'ll close this if we don\'t hear back"), you MUST record that commitment via deadline or the call is rejected.',
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        content: { type: 'string', description: 'The message the caregiver will read.' },
        reason: { type: 'string', description: 'Why this caregiver should be contacted now.' },
        deadline: { type: 'string', description: 'ISO 8601 timestamp. Required whenever the message states or implies action beyond this run. Written to the match so future runs honor the promise.' },
      },
      required: ['match_id', 'content', 'reason'],
    },
  },
  {
    name: 'message_family',
    description:
      'Send a message to the family on a match, written as Ruah. Use for updates that are NOT part of closing a match — closure notes ride mark_stalled instead. Promises of future action must record a deadline or the call is rejected.',
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        content: { type: 'string', description: 'The message the family will read.' },
        reason: { type: 'string', description: 'Why the family is being told this now.' },
        deadline: { type: 'string', description: 'ISO 8601 timestamp. Required whenever the message states or implies action beyond this run. Written to the match so future runs honor the promise.' },
      },
      required: ['match_id', 'content', 'reason'],
    },
  },
  {
    name: 'mark_stalled',
    description:
      'Close a match out as stalled. Closing is never silent: family_message (required) is delivered to the family with the outcome. If the caregiver was previously contacted on this match, caregiver_message is required too — she is owed the result; it is delivered without cooldown restrictions but counts toward her contact budget. If she never knew the match existed, caregiver_message is rejected. Do not also call message_family/message_caregiver for the same closure.',
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        reason: { type: 'string', description: 'Why this match is being closed (audit log).' },
        family_message: { type: 'string', description: 'The note the family receives about this closure.' },
        caregiver_message: { type: 'string', description: 'Closure note to the caregiver. Required if she was contacted on this match; omit if she never knew it existed.' },
      },
      required: ['match_id', 'reason', 'family_message'],
    },
  },
  {
    name: 'propose_new_match',
    description:
      'Queue a proposed caregiver for a family to approve. Creates the match in pending_family_approval. The caregiver is NOT contacted and will not be until the family approves.',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The service request to attach the proposal to.' },
        caregiver_id: { type: 'string', description: 'A caregiver_ref returned by search_caregivers.' },
        reason: { type: 'string', description: 'Why this caregiver suits this family.' },
      },
      required: ['request_id', 'caregiver_id', 'reason'],
    },
  },
  {
    name: 'escalate_to_admin',
    description:
      'Hand a match to a human operator. Use when the situation is ambiguous, sensitive, or outside what you should decide alone.',
    input_schema: {
      type: 'object',
      properties: {
        match_id: { type: 'string' },
        reason: { type: 'string', description: 'What a human needs to look at, and why.' },
      },
      required: ['match_id', 'reason'],
    },
  },
]

// ---------------------------------------------------------------------------
// World loading.
//
// matches.caregiver_id -> caregiver_profiles.id, but messages.sender_id and
// messages.receiver_id -> users.id. Those are different keyspaces and the hop
// between them lives entirely in here. Everything handed to the agent is keyed
// by match_id and by opaque caregiver_ref values; the agent never sees a
// user id and cannot address one.
// ---------------------------------------------------------------------------

type World = Awaited<ReturnType<typeof loadWorld>>

const cgRef = (caregiverProfileId: string) => `cg_${caregiverProfileId.slice(0, 8)}`

async function loadWorld() {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, request_id, caregiver_id, status, caregiver_interested, family_interested, created_at, initiated_by, initiator_message, expires_at, decline_reason')
  if (error) throw new Error(`matches query failed: ${error.message}`)

  const open = (matches || []).filter(m => !TERMINAL_STATUSES.includes(m.status))

  const requestIds = [...new Set(open.map(m => m.request_id).filter(Boolean))]
  const caregiverIds = [...new Set(open.map(m => m.caregiver_id).filter(Boolean))]

  const [{ data: requests }, { data: caregivers }] = await Promise.all([
    supabase.from('service_requests').select('id, family_id, service_type, title, description, status').in('id', requestIds),
    supabase.from('caregiver_profiles').select('id, user_id, services, languages, years_experience, is_verified').in('id', caregiverIds),
  ])

  const familyIds = [...new Set((requests || []).map(r => r.family_id).filter(Boolean))]
  const { data: families } = await supabase
    .from('family_profiles').select('id, user_id, family_name').in('id', familyIds)

  const userIds = [
    ...(caregivers || []).map(c => c.user_id),
    ...(families || []).map(f => f.user_id),
  ].filter(Boolean)
  const { data: users } = await supabase.from('users').select('id, full_name').in('id', userIds)

  // Thread messages for the open matches.
  const { data: threadMessages } = await supabase
    .from('messages')
    .select('id, match_id, sender_id, receiver_id, content, is_ai, sender_type, created_at')
    .in('match_id', open.map(m => m.id))
    .order('created_at', { ascending: true })

  // Platform-initiated contacts to these caregivers over the whole window,
  // across ALL matches — including matches not in this run's working set.
  // This is what makes cross-match over-contacting visible.
  const windowStart = new Date(Date.now() - CONTACT_WINDOW_DAYS * 86400_000).toISOString()
  const caregiverUserIds = (caregivers || []).map(c => c.user_id).filter(Boolean)
  const { data: contactRows } = await supabase
    .from('messages')
    .select('id, match_id, receiver_id, sender_type, is_ai, created_at')
    .in('receiver_id', caregiverUserIds)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })

  const platformContacts = (contactRows || []).filter(m => m.sender_type === 'ruah' || m.is_ai === true)

  const requestById = new Map((requests || []).map(r => [r.id, r]))
  const caregiverById = new Map((caregivers || []).map(c => [c.id, c]))
  const familyById = new Map((families || []).map(f => [f.id, f]))
  const userById = new Map((users || []).map(u => [u.id, u]))
  const matchById = new Map(open.map(m => [m.id, m]))

  // caregiver_profiles.id -> contacts, seeded from the DB. Sends made during
  // this run are appended here, so the guardrails see them immediately.
  const contactsByCaregiver = new Map<string, { at: string; match_id: string | null }[]>()
  for (const c of caregivers || []) {
    contactsByCaregiver.set(
      c.id,
      platformContacts
        .filter(p => p.receiver_id === c.user_id)
        .map(p => ({ at: p.created_at, match_id: p.match_id }))
    )
  }

  const refToCaregiverId = new Map((caregivers || []).map(c => [cgRef(c.id), c.id]))

  return {
    matches: open,
    matchById,
    requestById,
    caregiverById,
    familyById,
    userById,
    threadMessages: threadMessages || [],
    contactsByCaregiver,
    refToCaregiverId,
  }
}

/** Resolve a match to both keyspaces. Returns null if anything is missing. */
function resolveMatch(world: World, matchId: string) {
  const match = world.matchById.get(matchId)
  if (!match) return null
  const request = world.requestById.get(match.request_id)
  const caregiver = world.caregiverById.get(match.caregiver_id)
  if (!request || !caregiver) return null
  const family = world.familyById.get(request.family_id)
  if (!family) return null
  return {
    match,
    request,
    caregiver,
    family,
    caregiverUserId: caregiver.user_id as string,
    familyUserId: family.user_id as string,
    caregiverName: (world.userById.get(caregiver.user_id)?.full_name || 'there').split(' ')[0],
    familyName: family.family_name || world.userById.get(family.user_id)?.full_name || 'the family',
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

type ToolOutcome = { ok: true; result: any; matchId?: string | null } | { ok: false; block: Block; matchId?: string | null }

async function listPendingMatches(world: World) {
  const rows = world.matches.map(m => {
    const r = resolveMatch(world, m.id)
    if (!r) return null
    const rawThread = world.threadMessages.filter(t => t.match_id === m.id)
    const thread = rawThread.map(t => ({
      from: t.sender_type || (t.is_ai ? 'ruah' : 'unknown'),
      is_ai: t.is_ai === true,
      at: t.created_at,
      content: t.content,
    }))
    const contacts = world.contactsByCaregiver.get(m.caregiver_id) || []
    return {
      match_id: m.id,
      request_id: m.request_id,
      status: m.status,
      family_interested: m.family_interested,
      caregiver_interested: m.caregiver_interested,
      created_at: m.created_at,
      age_hours: Math.round((Date.now() - new Date(m.created_at).getTime()) / 3600_000),
      initiated_by: m.initiated_by,
      // A commitment recorded by an earlier run (or a legacy 48h acceptance
      // window from the admin flow — corroborate with the thread).
      deadline: m.expires_at ?? null,
      deadline_passed: m.expires_at ? new Date(m.expires_at).getTime() < Date.now() : false,
      // Why the caregiver passed (one-tap Pass). Use it to propose a better
      // alternative — e.g. 'rate' means find someone in the family's budget,
      // 'not_taking_new_families' means she is out of rotation for a while.
      ...(m.decline_reason ? { decline_reason: m.decline_reason } : {}),
      caregiver: {
        ref: cgRef(m.caregiver_id),
        name: r.caregiverName,
        verified: r.caregiver.is_verified === true,
        services: r.caregiver.services,
        platform_contacted_on_this_match: rawThread.some(
          t => (t.sender_type === 'ruah' || t.is_ai === true) && t.receiver_id === r.caregiverUserId),
        engaged_with_match:
          rawThread.some(t => t.sender_id === r.caregiverUserId) ||
          m.initiated_by === 'caregiver' ||
          m.caregiver_interested !== null,
      },
      family: { name: r.familyName },
      service_request: {
        type: r.request.service_type,
        title: r.request.title,
        status: r.request.status,
        still_open: r.request.status === 'open',
      },
      message_count: thread.length,
      messages: thread,
      caregiver_platform_contacts_7d: contacts.map(c => ({
        at: c.at,
        on_match: c.match_id,
        this_match: c.match_id === m.id,
      })),
    }
  }).filter(Boolean) as any[]

  // Cross-match rollup, so overlap is visible without diffing 28 rows by hand.
  const byCaregiver = new Map<string, any>()
  for (const row of rows) {
    const key = row.caregiver.ref
    if (!byCaregiver.has(key)) {
      byCaregiver.set(key, {
        caregiver_ref: key,
        name: row.caregiver.name,
        open_matches: 0,
        match_ids: [] as string[],
        platform_contacts_7d: row.caregiver_platform_contacts_7d.length,
      })
    }
    const agg = byCaregiver.get(key)
    agg.open_matches += 1
    agg.match_ids.push(row.match_id)
  }

  return {
    now: new Date().toISOString(),
    contact_rules: {
      cooldown_hours: CONTACT_COOLDOWN_HOURS,
      weekly_cap: CONTACT_WEEKLY_CAP,
      note: 'Both are per caregiver and count contacts across every match that caregiver holds.',
      deadline_note: 'deadline is a recorded commitment when an earlier run set it; on older matches it may be a legacy 48h acceptance window from the admin flow. Corroborate with the thread before treating it as a promise.',
    },
    match_count: rows.length,
    matches: rows,
    caregivers: [...byCaregiver.values()].sort((a, b) => b.open_matches - a.open_matches),
  }
}

async function searchCaregivers(input: any) {
  let query = supabase
    .from('caregiver_profiles')
    .select(`
      id, services, languages, years_experience, hourly_rate_min, hourly_rate_max, bio, is_verified,
      users!caregiver_profiles_user_id_fkey ( id, full_name, city, is_banned, is_shadow_banned )
    `)
    .limit(5)

  if (input.services?.length) query = query.overlaps('services', input.services)
  if (input.languages?.length) query = query.overlaps('languages', input.languages)

  const { data, error } = await query
  if (error) throw new Error(`search failed: ${error.message}`)

  return (data || [])
    .filter((cg: any) => !cg.users?.is_banned && !cg.users?.is_shadow_banned)
    .map((cg: any) => ({
      caregiver_ref: cgRef(cg.id),
      name: cg.users?.full_name,
      city: cg.users?.city,
      services: cg.services,
      languages: cg.languages,
      years_experience: cg.years_experience,
      rate: [cg.hourly_rate_min, cg.hourly_rate_max],
      verified: cg.is_verified === true,
      bio: cg.bio,
    }))
}

/**
 * Validates an optional deadline param. Returns a Block, or the normalized ISO
 * string (null when no deadline was passed).
 */
function parseDeadline(input: any): { block: Block } | { deadline: string | null } {
  if (input.deadline === undefined || input.deadline === null || input.deadline === '') return { deadline: null }
  const t = Date.parse(input.deadline)
  if (Number.isNaN(t)) {
    return { block: { blocked_by: 'invalid_deadline', message: `Rejected: deadline ${JSON.stringify(input.deadline)} is not a parseable ISO 8601 timestamp.` } }
  }
  if (t <= Date.now()) {
    return { block: { blocked_by: 'deadline_in_past', message: 'Rejected: a recorded commitment needs a future deadline — this one is already in the past.' } }
  }
  return { deadline: new Date(t).toISOString() }
}

const PROSE_PROMISE_BLOCK: Block = {
  blocked_by: 'prose_only_promise',
  message:
    'Rejected: this message promises future action ("we\'ll close / follow up / if we don\'t hear back") but ' +
    'records no deadline. A promise that lives only in prose will be broken — the next run cannot see it. ' +
    'Re-send with deadline set to when the promise falls due, or reword without the promise.',
}

async function messageCaregiver(world: World, input: any): Promise<ToolOutcome> {
  const r = resolveMatch(world, input.match_id)
  if (!r) return { ok: false, block: { blocked_by: 'unknown_match', message: `Rejected: no open match with id ${input.match_id}.` } }

  const interestBlock = checkFamilyInterested(r.match.family_interested)
  if (interestBlock) return { ok: false, block: interestBlock, matchId: r.match.id }

  const contactBlock = checkCaregiverContactAllowed(world.contactsByCaregiver.get(r.match.caregiver_id) || [])
  if (contactBlock) return { ok: false, block: contactBlock, matchId: r.match.id }

  const parsed = parseDeadline(input)
  if ('block' in parsed) return { ok: false, block: parsed.block, matchId: r.match.id }

  if (detectsProseOnlyPromise(String(input.content ?? ''), parsed.deadline !== null)) {
    return { ok: false, block: PROSE_PROMISE_BLOCK, matchId: r.match.id }
  }

  const { data, error } = await supabase.from('messages').insert({
    match_id: r.match.id,
    sender_id: r.familyUserId,
    receiver_id: r.caregiverUserId,
    content: input.content,
    is_ai: true,
    sender_type: 'ruah',
  }).select('id').single()
  if (error) throw new Error(`message insert failed: ${error.message}`)

  await supabase.from('notifications').insert({
    user_id: r.caregiverUserId,
    type: 'message',
    title: `Message about the ${r.request.service_type} role`,
    body: String(input.content).slice(0, 100),
    data: { senderId: r.familyUserId, isAi: true, matchId: r.match.id, followupSentFor: r.match.id },
  })

  if (parsed.deadline) {
    const { error: dlErr } = await supabase.from('matches').update({ expires_at: parsed.deadline }).eq('id', r.match.id)
    if (dlErr) throw new Error(`deadline write failed: ${dlErr.message}`)
    r.match.expires_at = parsed.deadline
  }

  // Count this send immediately so the guardrails see it on the next call,
  // and keep the in-run thread current so later listings reflect it.
  const contacts = world.contactsByCaregiver.get(r.match.caregiver_id) || []
  contacts.push({ at: new Date().toISOString(), match_id: r.match.id })
  world.contactsByCaregiver.set(r.match.caregiver_id, contacts)
  world.threadMessages.push({
    id: data.id, match_id: r.match.id, sender_id: r.familyUserId, receiver_id: r.caregiverUserId,
    content: input.content, is_ai: true, sender_type: 'ruah', created_at: new Date().toISOString(),
  })

  return {
    ok: true, matchId: r.match.id,
    result: { message_id: data.id, sent_to: 'caregiver', caregiver: r.caregiverName, deadline_recorded: parsed.deadline },
  }
}

async function messageFamily(world: World, input: any): Promise<ToolOutcome> {
  const r = resolveMatch(world, input.match_id)
  if (!r) return { ok: false, block: { blocked_by: 'unknown_match', message: `Rejected: no open match with id ${input.match_id}.` } }

  const parsed = parseDeadline(input)
  if ('block' in parsed) return { ok: false, block: parsed.block, matchId: r.match.id }

  if (detectsProseOnlyPromise(String(input.content ?? ''), parsed.deadline !== null)) {
    return { ok: false, block: PROSE_PROMISE_BLOCK, matchId: r.match.id }
  }

  const { data, error } = await supabase.from('messages').insert({
    match_id: r.match.id,
    sender_id: r.caregiverUserId,
    receiver_id: r.familyUserId,
    content: input.content,
    is_ai: true,
    sender_type: 'ruah',
  }).select('id').single()
  if (error) throw new Error(`message insert failed: ${error.message}`)

  await supabase.from('notifications').insert({
    user_id: r.familyUserId,
    type: 'message',
    title: `Update on your ${r.request.service_type} request`,
    body: String(input.content).slice(0, 100),
    data: { senderId: r.caregiverUserId, isAi: true, matchId: r.match.id },
  })

  if (parsed.deadline) {
    const { error: dlErr } = await supabase.from('matches').update({ expires_at: parsed.deadline }).eq('id', r.match.id)
    if (dlErr) throw new Error(`deadline write failed: ${dlErr.message}`)
    r.match.expires_at = parsed.deadline
  }

  world.threadMessages.push({
    id: data.id, match_id: r.match.id, sender_id: r.caregiverUserId, receiver_id: r.familyUserId,
    content: input.content, is_ai: true, sender_type: 'ruah', created_at: new Date().toISOString(),
  })

  return {
    ok: true, matchId: r.match.id,
    result: { message_id: data.id, sent_to: 'family', family: r.familyName, deadline_recorded: parsed.deadline },
  }
}

async function markStalled(world: World, input: any): Promise<ToolOutcome> {
  const r = resolveMatch(world, input.match_id)
  if (!r) return { ok: false, block: { blocked_by: 'unknown_match', message: `Rejected: no open match with id ${input.match_id}.` } }

  // 家庭应当能看到 Ruah 替他们做的事 — closing is never silent for the family.
  const familyBlock = checkFamilyClosureNote(input.family_message)
  if (familyBlock) return { ok: false, block: familyBlock, matchId: r.match.id }

  // Caregiver 也是需要交代的一方 — if she was contacted on this match, she is
  // told the outcome; if she never knew it existed, she is left in peace.
  const rawThread = world.threadMessages.filter(t => t.match_id === r.match.id)
  const caregiverBlock = checkCaregiverClosureNote({
    platformContactedOnMatch: rawThread.some(
      t => (t.sender_type === 'ruah' || t.is_ai === true) && t.receiver_id === r.caregiverUserId),
    caregiverEngaged:
      rawThread.some(t => t.sender_id === r.caregiverUserId) ||
      r.match.initiated_by === 'caregiver' ||
      r.match.caregiver_interested !== null,
    caregiverMessage: input.caregiver_message,
  })
  if (caregiverBlock) return { ok: false, block: caregiverBlock, matchId: r.match.id }

  const { error } = await supabase.from('matches').update({ status: 'stalled' }).eq('id', r.match.id)
  if (error) throw new Error(`mark_stalled failed: ${error.message}`)
  r.match.status = 'stalled'

  // Family side.
  const { data: famMsg, error: famErr } = await supabase.from('messages').insert({
    match_id: r.match.id,
    sender_id: r.caregiverUserId,
    receiver_id: r.familyUserId,
    content: input.family_message,
    is_ai: true,
    sender_type: 'ruah',
  }).select('id').single()
  if (famErr) throw new Error(`closure note to family failed: ${famErr.message}`)
  await supabase.from('notifications').insert({
    user_id: r.familyUserId,
    type: 'match_closed',
    title: `Update on your ${r.request.service_type} request`,
    body: String(input.family_message).slice(0, 100),
    data: { matchId: r.match.id, isAi: true, closed: true },
  })
  world.threadMessages.push({
    id: famMsg.id, match_id: r.match.id, sender_id: r.caregiverUserId, receiver_id: r.familyUserId,
    content: input.family_message, is_ai: true, sender_type: 'ruah', created_at: new Date().toISOString(),
  })

  // Caregiver side. Deliberately NOT gated by checkCaregiverContactAllowed — a
  // closure note releases her rather than demanding anything, and it can only
  // happen once per match. It still counts toward her future contact budget.
  let caregiverInformed = false
  if (typeof input.caregiver_message === 'string' && input.caregiver_message.trim()) {
    const { data: cgMsg, error: cgErr } = await supabase.from('messages').insert({
      match_id: r.match.id,
      sender_id: r.familyUserId,
      receiver_id: r.caregiverUserId,
      content: input.caregiver_message,
      is_ai: true,
      sender_type: 'ruah',
    }).select('id').single()
    if (cgErr) throw new Error(`closure note to caregiver failed: ${cgErr.message}`)
    await supabase.from('notifications').insert({
      user_id: r.caregiverUserId,
      type: 'match_closed',
      title: 'A match was closed — no action needed',
      body: String(input.caregiver_message).slice(0, 100),
      data: { matchId: r.match.id, isAi: true, closed: true },
    })
    world.threadMessages.push({
      id: cgMsg.id, match_id: r.match.id, sender_id: r.familyUserId, receiver_id: r.caregiverUserId,
      content: input.caregiver_message, is_ai: true, sender_type: 'ruah', created_at: new Date().toISOString(),
    })
    const contacts = world.contactsByCaregiver.get(r.match.caregiver_id) || []
    contacts.push({ at: new Date().toISOString(), match_id: r.match.id })
    world.contactsByCaregiver.set(r.match.caregiver_id, contacts)
    caregiverInformed = true
  }

  return {
    ok: true, matchId: r.match.id,
    result: { match_id: r.match.id, status: 'stalled', family_informed: true, caregiver_informed: caregiverInformed },
  }
}

async function proposeNewMatch(world: World, input: any): Promise<ToolOutcome> {
  const caregiverId = world.refToCaregiverId.get(input.caregiver_id) || input.caregiver_id

  const { data: cg } = await supabase.from('caregiver_profiles').select('id').eq('id', caregiverId).maybeSingle()
  if (!cg) return { ok: false, block: { blocked_by: 'unknown_caregiver', message: `Rejected: no caregiver matching ${input.caregiver_id}. Use a caregiver_ref from search_caregivers.` } }

  const { data: req } = await supabase.from('service_requests').select('id, family_id').eq('id', input.request_id).maybeSingle()
  if (!req) return { ok: false, block: { blocked_by: 'unknown_request', message: `Rejected: no service request with id ${input.request_id}.` } }

  const { data: dupe } = await supabase
    .from('matches').select('id').eq('request_id', input.request_id).eq('caregiver_id', caregiverId).maybeSingle()
  if (dupe) {
    return { ok: false, block: { blocked_by: 'duplicate_match', message: `Rejected: this caregiver is already matched to that request (match ${dupe.id}).` } }
  }

  // pending_family_approval, family_interested null, and NO message write of
  // any kind. The caregiver learns nothing until a family approves.
  const { data, error } = await supabase.from('matches').insert({
    request_id: input.request_id,
    caregiver_id: caregiverId,
    status: 'pending_family_approval',
    family_interested: null,
    caregiver_interested: null,
    initiated_by: 'ruah',
    ai_reasoning: `[agent-proposed] ${input.reason}`,
  }).select('id').single()
  if (error) throw new Error(`propose_new_match failed: ${error.message}`)

  const { data: fam } = await supabase.from('family_profiles').select('user_id').eq('id', req.family_id).maybeSingle()
  if (fam?.user_id) {
    await supabase.from('notifications').insert({
      user_id: fam.user_id,
      type: 'new_match',
      title: 'A new caregiver suggestion for you',
      body: 'Ruah found a caregiver who may fit. Review and approve to reach out.',
      data: { matchId: data.id, requiresApproval: true },
    })
  }

  return { ok: true, matchId: data.id, result: { match_id: data.id, status: 'pending_family_approval', caregiver_contacted: false } }
}

async function escalateToAdmin(world: World, input: any): Promise<ToolOutcome> {
  const r = resolveMatch(world, input.match_id)
  if (!r) return { ok: false, block: { blocked_by: 'unknown_match', message: `Rejected: no open match with id ${input.match_id}.` } }

  const { data: admins } = await supabase.from('users').select('id').in('email', ADMIN_EMAILS)
  const rows = (admins || []).map(a => ({
    user_id: a.id,
    type: 'admin_escalation',
    title: `Escalation: ${r.familyName} / ${r.caregiverName}`,
    body: String(input.reason).slice(0, 200),
    data: { matchId: r.match.id, requestId: r.request.id },
  }))
  if (rows.length) await supabase.from('notifications').insert(rows)

  return { ok: true, matchId: r.match.id, result: { escalated: true, admins_notified: rows.length } }
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = randomUUID()
  let stepIndex = 0
  let toolCalls = 0
  const decisions: any[] = []

  async function logDecision(row: {
    matchId?: string | null; toolName: string; input: any; reasoning: string
    executed: boolean; outcome?: any; blockedBy?: string | null
  }) {
    const record = {
      match_id: row.matchId ?? null,
      run_id: runId,
      step_index: stepIndex++,
      tool_name: row.toolName,
      tool_input: row.input ?? {},
      reasoning: row.reasoning,
      executed: row.executed,
      outcome: row.outcome ?? null,
      blocked_by: row.blockedBy ?? null,
    }
    decisions.push(record)
    const { error } = await supabase.from('agent_decisions').insert(record)
    if (error) console.error('agent_decisions insert failed:', error.message)
  }

  try {
    const world = await loadWorld()

    const messages: Anthropic.Beta.BetaMessageParam[] = [{
      role: 'user',
      content:
        `Daily review. There are ${world.matches.length} matches that may need attention. ` +
        `Start by calling list_pending_matches, then act on what you find. ` +
        `You have ${MAX_TOOL_CALLS} tool calls for this run in total.`,
    }]

    let stopReason = 'max_turns'

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      } as any)

      if (response.stop_reason === 'refusal') {
        stopReason = 'refusal'
        console.error('ai-followup: model declined', JSON.stringify((response as any).stop_details))
        break
      }

      // Append the whole assistant turn — thinking blocks included and unmodified.
      messages.push({ role: 'assistant', content: response.content })

      const toolUses = response.content.filter((b: any) => b.type === 'tool_use') as any[]
      if (toolUses.length === 0) {
        stopReason = 'end_turn'
        break
      }

      const narration = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join(' ')
        .trim()

      const results: any[] = []
      let budgetExhausted = false

      for (const call of toolUses) {
        const input = call.input || {}
        const reasoning: string =
          (typeof input.reason === 'string' && input.reason.trim()) ||
          narration ||
          `(no narration) automatic ${call.name} call`

        if (toolCalls >= MAX_TOOL_CALLS) {
          budgetExhausted = true
          await logDecision({
            matchId: input.match_id ?? null, toolName: call.name, input, reasoning,
            executed: false, blockedBy: 'tool_call_budget_exhausted',
          })
          results.push({
            type: 'tool_result', tool_use_id: call.id, is_error: true,
            content: `Rejected: the ${MAX_TOOL_CALLS}-tool-call budget for this run is exhausted. Stop and summarise what you did.`,
          })
          continue
        }
        toolCalls++

        try {
          let outcome: ToolOutcome

          switch (call.name) {
            case 'list_pending_matches':
              outcome = { ok: true, result: await listPendingMatches(world) }
              break
            case 'search_caregivers':
              outcome = { ok: true, result: await searchCaregivers(input) }
              break
            case 'message_caregiver':
              outcome = await messageCaregiver(world, input)
              break
            case 'message_family':
              outcome = await messageFamily(world, input)
              break
            case 'mark_stalled':
              outcome = await markStalled(world, input)
              break
            case 'propose_new_match':
              outcome = await proposeNewMatch(world, input)
              break
            case 'escalate_to_admin':
              outcome = await escalateToAdmin(world, input)
              break
            default:
              outcome = { ok: false, block: { blocked_by: 'unknown_tool', message: `Rejected: no tool named ${call.name}.` } }
          }

          if (outcome.ok) {
            await logDecision({
              matchId: outcome.matchId ?? input.match_id ?? null, toolName: call.name, input, reasoning,
              executed: true,
              // list_pending_matches returns the whole world; log a digest, not a copy.
              outcome: call.name === 'list_pending_matches'
                ? { match_count: outcome.result.match_count }
                : outcome.result,
            })
            results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(outcome.result) })
          } else {
            await logDecision({
              matchId: outcome.matchId ?? input.match_id ?? null, toolName: call.name, input, reasoning,
              executed: false, blockedBy: outcome.block.blocked_by,
              outcome: { rejected: outcome.block.message },
            })
            // The rejection reason goes back to the agent so it can choose again.
            results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: outcome.block.message })
          }
        } catch (err: any) {
          await logDecision({
            matchId: input.match_id ?? null, toolName: call.name, input, reasoning,
            executed: false, blockedBy: 'tool_error', outcome: { error: err.message },
          })
          results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `Tool failed: ${err.message}` })
        }
      }

      messages.push({ role: 'user', content: results })

      if (budgetExhausted) {
        stopReason = 'tool_budget_exhausted'
        break
      }
    }

    const executed = decisions.filter(d => d.executed)
    return NextResponse.json({
      run_id: runId,
      stop_reason: stopReason,
      tool_calls: toolCalls,
      executed: executed.length,
      blocked: decisions.length - executed.length,
      by_tool: decisions.reduce((acc: any, d) => {
        acc[d.tool_name] = acc[d.tool_name] || { executed: 0, blocked: 0 }
        d.executed ? acc[d.tool_name].executed++ : acc[d.tool_name].blocked++
        return acc
      }, {}),
    })
  } catch (err: any) {
    console.error('ai-followup error:', err)
    return NextResponse.json({ error: 'Internal error', run_id: runId, detail: err.message }, { status: 500 })
  }
}
