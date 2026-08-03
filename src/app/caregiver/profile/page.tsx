'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

type Message = { role: 'user' | 'assistant'; content: string }

export default function CaregiverProfile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! 👋 I'm Ruah! Tell me about yourself in any language — I'll write a professional English bio for you!\n\nFor example: \"我是有3年经验的保姆，会说中文和英文，擅长照顾婴儿\"" }
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [zipcode, setZipcode] = useState('')
  const [zipcodeInfo, setZipcodeInfo] = useState<{ city: string; state: string } | null>(null)
  const [zipcodeLoading, setZipcodeLoading] = useState(false)
  const [zipcodeError, setZipcodeError] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [savedLocation, setSavedLocation] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single()
      const { data: profileData } = await supabase.from('caregiver_profiles').select('*').eq('user_id', user.id).single()
      setUser(userData)
      setProfile(profileData)
      setBio(profileData?.bio || '')
      setAvatarUrl(userData?.avatar_url || null)
      setZipcode(userData?.zipcode || '')
      if (userData?.city && userData?.state) {
        setZipcodeInfo({ city: userData.city, state: userData.state })
      }
      setLoading(false)
    }
    load()
    const timer = setTimeout(() => setShowTooltip(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const lookupZipcode = async (zip: string) => {
    if (zip.length !== 5) { setZipcodeInfo(null); setZipcodeError(''); return }
    setZipcodeLoading(true)
    setZipcodeError('')
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
      if (!res.ok) { setZipcodeError('Invalid ZIP code'); setZipcodeInfo(null) }
      else {
        const data = await res.json()
        const place = data.places?.[0]
        if (place) setZipcodeInfo({ city: place['place name'], state: place['state abbreviation'] })
      }
    } catch { setZipcodeError('Could not verify') }
    finally { setZipcodeLoading(false) }
  }

  const handleZipcodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 5)
    setZipcode(cleaned)
    lookupZipcode(cleaned)
  }

  const saveLocation = async () => {
    if (!zipcodeInfo) return
    setSavingLocation(true)
    await supabase.from('users').update({
      zipcode,
      city: zipcodeInfo.city,
      state: zipcodeInfo.state,
    }).eq('id', user.id)
    setSavingLocation(false)
    setSavedLocation(true)
    setTimeout(() => setSavedLocation(false), 2000)
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id)
      setAvatarUrl(data.publicUrl)
    }
    setUploadingAvatar(false)
  }

  const removeAvatar = async () => {
    await supabase.from('users').update({ avatar_url: null }).eq('id', user.id)
    setAvatarUrl(null)
  }

  const saveBio = async () => {
    setSaving(true)
    await supabase.from('caregiver_profiles').update({ bio }).eq('user_id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sendMessage = async (text?: string) => {
    const userMessage = text || input.trim()
    if (!userMessage || chatLoading) return
    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(newMessages)
    setChatLoading(true)
    const answers = profile?.onboarding_answers || {}
    const systemPrompt = `You are Ruah!, a warm AI assistant helping caregivers write professional bios.
The caregiver's name is ${user?.full_name}.
Their info: services: ${profile?.services?.join(', ')}, languages: ${profile?.languages?.join(', ')}, experience: ${EXPERIENCE_LABELS[String(profile?.years_experience)] || profile?.years_experience + ' years'}, rate: $${profile?.hourly_rate_min}–$${profile?.hourly_rate_max}/hr, availability: ${answers.availability}, live-in: ${answers.living}.

Your job:
1. When the caregiver describes themselves (in ANY language including Chinese), write a warm professional English bio for them.
2. After writing the bio, end with exactly this line on its own: **[Use this bio]**
3. Keep bios under 100 words — warm, specific, and trustworthy.
4. Write ONLY the English bio — no Chinese text, no intro sentences like "Here is your bio:", no "---" separators.
5. Start directly with "Hi, I'm [name]!" or similar.`
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt
        })
      })
      const data = await response.json()
      const reply = data.content[0].text
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, something went wrong. Please try again! 🐻" }])
    } finally {
      setChatLoading(false)
    }
  }

  const applyBio = (content: string) => {
    const lines = content.split('\n')
    const bioLines: string[] = []
    let started = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (!started && (
        /[\u4e00-\u9fff]/.test(trimmed) ||
        trimmed === '---' ||
        trimmed === '' ||
        trimmed.startsWith('**[Use this bio]')
      )) continue
      if (!started && trimmed.length > 0) started = true
      if (trimmed.includes('[Use this bio]')) break
      if (started) bioLines.push(line)
    }
    const bioText = bioLines.join('\n').trim()
    setBio(bioText)
    setChatOpen(false)
    setTimeout(async () => {
      await supabase.from('caregiver_profiles').update({ bio: bioText }).eq('user_id', user.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 300)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const answers = profile?.onboarding_answers || {}

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/caregiver/dashboard')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="w-12" />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 pb-32">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {/* Avatar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 flex items-center gap-4">
          <div className="relative flex-shrink-0 group">
            <label className="cursor-pointer block">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] flex items-center justify-center text-3xl font-bold text-[#7FB3FF]">
                  {user?.full_name?.[0] || '?'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span className="text-white text-xl">📷</span>
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#7FB3FF] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </label>
          </div>
          <div>
            <div className="font-semibold text-gray-900 mb-1">{user?.full_name}</div>
            <label className="cursor-pointer text-sm text-[#7FB3FF] hover:underline block mb-1">
              {avatarUrl ? 'Change photo' : '+ Upload photo'}
              <input type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
            </label>
            {avatarUrl && (
              <button onClick={removeAvatar} className="text-xs text-red-400 hover:text-red-600 block mb-1">
                Remove photo
              </button>
            )}
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG · Max 5MB</p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Basic Info</h2>
          <div className="space-y-3">
            {[
              { label: 'Name', value: user?.full_name },
              { label: 'Email', value: user?.email },
              { label: 'Services', value: profile?.services?.join(', ') },
              { label: 'Languages', value: profile?.languages?.join(', ') },
              { label: 'Experience', value: EXPERIENCE_LABELS[String(profile?.years_experience)] || `${profile?.years_experience} years` },
              { label: 'Hourly Rate', value: profile?.hourly_rate_min ? `$${profile.hourly_rate_min}${profile.hourly_rate_max ? `–$${profile.hourly_rate_max}` : '+'}/hr` : '—' },
              { label: 'Availability', value: answers.availability },
              { label: 'Live-in', value: answers.living },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.label}</span>
                <span className="text-gray-900 font-medium">{item.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Location */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">📍 Location</span>
              {zipcodeInfo && (
                <span className="text-xs text-gray-400">{zipcodeInfo.city}, {zipcodeInfo.state}</span>
              )}
            </div>
            {!zipcode && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-2">
                ⚠️ Add your ZIP code so families near you can find you
              </p>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={zipcode}
                  onChange={e => handleZipcodeChange(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] ${
                    zipcodeError ? 'border-red-300' : zipcodeInfo ? 'border-green-300' : 'border-gray-200'
                  }`}
                  placeholder="ZIP code (e.g. 10001)"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                  {zipcodeLoading && <span className="text-gray-400">...</span>}
                  {!zipcodeLoading && zipcodeInfo && <span className="text-green-500">✓</span>}
                  {!zipcodeLoading && zipcodeError && <span className="text-red-400">✕</span>}
                </div>
              </div>
              <button
                onClick={saveLocation}
                disabled={!zipcodeInfo || savingLocation || zipcodeLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
              >
                {savedLocation ? '✓ Saved' : savingLocation ? '...' : 'Save'}
              </button>
            </div>
            {zipcodeError && <p className="text-xs text-red-400 mt-1">{zipcodeError}</p>}
          </div>
        </div>

        {/* Availability — NEW */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Availability</h2>
              <p className="text-xs text-gray-400">
                {profile?.availability_schedule
                  ? `${Object.keys(profile.availability_schedule).length} days set`
                  : "Not set yet — families can't see your schedule"}
              </p>
            </div>
            <button
              onClick={() => router.push('/caregiver/availability')}
              className="text-sm text-[#7FB3FF] hover:underline font-medium"
            >
              {profile?.availability_schedule ? 'Edit' : 'Set up →'}
            </button>
          </div>
          {profile?.availability_schedule && (
            <div className="mt-3 space-y-1 pt-3 border-t border-gray-100">
              {Object.entries(profile.availability_schedule).map(([day, times]: [string, any]) => (
                <div key={day} className="flex justify-between text-xs text-gray-500">
                  <span className="capitalize">{day}</span>
                  <span>{times.start} – {times.end}</span>
                </div>
              ))}
              {profile?.overnight_ok && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-purple-500">🌙 Open to overnight</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Bio</h2>
            <button onClick={() => setChatOpen(true)}
              className="text-xs text-[#7FB3FF] hover:underline flex items-center gap-1">
              <img src="/ruah-logo.png" className="w-4 h-4" />
              Write with Ruah!
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">Tell families about yourself</p>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none mb-3"
            placeholder="Hi! I'm an experienced caregiver who loves working with children..."
          />
          <button onClick={saveBio} disabled={saving}
            className="w-full text-white py-3 rounded-xl text-sm font-medium transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Bio'}
          </button>
        </div>

        {/* Identity verification. This is the only check Ruah runs — there is
            no background check product, so nothing here may imply one. */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Identity verification</h2>
              <p className="text-xs text-gray-400">Required before you can apply to requests</p>
            </div>
            <span className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium ${
              profile?.is_verified
                ? 'bg-green-100 text-green-600'
                : profile?.verification_status === 'pending'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
            }`}>
              {profile?.is_verified
                ? '✓ Verified'
                : profile?.verification_status === 'pending'
                  ? 'Under review'
                  : profile?.verification_status === 'rejected'
                    ? 'Needs another look'
                    : 'Not started'}
            </span>
          </div>
          {!profile?.is_verified && profile?.verification_status !== 'pending' && (
            <div className="mt-4">
              <div className="bg-[#EAF4FF] rounded-xl p-4 mb-4">
                <div className="text-sm font-medium text-[#4A90D9] mb-2">What this involves</div>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>✓ Upload a government ID and a selfie — that is all we ask for</li>
                  <li>✓ Someone on our team checks them by hand</li>
                  <li>✓ Families never see your documents, only the badge</li>
                  <li>✓ Families can filter their search to verified caregivers only</li>
                </ul>
              </div>
              <button onClick={() => router.push('/caregiver/verify')}
                className="w-full border-2 border-[#7FB3FF] text-[#7FB3FF] py-3 rounded-xl text-sm font-medium hover:bg-blue-50 transition">
                {profile?.verification_status === 'rejected' ? 'Re-submit your documents' : 'Start verification'}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Ruah does not run background checks.{' '}
                <Link href="/trust" className="text-[#4A90D9] hover:underline">What we check →</Link>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating AI Button */}
      {!chatOpen && (
        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
          {showTooltip && (
            <div className="relative bg-gray-900 text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-40 text-center animate-bounce-slow">
              ✨ Let me write your bio!
              <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-gray-900 rotate-45" />
            </div>
          )}
          <button
            onClick={() => { setChatOpen(true); setShowTooltip(false) }}
            className="flex items-center gap-2 text-white pl-3 pr-4 py-3 rounded-full shadow-xl transition hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)',
              boxShadow: '0 8px 32px rgba(127,179,255,0.5)'
            }}
          >
            <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
            <span className="text-sm font-semibold">Ask Ruah!</span>
          </button>
        </div>
      )}

      {/* AI Chat Panel */}
      {chatOpen && (
        <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-6 md:bottom-6 md:w-96 bg-white rounded-t-3xl md:rounded-3xl shadow-2xl z-50 flex flex-col"
          style={{ height: '70vh', maxHeight: '600px' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 rounded-t-3xl"
            style={{ background: 'linear-gradient(135deg, #EAF4FF 0%, #FFF6F2 100%)' }}>
            <div className="flex items-center gap-2">
              <img src="/ruah-logo.png" alt="Ruah" className="w-9 h-9" />
              <div>
                <div className="text-sm font-bold text-gray-900">Ruah! AI</div>
                <div className="text-xs text-green-500">● Ready to help</div>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <img src="/ruah-logo.png" className="w-6 h-6 mr-2 flex-shrink-0 mt-1" />
                )}
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-gray-50 text-gray-800 rounded-bl-sm'
                }`}
                  style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' } : {}}>
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}>
                    {msg.content.replace('**[Use this bio]**', '')}
                  </ReactMarkdown>
                  {msg.role === 'assistant' && msg.content.includes('[Use this bio]') && (
                    <button onClick={() => applyBio(msg.content)}
                      className="mt-2 w-full text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      ✓ Use this bio & save
                    </button>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <img src="/ruah-logo.png" className="w-6 h-6 mr-2 flex-shrink-0 mt-1" />
                <div className="bg-gray-50 px-3 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
                placeholder="Tell me about yourself..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]" />
              <button onClick={() => sendMessage()} disabled={!input.trim() || chatLoading}
                className="text-white w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
      `}</style>
    </div>
  )
}