'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CaregiverDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('users').select('*').eq('id', authUser.id).single()
      const { data: caregiverData } = await supabase
        .from('caregiver_profiles').select('*').eq('user_id', authUser.id).single()
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Fetch my applications
      let appsData: any[] = []
      if (caregiverData?.id) {
        const { data } = await supabase
          .from('applications')
          .select(`
            *,
            service_requests (
              id, service_type, status, ai_job_post, created_at,
              family_profiles (
                users ( full_name, avatar_url )
              )
            )
          `)
          .eq('caregiver_id', caregiverData.id)
          .order('created_at', { ascending: false })
        appsData = data || []
      }

      setUser(userData)
      setProfile(caregiverData)
      setNotifications(notifData || [])
      setApplications(appsData)
      setLoading(false)
    }
    load()
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleInterested = async (n: any) => {
    if (n.data?.familyUserId) {
      await supabase.from('notifications').insert({
        user_id: n.data.familyUserId,
        type: 'caregiver_interested',
        title: `${user?.full_name} is interested! 🎉`,
        body: `Great news! ${user?.full_name} has responded to your inquiry and is interested in connecting with your family.`,
        data: { caregiverUserId: user?.id, caregiverName: user?.full_name }
      })
    }
    await markAsRead(n.id)
    setNotifications(prev => prev.map(notif =>
      notif.id === n.id ? { ...notif, responded: true, read: true } : notif
    ))
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

  const completionItems = [
    { label: 'Basic info added', done: true },
    { label: 'Bio written', done: !!profile?.bio },
    { label: 'Identity verified', done: false },
    { label: 'Background check', done: profile?.background_check_status === 'passed' },
  ]
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100)
  const unreadCount = notifications.filter(n => !n.read).length
  const pendingApps = applications.filter(a => a.status === 'pending')

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
        </div>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>
          )}
          <button onClick={() => router.push('/caregiver/profile')}
            className="text-sm text-gray-600 hover:text-[#7FB3FF] transition">
            👋 {user?.full_name}
            </button>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}! 🤝</h1>
          <p className="text-gray-400 mt-1">Manage your profile and find families to help</p>
        </div>

        {/* Unread notifications */}
        {notifications.filter(n => !n.read).length > 0 && (
          <div className="mb-6 space-y-3">
            {notifications.filter(n => !n.read).map(n => (
              <div key={n.id} onClick={() => markAsRead(n.id)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition ${
                  n.read ? 'border-gray-100' : 'border-[#7FB3FF]/30 bg-blue-50/30'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl mt-0.5">
                      {n.type === 'new_match' ? '🎉' : n.type === 'application_accepted' ? '✅' : '📬'}
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
                  <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1" />
                </div>

                {n.type === 'new_match' && !n.responded && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={e => { e.stopPropagation(); handleInterested(n) }}
                      className="flex-1 text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      ✅ I'm interested!
                    </button>
                    <button onClick={e => { e.stopPropagation(); markAsRead(n.id) }}
                      className="px-4 py-2 rounded-xl text-xs font-medium border-2 border-gray-200 text-gray-500">
                      Not available
                    </button>
                  </div>
                )}
                {n.responded && (
                  <div className="mt-3 text-xs text-green-600 font-medium">
                    ✓ You responded — waiting for family to confirm
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/caregiver/requests')}
            className="p-6 rounded-2xl text-left transition"
            style={{
              background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)',
              boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)'
            }}
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-white">Browse Requests</div>
            <div className="text-sm text-white/70 mt-1">Find families looking for care</div>
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

        {/* My Applications */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">My Applications</h2>
              {pendingApps.length > 0 && (
                <span className="bg-[#7FB3FF] text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingApps.length} pending
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">{applications.length} total</span>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📩</div>
              <p className="text-sm">No applications yet.</p>
              <button onClick={() => router.push('/caregiver/requests')}
                className="mt-2 text-xs text-[#7FB3FF] hover:underline">
                Browse open requests →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map(app => {
                const req = app.service_requests
                const familyUser = req?.family_profiles?.users
                return (
                  <div key={app.id} className={`rounded-xl border p-3 transition ${
                    app.status === 'accepted' ? 'border-green-200 bg-green-50/20'
                    : app.status === 'declined' ? 'border-red-100 bg-red-50/10'
                    : 'border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {familyUser?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">{req?.service_type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            app.status === 'accepted' ? 'bg-green-100 text-green-600'
                            : app.status === 'declined' ? 'bg-red-100 text-red-400'
                            : 'bg-yellow-100 text-yellow-600'
                          }`}>{app.status}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{app.message}</p>
                        <div className="text-xs text-gray-300 mt-0.5">
                          {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      {app.status === 'accepted' && (
                        <button
                          onClick={() => router.push(`/messages?with=${req?.family_profiles?.user_id}`)}
                          className="text-xs px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                          💬 Message
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Profile Completion */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Profile Completion</h2>
            <span className="text-sm font-medium text-[#7FB3FF]">{completionPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${completionPct}%`, background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }} />
          </div>
          <div className="space-y-2 mb-4">
            {completionItems.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done ? <span className="text-green-500">✓</span> : <span className="text-gray-300">○</span>}
                <span className={item.done ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/caregiver/profile')}
            className="w-full py-3 rounded-xl text-sm font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition">
            Complete Profile →
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Applications', value: String(applications.length), icon: '📩' },
            { label: 'Accepted', value: String(applications.filter(a => a.status === 'accepted').length), icon: '✅' },
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
              <button onClick={() => router.push('/caregiver/chat')}
                className="mt-3 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                Chat with Ruah! →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}