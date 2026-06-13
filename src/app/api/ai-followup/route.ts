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

    // Find matches where caregiver hasn't responded in 48 hours
    const { data: matches } = await supabase
      .from('matches')
      .select(`
        id,
        created_at,
        caregiver_profiles (
          user_id,
          services,
          users ( full_name )
        ),
        service_requests (
          service_type,
          family_id,
          family_profiles ( user_id )
        )
      `)
      .is('caregiver_interested', null)
      .lt('created_at', fortyEightHoursAgo)
      .not('status', 'eq', 'declined')

    if (!matches || matches.length === 0) {
      return NextResponse.json({ followed_up: 0 })
    }

    let count = 0

    for (const match of matches) {
      const caregiverUserId = (match.caregiver_profiles as any)?.user_id
      const caregiverName = (match.caregiver_profiles as any)?.users?.full_name?.split(' ')[0] || 'there'
      const serviceType = (match.service_requests as any)?.service_type || 'caregiving'
      const familyUserId = (match.service_requests as any)?.family_profiles?.user_id

      if (!caregiverUserId || !familyUserId) continue

      // Check if we already sent a follow-up for this match
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', caregiverUserId)
        .eq('is_ai', true)
        .like('content', '%following up%')
        .limit(1)

      if (existing && existing.length > 0) continue

      // Generate follow-up message
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 150,
          messages: [
            {
              role: 'system',
              content: `You are Ruah, a warm AI assistant for a caregiving platform. Write a brief, friendly follow-up message to a caregiver who hasn't responded to a family's inquiry in 48 hours. Keep it under 2 sentences. Be warm but not pushy. Sign off as "The Ruah Team".`
            },
            {
              role: 'user',
              content: `Write a follow-up to ${caregiverName} about a ${serviceType} position they were matched with.`
            }
          ]
        })
      })

      const aiData = await aiRes.json()
      const followUpContent = aiData.choices?.[0]?.message?.content
      if (!followUpContent) continue

      // Send follow-up as a system message from family to caregiver
      await supabase.from('messages').insert({
        sender_id: familyUserId,
        receiver_id: caregiverUserId,
        content: followUpContent,
        is_ai: true,
      })

      // Notify caregiver
      await supabase.from('notifications').insert({
        user_id: caregiverUserId,
        type: 'message',
        title: 'Following up on your match',
        body: followUpContent.slice(0, 100),
        data: { senderId: familyUserId, isAi: true }
      })

      count++
    }

    return NextResponse.json({ followed_up: count })
  } catch (err) {
    console.error('ai-followup error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}