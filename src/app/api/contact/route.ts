import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import {
  checkCaregiverContactAllowed,
  CONTACT_WINDOW_DAYS,
  type Contact,
} from '@/lib/followup/guardrails'

// A family asks Ruah to reach out to a caregiver, from the family chat.
//
// Rewritten on the /api/approve-proposal pattern. What changed:
//   * It had NO authentication. `familyUserId` came from the request body, so
//     anyone could forge outreach as any family — and burn Anthropic tokens
//     doing it, since generation happened before any validation.
//   * It bypassed the contact guardrails entirely. Every other platform-
//     initiated message to a caregiver honors the 24h cooldown and the
//     3-per-7-days cap; this path did not, so repeated clicks could spam a
//     caregiver across all her matches.
//
// Now: identity from the session, the family's needs read from their own
// profile, guardrails checked before a single token is spent.

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Answers = Record<string, unknown>

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function list(v: unknown): string[] | null {
  return Array.isArray(v) && v.length ? v.map(String) : null
}

/** The family's needs, summarised from THEIR OWN onboarding answers. */
function summariseNeeds(answers: Answers): string {
  const services = list(answers.services)
  const ages = list(answers.childcare_ages)
  const extras = list(answers.childcare_extras)
  return [
    services ? `Services: ${services.join(', ')}` : '',
    str(answers.childcare_schedule) ? `Schedule: ${str(answers.childcare_schedule)}` : '',
    str(answers.childcare_budget) ? `Budget: ${str(answers.childcare_budget)}/hr` : '',
    extras?.includes('bilingual') ? 'Bilingual caregiver preferred' : '',
    ages ? `Children ages: ${ages.join(', ')}` : '',
  ].filter(Boolean).join(', ')
}

export async function POST(request: NextRequest) {
  try {
    // 1. Identity from the session — never from the body.
    const session = await createSessionClient()
    const { data: { user }, error: authErr } = await session.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const caregiverUserId = body && typeof body === 'object'
      ? (body as Record<string, unknown>).caregiverUserId
      : null
    if (typeof caregiverUserId !== 'string' || !caregiverUserId) {
      return NextResponse.json({ success: false, error: 'caregiverUserId required' }, { status: 400 })
    }

    // 2. The caller must be a family, and we use THEIR profile — not a
    //    familyUserId handed to us.
    const { data: familyProfile } = await admin
      .from('family_profiles')
      .select('id, onboarding_answers')
      .eq('user_id', user.id)
      .single()
    if (!familyProfile) {
      return NextResponse.json({ success: false, error: 'No family profile' }, { status: 403 })
    }

    const { data: caregiverProfile } = await admin
      .from('caregiver_profiles')
      .select('id, user_id')
      .eq('user_id', caregiverUserId)
      .single()
    if (!caregiverProfile) {
      return NextResponse.json({ success: false, error: 'Caregiver not found' }, { status: 404 })
    }

    // 3. Names come from the database, not from the caller.
    const { data: people } = await admin
      .from('users')
      .select('id, full_name, is_banned, is_shadow_banned')
      .in('id', [user.id, caregiverUserId])
    const familyUser = people?.find(p => p.id === user.id)
    const caregiverUser = people?.find(p => p.id === caregiverUserId)
    if (!caregiverUser || caregiverUser.is_banned || caregiverUser.is_shadow_banned) {
      return NextResponse.json({ success: false, error: 'Caregiver not available' }, { status: 404 })
    }
    const familyName = familyUser?.full_name || 'a family'
    const caregiverName = caregiverUser.full_name || 'there'

    // 4. Contact guardrails BEFORE generation — the same ledger the nightly
    //    agent and /api/approve-proposal use: platform-initiated messages to
    //    this caregiver in the window, across ALL her matches.
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
      return NextResponse.json({
        success: false,
        blocked_by: block.blocked_by,
        error: `Ruah has contacted ${caregiverName} very recently and is spacing things out. Try again once she has had a chance to reply.`,
      }, { status: 429 })
    }

    const answers = (familyProfile.onboarding_answers as Answers | null) || {}
    const familyNeeds = summariseNeeds(answers)

    // 5. Compose the outreach.
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        system:
          'You are Ruah, an AI coordinator that sends warm, professional messages to caregivers on behalf of families. ' +
          'Write a short, friendly outreach message (under 80 words). Be warm and specific about the family\'s needs. ' +
          'Do not promise any future follow-up or deadline. Sign off as "The Ruah Team".',
        messages: [{
          role: 'user',
          content: `Write a message to caregiver ${caregiverName} on behalf of family ${familyName}. Family needs: ${familyNeeds}. Introduce the family's needs and ask if the caregiver is available and interested.`,
        }],
      }),
    })

    let message: string | null = null
    if (aiResponse.ok) {
      const aiData = await aiResponse.json()
      message = aiData?.content?.find((b: { type?: string }) => b.type === 'text')?.text?.trim() || null
    } else {
      console.error('contact: anthropic error', aiResponse.status)
    }
    if (!message) {
      message = `Hi ${caregiverName} — ${familyName} would love to connect about their care needs${familyNeeds ? ` (${familyNeeds})` : ''}. Are you available and interested? A short reply either way is perfect. — The Ruah Team`
    }

    // 6. Create the request, the match, the visible message, the notifications.
    const budgetMatch = String(str(answers.childcare_budget) || '').match(/(\d+)\D+(\d+)/)
    const { data: requestData } = await admin
      .from('service_requests')
      .insert({
        family_id: familyProfile.id,
        service_type: list(answers.services)?.[0] || 'childcare',
        status: 'open',
        ai_job_post: familyNeeds,
        languages: list(answers.languages),
        pay_min: budgetMatch ? parseInt(budgetMatch[1], 10) : null,
        pay_max: budgetMatch ? parseInt(budgetMatch[2], 10) : null,
        extra_details: familyNeeds || null,
      })
      .select()
      .single()

    if (!requestData) {
      return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 })
    }

    const { data: matchData } = await admin
      .from('matches')
      .insert({
        request_id: requestData.id,
        caregiver_id: caregiverProfile.id,
        ai_reasoning: message,
        status: 'admin_matched',
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        family_interested: true,
        caregiver_interested: null,
      })
      .select()
      .single()

    const matchId = matchData?.id
    if (!matchId) {
      return NextResponse.json({ success: false, error: 'Failed to create match' }, { status: 500 })
    }

    // The outreach as a real message — the family can see what Ruah said on
    // their behalf (visibility principle). Sender is the FAMILY's user id with
    // sender_type='ruah', so the UI renders it as Ruah.
    await admin.from('messages').insert({
      match_id: matchId,
      sender_id: user.id,
      receiver_id: caregiverUserId,
      content: message,
      is_ai: true,
      sender_type: 'ruah',
    })

    await admin.from('notifications').insert([
      {
        user_id: caregiverUserId,
        type: 'new_match',
        title: 'A family wants to meet you! 🎯',
        body: message.slice(0, 100),
        data: { matchId, adminMatch: false, aiMatch: true, familyUserId: user.id, familyName, requestId: requestData.id },
      },
      {
        user_id: user.id,
        type: 'new_match',
        title: `We reached out to ${caregiverName} for you! 🎯`,
        body: `Ruah sent your request to ${caregiverName}. You'll be notified when they respond!`,
        data: { matchId, aiMatch: true, caregiverUserId, caregiverName, requestId: requestData.id },
      },
    ])

    return NextResponse.json({ success: true, message, matchId })
  } catch (err) {
    console.error('contact error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
