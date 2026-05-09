'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SERVICE_OPTIONS = [
  { value: 'childcare', label: '👶 Childcare / Nanny', emoji: '👶' },
  { value: 'babysitter', label: '🍼 Babysitter (short-term)', emoji: '🍼' },
  { value: 'elder_care', label: '🏥 Elder Care', emoji: '🏥' },
  { value: 'housekeeping', label: '🏠 Housekeeping / 阿姨', emoji: '🏠' },
  { value: 'chef', label: '👨‍🍳 Personal Chef', emoji: '👨‍🍳' },
  { value: 'pet_care', label: '🐾 Pet Care', emoji: '🐾' },
  { value: 'tutoring', label: '📚 Tutoring', emoji: '📚' },
  { value: 'postpartum', label: '🌸 Postpartum / 月嫂', emoji: '🌸' },
]

const SCHEDULE_OPTIONS = ['Full-time', 'Part-time', 'Weekends only', 'Evenings only', 'One-time / Temporary', 'Flexible']
const LANGUAGE_OPTIONS = ['Mandarin', 'Cantonese', 'English', 'Spanish', 'Other']
const WHEN_OPTIONS = ['ASAP', 'Within 2 weeks', 'Within a month', 'Just exploring']

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
  const [schedule, setSchedule] = useState('')
  const [when, setWhen] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [extraDetails, setExtraDetails] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: profileData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()
      setUser(userData)
      setFamilyProfile(profileData)

      // Pre-fill from onboarding if available
      const answers = profileData?.onboarding_answers || {}
      if (answers.services?.[0]) setServiceType(answers.services[0])
      if (answers.childcare_schedule) setSchedule(answers.childcare_schedule)
      if (answers.childcare_when) setWhen(answers.childcare_when)
      if (answers.childcare_budget) setBudget(answers.childcare_budget)

      setLoading(false)
    }
    load()
  }, [])

  const toggleLanguage = (lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    )
  }

  const generatePost = async () => {
    if (!serviceType) return
    setGenerating(true)

    const answers = familyProfile?.onboarding_answers || {}
    const context = [
      `Service: ${serviceType}`,
      schedule && `Schedule: ${schedule}`,
      when && `Start: ${when}`,
      languages.length > 0 && `Language preference: ${languages.join(', ')}`,
      budget && `Budget: $${budget}/hr`,
      answers.childcare_kids && `Number of children: ${answers.childcare_kids}`,
      answers.childcare_ages?.length && `Children ages: ${answers.childcare_ages.join(', ')}`,
      answers.childcare_extras?.length && `Special needs: ${answers.childcare_extras.join(', ')}`,
      extraDetails && `Additional details: ${extraDetails}`,
    ].filter(Boolean).join('\n')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Write a warm, concise job post for a family looking for care. Keep it under 120 words, friendly tone, no headers needed. Details:\n${context}`
          }],
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
    })

    if (error) {
      alert('Failed to submit. Please try again.')
      setSubmitting(false)
      return
    }

    // Send notification to admin (optional — via notifications table)
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
        >
          ← Back
        </button>
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
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                What kind of care do you need? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setServiceType(opt.value)}
                    className={`p-3 rounded-xl border text-left text-sm transition ${
                      serviceType === opt.value
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">Schedule</label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSchedule(schedule === opt ? '' : opt)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      schedule === opt
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* When */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">When do you need it?</label>
              <div className="flex flex-wrap gap-2">
                {WHEN_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setWhen(when === opt ? '' : opt)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      when === opt
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
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
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition ${
                      languages.includes(lang)
                        ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Budget ($/hr)
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <input
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="e.g. 20–25"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF]"
              />
            </div>

            {/* Extra details */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Anything else to add?
                <span className="font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <textarea
                value={extraDetails}
                onChange={e => setExtraDetails(e.target.value)}
                placeholder="e.g. We have a dog, looking for someone who speaks Mandarin, need help with school pickup..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none"
              />
            </div>

            <button
              onClick={generatePost}
              disabled={!serviceType || generating}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
            >
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
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <img src="/ruah-logo.png" alt="Ruah" className="w-6 h-6" />
                <span className="text-sm font-semibold text-gray-900">Ruah wrote this for you</span>
              </div>
              <p className="text-xs text-gray-400">Feel free to edit before posting</p>
            </div>

            {/* Service type badge */}
            <div className="mb-4">
              <span className="text-xs px-3 py-1 rounded-full bg-blue-50 text-[#4A90D9] border border-[#7FB3FF]/30 font-medium capitalize">
                {SERVICE_OPTIONS.find(o => o.value === serviceType)?.label || serviceType}
              </span>
              {schedule && <span className="ml-2 text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">{schedule}</span>}
              {when && <span className="ml-2 text-xs px-3 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">{when}</span>}
            </div>

            {/* Editable post */}
            <div className="mb-6">
              <textarea
                value={generatedPost}
                onChange={e => setGeneratedPost(e.target.value)}
                rows={6}
                className="w-full border border-[#7FB3FF]/40 bg-blue-50/20 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] leading-relaxed resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('form')}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 transition"
              >
                ← Edit details
              </button>
              <button
                onClick={submitPost}
                disabled={submitting || !generatedPost}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
              >
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