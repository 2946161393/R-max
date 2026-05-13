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
  const [showTooltip, setShowTooltip] = useState(true)
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

      let appsData: any[] = []
      if (caregiverData?.id) {
        const { data: rawApps } = await supabase
          .from('applications')
          .select(`
            *,
            service_requests (
              id, service_type, status, ai_job_post, created_at,
              family_profiles ( user_id )
            )
          `)
          .eq('caregiver_id', caregiverData.id)
          .order('created_at', { ascending: false })

        const familyUserIds = [...new Set(
          (rawApps || [])
            .map((a: any) => a.service_requests?.family_profiles?.user_id)
            .filter(Boolean)
        )]

        let familyUsersMap: Record<string, any> = {}
        if (familyUserIds.length > 0) {
          const { data: familyUsersData } = await supabase
            .from('users')
            .select('id, full_name, avatar_url')
            .in('id', familyUserIds)
          familyUsersData?.forEach((u: any) => { familyUsersMap[u.id] = u })
        }

        appsData = (rawApps || []).map((a: any) => ({
          ...a,
          familyUser: familyUsersMap[a.service_requests?.family_profiles?.user_id] || null
        }))
      }

      // Update last_active_at
      if (caregiverData?.id) {
        await supabase.from('caregiver_profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('user_id', authUser.id)
      }

      setUser(userData)
      setProfile(caregiverData)
      setNotifications(notifData || [])
      setApplications(appsData)
      setLoading(false)
    }
    load()

    const timer = setTimeout(() => setShowTooltip(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const handleMatchInterest = async (n: any, interested: boolean) => {
    if (!n.data?.matchId) return

    await supabase.from('matches')
      .update({
        caregiver_interested: interested,
        ...(interested ? {} : { status: 'declined' })
      })
      .eq('id', n.data.matchId)

    if (interested) {
      // Check if family already interested → mutual!
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, service_requests(family_profiles(user_id))')
        .eq('id', n.data.matchId)
        .single()

      if (matchData?.family_interested === true) {
        const familyUserId = matchData.service_requests?.family_profiles?.user_id
        if (familyUserId) {
          await supabase.from('matches').update({ status: 'accepted' }).eq('id', n.data.matchId)
          await supabase.from('notifications').insert([
            {
              user_id: user.id,
              type: 'mutual_match',
              title: '🎉 It\'s a match!',
              body: 'Both you and the family are interested. You can now message each other!',
              data: { matchId: n.data.matchId, familyUserId }
            },
            {
              user_id: familyUserId,
              type: 'mutual_match',
              title: '🎉 It\'s a match!',
              body: 'Both you and the caregiver are interested. You can now message each other!',
              data: { matchId: n.data.matchId, caregiverUserId: user.id }
            }
          ])
          await markAsRead(n.id)
          router.push(`/messages/${familyUserId}`)
          return
        }
      }

      // Family hasn't responded yet — update no_response_count if pass
    } else {
      // Passed — increment no_response_count
      await supabase.from('caregiver_profiles')
        .update({ match_no_response_count: (profile?.match_no_response_count || 0) + 1 })
        .eq('user_id', user.id)
    }

    await markAsRead(n.id)
    setNotifications(prev => prev.map(notif =>
      notif.id === n.id ? { ...notif, read: true } : notif
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
    { label: 'Location set', done: !!user?.zipcode },
    { label: 'Background check', done: profile?.background_check_status === 'passed' },
  ]
  const completionPct = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100)
  const unreadCount = notifications.filter(n => !n.read).length
  const pendingApps = applications.filter(a => a.status === 'pending')
  const acceptedApps = applications.filter(a => a.status === 'accepted')

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
                className="bg-white rounded-2xl border border-[#7FB3FF]/30 bg-blue-50/30 p-4 cursor-pointer transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl mt-0.5">
                      {n.type === 'new_match' ? '🎯'
                        : n.type === 'mutual_match' ? '🎉'
                        : n.type === 'application_accepted' ? '✅'
                        : n.type === 'message' ? '💬'
                        : '📬'}
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

                {/* New match — I'm Interested / Pass */}
                {n.type === 'new_match' && n.data?.matchId && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={e => { e.stopPropagation(); handleMatchInterest(n, true) }}
                      className="flex-1 text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      ✅ I'm Interested!
                    </button>
                    {n.data?.familyUserId && (
                      <button onClick={e => { e.stopPropagation(); router.push(`/caregiver/requests`) }}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] transition">
                        📋 View Their Post
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); handleMatchInterest(n, false) }}
                      className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400 transition">
                      Pass
                    </button>
                  </div>
                )}

                {/* Mutual match */}
                {n.type === 'mutual_match' && n.data?.familyUserId && (
                  <div className="mt-3">
                    <button onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/messages/${n.data.familyUserId}`) }}
                      className="w-full text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      💬 Start Chatting
                    </button>
                  </div>
                )}

                {/* Application accepted */}
                {n.type === 'application_accepted' && n.data?.familyUserId && (
                  <div className="mt-3">
                    <button onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/messages/${n.data.familyUserId}`) }}
                      className="w-full text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      💬 Message Family
                    </button>
                  </div>
                )}

                {/* Message */}
                {n.type === 'message' && n.data?.senderId && (
                  <div className="mt-3">
                    <button onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/messages/${n.data.senderId}`) }}
                      className="w-full text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      💬 Reply
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button onClick={() => router.push('/caregiver/requests')}
            className="p-5 rounded-2xl text-left transition"
            style={{
              background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)',
              boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)'
            }}>
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-white text-sm">Browse Requests</div>
            <div className="text-xs text-white/70 mt-1">Find families</div>
          </button>
          <button onClick={() => router.push('/caregiver/profile')}
            className="bg-white border border-gray-200 p-5 rounded-2xl text-left hover:border-[#7FB3FF] transition">
            <div className="text-2xl mb-2">👤</div>
            <div className="font-semibold text-gray-900 text-sm">My Profile</div>
            <div className="text-xs text-gray-400 mt-1">Edit info & services</div>
          </button>
          <button onClick={() => router.push('/messages')}
            className="bg-white border border-gray-200 p-5 rounded-2xl text-left hover:border-[#7FB3FF] transition">
            <div className="text-2xl mb-2">💬</div>
            <div className="font-semibold text-gray-900 text-sm">Messages</div>
            <div className="text-xs text-gray-400 mt-1">Chat with families</div>
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
                const familyUser = app.familyUser
                const familyUserId = req?.family_profiles?.user_id

                const nameParts = (familyUser?.full_name || '').split(' ').filter(Boolean)
                const displayName = nameParts.length > 1
                  ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                  : nameParts[0] || 'A Family'

                return (
                  <div key={app.id} className={`rounded-xl border p-3 transition ${
                    app.status === 'accepted' ? 'border-green-200 bg-green-50/20'
                    : app.status === 'declined' ? 'border-red-100 bg-red-50/10 opacity-60'
                    : 'border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      {familyUser?.avatar_url ? (
                        <img src={familyUser.avatar_url}
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {nameParts[0]?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{displayName}</span>
                          <span className="text-xs text-gray-400 capitalize">{req?.service_type}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            app.status === 'accepted' ? 'bg-green-100 text-green-600'
                            : app.status === 'declined' ? 'bg-red-100 text-red-400'
                            : 'bg-yellow-100 text-yellow-600'
                          }`}>{app.status}</span>
                        </div>
                        <div className="text-xs text-gray-300 mt-0.5">
                          Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      {app.status === 'accepted' && familyUserId && (
                        <button onClick={() => router.push(`/messages/${familyUserId}`)}
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
            { label: 'Applied', value: String(applications.length), icon: '📩' },
            { label: 'Accepted', value: String(acceptedApps.length), icon: '✅' },
            { label: 'Pending', value: String(pendingApps.length), icon: '⏳' },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Ruah AI button */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
        {showTooltip && (
          <div className="relative bg-gray-900 text-white text-xs px-3 py-2 rounded-xl rounded-br-sm max-w-40 text-center">
            ✨ Need help? Ask me!
            <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-gray-900 rotate-45" />
          </div>
        )}
        <button
          onClick={() => router.push('/caregiver/chat')}
          className="flex items-center gap-2 text-white pl-3 pr-4 py-3 rounded-full shadow-xl transition hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)',
            boxShadow: '0 8px 32px rgba(127,179,255,0.5)'
          }}>
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <span className="text-sm font-semibold">Ask Ruah!</span>
        </button>
      </div>
    </div>
  )
}