import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { caregiverUserId, familyUserId, familyNeeds, caregiverName, familyName } = await request.json()
  const supabase = await createClient()

  // 1. AI 生成消息
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

  // 2. 获取 family profile 和 caregiver profile
  const { data: familyProfile } = await supabase
    .from('family_profiles')
    .select('id, onboarding_answers')
    .eq('user_id', familyUserId)
    .single()

  const { data: caregiverProfile } = await supabase
    .from('caregiver_profiles')
    .select('id')
    .eq('user_id', caregiverUserId)
    .single()

  if (!familyProfile || !caregiverProfile) {
    return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 400 })
  }

  // 3. 创建 service_request — carry the family's structured onboarding data
  // onto the request so the caregiver-side request card has real fields to
  // show, not prose alone.
  const answers = (familyProfile as any).onboarding_answers || {}
  const budgetMatch = String(answers.childcare_budget || '').match(/(\d+)\D+(\d+)/)
  const { data: requestData } = await supabase
    .from('service_requests')
    .insert({
      family_id: familyProfile.id,
      service_type: answers.services?.[0] || 'childcare',
      status: 'open',
      ai_job_post: familyNeeds,
      languages: answers.languages?.length ? answers.languages : null,
      pay_min: budgetMatch ? parseInt(budgetMatch[1], 10) : null,
      pay_max: budgetMatch ? parseInt(budgetMatch[2], 10) : null,
      extra_details: familyNeeds || null,
    })
    .select()
    .single()

  if (!requestData) {
    return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 })
  }

  // 4. 创建 match — 跟 admin match 完全一样的结构
  const { data: matchData } = await supabase
    .from('matches')
    .insert({
      request_id: requestData.id,
      caregiver_id: caregiverProfile.id,
      ai_reasoning: message,
      status: 'admin_matched',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      family_interested: true,  // Family 已经通过 AI 表示感兴趣
      caregiver_interested: null,  // 等待 caregiver 响应
    })
    .select()
    .single()

  const matchId = matchData?.id

  // 4b. 把 outreach 写成真正的消息 — thread 里可见,family 能看到 Ruah
  // 替他们说了什么 (visibility principle)。sender 是 family 的 user id,
  // sender_type='ruah' 让 UI 以 Ruah 的身份渲染。
  if (matchId) {
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: familyUserId,
      receiver_id: caregiverUserId,
      content: message,
      is_ai: true,
      sender_type: 'ruah',
    })
  }

  // 5. 给 caregiver 发通知 — 跟 admin match 完全一样
  await supabase.from('notifications').insert({
    user_id: caregiverUserId,
    type: 'new_match',
    title: `A family wants to meet you! 🎯`,
    body: message,
    data: {
      matchId,
      adminMatch: false,
      aiMatch: true,
      familyUserId,
      familyName,
      requestId: requestData.id,
    }
  })

  // 6. 给 family 发确认通知
  await supabase.from('notifications').insert({
    user_id: familyUserId,
    type: 'new_match',
    title: `We reached out to ${caregiverName} for you! 🎯`,
    body: `Ruah sent your request to ${caregiverName}. You'll be notified when they respond!`,
    data: {
      matchId,
      aiMatch: true,
      caregiverUserId,
      caregiverName,
      requestId: requestData.id,
    }
  })

  return NextResponse.json({ success: true, message, matchId })
}