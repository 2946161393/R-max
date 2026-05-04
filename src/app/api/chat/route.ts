import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { messages, userName } = await request.json()

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: `You are Ruah!, a warm and helpful AI assistant for a family care platform called Ruah. 
You help families find the right caregivers — including nannies, babysitters, private chefs, housekeepers, elder care, pet care, and tutors.
You speak in a friendly, warm, and reassuring tone. You are concise but thorough.
The user's name is ${userName || 'there'}.`,
      messages,
    }),
  })

  const data = await response.json()
  return NextResponse.json(data)
}