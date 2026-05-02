'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SERVICES = [
  { id: 'childcare', emoji: '👶', label: 'Childcare', desc: 'Nanny or babysitter' },
  { id: 'chef', emoji: '🍳', label: 'Private Chef', desc: 'Meal prep & cooking' },
  { id: 'housekeeping', emoji: '🏠', label: 'Housekeeping', desc: 'Cleaning & household help' },
  { id: 'elder_care', emoji: '👴', label: 'Elder Care', desc: 'Senior companion & care' },
  { id: 'pet_care', emoji: '🐾', label: 'Pet Care', desc: 'Dog walking & pet sitting' },
  { id: 'tutoring', emoji: '📚', label: 'Learning Support', desc: 'Tutoring & education' },
]

type Answers = Record<string, any>

export default function CaregiverOnboarding() {
  const [step, setStep] = useState('services')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const router = useRouter()

  const save = (key: string, value: any) => setAnswers(prev => ({ ...prev, [key]: value }))

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const STEPS = [
    'services',
    'experience',
    'languages',
    'availability',
    'living',
    'rate',
    'bio',
  ]

  const next = (current: string) => {
    const idx = STEPS.indexOf(current)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
    else {
      router.push(`/onboarding/register?role=caregiver&answers=${encodeURIComponent(JSON.stringify({ ...answers, services: selectedServices }))}`)
    }
  }

  const back = (current: string) => {
    const idx = STEPS.indexOf(current)
    if (idx > 0) setStep(STEPS[idx - 1])
    else router.push('/')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Step: 选服务 */}
        {step === 'services' && (
          <div>
            <button onClick={() => router.push('/')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">What services do you offer?</h1>
            <p className="text-gray-400 text-sm mb-8">Select all that apply</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {SERVICES.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleService(s.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition ${
                    selectedServices.includes(s.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{s.emoji}</div>
                  <div className="font-medium text-sm text-gray-900">{s.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => next('services')}
              disabled={selectedServices.length === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step: 经验 */}
        {step === 'experience' && (
          <div>
            <button onClick={() => back('experience')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">How many years of experience do you have?</h1>
            <div className="space-y-3">
              {[
                { id: '0', label: '🌱 Just starting out', desc: 'Less than 1 year' },
                { id: '1', label: '⭐ 1–2 years' },
                { id: '3', label: '⭐⭐ 3–5 years' },
                { id: '5', label: '⭐⭐⭐ 5–10 years' },
                { id: '10', label: '🏆 10+ years' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { save('experience', opt.id); next('experience') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.experience === opt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  {opt.desc && <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 语言 */}
        {step === 'languages' && (
          <div>
            <button onClick={() => back('languages')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">What languages do you speak?</h1>
            <p className="text-gray-400 text-sm mb-8">Select all that apply</p>
            <div className="space-y-3 mb-8">
              {['English', 'Mandarin', 'Cantonese', 'Spanish', 'French', 'Other'].map(lang => (
                <button
                  key={lang}
                  onClick={() => {
                    const curr = answers.languages || []
                    save('languages', curr.includes(lang)
                      ? curr.filter((l: string) => l !== lang)
                      : [...curr, lang])
                  }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    (answers.languages || []).includes(lang)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{lang}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => next('languages')}
              disabled={!answers.languages?.length}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step: 可用时间 */}
        {step === 'availability' && (
          <div>
            <button onClick={() => back('availability')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">When are you available?</h1>
            <div className="space-y-3">
              {[
                { id: 'fulltime', label: '🗓 Full-time', desc: 'Mon–Fri, 40hrs/week' },
                { id: 'parttime', label: '⏰ Part-time', desc: 'Flexible hours' },
                { id: 'weekends', label: '🌅 Weekends only' },
                { id: 'evenings', label: '🌙 Evenings & overnight' },
                { id: 'flexible', label: '😊 Very flexible' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { save('availability', opt.id); next('availability') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.availability === opt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  {opt.desc && <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Live-in */}
        {step === 'living' && (
          <div>
            <button onClick={() => back('living')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Are you open to live-in positions?</h1>
            <div className="space-y-3">
              {[
                { id: 'yes', label: '🏠 Yes, open to live-in', desc: 'I can live with the family' },
                { id: 'no', label: '🚗 No, live-out only', desc: 'I commute to work' },
                { id: 'open', label: '🤔 Open to discuss', desc: 'Depends on the family' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { save('living', opt.id); next('living') }}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition ${
                    answers.living === opt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{opt.label}</div>
                  {opt.desc && <div className="text-sm text-gray-400 mt-0.5">{opt.desc}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: 价格 */}
        {step === 'rate' && (
          <RateStep
            value={answers.rate || 20}
            onNext={(val) => { save('rate', val); next('rate') }}
            onBack={() => back('rate')}
          />
        )}

        {/* Step: Bio */}
        {step === 'bio' && (
          <div>
            <button onClick={() => back('bio')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Introduce yourself</h1>
            <p className="text-gray-400 text-sm mb-6">A short bio helps families get to know you</p>
            <textarea
              value={answers.bio || ''}
              onChange={e => save('bio', e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
              placeholder="Hi! I'm an experienced caregiver who loves working with kids..."
            />
            <button
              onClick={() => next('bio')}
              disabled={!answers.bio}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              See my matches →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

function RateStep({ value, onNext, onBack }: {
  value: number
  onNext: (val: number) => void
  onBack: () => void
}) {
  const [val, setVal] = useState(value)
  return (
    <div>
      <button onClick={onBack} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">What's your hourly rate?</h1>
      <p className="text-gray-400 text-sm mb-12">You can always change this later</p>
      <div className="text-center mb-8">
        <span className="text-5xl font-bold text-blue-600">${val}</span>
        <span className="text-gray-400 text-lg">/hr</span>
      </div>
      <input
        type="range"
        min={10}
        max={100}
        value={val}
        onChange={e => setVal(Number(e.target.value))}
        className="w-full accent-blue-600 mb-12"
      />
      <div className="flex justify-between text-sm text-gray-400 mb-12">
        <span>$10/hr</span>
        <span>$100/hr</span>
      </div>
      <button
        onClick={() => onNext(val)}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition"
      >
        Continue →
      </button>
    </div>
  )
}