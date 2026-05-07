'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

export default function CaregiverPublicProfile() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const userId = params.id as string
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      // Return 404 if user is banned or shadow banned
      if (!userData || userData.is_banned || userData.is_shadow_banned) {
        router.push('/not-found')
        return
      }

      const { data: profileData } = await supabase
        .from('caregiver_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      setUser(userData)
      setProfile(profileData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  if (!user || !profile) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Profile not found</div>
    </div>
  )

  const answers = profile?.onboarding_answers || {}

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="w-12" />
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] flex items-center justify-center text-3xl font-bold text-[#7FB3FF]">
                  {user.full_name?.[0] || '?'}
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{user.full_name}</h1>
                {profile.is_verified && (
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">✓ Verified</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {profile.languages?.map((lang: string) => (
                  <span key={lang} className="text-xs bg-[#EAF4FF] text-[#4A90D9] px-2 py-0.5 rounded-full">{lang}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                {profile.years_experience > 0 && (
                  <span>⭐ {EXPERIENCE_LABELS[String(profile.years_experience)] || `${profile.years_experience}+ yrs`}</span>
                )}
                {profile.hourly_rate_min && (
                  <span>💰 ${profile.hourly_rate_min}{profile.hourly_rate_max ? `–$${profile.hourly_rate_max}` : '+'}/hr</span>
                )}
                {user.city && <span>📍 {user.city}</span>}
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Contact Button */}
          <button
            onClick={() => router.back()}
            className="w-full mt-4 text-white py-3 rounded-xl text-sm font-semibold transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
          >
            🤝 Let Ruah Contact This Caregiver
          </button>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
          <div className="space-y-3">
            {[
              { label: 'Services', value: profile.services?.join(', ') },
              { label: 'Experience', value: EXPERIENCE_LABELS[String(profile.years_experience)] || `${profile.years_experience} years` },
              { label: 'Languages', value: profile.languages?.join(', ') },
              { label: 'Hourly Rate', value: profile.hourly_rate_min ? `$${profile.hourly_rate_min}${profile.hourly_rate_max ? `–$${profile.hourly_rate_max}` : '+'}/hr` : '—' },
              { label: 'Availability', value: answers.availability },
              { label: 'Live-in', value: answers.living },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.label}</span>
                <span className="text-gray-900 font-medium">{item.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Background Check */}
        {profile.background_check_status === 'passed' && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-semibold text-green-700 text-sm">Background Check Passed</div>
              <div className="text-xs text-green-600">This caregiver has been verified by Ruah</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}