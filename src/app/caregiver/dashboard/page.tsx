'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CaregiverDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('users').select('*').eq('id', user.id).single()
      const { data: caregiverData } = await supabase
        .from('caregiver_profiles').select('*').eq('user_id', user.id).single()

      setUser(userData)
      setProfile(caregiverData)
      setLoading(false)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const completionItems = [
    { label: 'Basic info added', done: true },
    { label: 'Bio written', done: !!profile?.bio },
    { label: 'Identity verified', done: false },
    { label: 'Background check', done: profile?.background_check_status === 'passed' },
  ]
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100)

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">👋 {user?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}! 🤝</h1>
          <p className="text-gray-400 mt-1">Manage your profile and find families to help</p>
        </div>

        {/* Profile Completion */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Profile Completion</h2>
            <span className="text-sm font-medium text-[#7FB3FF]">{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${completionPct}%`,
                background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)'
              }}
            />
          </div>
          <div className="space-y-2 mb-4">
            {completionItems.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done
                  ? <span className="text-green-500">✓</span>
                  : <span className="text-gray-300">○</span>}
                <span className={item.done ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push('/caregiver/profile')}
            className="w-full py-3 rounded-xl text-sm font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition"
          >
            Complete Profile →
          </button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => router.push('/search')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-[#7FB3FF] transition"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-gray-900">Browse Requests</div>
            <div className="text-sm text-gray-400 mt-1">Find families near you</div>
          </button>
          <button
            onClick={() => router.push('/caregiver/profile')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-[#7FB3FF] transition"
          >
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold text-gray-900">My Profile</div>
            <div className="text-sm text-gray-400 mt-1">Edit your info & services</div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Profile Views', value: '0', icon: '👁' },
            { label: 'Matches', value: '0', icon: '🤝' },
            { label: 'Rating', value: '—', icon: '⭐' },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-2xl p-6 border border-blue-50">
          <div className="flex items-start gap-4">
            <img src="/ruah-logo.png" alt="Ruah" className="w-12 h-12 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Hi, I'm Ruah! Your AI Assistant ✨</div>
              <div className="text-sm text-gray-500 mt-1">
                Let me help you write a standout bio and highlight your best skills to attract the right families.
              </div>
              <button
                onClick={() => router.push('/caregiver/chat')}
                className="mt-3 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
              >
                Chat with Ruah! →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}