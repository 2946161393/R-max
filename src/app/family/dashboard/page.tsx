'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function FamilyDashboard() {
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: familyData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()
      const { data: notifData } = await supabase.from('notifications').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(10)

      let requestsData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('service_requests')
          .select('*, applications(id, status)')
          .eq('family_id', familyData.id)
          .order('created_at', { ascending: false })
        requestsData = data || []
      }

      let matchesData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('matches')
          .select(`*, service_requests!inner ( family_id ), caregiver_profiles ( user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, onboarding_answers, users ( full_name, email, avatar_url ) )`)
          .eq('service_requests.family_id', familyData.id)
          .order('created_at', { ascending: false })
        matchesData = data || []
      }

      setUser(userData)
      setFamilyProfile(familyData)
      setNotifications(notifData || [])
      setRequests(requestsData)
      setMatches(matchesData)
      setLoading(false)
    }
    load()
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const updateMatchStatus = async (matchId: string, status: 'accepted' | 'declined') => {
    await supabase.from('matches').update({ status }).eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m))
  }

  const closeRequest = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'filled' }).eq('id', requestId)
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'filled' } : r))
  }

  const reopenRequest = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'open' }).eq('id', requestId)
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'open' } : r))
  }

  const deleteRequest = async (requestId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    await supabase.from('service_requests').delete().eq('id', requestId)
    setRequests(prev => prev.filter(r => r.id !== requestId))
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
  const pendingMatches = matches.filter(m => m.status === 'admin_matched' || m.status === 'pending')
  const hasOpenRequest = requests.some(r => r.status === 'open')

  const EXPERIENCE_LABELS: Record<string, string> = {
    '0': '< 1 yr', '1': '1–2 yrs', '3': '3–5 yrs', '5': '5–10 yrs', '10': '10+ yrs',
  }

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
          <button onClick={() => router.push('/family/profile')} className="text-sm text-gray-600 hover:text-[#7FB3FF] transition">
            👋 {user?.full_name}
          </button>
          <button onClick={() => router.push('/messages')} className="text-sm text-gray-400 hover:text-gray-600">
            💬 Messages
          </button>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}! 👨‍👩‍👧</h1>
          <p className="text-gray-400 mt-1">Find the perfect care for your family</p>
        </div>

        {notifications.filter(n => !n.read).length > 0 && (
          <div className="mb-6 space-y-3">
            {notifications.filter(n => !n.read).map(n => (
              <div key={n.id} onClick={() => markAsRead(n.id)}
                className="bg-white rounded-2xl border border-[#7FB3FF]/30 bg-blue-50/30 p-4 cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl mt-0.5">
                      {n.type === 'new_match' ? '🎯' : n.type === 'caregiver_interested' ? '🎉' : n.type === 'new_application' ? '📩' : n.type === 'message' ? '💬' : '📬'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{n.title}</div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1" />
                </div>
                {(n.type === 'new_match' || n.type === 'caregiver_interested') && n.data?.caregiverUserId && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/caregiver/${n.data.caregiverUserId}`) }}
                      className="flex-1 text-white py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                      👤 View Profile
                    </button>
                    <button onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push('/family/chat') }}
                      className="flex-1 py-2 rounded-xl text-xs font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition">
                      💬 Chat with Ruah
                    </button>
                  </div>
                )}
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

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => { if (hasOpenRequest) { alert('You already have an open request. Please close it before posting a new one.') } else { router.push('/family/post') } }}
            className="p-6 rounded-2xl text-left transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)', boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)' }}>
            <div className="text-2xl mb-2">✍️</div>
            <div className="font-semibold text-white">Post a Request</div>
            <div className="text-sm text-white/70 mt-1">Nanny, babysitter, pet care & more</div>
          </button>
          <button onClick={() => router.push('/search')}
            className="bg-white border border-gray-200 p-6 rounded-2xl text-left hover:border-[#7FB3FF] transition">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-gray-900">Browse Caregivers</div>
            <div className="text-sm text-gray-400 mt-1">Search by service & location</div>
          </button>
        </div>

        {!hasOpenRequest && familyProfile?.onboarding_answers && requests.length === 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm">Ready to find your caregiver?</div>
                <div className="text-xs text-gray-500 mt-1">We already have your needs from onboarding. Post your request in one click!</div>
                <button onClick={() => router.push('/family/post')}
                  className="mt-3 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                  🚀 Post My Request →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Matches */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">My Matches</h2>
              {pendingMatches.length > 0 && (
                <span className="bg-[#7FB3FF] text-white text-xs px-2 py-0.5 rounded-full">{pendingMatches.length} new</span>
              )}
            </div>
            <span className="text-xs text-gray-400">{matches.length} total</span>
          </div>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🎯</div>
              <p className="text-sm">No matches yet.</p>
              <p className="text-xs mt-1 text-gray-300">Post a request and we'll find you the best caregivers!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map(m => {
                const cp = m.caregiver_profiles
                const caregiverUser = cp?.users
                const isPending = m.status === 'admin_matched' || m.status === 'pending'
                return (
                  <div key={m.id} className={`rounded-xl border p-4 transition ${isPending ? 'border-[#7FB3FF]/40 bg-blue-50/20' : m.status === 'accepted' ? 'border-green-200 bg-green-50/20' : 'border-gray-100'}`}>
                    <div className="flex items-start gap-3">
                      {caregiverUser?.avatar_url
                        ? <img src={caregiverUser.avatar_url} className="w-12 h-12 rounded-full object-cover flex-shrink-0" alt="" />
                        : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-lg">
                            {caregiverUser?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{caregiverUser?.full_name || 'Caregiver'}</span>
                          {cp?.is_verified && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">✓ Verified</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'accepted' ? 'bg-green-100 text-green-600' : m.status === 'declined' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                            {m.status === 'admin_matched' ? '✨ New match!' : m.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          {cp?.services?.length > 0 && <span className="text-xs text-gray-500">{cp.services.join(', ')}</span>}
                          {cp?.languages?.length > 0 && <span className="text-xs text-gray-400">· {cp.languages.join(', ')}</span>}
                          {cp?.hourly_rate_min && cp?.hourly_rate_max && <span className="text-xs text-gray-400">· ${cp.hourly_rate_min}–${cp.hourly_rate_max}/hr</span>}
                          {cp?.years_experience != null && <span className="text-xs text-gray-400">· {EXPERIENCE_LABELS[String(cp.years_experience)]}</span>}
                        </div>
                        {cp?.bio && <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{cp.bio}</p>}
                        {m.ai_reasoning && m.ai_reasoning !== 'Manually matched by admin' && (
                          <p className="text-xs text-[#7FB3FF] mt-1.5 italic">"{m.ai_reasoning}"</p>
                        )}
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => updateMatchStatus(m.id, 'accepted')}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                          ✓ I'm Interested
                        </button>
                        <button onClick={() => router.push(`/caregiver/${cp?.user_id}`)}
                          className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                          👤 View Profile
                        </button>
                        <button onClick={() => updateMatchStatus(m.id, 'declined')}
                          className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-400 transition">
                          ✕
                        </button>
                      </div>
                    )}
                    {m.status === 'accepted' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => router.push(`/messages/${cp?.user_id}`)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                          💬 Message
                        </button>
                        <button onClick={() => router.push(`/caregiver/${cp?.user_id}`)}
                          className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] transition">
                          👤 View Profile
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* My Requests */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Requests</h2>
            {!hasOpenRequest && (
              <button onClick={() => router.push('/family/post')} className="text-sm text-[#7FB3FF] hover:underline">+ New</button>
            )}
          </div>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm">No requests yet. Post your first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onClose={() => closeRequest(r.id)}
                  onReopen={() => reopenRequest(r.id)}
                  onDelete={() => deleteRequest(r.id)}
                  onViewApplications={() => router.push(`/family/applications?request=${r.id}`)}
                  onEdit={() => router.push(`/family/post?edit=${r.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-2xl p-6 border border-blue-50">
          <div className="flex items-start gap-4">
            <img src="/ruah-logo.png" alt="Ruah" className="w-12 h-12 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Hi, I'm Ruah! Your AI Assistant ✨</div>
              <div className="text-sm text-gray-500 mt-1">Let me help you write your job post, find the best matches, and prepare interview questions.</div>
              <button onClick={() => router.push('/family/chat')}
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

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function RequestCard({ request: r, onClose, onReopen, onDelete, onViewApplications, onEdit }: {
  request: any
  onClose: () => void
  onReopen: () => void
  onDelete: () => void
  onViewApplications: () => void
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const applicationCount = r.applications?.length || 0
  const isOpen = r.status === 'open'
  const scheduleDays = r.schedule_days || {}
  const sortedDays = DAY_ORDER.filter(d => scheduleDays[d])

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Service + status + type */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="font-semibold text-gray-900 capitalize">{r.service_type}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                r.status === 'open' ? 'bg-green-100 text-green-600'
                : r.status === 'filled' ? 'bg-gray-100 text-gray-500'
                : 'bg-yellow-100 text-yellow-600'
              }`}>{r.status}</span>
              {r.schedule_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                  {r.schedule_type === 'recurring' ? '🔄 Recurring' : '1️⃣ One-time'}
                </span>
              )}
            </div>

            {/* Structured info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
              {(r.pay_min || r.pay_max) && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="text-gray-400">💰</span>
                  <span className="font-medium">${r.pay_min}{r.pay_max ? `–$${r.pay_max}` : '+'}/hr</span>
                </div>
              )}
              {r.start_date && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="text-gray-400">📅</span>
                  <span>Starts {new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
              {applicationCount > 0 && (
                <div className="flex items-center gap-1.5 text-[#7FB3FF]">
                  <span>📩</span>
                  <span className="font-medium">{applicationCount} applicant{applicationCount > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                <span>🕐</span>
                <span>Posted {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            {/* Schedule */}
            {sortedDays.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1.5">Schedule</div>
                <div className="space-y-1">
                  {sortedDays.map(day => {
                    const times = scheduleDays[day]
                    return (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="text-gray-600 capitalize w-24">{day}</span>
                        <span className="text-gray-500">{formatTime(times.start)} – {formatTime(times.end)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Languages */}
            {r.languages?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {r.languages.map((lang: string) => (
                  <span key={lang} className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">🗣 {lang}</span>
                ))}
              </div>
            )}

            {/* Requirements */}
            {r.requirements?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {r.requirements.map((req: string) => (
                  <span key={req} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{req}</span>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setExpanded(p => !p)} className="text-gray-300 text-xs flex-shrink-0 mt-1">
            {expanded ? '▲' : '▼'}
          </button>
        </div>

        {/* Job description expanded */}
        {expanded && r.ai_job_post && (
          <div className="border-t border-gray-50 pt-3 mb-3">
            <div className="text-xs text-gray-400 mb-1">Job description</div>
            <p className="text-sm text-gray-600 leading-relaxed">{r.ai_job_post}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap border-t border-gray-50 pt-3">
          {applicationCount > 0 && (
            <button onClick={onViewApplications}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white min-w-[100px]"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              📩 View Applications
            </button>
          )}
          <button onClick={onEdit}
            className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition min-w-[80px]">
            ✏️ Edit
          </button>
          {isOpen ? (
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 transition min-w-[80px]">
              ✓ Mark Filled
            </button>
          ) : (
            <button onClick={onReopen}
              className="flex-1 py-2 rounded-xl text-xs font-medium border border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition min-w-[80px]">
              ↺ Reopen
            </button>
          )}
          <button onClick={onDelete}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-300 hover:border-red-200 hover:text-red-400 transition">
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}