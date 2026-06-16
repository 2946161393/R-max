'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FamilyNav from '@/components/FamilyNav'

const SERVICE_LABELS: Record<string, string> = {
  childcare: '👶 Childcare',
  babysitter: '🍼 Babysitter',
  elder_care: '🏥 Elder Care',
  housekeeping: '🏠 Housekeeping',
  chef: '👨‍🍳 Personal Chef',
  pet_care: '🐾 Pet Care',
  tutoring: '📚 Tutoring',
  postpartum: '🌸 Postpartum',
}

const ALL_SERVICES = Object.keys(SERVICE_LABELS)

export default function FamilyDashboard() {
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeService, setActiveService] = useState<string | null>(null)
  const [showAddService, setShowAddService] = useState(false)
  const [addingServices, setAddingServices] = useState(false)
  const [selectedNewServices, setSelectedNewServices] = useState<string[]>([])
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
          .select('*, matches(id, status)')
          .eq('family_id', familyData.id)
          .order('created_at', { ascending: false })
        requestsData = data || []
      }

      let matchesData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('matches')
          .select(`*, service_requests!inner(family_id, service_type), caregiver_profiles(user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, onboarding_answers, users(full_name, email, avatar_url))`)
          .eq('service_requests.family_id', familyData.id)
          .order('created_at', { ascending: false })
        matchesData = data || []
      }

      const onboardingServices: string[] = familyData?.onboarding_answers?.services || []
      const requestServices = [...new Set((requestsData || []).map((r: any) => r.service_type).filter(Boolean))]
      const mergedServices = [...new Set([...onboardingServices, ...requestServices])]

      setUser(userData)
      setFamilyProfile(familyData)
      setNotifications(notifData || [])
      setRequests(requestsData)
      setMatches(matchesData)
      if (mergedServices.length > 0) setActiveService(mergedServices[0])
      setLoading(false)
    }
    load()
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const saveNewServices = async () => {
    if (selectedNewServices.length === 0) { setShowAddService(false); return }
    setAddingServices(true)
    const currentServices: string[] = familyProfile?.onboarding_answers?.services || []
    const merged = [...new Set([...currentServices, ...selectedNewServices])]
    const updatedAnswers = { ...(familyProfile?.onboarding_answers || {}), services: merged }
    await supabase.from('family_profiles').update({ onboarding_answers: updatedAnswers }).eq('user_id', user.id)
    setFamilyProfile((prev: any) => ({ ...prev, onboarding_answers: updatedAnswers }))
    setSelectedNewServices([])
    setAddingServices(false)
    setShowAddService(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const unreadCount = notifications.filter(n => !n.read).length
  const hasRequests = requests.length > 0

  const onboardingServices: string[] = familyProfile?.onboarding_answers?.services || []
  const requestServices = [...new Set(requests.map(r => r.service_type).filter(Boolean))]
  const serviceList = [...new Set([...onboardingServices, ...requestServices])]

  const filteredRequests = activeService
    ? requests.filter(r => r.service_type === activeService)
    : requests
  const filteredMatches = activeService
    ? matches.filter(m => m.service_requests?.service_type === activeService)
    : matches

  const previewMatches = filteredMatches.slice(0, 2)
  const previewNotifs = notifications.slice(0, 3)
  const availableToAdd = ALL_SERVICES.filter(s => !serviceList.includes(s))

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <FamilyNav userName={user?.full_name} unreadCount={unreadCount} />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.full_name?.split(' ')[0]}! 👨‍👩‍👧
          </h1>
          <p className="text-gray-400 mt-1">Find the perfect care for your family</p>
        </div>

        {/* Service pills */}
        {serviceList.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {serviceList.map(svc => (
              <button
                key={svc}
                onClick={() => setActiveService(svc)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                  activeService === svc
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {SERVICE_LABELS[svc] || svc}
              </button>
            ))}
            {availableToAdd.length > 0 && (
              <button
                onClick={() => { setSelectedNewServices([]); setShowAddService(true) }}
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-400 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                + Add service
              </button>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className={`grid gap-4 mb-6 ${hasRequests ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasRequests && (
            <button
              onClick={() => router.push('/family/post')}
              className="p-6 rounded-2xl text-left transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)', boxShadow: '0 8px 32px rgba(127, 179, 255, 0.3)' }}>
              <div className="text-2xl mb-2">✍️</div>
              <div className="font-semibold text-white">Post a Request</div>
              <div className="text-sm text-white/70 mt-1">Nanny, babysitter, pet care & more</div>
            </button>
          )}

          <button
            onClick={() => router.push('/search')}
            className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 p-6 rounded-2xl text-left hover:border-[#7FB3FF]/60 transition">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-semibold text-gray-900">Browse Caregivers</div>
            <div className="text-sm text-gray-500 mt-1">Search by service & location</div>
          </button>
        </div>

        {/* Post first request nudge */}
        {!hasRequests && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-[#7FB3FF]/30 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900 text-sm">
                  Post your first {activeService ? (SERVICE_LABELS[activeService] || activeService) : ''} request
                </div>
                <div className="text-xs text-gray-500 mt-1">Tell us what you need and our team will start matching you with caregivers!</div>
                <button
                  onClick={() => router.push('/family/post')}
                  className="mt-3 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
                  style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                  🚀 Post My Request →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Matches preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">My Matches</h2>
              {filteredMatches.filter(m => m.family_interested === null && (m.status === 'admin_matched' || m.status === 'pending')).length > 0 && (
                <span className="bg-[#7FB3FF] text-white text-xs px-2 py-0.5 rounded-full">
                  {filteredMatches.filter(m => m.family_interested === null && (m.status === 'admin_matched' || m.status === 'pending')).length} new
                </span>
              )}
            </div>
            {filteredMatches.length > 2 && (
              <button onClick={() => router.push('/family/matches')} className="text-sm text-[#7FB3FF] hover:underline">
                See all {filteredMatches.length} →
              </button>
            )}
          </div>

          {filteredMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🎯</div>
              <p className="text-sm">No matches yet.</p>
              <p className="text-xs mt-1 text-gray-300">Post a request and we'll find you the best caregivers!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {previewMatches.map(m => {
                const cp = m.caregiver_profiles
                const caregiverUser = cp?.users
                const isMutual = m.status === 'accepted'
                const familyAccepted = m.family_interested === true

                return (
                  <div key={m.id} className={`rounded-xl border p-4 transition ${
                    isMutual ? 'border-green-200 bg-green-50/20'
                    : familyAccepted ? 'border-yellow-200 bg-yellow-50/20'
                    : m.family_interested === false ? 'border-gray-100 opacity-50'
                    : 'border-[#7FB3FF]/40 bg-blue-50/20'
                  }`}>
                    <div className="flex items-center gap-3">
                      {caregiverUser?.avatar_url
                        ? <img src={caregiverUser.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                        : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            {caregiverUser?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{caregiverUser?.full_name || 'Caregiver'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            isMutual ? 'bg-green-100 text-green-600'
                            : familyAccepted ? 'bg-yellow-100 text-yellow-600'
                            : m.family_interested === false ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-100 text-blue-500'
                          }`}>
                            {isMutual ? '🎉 Matched!' : familyAccepted ? '⏳ Waiting' : m.family_interested === false ? 'Passed' : '✨ New'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 mt-0.5">
                          {cp?.services?.length > 0 && <span className="text-xs text-gray-500">{cp.services.join(', ')}</span>}
                          {cp?.hourly_rate_min && cp?.hourly_rate_max && <span className="text-xs text-gray-400">· ${cp.hourly_rate_min}–${cp.hourly_rate_max}/hr</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push('/family/matches')}
                        className="text-xs text-[#7FB3FF] hover:underline flex-shrink-0">
                        {isMutual ? '💬 Chat' : 'View'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredMatches.length > 2 && (
                <button
                  onClick={() => router.push('/family/matches')}
                  className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                  + {filteredMatches.length - 2} more matches →
                </button>
              )}
            </div>
          )}
        </div>

        {/* My Requests preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">My Requests</h2>
            <button onClick={() => router.push('/family/requests')} className="text-sm text-[#7FB3FF] hover:underline">
              {filteredRequests.length > 0 ? `See all ${filteredRequests.length} →` : '+ New'}
            </button>
          </div>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm">No requests yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.slice(0, 3).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {SERVICE_LABELS[r.service_type] || r.service_type}
                    </span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'open' ? 'bg-green-100 text-green-600'
                      : r.status === 'filled' ? 'bg-gray-100 text-gray-500'
                      : 'bg-yellow-100 text-yellow-600'
                    }`}>{r.status}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    Posted {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              {filteredRequests.length > 3 && (
                <button onClick={() => router.push('/family/requests')} className="w-full pt-2 text-sm text-[#7FB3FF] hover:underline text-center">
                  + {filteredRequests.length - 3} more →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {previewNotifs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              {notifications.length > 3 && (
                <button onClick={() => router.push('/family/activity')} className="text-sm text-[#7FB3FF] hover:underline">
                  See all →
                </button>
              )}
            </div>
            <div className="space-y-3">
              {previewNotifs.map(n => (
                <div key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`flex items-start gap-3 cursor-pointer rounded-xl p-3 transition ${!n.read ? 'bg-blue-50/40' : ''}`}>
                  <div className="text-xl mt-0.5">
                    {n.type === 'new_match' ? '🎯' : n.type === 'mutual_match' ? '🎉' : n.type === 'caregiver_interested' ? '🎉' : n.type === 'message' ? '💬' : '📬'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.body}</div>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1.5" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] rounded-2xl p-6 border border-blue-50">
          <div className="flex items-start gap-4">
            <img src="/ruah-logo.png" alt="Ruah" className="w-12 h-12 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Hi, I'm Ruah! Your AI Assistant ✨</div>
              <div className="text-sm text-gray-500 mt-1">Let me help you write your job post and prepare interview questions.</div>
              <button
                onClick={() => router.push('/family/chat')}
                className="mt-3 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                Chat with Ruah! →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Service Modal */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Add a service</h3>
            <p className="text-xs text-gray-400 mb-4">Select the services you're looking for</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {availableToAdd.map(svc => (
                <button
                  key={svc}
                  onClick={() => setSelectedNewServices(prev =>
                    prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
                  )}
                  className={`p-3 rounded-xl border text-left text-sm transition ${
                    selectedNewServices.includes(svc)
                      ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {SERVICE_LABELS[svc]}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddService(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
                Cancel
              </button>
              <button
                onClick={saveNewServices}
                disabled={addingServices || selectedNewServices.length === 0}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                {addingServices ? 'Saving...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}