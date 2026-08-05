import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, isPromptKey } from '@/lib/chat/prompts'

// Conversational assistant behind the family and caregiver chat UIs.
//
// This route used to take `systemPrompt` from the request body and forward it
// to Anthropic with no authentication — an open LLM proxy on the platform's
// API key. Two things changed:
//   1. the caller must have a session;
//   2. the caller names a prompt (`promptKey`); the server builds it from that
//      user's own profile. Instructions are no longer caller-supplied.

const MAX_MESSAGES = 40
const MAX_TOTAL_CHARS = 24_000
const MAX_TOKENS = 1000

// Per-user throttle. Process-local, so on serverless it is per-instance rather
// than global — it blunts a runaway client, it is not a real rate limiter.
// A durable one belongs in the database or an edge KV.
const RATE_LIMIT = { windowMs: 60_000, max: 20 }
const hits = new Map<string, number[]>()

function throttled(userId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(userId) || []).filter(t => now - t < RATE_LIMIT.windowMs)
  recent.push(now)
  hits.set(userId, recent)
  return recent.length > RATE_LIMIT.max
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null

  let total = 0
  const out: ChatMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null
    const { role, content } = m as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') return null
    if (typeof content !== 'string' || content.length === 0) return null
    total += content.length
    if (total > MAX_TOTAL_CHARS) return null
    out.push({ role, content })
  }
  return out
}

export async function POST(request: NextRequest) {
  // 1. Identity from the session cookie — never from the body.
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  if (throttled(user.id)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { promptKey, messages: rawMessages } = body as Record<string, unknown>

  if (!isPromptKey(promptKey)) {
    return NextResponse.json({ error: 'Unknown promptKey' }, { status: 400 })
  }

  const messages = parseMessages(rawMessages)
  if (!messages) {
    return NextResponse.json({ error: 'Invalid messages' }, { status: 400 })
  }

  // 2. The prompt is assembled here, from this user's own rows.
  const systemPrompt = await buildSystemPrompt(promptKey, supabase, user.id)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    console.error('chat: anthropic error', response.status, await response.text().catch(() => ''))
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 })
  }

  // Response shape is passed through unchanged — callers read content[0].text.
  return NextResponse.json(await response.json())
}
