'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SERVICE_OPTIONS = [
  { value: 'childcare', label: '👶 Childcare / Nanny' },
  { value: 'babysitter', label: '🍼 Babysitter (short-term)' },
  { value: 'elder_care', label: '🏥 Elder Care' },
  { value: 'housekeeping', label: '🏠 Housekeeping / 阿姨' },
  { value: 'chef', label: '👨‍🍳 Personal Chef' },
  { value: 'pet_care', label: '🐾 Pet Care' },
  { value: 'tutoring', label: '📚 Tutoring' },
  { value: 'postpartum', label: '🌸 Postpartum / 月嫂' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const LANGUAGE_OPTIONS = ['Mandarin', 'Cantonese', 'English', 'Spanish', 'Other']

const REQUIREMENTS_OPTIONS = [
  'Light housekeeping', 'Meal preparation', 'Homework help',
  'Can drive kids', 'Non-smoker', 'Has own transportation',
  'Bilingual', 'CPR certified', 'Live-in ok',
]

type ScheduleDay = { start: string; end: string }
type ScheduleDays = Record<string, ScheduleDay>

export default function PostRequestPage() {
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generatedPost, setGeneratedPost] = useState('')
  const [step, setStep] = useState<'form' | 'preview'>('form')

  // Form state
  const [serviceType, setServiceType] = useState('')
  const [scheduleType, setScheduleType] = useState<'recurring' | 'one_time'>('recurring')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [scheduleDays, setScheduleDays] = useState<ScheduleDays>({})
  const [startDate, setStartDate] = useState('')
  const [payMin, setPayMin] = useState('')
  const [payMax, setPayMax] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [requirements, setRequirements] = useState<string[]>([])
  const [extraDetails, setExtraDetails] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      // Check if already has open request
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: profileData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()

      if (profileData?.id) {
        const { data: existing } = await supabase
          .from('service_requests')
          .select('id')
          .eq('family_id', profileData.id)
          .eq('status', 'open')
          .single()
        if (existing) {
          alert('You already have an open request. Please close it before posting a new one.')
          router.push('/family/dashboard')
          return
        }
      }

      setUser(userData)
      setFamilyProfile(profileData)

      // Pre-fill from onboarding
      const answers = profileData?.onboarding_answers || {}
      if (answers.services?.[0]) setServiceType(answers.services[0])
      if (answers.childcare_budget) {
        const parts = answers.childcare_budget.replace(/\$/g, '').split('–')
        if (parts[0]) setPayMin(parts[0].trim())
        if (parts[1]) setPayMax(parts[1].trim())
      }

      setLoading(false)
    }
    load()
  }, [])

  const toggleDay = (dayKey: string) => {
    setSelectedDays(prev => {
      if (prev.includes(dayKey)) {
        const next = prev.filter(d => d !== dayKey)
        setScheduleDays(sd => { const copy = { ...sd }; delete copy[dayKey]; return copy })
        return next
      }
      setScheduleDays(sd => ({ ...sd, [dayKey]: { start: '08:00', end: '17:00' } }))
      return [...prev, dayKey]
    })
  }

  const updateDayTime = (dayKey: string, field: 'start' | 'end', value: string) => {
    setScheduleDays(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], [field]: value } }))
  }

  const toggleLanguage = (lang: string) => {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang])
  }

  const toggleRequirement = (req: string) => {
    setRequirements(prev => prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req])
  }

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  const generatePost = async () => {
    if (!serviceType) return
    setGenerating(true)

    const answers = familyProfile?.onboarding_answers || {}
    const scheduleDesc = selectedDays.length > 0
      ? selectedDays.map(d => {
          const times = scheduleDays[d]
          return `${d.charAt(0).toUpperCase() + d.slice(1)} ${formatTime(times?.start || '08:00')}–${formatTime(times?.end || '17:00')}`
        }).join(', ')
      : ''

    const context = [
      `Service: ${serviceType}`,
      `Type: ${scheduleType === 'recurring' ? 'Recurring job' : 'One-time job'}`,
      scheduleDesc && `Schedule: ${scheduleDesc}`,
      startDate && `Start date: ${startDate}`,
      (payMin || payMax) && `Pay: $${payMin}${payMax ? `–$${payMax}` : '+'}/hr`,
      languages.length > 0 && `Language preference: ${languages.join(', ')}`,
      requirements.length > 0 && `Requirements: ${requirements.join(', ')}`,
      answers.childcare_kids && `Number of children: ${answers.childcare_kids}`,
      answers.childcare_ages?.length && `Children ages: ${answers.childcare_ages.join(', ')}`,
      extraDetails && `Additional details: ${extraDetails}`,
    ].filter(Boolean).join('\n')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Write a warm, concise job post for a family looking for care. Keep it under 120 words, friendly tone, no headers needed. Details:\n${context}` }],
          systemPrompt: `You are Ruah!, a warm AI assistant for a family care platform. Write natural, friendly job posts that feel personal, not corporate. Write in first person from the family's perspective. Do not use markdown headers or bullet points — just flowing sentences.`
        })
      })
      const data = await res.json()
      setGeneratedPost(data.content[0].text)
      setStep('preview')
    } catch {
      alert('Failed to generate post. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const submitPost = async () => {
    if (!generatedPost || !serviceType) return
    setSubmitting(true)

    const { data: familyProfileData } = await supabase
      .from('family_profiles').select('id').eq('user_id', user.id).single()

    const { error } = await supabase.from('service_requests').insert({
      family_id: familyProfileData?.id,
      service_type: serviceType,
      status: 'open',
      ai_job_post: generatedPost,
      schedule_type: scheduleType,
      schedule_days: selectedDays.length > 0 ? scheduleDays : null,
      start_date: startDate || null,
      pay_min: payMin ? parseInt(payMin) : null,
      pay_max: payMax ? parseInt(payMax) : null,
      requirements: requirements.length > 0 ? requirements : null,
    })

    if (error) {
      alert('Failed to submit. Please try again.')
      setSubmitting(false)
      return
    }

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'request_posted',
      title: '✅ Your request has been posted!',
      body: `We'll find you the best ${serviceType} caregivers soon. Stay tuned!`,
      data: { serviceType }
    })

    router.push('/family/dashboard?posted=1')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => step === 'preview' ? setStep('form') : router.push('/family/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >← Back</button>
        <div>
          <div className="font-semibold text-gray-900 text-sm">Post a Request</div>
          <div className="text-xs text-gray-400">{step === 'form' ? 'Step 1 of 2 — Your needs' : 'Step 2 of 2 — Review & post'}</div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8">
        {step === 'form' && (
          <>
            {/* Service Type */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">What kind of care do you need? *</label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setServiceType(opt.value)}
                    className={`p-3 rounded-xl border text-left text-sm transition ${
                      serviceType === opt.value
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurring vs One-time */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">Job type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'recurring', label: '🔄 Recurring', desc: 'Regular ongoing job' },
                  { value: 'one_time', label: '1️⃣ One-time', desc: 'Single occasion' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setScheduleType(opt.value as any)}
                    className={`p-3 rounded-xl border text-left text-sm transition ${
                      scheduleType === opt.value
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Days & Times */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {scheduleType === 'recurring' ? 'What days & times?' : 'What day & time?'}
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>

              {/* Day selector */}
              <div className="flex gap-1.5 mb-3">
                {DAYS.map((day, i) => {
                  const key = DAY_KEYS[i]
                  const selected = selectedDays.includes(key)
                  return (
                    <button key={key} onClick={() => toggleDay(key)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                        selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}>
                      {day}
                    </button>
                  )
                })}
              </div>

              {/* Time inputs for selected days */}
              {selectedDays.length > 0 && (
                <div className="space-y-2 bg-white rounded-xl border border-gray-100 p-3">
                  {selectedDays.map(dayKey => {
                    const dayLabel = DAY_KEYS.indexOf(dayKey)
                    const times = scheduleDays[dayKey] || { start: '08:00', end: '17:00' }
                    return (
                      <div key={dayKey} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-24 capitalize">{dayKey}</span>
                        <input type="time" value={times.start}
                          onChange={e => updateDayTime(dayKey, 'start', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FB3FF]" />
                        <span className="text-gray-400 text-sm">–</span>
                        <input type="time" value={times.end}
                          onChange={e => updateDayTime(dayKey, 'end', e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FB3FF]" />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Start Date */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Start date
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]" />
            </div>

            {/* Pay Range */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Pay rate ($/hr)
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={payMin} onChange={e => setPayMin(e.target.value)}
                    placeholder="Min" min="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]" />
                </div>
                <span className="text-gray-400">–</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={payMax} onChange={e => setPayMax(e.target.value)}
                    placeholder="Max" min="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]" />
                </div>
                <span className="text-gray-400 text-sm">/hr</span>
              </div>
            </div>

            {/* Language preference */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Language preference
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map(lang => (
                  <button key={lang} onClick={() => toggleLanguage(lang)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      languages.includes(lang)
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Job requirements
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {REQUIREMENTS_OPTIONS.map(req => (
                  <button key={req} onClick={() => toggleRequirement(req)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      requirements.includes(req)
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}>
                    {req}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra details */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Anything else?
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <textarea value={extraDetails} onChange={e => setExtraDetails(e.target.value)}
                placeholder="e.g. We have a dog, need help with school pickup, prefer someone with infant experience..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none" />
            </div>

            <button onClick={generatePost} disabled={!serviceType || generating}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Ruah is writing your post...
                </span>
              ) : '✨ Generate My Post with AI →'}
            </button>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <img src="/ruah-logo.png" alt="Ruah" className="w-6 h-6" />
                <span className="text-sm font-semibold text-gray-900">Ruah wrote this for you</span>
              </div>
              <p className="text-xs text-gray-400">Feel free to edit before posting</p>
            </div>

            {/* Structured info card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium text-gray-900 capitalize">{SERVICE_OPTIONS.find(o => o.value === serviceType)?.label || serviceType}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{scheduleType === 'recurring' ? '🔄 Recurring' : '1️⃣ One-time'}</span>
              </div>
              {selectedDays.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-500 block mb-1">Schedule</span>
                  <div className="space-y-0.5">
                    {selectedDays.map(d => {
                      const times = scheduleDays[d]
                      return (
                        <div key={d} className="flex justify-between text-gray-700">
                          <span className="capitalize">{d}</span>
                          <span>{formatTime(times?.start || '08:00')} – {formatTime(times?.end || '17:00')}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {startDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Start date</span>
                  <span className="font-medium text-gray-900">{new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {(payMin || payMax) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Pay</span>
                  <span className="font-medium text-gray-900">${payMin}{payMax ? `–$${payMax}` : '+'}/hr</span>
                </div>
              )}
              {requirements.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-500 block mb-1">Requirements</span>
                  <div className="flex flex-wrap gap-1">
                    {requirements.map(r => (
                      <span key={r} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Editable job description */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Job description</label>
              <textarea value={generatedPost} onChange={e => setGeneratedPost(e.target.value)} rows={5}
                className="w-full border border-[#7FB3FF]/40 bg-blue-50/20 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] leading-relaxed resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('form')}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition">
                ← Edit details
              </button>
              <button onClick={submitPost} disabled={submitting || !generatedPost}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Posting...
                  </span>
                ) : '🚀 Post & Notify Ruah Team'}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              Our team will review and match you with the best caregivers within 24 hours.
            </p>
          </>
        )}
      </div>
    </div>
  )
}