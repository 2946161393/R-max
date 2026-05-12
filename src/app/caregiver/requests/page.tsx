'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const SERVICE_LABELS: Record<string, string> = {
  childcare: '👶 Childcare',
  babysitter: '🍼 Babysitter',
  elder_care: '🏥 Elder Care',
  housekeeping: '🏠 Housekeeping',
  chef: '👨‍🍳 Chef',
  pet_care: '🐾 Pet Care',
  tutoring: '📚 Tutoring',
  postpartum: '🌸 Postpartum',
  manual: '📋 General',
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DISTANCE_OPTIONS = [10, 25, 50, 100]

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getLatLng(zipcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zipcode}`)
    if (!res.ok) return null
    const data = await res.json()
    const place = data.places?.[0]
    if (!place) return null
    return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) }
  } catch { return null }
}

export default function CaregiverRequestsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [myApplications, setMyApplications] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [applyingTo, setApplyingTo] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [myLatLng, setMyLatLng] = useState<{ lat: number; lng: number } | null>(null)
  const [requestDistances, setRequestDistances] = useState<Record<string, number>>({})

  const [serviceFilter, setServiceFilter] = useState('')
  const [maxDistance, setMaxDistance] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)

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

      // Step 1: fetch requests with family_profiles (no nested users join)
      const { data: requestsData } = await supabase
        .from('service_requests')
        .select(`
          *,
          family_profiles ( id, onboarding_answers, user_id ),
          applications ( id )
        `)
        .eq('status', 'open')
        .neq('service_type', 'manual')
        .order('created_at', { ascending: false })

      // Step 2: collect all family user_ids and fetch separately
      const familyUserIds = [...new Set(
        (requestsData || [])
          .map((r: any) => r.family_profiles?.user_id)
          .filter(Boolean)
      )]

      let familyUsersMap: Record<string, any> = {}
      if (familyUserIds.length > 0) {
        const { data: familyUsersData } = await supabase
          .from('users')
          .select('id, full_name, avatar_url, city, state, zipcode')
          .in('id', familyUserIds)
        familyUsersData?.forEach((u: any) => { familyUsersMap[u.id] = u })
      }

      // Step 3: enrich requests with family user data
      const enrichedRequests = (requestsData || []).map((r: any) => ({
        ...r,
        familyUser: familyUsersMap[r.family_profiles?.user_id] || null
      }))

      let myApps = new Set<string>()
      if (caregiverData?.id) {
        const { data: appsData } = await supabase
          .from('applications').select('request_id').eq('caregiver_id', caregiverData.id)
        appsData?.forEach((a: any) => myApps.add(a.request_id))
      }

      setUser(userData)
      setProfile(caregiverData)
      setRequests(enrichedRequests)
      setMyApplications(myApps)

      // Calculate distances
      if (userData?.zipcode) {
        const latLng = await getLatLng(userData.zipcode)
        if (latLng) {
          setMyLatLng(latLng)
          const distances: Record<string, number> = {}
          for (const r of enrichedRequests) {
            const familyZip = r.familyUser?.zipcode
            if (familyZip) {
              const familyLatLng = await getLatLng(familyZip)
              if (familyLatLng) {
                distances[r.id] = getDistanceMiles(latLng.lat, latLng.lng, familyLatLng.lat, familyLatLng.lng)
              }
            }
          }
          setRequestDistances(distances)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const submitApplication = async () => {
    if (!applyingTo || !profile?.id) return
    setApplying(applyingTo.id)

    const { error } = await supabase.from('applications').insert({
      request_id: applyingTo.id,
      caregiver_id: profile.id,
      message: message || `Hi! I'm interested in this ${applyingTo.service_type} position. I'd love to connect!`,
      status: 'pending'
    })

    if (!error) {
      const familyUserId = applyingTo.familyUser?.id
      if (familyUserId) {
        await supabase.from('notifications').insert({
          user_id: familyUserId,
          type: 'new_application',
          title: `${user?.full_name} applied to your request! 📩`,
          body: message || `${user?.full_name} is interested in your ${applyingTo.service_type} position.`,
          data: { caregiverUserId: user?.id, caregiverName: user?.full_name, requestId: applyingTo.id }
        })
      }
      setMyApplications(prev => new Set([...prev, applyingTo.id]))
      setApplyingTo(null)
      setMessage('')
    }
    setApplying(null)
  }

  const myServices = profile?.services || []

  const filtered = requests.filter(r => {
    if (serviceFilter && r.service_type !== serviceFilter) return false
    if (maxDistance !== null && requestDistances[r.id] !== undefined) {
      if (requestDistances[r.id] > maxDistance) return false
    }
    return true
  })

  const activeFilterCount = [serviceFilter, maxDistance !== null].filter(Boolean).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/caregiver/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">Browse Requests</div>
          <div className="text-xs text-gray-400">{filtered.length} open positions</div>
        </div>
        <button onClick={() => setShowFilters(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition ${
            showFilters || activeFilterCount > 0 ? 'bg-[#7FB3FF] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-[#7FB3FF] text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </header>

      {showFilters && (
        <div className="bg-white border-b border-gray-100 px-6 py-4 space-y-4">
          {myServices.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Service type</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setServiceFilter('')}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    !serviceFilter ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  All
                </button>
                {myServices.map((svc: string) => (
                  <button key={svc} onClick={() => setServiceFilter(serviceFilter === svc ? '' : svc)}
                    className={`px-3 py-1.5 rounded-full border text-xs transition ${
                      serviceFilter === svc ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    {SERVICE_LABELS[svc] || svc}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Distance
              {!myLatLng && <span className="font-normal text-gray-400 ml-1">(add your ZIP code in profile to enable)</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMaxDistance(null)}
                className={`px-3 py-1.5 rounded-full border text-xs transition ${
                  maxDistance === null ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                Any distance
              </button>
              {DISTANCE_OPTIONS.map(d => (
                <button key={d} onClick={() => setMaxDistance(maxDistance === d ? null : d)}
                  disabled={!myLatLng}
                  className={`px-3 py-1.5 rounded-full border text-xs transition disabled:opacity-40 ${
                    maxDistance === d ? 'border-[#7FB3FF] bg-blue-50 text-[#4A90D9] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  Within {d} mi
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button onClick={() => { setServiceFilter(''); setMaxDistance(null) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No open requests right now.</p>
            <p className="text-xs mt-1 text-gray-300">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => {
              const familyUser = r.familyUser
              const alreadyApplied = myApplications.has(r.id)
              const appCount = r.applications?.length || 0
              const scheduleDays = r.schedule_days || {}
              const sortedDays = DAY_ORDER.filter(d => scheduleDays[d])
              const isExpanded = expandedId === r.id
              const distance = requestDistances[r.id]

              const nameParts = (familyUser?.full_name || '').split(' ').filter(Boolean)
              const displayName = nameParts.length > 1
                ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                : nameParts[0] || null

              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition overflow-hidden">
                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start gap-3 mb-3">
                      {familyUser?.avatar_url ? (
                        <img src={familyUser.avatar_url}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                          {nameParts[0]?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {SERVICE_LABELS[r.service_type] || r.service_type}
                          </span>
                          {r.schedule_type && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                              {r.schedule_type === 'recurring' ? '🔄 Recurring' : '1️⃣ One-time'}
                            </span>
                          )}
                          {alreadyApplied && (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">✓ Applied</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                          {displayName && <span>Posted by {displayName}</span>}
                          {familyUser?.city && (
                            <span>{displayName ? '·' : ''} 📍 {familyUser.city}{familyUser.state ? `, ${familyUser.state}` : ''}</span>
                          )}
                          {distance !== undefined && (
                            <span className="text-[#7FB3FF] font-medium">· {distance < 1 ? '< 1' : Math.round(distance)} mi away</span>
                          )}
                          {appCount > 0 && <span>· {appCount} applicant{appCount > 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Structured info */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                      {(r.pay_min || r.pay_max) && (
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <span>💰</span>
                          <span className="font-medium">${r.pay_min}{r.pay_max ? `–$${r.pay_max}` : '+'}/hr</span>
                        </div>
                      )}
                      {r.start_date && (
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                          <span>📅</span>
                          <span>Starts {new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    {/* Schedule */}
                    {sortedDays.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">Schedule</div>
                        <div className="space-y-0.5">
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

                    {/* Job description expandable */}
                    {r.ai_job_post && (
                      <div className="mb-3">
                        <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="text-xs text-[#7FB3FF] hover:underline mb-1">
                          {isExpanded ? '▲ Hide description' : '▼ View job description'}
                        </button>
                        {isExpanded && (
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3 py-2 mt-1">
                            {r.ai_job_post}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Apply button */}
                    {alreadyApplied ? (
                      <div className="w-full py-2.5 rounded-xl text-xs font-medium text-center bg-gray-50 text-gray-400 border border-gray-100">
                        ✓ Application sent
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button onClick={() => setApplyingTo(r)}
                          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                          📩 Apply Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Apply modal */}
      {applyingTo && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => { setApplyingTo(null); setMessage('') }} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {applyingTo.familyUser?.avatar_url ? (
                <img src={applyingTo.familyUser.avatar_url}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {applyingTo.familyUser?.full_name?.split(' ')?.[0]?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  Apply for {SERVICE_LABELS[applyingTo.service_type] || applyingTo.service_type}
                </h3>
                <p className="text-xs text-gray-400">
                  {(() => {
                    const parts = (applyingTo.familyUser?.full_name || '').split(' ').filter(Boolean)
                    const name = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || 'Family'
                    return `${name}${(applyingTo.pay_min || applyingTo.pay_max) ? ` · $${applyingTo.pay_min}${applyingTo.pay_max ? `–$${applyingTo.pay_max}` : '+'}/hr` : ''}`
                  })()}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3">Write a short intro message to the family</p>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder={`Hi! I'm interested in this ${applyingTo.service_type} position. I have experience with...`}
              rows={4}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setApplyingTo(null); setMessage('') }}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium">
                Cancel
              </button>
              <button onClick={submitApplication} disabled={applying === applyingTo.id}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                {applying === applyingTo.id ? 'Sending...' : '📩 Send Application'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}