import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    // Find matches where the caregiver hasn't responded in 48 hours (flat query).
    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select('id, created_at, request_id, caregiver_id')
      .is('caregiver_interested', null)
      .lt('created_at', fortyEightHoursAgo)
      .not('status', 'eq', 'declined')

    if (matchErr) {
      console.error('ai-followup match query error:', matchErr)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ followed_up: 0 })
    }

    let count = 0

    for (const match of matches) {
      // 1. Resolve caregiver user_id + name
      const { data: caregiverProfile } = await supabase
        .from('caregiver_profiles')
        .select('user_id, users ( full_name )')
        .eq('id', match.caregiver_id)
        .single()

      const caregiverUserId = caregiverProfile?.user_id
      const caregiverName =
        (caregiverProfile?.users as any)?.full_name?.split(' ')[0] || 'there'

      // 2. Resolve service request (service_type + family_id)
      const { data: serviceRequest } = await supabase
        .from('service_requests')
        .select('service_type, family_id')
        .eq('id', match.request_id)
        .single()

      const serviceType = serviceRequest?.service_type || 'caregiving'
      const familyId = serviceRequest?.family_id

      if (!caregiverUserId || !familyId) continue

      // 3. Resolve family's user_id
      const { data: familyProfile } = await supabase
        .from('family_profiles')
        .select('user_id')
        .eq('id', familyId)
        .single()

      const familyUserId = familyProfile?.user_id
      if (!familyUserId) continue

      // 4. Skip if we've already followed up for THIS match
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', caregiverUserId)
        .eq('type', 'message')
        .contains('data', { followupSentFor: match.id })
        .limit(1)

      if (existing && existing.length > 0) continue

      // 5. Generate the follow-up message via Anthropic (Claude)
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 150,
          system: `You are Ruah, a warm AI assistant for a caregiving platform. Write a brief, friendly follow-up message to a caregiver who hasn't responded to a family's inquiry in 48 hours. Keep it under 2 sentences. Be warm but not pushy. Sign off as "The Ruah Team".`,
          messages: [
            {
              role: 'user',
              content: `Write a follow-up to ${caregiverName} about a ${serviceType} position they were matched with.`
            }
          ]
        })
      })

      const aiData = await aiRes.json()
      const followUpContent = aiData.content?.[0]?.text
      if (!followUpContent) {
        console.error('ai-followup: no content from Anthropic', aiData.error?.message)
        continue
      }

      // 6. Send the follow-up as an AI message from the family to the caregiver
      await supabase.from('messages').insert({
        sender_id: familyUserId,
        receiver_id: caregiverUserId,
        content: followUpContent,
        is_ai: true,
      })

      // 7. Notify the caregiver — tag with matchId so we never double-send
      await supabase.from('notifications').insert({
        user_id: caregiverUserId,
        type: 'message',
        title: 'Following up on your match',
        body: followUpContent.slice(0, 100),
        data: { senderId: familyUserId, isAi: true, followupSentFor: match.id }
      })

      count++
    }

    return NextResponse.json({ followed_up: count })
  } catch (err) {
    console.error('ai-followup error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}