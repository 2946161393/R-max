'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

type ScheduleDay = { start: string; end: string }
type ScheduleDays = Record<string, ScheduleDay>

export default function CaregiverAvailability() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [scheduleDays, setScheduleDays] = useState<ScheduleDays>({})
  const [availabilityType, setAvailabilityType] = useState<string[]>([])
  const [overnightOk, setOvernightOk] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: profileData } = await supabase.from('caregiver_profiles').select('*').eq('user_id', authUser.id).single()
      setUser(userData)
      setProfile(profileData)

      // Load existing availability
      if (profileData?.availability_schedule) {
        const sched = profileData.availability_schedule
        setSelectedDays(Object.keys(sched))
        setScheduleDays(sched)
      }
      if (profileData?.availability_type) setAvailabilityType(profileData.availability_type)
      if (profileData?.overnight_ok) setOvernightOk(profileData.overnight_ok)

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

  const toggleAvailabilityType = (type: string) => {
    setAvailabilityType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const formatTime = (t: string) => {
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('caregiver_profiles').update({
      availability_schedule: selectedDays.length > 0 ? scheduleDays : null,
      availability_type: availabilityType.length > 0 ? availabilityType : null,
      overnight_ok: overnightOk,
    }).eq('user_id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/caregiver/profile')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="w-12" />
      </header>

      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">My Availability</h1>
        <p className="text-gray-400 text-sm mb-8">Set your schedule so families know when you're free</p>

        {/* Job type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-1">Which jobs are you available for?</h2>
          <p className="text-xs text-gray-400 mb-4">Select the types of job you're available for</p>
          <div className="space-y-3">
            {[
              { id: 'full_time', label: 'Full-time', desc: '30+ hours per week' },
              { id: 'part_time', label: 'Part-time', desc: 'Less than 30 hours per week' },
            ].map(opt => (
              <label key={opt.id} className="flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition hover:border-gray-300"
                style={{ borderColor: availabilityType.includes(opt.id) ? '#7FB3FF' : '#E5E7EB', backgroundColor: availabilityType.includes(opt.id) ? '#EFF6FF' : 'white' }}>
                <div>
                  <div className="font-semibold text-gray-900">{opt.label}</div>
                  <div className="text-sm text-gray-400">{opt.desc}</div>
                </div>
                <input type="checkbox" checked={availabilityType.includes(opt.id)}
                  onChange={() => toggleAvailabilityType(opt.id)}
                  className="w-5 h-5 accent-[#7FB3FF]" />
              </label>
            ))}
          </div>
        </div>

        {/* Overnight */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-semibold text-gray-900">Open to overnight work?</div>
              <div className="text-sm text-gray-400 mt-0.5">Include jobs from 10 PM – 6 AM</div>
            </div>
            <div onClick={() => setOvernightOk(p => !p)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${overnightOk ? 'bg-[#7FB3FF]' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${overnightOk ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>

        {/* Days & Times */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">What days and times are you available?</h2>
          <p className="text-xs text-gray-400 mb-4">Tap a day to add it to your schedule</p>

          {/* Day selector */}
          <div className="flex gap-1.5 mb-4">
            {DAYS.map((day, i) => {
              const key = DAY_KEYS[i]
              const selected = selectedDays.includes(key)
              return (
                <button key={key} onClick={() => toggleDay(key)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition ${
                    selected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time inputs */}
          {selectedDays.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Tap days above to set your hours</p>
          ) : (
            <div className="space-y-3">
              {DAY_KEYS.filter(k => selectedDays.includes(k)).map(dayKey => {
                const times = scheduleDays[dayKey] || { start: '08:00', end: '17:00' }
                return (
                  <div key={dayKey} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-700 w-24 capitalize">{dayKey}</span>
                    <input type="time" value={times.start}
                      onChange={e => updateDayTime(dayKey, 'start', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] bg-white" />
                    <span className="text-gray-400">–</span>
                    <input type="time" value={times.end}
                      onChange={e => updateDayTime(dayKey, 'end', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] bg-white" />
                  </div>
                )
              })}
            </div>
          )}

          {/* Summary */}
          {selectedDays.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Summary</p>
              <div className="space-y-1">
                {DAY_KEYS.filter(k => selectedDays.includes(k)).map(dayKey => {
                  const times = scheduleDays[dayKey]
                  return (
                    <div key={dayKey} className="flex justify-between text-sm text-gray-600">
                      <span className="capitalize">{dayKey}</span>
                      <span className="text-gray-500">{formatTime(times?.start || '08:00')} – {formatTime(times?.end || '17:00')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition"
          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Availability'}
        </button>
      </div>
    </div>
  )
}