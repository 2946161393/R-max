import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  checkCaregiverContactAllowed,
  CONTACT_WINDOW_DAYS,
  type Contact,
} from '@/lib/followup/guardrails'

// Family approves a Ruah-proposed match (status pending_family_approval).
// Approval flips the match into the normal pipeline; outreach to the caregiver
// happens IMMEDIATELY — but through the same contact guardrails the nightly
// agent obeys. If the caregiver is inside the cooldown/cap, the approval still
// lands and outreach defers to the agent, with the reason returned honestly.

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    // 1. Identity from the session — never from the body.
    const session = await createSessionClient()
    const { data: { user }, error: authErr } = await session.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { matchId } = await req.json()
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    // 2. Ownership + state. The match's request must belong to THIS family.
    const { data: fam } = await admin
      .from('family_profiles').select('id').eq('user_id', user.id).single()
    if (!fam) return NextResponse.json({ error: 'No family profile' }, { status: 403 })

    const { data: match } = await admin
      .from('matches')
      .select('id, status, caregiver_id, request_id, service_requests!inner(family_id, service_type, title)')
      .eq('id', matchId)
      .single()
    const request = (match as any)?.service_requests
    if (!match || request?.family_id !== fam.id) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    if (match.status !== 'pending_family_approval') {
      return NextResponse.json({ error: `Match is ${match.status}, not awaiting approval` }, { status: 409 })
    }

    // 3. Approve: the match enters the normal pipeline.
    const { error: updErr } = await admin
      .from('matches')
      .update({ family_interested: true, status: 'pending' })
      .eq('id', matchId)
    if (updErr) throw new Error(`approve update failed: ${updErr.message}`)

    // 4. Resolve the caregiver's user + name (profile→user keyspace hop).
    const { data: cg } = await admin
      .from('caregiver_profiles')
      .select('user_id, users(full_name)')
      .eq('id', match.caregiver_id)
      .single()
    const caregiverUserId = cg?.user_id
    const caregiverName = ((cg as any)?.users?.full_name || 'there').split(' ')[0]
    if (!caregiverUserId) {
      return NextResponse.json({ approved: true, outreach: 'deferred', reason: 'Caregiver account not resolvable; the agent will handle it.' })
    }

    // 5. Contact guardrails — same ledger the agent uses: platform-initiated
    // messages to this caregiver in the window, across ALL her matches.
    const windowStart = new Date(Date.now() - CONTACT_WINDOW_DAYS * 86400_000).toISOString()
    const { data: contactRows } = await admin
      .from('messages')
      .select('match_id, sender_type, is_ai, created_at')
      .eq('receiver_id', caregiverUserId)
      .gte('created_at', windowStart)
    const ledger: Contact[] = (contactRows || [])
      .filter(m => m.sender_type === 'ruah' || m.is_ai === true)
      .map(m => ({ at: m.created_at, match_id: m.match_id }))

    const block = checkCaregiverContactAllowed(ledger)
    if (block) {
      // Approved, but not contacted now — the nightly agent picks it up once
      // the caregiver is contactable. Honest reason goes back to the family UI.
      return NextResponse.json({
        approved: true,
        outreach: 'deferred',
        blocked_by: block.blocked_by,
        reason: 'This caregiver was contacted very recently, so Ruah is spacing things out. Your approval is saved and outreach happens as soon as she is contactable.',
      })
    }

    // 6. Compose and send the outreach as Ruah.
    const { data: familyUser } = await admin.from('users').select('full_name').eq('id', user.id).single()
    const familyName = familyUser?.full_name || 'a family'

    let content: string | null = null
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: 300,
        system:
          'You are Ruah, the coordinator of a caregiving platform, writing to a caregiver on a family\'s behalf. ' +
          'Warm, professional, under 70 words. Introduce the family\'s need and ask if she is available and interested. ' +
          'Do not promise any future follow-up or deadline. Sign off as "The Ruah Team".',
        messages: [{
          role: 'user',
          content: `Write the outreach to ${caregiverName} for family "${familyName}". The request: ${request.service_type}${request.title ? ` — ${request.title}` : ''}. The family has just approved this introduction.`,
        }],
      })
      const first = msg.content.find((b: any) => b.type === 'text') as any
      content = first?.text?.trim() || null
    } catch (e: any) {
      console.error('approve-proposal: outreach generation failed', e?.message)
    }
    if (!content) {
      content = `Hi ${caregiverName} — ${familyName} would love to connect about their ${request.service_type} request. Are you available and interested? A short reply either way is perfect. — The Ruah Team`
    }

    const { error: msgErr } = await admin.from('messages').insert({
      match_id: matchId,
      sender_id: user.id,
      receiver_id: caregiverUserId,
      content,
      is_ai: true,
      sender_type: 'ruah',
    })
    if (msgErr) throw new Error(`outreach insert failed: ${msgErr.message}`)

    // 48h acceptance window — same convention as the admin/contact flows.
    await admin.from('matches')
      .update({ expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() })
      .eq('id', matchId)

    await admin.from('notifications').insert([
      {
        user_id: caregiverUserId,
        type: 'new_match',
        title: 'A family wants to meet you',
        body: content.slice(0, 100),
        data: { matchId, aiMatch: true, familyUserId: user.id, familyName, requestId: match.request_id, followupSentFor: matchId },
      },
      {
        user_id: user.id,
        type: 'message',
        title: `Ruah reached out to ${caregiverName}`,
        body: `Your approval went through and ${caregiverName} has been contacted. You can read the message in your conversation thread.`,
        data: { matchId, isAi: true, senderId: caregiverUserId },
      },
    ])

    return NextResponse.json({ approved: true, outreach: 'sent', caregiver: caregiverName })
  } catch (err: any) {
    console.error('approve-proposal error:', err)
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 })
  }
}
