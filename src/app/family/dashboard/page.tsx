'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function FamilyDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('users').select('*').eq('id', user.id).single()
      const { data: familyData } = await supabase
        .from('family_profiles').select('*').eq('user_id', user.id).single()
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setUser(userData)
      setProfile(familyData)
      setNotifications(notifData || [])
      setLoading(false)
    }
    load()
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const unreadCount = notifications.filter(n => !n.read).length

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
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}! 👨‍👩‍👧</h1>
          <p className="text-gray-400 mt-1">Find the perfect care for your family</p>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>
              )}
            </div>
            <div className="space-y-3">
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition ${
                    n.read ? 'border-gray-100' : 'border-[#7FB3FF] bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl mt-0.5">
                        {n.type === 'caregiver_interested' ? '🎉' : '📬'}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{n.title}</div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                        <div className="text-xs text-gray-300 mt-2">
                          {new Date(n.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>

                  {n.type === 'caregiver_interested' && n.data?.caregiverUserId && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          markAsRead(n.id)
                          router.push(`/caregiver/${n.data.caregiverUserId}`)
                        }}
                        className="flex-1 text-white py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
                      >
                        👤 View Profile
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          markAsRead(n.id)
                          router.push('/family/chat')
                        }}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition"
                      >
                        💬 Chat with Ruah
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/family/chat')}
            className="p-6 rounded-2xl text-left transition"
            style={{
              background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)',
              boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)'
            }}
          >
            <div className="text-2xl mb-2">✍️</div>
            <div className="font-semibold text-white">Find a Caregiver</div>
            <div className="text-sm text-white/70 mt-1">Let Ruah find your match</div>
          </button>
          <button
            onClick={() => router.push('/search')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-[#7FB3FF] transition"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-gray-900">Browse Caregivers</div>
            <div className="text-sm text-gray-400 mt-1">Search by service & location</div>
          </button>
        </div>

        {/* My Requests */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Requests</h2>
            <button
              onClick={() => router.push('/family/post')}
              className="text-sm text-[#7FB3FF] hover:underline"
            >
              + New
            </button>
          </div>
          <div className="text-center py-8 text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm">No requests yet. Post your first one!</p>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-2xl p-6 border border-blue-50">
          <div className="flex items-start gap-4">
            <img src="/ruah-logo.png" alt="Ruah" className="w-12 h-12 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Hi, I'm Ruah! Your AI Assistant ✨</div>
              <div className="text-sm text-gray-500 mt-1">
                Let me help you write your job post, find the best matches, and prepare interview questions.
              </div>
              <button
                onClick={() => router.push('/family/chat')}
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