import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Detect if a message contains a question
function isQuestion(content: string): boolean {
  const questionWords = ['?', 'what', 'when', 'where', 'how', 'who', 'do you', 'can you', 'is it', 'are you', 'will you', 'would you', 'could you', 'does', 'did', 'have you']
  const lower = content.toLowerCase()
  return questionWords.some(w => lower.includes(w))
}

export async function POST(req: NextRequest) {
  try {
    const { messageContent, familyUserId, caregiverUserId } = await req.json()

    // Only auto-reply if message is a question
    if (!isQuestion(messageContent)) {
      return NextResponse.json({ replied: false })
    }

    // Get family profile with auto_replies
    const { data: familyProfile } = await supabase
      .from('family_profiles')
      .select('auto_replies')
      .eq('user_id', familyUserId)
      .single()

    const autoReplies = familyProfile?.auto_replies || {}

    // If no auto_replies set, don't reply
    const hasReplies = Object.values(autoReplies).some((v: any) => v && v.trim())
    if (!hasReplies) {
      return NextResponse.json({ replied: false })
    }

    // Build context from auto_replies
    const context = Object.entries(autoReplies)
      .filter(([_, v]) => v && (v as string).trim())
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join('\n')

    // Call OpenAI to generate reply
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: `You are a family's assistant on a caregiving platform. Answer the caregiver's question warmly and concisely using only the information provided. If the information doesn't answer their question, say "Great question! The family will get back to you on that." Do not make up information. Keep replies under 3 sentences.

Family's information:
${context}`
          },
          {
            role: 'user',
            content: messageContent
          }
        ]
      })
    })

    const aiData = await aiRes.json()
    const replyContent = aiData.choices?.[0]?.message?.content
    if (!replyContent) return NextResponse.json({ replied: false })

    // Insert AI reply as family user
    const { data: msg } = await supabase.from('messages').insert({
      sender_id: familyUserId,
      receiver_id: caregiverUserId,
      content: replyContent,
      is_ai: true,
    }).select().single()

    // Notify caregiver
    await supabase.from('notifications').insert({
      user_id: caregiverUserId,
      type: 'message',
      title: 'New message',
      body: replyContent.slice(0, 100),
      data: { senderId: familyUserId, isAi: true }
    })

    // Notify family that AI replied on their behalf
    await supabase.from('notifications').insert({
      user_id: familyUserId,
      type: 'ai_replied',
      title: '🤖 Ruah AI replied for you',
      body: `Caregiver asked: "${messageContent.slice(0, 60)}..." — AI replied automatically.`,
      data: { caregiverUserId, messageId: msg?.id }
    })

    return NextResponse.json({ replied: true, message: replyContent })
  } catch (err) {
    console.error('ai-autoreply error:', err)
    return NextResponse.json({ replied: false })
  }
}