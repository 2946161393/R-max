import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { caregiverUserId, familyUserId, familyNeeds, caregiverName, familyName } = await request.json()
  const supabase = await createClient()

  // 1. 用 AI 生成给 caregiver 的消息
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
      system: `You are Ruah!, an AI assistant that sends warm, professional messages to caregivers on behalf of families. Write a short, friendly outreach message (under 80 words). Be warm and specific about the family's needs.`,
      messages: [{
        role: 'user',
        content: `Write a message from Ruah to caregiver ${caregiverName} on behalf of family ${familyName}. Family needs: ${familyNeeds}. The message should introduce the family's needs and ask if the caregiver is available and interested.`
      }]
    })
  })

  const aiData = await aiResponse.json()
  const message = aiData.content[0].text

  // 2. 创建 match 记录
  const { data: familyProfile } = await supabase
    .from('family_profiles')
    .select('id')
    .eq('user_id', familyUserId)
    .single()

  const { data: caregiverProfile } = await supabase
    .from('caregiver_profiles')
    .select('id')
    .eq('user_id', caregiverUserId)
    .single()

  if (familyProfile && caregiverProfile) {
    // 先建一个 service_request
    const { data: request_data } = await supabase
      .from('service_requests')
      .insert({
        family_id: familyProfile.id,
        service_type: 'childcare',
        status: 'open',
        ai_job_post: familyNeeds
      })
      .select()
      .single()

    if (request_data) {
      await supabase.from('matches').insert({
        request_id: request_data.id,
        caregiver_id: caregiverProfile.id,
        ai_reasoning: message,
        status: 'pending'
      })
    }
  }

  // 3. 给 caregiver 发通知
  await supabase.from('notifications').insert({
    user_id: caregiverUserId,
    type: 'new_match',
    title: `${familyName} is interested in you! 🎉`,
    body: message,
    data: { familyUserId, familyName, familyNeeds }
  })

  return NextResponse.json({ success: true, message })
}