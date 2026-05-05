'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "Help me write a job post based on my needs",
  "What questions should I ask in a caregiver interview?",
  "How do I find the right babysitter for my infant?",
  "Compare full-time nanny vs au pair options",
]

function buildSystemPrompt(user: any, familyProfile: any) {
  const answers = familyProfile?.onboarding_answers
  let context = ''

  if (answers) {
    const parts: string[] = []
    if (answers.services?.length) parts.push(`Services needed: ${answers.services.join(', ')}`)
    if (answers.childcare_type) parts.push(`Childcare type: ${answers.childcare_type}`)
    if (answers.childcare_when) parts.push(`Start date: ${answers.childcare_when}`)
    if (answers.childcare_schedule) parts.push(`Schedule: ${answers.childcare_schedule}`)
    if (answers.childcare_kids) parts.push(`Number of children: ${answers.childcare_kids}`)
    if (answers.childcare_ages?.length) parts.push(`Children ages: ${answers.childcare_ages.join(', ')}`)
    if (answers.childcare_extras?.length) parts.push(`Extra needs: ${answers.childcare_extras.join(', ')}`)
    if (answers.childcare_budget) parts.push(`Childcare budget: ${answers.childcare_budget}/hr`)
    if (answers.chef_type) parts.push(`Chef service: ${answers.chef_type}`)
    if (answers.chef_cuisine) parts.push(`Cuisine preference: ${answers.chef_cuisine}`)
    if (answers.chef_budget) parts.push(`Chef budget: ${answers.chef_budget}/hr`)
    if (answers.house_type) parts.push(`Housekeeping type: ${answers.house_type}`)
    if (answers.house_size) parts.push(`Home size: ${answers.house_size}`)
    if (answers.house_frequency) parts.push(`Cleaning frequency: ${answers.house_frequency}`)
    if (answers.house_budget) parts.push(`Housekeeping budget: ${answers.house_budget}/session`)
    if (answers.elder_needs?.length) parts.push(`Elder care needs: ${answers.elder_needs.join(', ')}`)
    if (answers.elder_living) parts.push(`Elder care arrangement: ${answers.elder_living}`)
    if (answers.elder_budget) parts.push(`Elder care budget: ${answers.elder_budget}/hr`)
    if (answers.pet_type) parts.push(`Pet type: ${answers.pet_type}`)
    if (answers.pet_service) parts.push(`Pet service: ${answers.pet_service}`)
    if (answers.pet_budget) parts.push(`Pet care budget: ${answers.pet_budget}`)
    if (answers.tutor_needs?.length) parts.push(`Tutoring needs: ${answers.tutor_needs.join(', ')}`)
    if (answers.tutor_subject?.length) parts.push(`Subjects: ${answers.tutor_subject.join(', ')}`)
    if (answers.tutor_age) parts.push(`Child grade level: ${answers.tutor_age}`)
    if (answers.tutor_budget) parts.push(`Tutoring budget: ${answers.tutor_budget}/hr`)

    if (parts.length > 0) {
      context = `\n\nIMPORTANT - This family has already shared their needs during onboarding. Use this directly without asking again:\n${parts.join('\n')}\n\nDo NOT re-ask questions they've already answered. Be specific and personalized.`
    }
  }

  return `You are Ruah!, a warm AI assistant for a family care platform.
You help families find caregivers: nannies, chefs, housekeepers, elder care, pet care, tutors.
The user's name is ${user?.full_name || 'there'}.

RESPONSE STYLE:
- Keep replies SHORT and warm. Max 100 words unless writing a full document.
- Use simple formatting. Max 3-4 bullet points.
- Never list everything at once. Be conversational.
- If writing a job post, go ahead and write it fully.
- End with ONE short follow-up question max.
${context}`
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Ruah! 👋 I'm here to help you find the perfect care for your family. Ask me anything — I'm ready to help!"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single()
      const { data: profileData, error } = await supabase.from('family_profiles').select('*').eq('user_id', user.id).single()
      setUser(userData)
      setFamilyProfile(profileData)
      setProfileLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const userMessage = text || input.trim()
    if (!userMessage || loading || !profileLoaded) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    const systemPrompt = buildSystemPrompt(user, familyProfile)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.concat({ role: 'user', content: userMessage }).map(m => ({
            role: m.role,
            content: m.content
          })),
          systemPrompt
        })
      })

      const data = await response.json()
      const assistantMessage = data.content[0].text
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again! 🐻"
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/family/dashboard')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Ruah! AI Assistant</div>
            <div className="text-xs text-green-500">● Online</div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8 mr-2 flex-shrink-0 mt-1" />
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
              }`}
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)'
              } : {}}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mb-4 flex justify-start">
            <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8 mr-2 flex-shrink-0 mt-1" />
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {messages.length === 1 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-400 text-center mb-3">Quick questions to get started</p>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="w-full text-left text-sm bg-white border border-gray-100 rounded-2xl px-4 py-3 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition shadow-sm">
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask Ruah anything about finding care..."
            rows={1}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || !profileLoaded}
            className="text-white w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}