'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ---- 数据 ----
const SERVICES = [
  { id: 'childcare', emoji: '👶', label: 'Childcare', desc: 'Nanny or babysitter' },
  { id: 'chef', emoji: '🍳', label: 'Home Private Chef', desc: 'Meal prep & cooking' },
  { id: 'housekeeping', emoji: '🏠', label: 'Housekeeper', desc: 'Cleaning & household help' },
  { id: 'elder_care', emoji: '👴', label: 'Elder Care', desc: 'Senior companion & care' },
  { id: 'pet_care', emoji: '🐾', label: 'Pet Care', desc: 'Dog walking & pet sitting' },
  { id: 'tutoring', emoji: '📚', label: 'Learning Support', desc: 'Tutoring & education' },
]

const CHILDCARE_STEPS = [
  'childcare_type',     // one-time or recurring
  'childcare_when',     // when to start
  'childcare_schedule', // days/hours
  'childcare_kids',     // number of kids
  'childcare_ages',     // ages
  'childcare_extras',   // extra needs
  'childcare_budget',   // budget
]

const PET_STEPS = [
  'pet_type',     // what animal
  'pet_service',  // service type
  'pet_when',     // when
  'pet_budget',   // budget
]

type Answers = Record<string, any>

export default function FamilyOnboarding() {
  const [step, setStep] = useState<string>('services')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceQueue, setServiceQueue] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answers>({})
  const router = useRouter()

  const save = (key: string, value: any) => setAnswers(prev => ({ ...prev, [key]: value }))

  const toggleService = (id: string) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const startFlow = () => {
    const queue: string[] = []
    if (selectedServices.includes('childcare')) queue.push(...CHILDCARE_STEPS)
    if (selectedServices.includes('pet_care')) queue.push(...PET_STEPS)
    // 其他服务可以后续加
    setServiceQueue(queue)
    setStep(queue[0])
  }

  const next = (currentStep: string) => {
    const idx = serviceQueue.indexOf(currentStep)
    if (idx < serviceQueue.length - 1) {
      setStep(serviceQueue[idx + 1])
    } else {
      // 所有问题问完，去注册
      router.push(`/onboarding/register?role=family&answers=${encodeURIComponent(JSON.stringify({ ...answers, services: selectedServices }))}`)
    }
  }

  const back = (currentStep: string) => {
    const idx = serviceQueue.indexOf(currentStep)
    if (idx === 0) setStep('services')
    else setStep(serviceQueue[idx - 1])
  }

  // ---- UI ----
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* 返回主页 */}
        <button onClick={() => router.push('/')} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>

        {/* Step: 选服务 */}
        {step === 'services' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">What do you need help with?</h1>
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
              onClick={startFlow}
              disabled={selectedServices.length === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40 hover:bg-blue-700 transition"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ===== CHILDCARE STEPS ===== */}

        {step === 'childcare_type' && (
          <Question
            title="What kind of childcare do you need?"
            back={() => setStep('services')}
          >
            {[
              { id: 'babysitter', label: '🍼 One-time Babysitter', desc: 'For a specific date or occasion' },
              { id: 'nanny', label: '👩‍👧 Recurring Nanny', desc: 'Regular ongoing help' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                desc={opt.desc}
                selected={answers.childcare_type === opt.id}
                onClick={() => { save('childcare_type', opt.id); next('childcare_type') }}
              />
            ))}
          </Question>
        )}

        {step === 'childcare_when' && (
          <Question title="When do you need to start?" back={() => back('childcare_when')}>
            {[
              { id: 'asap', label: '⚡ Right away' },
              { id: 'week', label: '📅 Within a week' },
              { id: 'month', label: '🗓 Within a month' },
              { id: 'flexible', label: '😊 I\'m flexible' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                selected={answers.childcare_when === opt.id}
                onClick={() => { save('childcare_when', opt.id); next('childcare_when') }}
              />
            ))}
          </Question>
        )}

        {step === 'childcare_schedule' && (
          <Question title="How often do you need help?" back={() => back('childcare_schedule')}>
            {[
              { id: 'fulltime', label: '🗓 Full-time', desc: '5 days/week' },
              { id: 'parttime', label: '⏰ Part-time', desc: '2-4 days/week' },
              { id: 'occasional', label: '🌟 Occasional', desc: 'As needed' },
              { id: 'overnight', label: '🌙 Overnight', desc: 'Overnight care' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                desc={opt.desc}
                selected={answers.childcare_schedule === opt.id}
                onClick={() => { save('childcare_schedule', opt.id); next('childcare_schedule') }}
              />
            ))}
          </Question>
        )}

        {step === 'childcare_kids' && (
          <Question title="How many children?" back={() => back('childcare_kids')}>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, '4+'].map(n => (
                <button
                  key={n}
                  onClick={() => { save('childcare_kids', n); next('childcare_kids') }}
                  className={`py-4 rounded-2xl border-2 font-bold text-lg transition ${
                    answers.childcare_kids === n
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Question>
        )}

        {step === 'childcare_ages' && (
          <Question title="How old are your kids?" back={() => back('childcare_ages')}>
            {[
              { id: 'infant', label: '👶 Infant', desc: '0–12 months' },
              { id: 'toddler', label: '🧒 Toddler', desc: '1–3 years' },
              { id: 'preschool', label: '🎨 Preschool', desc: '3–5 years' },
              { id: 'school', label: '🎒 School age', desc: '5–12 years' },
              { id: 'teen', label: '🧑 Teen', desc: '13+ years' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                desc={opt.desc}
                selected={(answers.childcare_ages || []).includes(opt.id)}
                onClick={() => {
                  const curr = answers.childcare_ages || []
                  save('childcare_ages', curr.includes(opt.id)
                    ? curr.filter((a: string) => a !== opt.id)
                    : [...curr, opt.id])
                }}
                multi
              />
            ))}
            <button
              onClick={() => next('childcare_ages')}
              disabled={!answers.childcare_ages?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40"
            >
              Continue →
            </button>
          </Question>
        )}

        {step === 'childcare_extras' && (
          <Question title="Any extra needs?" back={() => back('childcare_extras')}>
            {[
              { id: 'bilingual', label: '🗣 Bilingual caregiver', desc: 'Speaks Mandarin, Spanish, etc.' },
              { id: 'homework', label: '📖 Homework help' },
              { id: 'driving', label: '🚗 Can drive kids' },
              { id: 'cooking', label: '🍱 Can cook meals' },
              { id: 'none', label: '✅ No extras needed' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                desc={opt.desc}
                selected={(answers.childcare_extras || []).includes(opt.id)}
                onClick={() => {
                  if (opt.id === 'none') { save('childcare_extras', ['none']); next('childcare_extras'); return }
                  const curr = (answers.childcare_extras || []).filter((e: string) => e !== 'none')
                  save('childcare_extras', curr.includes(opt.id)
                    ? curr.filter((e: string) => e !== opt.id)
                    : [...curr, opt.id])
                }}
                multi
              />
            ))}
            <button
              onClick={() => next('childcare_extras')}
              disabled={!answers.childcare_extras?.length}
              className="w-full mt-4 bg-blue-600 text-white py-4 rounded-2xl font-semibold disabled:opacity-40"
            >
              Continue →
            </button>
          </Question>
        )}

        {step === 'childcare_budget' && (
          <BudgetStep
            title="What's your hourly budget for childcare?"
            value={answers.childcare_budget || 20}
            min={10} max={80}
            onNext={(val) => { save('childcare_budget', val); next('childcare_budget') }}
            onBack={() => back('childcare_budget')}
          />
        )}

        {/* ===== PET CARE STEPS ===== */}

        {step === 'pet_type' && (
          <Question title="What kind of pet do you have?" back={() => back('pet_type')}>
            {[
              { id: 'dog', label: '🐶 Dog' },
              { id: 'cat', label: '🐱 Cat' },
              { id: 'bird', label: '🐦 Bird' },
              { id: 'other', label: '🐾 Other' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                selected={answers.pet_type === opt.id}
                onClick={() => { save('pet_type', opt.id); next('pet_type') }}
              />
            ))}
          </Question>
        )}

        {step === 'pet_service' && (
          <Question title="What kind of pet care do you need?" back={() => back('pet_service')}>
            {[
              { id: 'walking', label: '🦮 Dog Walking', desc: 'Daily walks' },
              { id: 'sitting', label: '🏠 Pet Sitting', desc: 'At your home' },
              { id: 'boarding', label: '🛏 Boarding', desc: 'At caregiver\'s home' },
              { id: 'checkin', label: '✅ Drop-in Visit', desc: 'Quick check-ins' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                desc={opt.desc}
                selected={answers.pet_service === opt.id}
                onClick={() => { save('pet_service', opt.id); next('pet_service') }}
              />
            ))}
          </Question>
        )}

        {step === 'pet_when' && (
          <Question title="When do you need pet care?" back={() => back('pet_when')}>
            {[
              { id: 'asap', label: '⚡ Right away' },
              { id: 'week', label: '📅 Within a week' },
              { id: 'month', label: '🗓 Within a month' },
              { id: 'flexible', label: '😊 I\'m flexible' },
            ].map(opt => (
              <OptionCard
                key={opt.id}
                label={opt.label}
                selected={answers.pet_when === opt.id}
                onClick={() => { save('pet_when', opt.id); next('pet_when') }}
              />
            ))}
          </Question>
        )}

        {step === 'pet_budget' && (
          <BudgetStep
            title="What's your budget for pet care?"
            value={answers.pet_budget || 20}
            min={10} max={60}
            onNext={(val) => { save('pet_budget', val); next('pet_budget') }}
            onBack={() => back('pet_budget')}
          />
        )}

      </div>
    </div>
  )
}

// ---- 复用组件 ----

function Question({ title, children, back }: {
  title: string
  children: React.ReactNode
  back?: () => void
}) {
  return (
    <div>
      {back && (
        <button onClick={back} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
      )}
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{title}</h1>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function OptionCard({ label, desc, selected, onClick, multi }: {
  label: string
  desc?: string
  selected: boolean
  onClick: () => void
  multi?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-2xl border-2 text-left transition ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-gray-900">{label}</div>
          {desc && <div className="text-sm text-gray-400 mt-0.5">{desc}</div>}
        </div>
        {multi && (
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
          }`}>
            {selected && <div className="w-2 h-2 bg-white rounded-full" />}
          </div>
        )}
      </div>
    </button>
  )
}

function BudgetStep({ title, value, min, max, onNext, onBack }: {
  title: string
  value: number
  min: number
  max: number
  onNext: (val: number) => void
  onBack: () => void
}) {
  const [val, setVal] = useState(value)
  return (
    <div>
      <button onClick={onBack} className="text-gray-400 text-sm mb-8 hover:text-gray-600">← Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-400 text-sm mb-12">Slide to set your hourly rate</p>
      <div className="text-center mb-8">
        <span className="text-5xl font-bold text-blue-600">${val}</span>
        <span className="text-gray-400 text-lg">/hr</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={e => setVal(Number(e.target.value))}
        className="w-full accent-blue-600 mb-12"
      />
      <button
        onClick={() => onNext(val)}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition"
      >
        Continue →
      </button>
    </div>
  )
}