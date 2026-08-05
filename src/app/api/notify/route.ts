import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { ADMIN_EMAILS, isAdminEmail } from '@/lib/admin/emails'

// Cross-user notifications.
//
// `notifications` is now RLS-scoped to `user_id = auth.uid()`: from the
// browser you may only write a notification addressed to yourself. But the
// product is full of legitimate cross-user notices — a caregiver passing on a
// match tells the family, a family declining an application tells the
// caregiver. Those come through here.
//
// The rule this route enforces, which the old client-side inserts could not:
// you may notify someone you actually share a match with. Not anyone, and not
// with a payload that claims to be from somebody else — the sender's identity
// is stamped server-side from the session.

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Types the UI is allowed to send. Anything else is rejected rather than
// forwarded — a notification type drives rendering and Ruah narration.
const ALLOWED_TYPES = new Set([
  'message',
  'new_match',
  'mutual_match',
  'match_declined',
  'match_closed',
  'application_declined',
  'admin_escalation',
])

const MAX_TITLE = 200
const MAX_BODY = 500

type Payload = {
  recipientUserId?: unknown
  audience?: unknown
  type?: unknown
  title?: unknown
  body?: unknown
  data?: unknown
}

/** Do these two users share a match? Either direction, any status. */
async function sharesMatch(userA: string, userB: string): Promise<boolean> {
  // Resolve both sides in both roles — we do not know which is the family.
  const [{ data: famA }, { data: cgA }, { data: famB }, { data: cgB }] = await Promise.all([
    admin.from('family_profiles').select('id').eq('user_id', userA).maybeSingle(),
    admin.from('caregiver_profiles').select('id').eq('user_id', userA).maybeSingle(),
    admin.from('family_profiles').select('id').eq('user_id', userB).maybeSingle(),
    admin.from('caregiver_profiles').select('id').eq('user_id', userB).maybeSingle(),
  ])

  const pairs: Array<{ familyId: string; caregiverId: string }> = []
  if (famA?.id && cgB?.id) pairs.push({ familyId: famA.id, caregiverId: cgB.id })
  if (famB?.id && cgA?.id) pairs.push({ familyId: famB.id, caregiverId: cgA.id })
  if (pairs.length === 0) return false

  for (const { familyId, caregiverId } of pairs) {
    const { data } = await admin
      .from('matches')
      .select('id, service_requests!inner(family_id)')
      .eq('caregiver_id', caregiverId)
      .eq('service_requests.family_id', familyId)
      .limit(1)
    if (data && data.length > 0) return true
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const session = await createSessionClient()
    const { data: { user }, error: authErr } = await session.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as Payload | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { audience, recipientUserId, type, title, data } = body
    const text = body.body

    if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
    }
    if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
    }
    if (text !== undefined && text !== null && (typeof text !== 'string' || text.length > MAX_BODY)) {
      return NextResponse.json({ error: 'Invalid body text' }, { status: 400 })
    }

    // --- Audience: the admin bench -------------------------------------
    // Matching-layer escalations. Any authenticated user may raise one (the
    // caregiver dashboard does, on a service mismatch), but the recipient
    // list is resolved here from the allowlist — the client never learns
    // admin user ids, and never got to read the users table to find them.
    if (audience === 'admins') {
      if (type !== 'admin_escalation') {
        return NextResponse.json({ error: 'Only escalations may target admins' }, { status: 403 })
      }
      const { data: admins } = await admin.from('users').select('id').in('email', ADMIN_EMAILS)
      if (!admins?.length) return NextResponse.json({ sent: 0 })

      const { error } = await admin.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          type,
          title,
          body: text ?? null,
          data: { ...(data && typeof data === 'object' ? data : {}), raisedBy: user.id },
        }))
      )
      if (error) throw error
      return NextResponse.json({ sent: admins.length })
    }

    // --- Audience: one specific user -----------------------------------
    if (typeof recipientUserId !== 'string' || !recipientUserId) {
      return NextResponse.json({ error: 'recipientUserId required' }, { status: 400 })
    }
    if (recipientUserId === user.id) {
      // Self-notifications do not need this route — RLS already allows them.
      return NextResponse.json({ error: 'Use a direct insert for yourself' }, { status: 400 })
    }

    const callerIsAdmin = isAdminEmail(user.email)
    if (!callerIsAdmin && !(await sharesMatch(user.id, recipientUserId))) {
      return NextResponse.json(
        { error: 'You can only notify someone you share a match with' },
        { status: 403 }
      )
    }

    const { error } = await admin.from('notifications').insert({
      user_id: recipientUserId,
      type,
      title,
      body: text ?? null,
      // senderId is stamped from the session, overriding anything the client
      // put in `data` — a notification must not be able to claim a false author.
      data: { ...(data && typeof data === 'object' ? data : {}), senderId: user.id },
    })
    if (error) throw error

    return NextResponse.json({ sent: 1 })
  } catch (err) {
    console.error('notify error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
