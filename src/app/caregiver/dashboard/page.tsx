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
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="text-xl font-bold text-blue-600">Ruah</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">👋 {user?.full_name}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}! 🤝</h1>
          <p className="text-gray-500 mt-1">Manage your profile and find families to help</p>
        </div>

        {/* Profile Completion */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Profile Completion</h2>
            <span className="text-sm text-blue-600 font-medium">
              {profile?.bio ? '80%' : '60%'}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: profile?.bio ? '80%' : '60%' }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600">Basic info added</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {profile?.bio ? <span className="text-green-500">✓</span> : <span className="text-gray-300">○</span>}
              <span className={profile?.bio ? 'text-gray-600' : 'text-gray-400'}>Bio written</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-300">○</span>
              <span className="text-gray-400">Identity verified</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-300">○</span>
              <span className="text-gray-400">Background check</span>
            </div>
          </div>
          <button
            onClick={() => router.push('/caregiver/profile')}
            className="mt-4 w-full border border-blue-200 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
          >
            Complete Profile →
          </button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => router.push('/search')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-blue-300 transition"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-gray-900">Browse Requests</div>
            <div className="text-sm text-gray-500 mt-1">Find families near you</div>
          </button>
          <button
            onClick={() => router.push('/caregiver/profile')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-blue-300 transition"
          >
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold text-gray-900">My Profile</div>
            <div className="text-sm text-gray-500 mt-1">Edit your info & services</div>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Profile Views', value: '0', icon: '👁' },
            { label: 'Matches', value: '0', icon: '🤝' },
            { label: 'Rating', value: '—', icon: '⭐' },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* AI Assistant */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🤖</div>
            <div>
              <div className="font-semibold text-gray-900">AI Profile Assistant</div>
              <div className="text-sm text-gray-500 mt-1">
                Let AI help you write a standout bio and highlight your best skills.
              </div>
              <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                Improve my profile →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}