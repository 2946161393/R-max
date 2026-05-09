'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function FamilyProfile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [zipcode, setZipcode] = useState('')
  const [zipcodeInfo, setZipcodeInfo] = useState<{ city: string; state: string } | null>(null)
  const [zipcodeLoading, setZipcodeLoading] = useState(false)
  const [zipcodeError, setZipcodeError] = useState('')
  const [savingLocation, setSavingLocation] = useState(false)
  const [savedLocation, setSavedLocation] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: profileData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()
      setUser(userData)
      setProfile(profileData)
      setZipcode(userData?.zipcode || '')
      if (userData?.city && userData?.state) {
        setZipcodeInfo({ city: userData.city, state: userData.state })
      }
      setLoading(false)
    }
    load()
  }, [])

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const answers = profile?.onboarding_answers || {}

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/family/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="w-12" />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Basic Info</h2>
          <div className="space-y-3">
            {[
              { label: 'Name', value: user?.full_name },
              { label: 'Email', value: user?.email },
              { label: 'Looking for', value: answers.services?.join(', ') },
              { label: 'Children ages', value: answers.childcare_ages?.join(', ') },
              { label: 'Schedule', value: answers.childcare_schedule },
              { label: 'Budget', value: answers.childcare_budget || answers.chef_budget || answers.pet_budget },
              { label: 'Start date', value: answers.childcare_when },
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
                ⚠️ Add your ZIP code so caregivers near you can find your request
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

        {/* Special Requirements */}
        {answers.childcare_extras?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">Special Requirements</h2>
            <div className="flex flex-wrap gap-2">
              {answers.childcare_extras.map((extra: string) => (
                <span key={extra} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {extra}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Post new request */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Update Your Needs</h2>
          <p className="text-sm text-gray-400 mb-4">Changed what you're looking for? Post a new request.</p>
          <button
            onClick={() => router.push('/family/post')}
            className="w-full py-3 rounded-xl text-sm font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition"
          >
            Post a New Request →
          </button>
        </div>
      </div>
    </div>
  )
}