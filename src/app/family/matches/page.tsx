'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FamilyNav from '@/components/FamilyNav'

const FILTERS = ['All', 'New', 'Waiting', 'Matched', 'Passed'] as const
type Filter = typeof FILTERS[number]

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': '< 1 yr', '1': '1–2 yrs', '3': '3–5 yrs', '5': '5–10 yrs', '10': '10+ yrs',
}

export default function FamilyMatchesPage() {
  const [user, setUser] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('All')
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: familyData } = await supabase.from('family_profiles').select('*').eq('user_id', authUser.id).single()
      const { data: notifData } = await supabase.from('notifications').select('id, read').eq('user_id', authUser.id)

      let matchesData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('matches')
          .select(`*, service_requests!inner(family_id), caregiver_profiles(user_id, services, languages, hourly_rate_min, hourly_rate_max, years_experience, bio, is_verified, onboarding_answers, users(full_name, email, avatar_url))`)
          .eq('service_requests.family_id', familyData.id)
          .order('created_at', { ascending: false })
        matchesData = data || []
      }

      setUser(userData)
      setMatches(matchesData)
      setUnreadCount((notifData || []).filter(n => !n.read).length)
      setLoading(false)
    }
    load()
  }, [])

  const triggerMutualMatch = async (matchId: string, caregiverUserId: string) => {
    await supabase.from('matches').update({ status: 'accepted' }).eq('id', matchId)
    await supabase.from('notifications').insert([
      {
        user_id: user.id,
        type: 'mutual_match',
        title: '🎉 It\'s a match!',
        body: 'Both you and the caregiver are interested. You can now message each other!',
        data: { matchId, caregiverUserId }
      },
      {
        user_id: caregiverUserId,
        type: 'mutual_match',
        title: '🎉 It\'s a match!',
        body: 'Both you and the family are interested. You can now message each other!',
        data: { matchId, familyUserId: user.id }
      }
    ])
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'accepted', family_interested: true } : m))
  }

  const updateMatchInterest = async (matchId: string, interested: boolean) => {
    await supabase.from('matches').update({ family_interested: interested }).eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, family_interested: interested } : m))

    if (interested) {
      const { data: matchData } = await supabase
        .from('matches').select('*, caregiver_profiles(user_id)').eq('id', matchId).single()
      if (matchData?.caregiver_interested === true) {
        await triggerMutualMatch(matchId, matchData.caregiver_profiles?.user_id)
      }
    }
  }

  const filteredMatches = matches.filter(m => {
    if (filter === 'All') return true
    if (filter === 'New') return m.family_interested === null && (m.status === 'admin_matched' || m.status === 'pending')
    if (filter === 'Waiting') return m.family_interested === true && m.status !== 'accepted'
    if (filter === 'Matched') return m.status === 'accepted'
    if (filter === 'Passed') return m.family_interested === false
    return true
  })

  const countFor = (f: Filter) => {
    if (f === 'All') return matches.length
    if (f === 'New') return matches.filter(m => m.family_interested === null && (m.status === 'admin_matched' || m.status === 'pending')).length
    if (f === 'Waiting') return matches.filter(m => m.family_interested === true && m.status !== 'accepted').length
    if (f === 'Matched') return matches.filter(m => m.status === 'accepted').length
    if (f === 'Passed') return matches.filter(m => m.family_interested === false).length
    return 0
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <FamilyNav userName={user?.full_name} unreadCount={unreadCount} />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/family/dashboard')}
            className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">My Matches</h1>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map(f => {
            const count = countFor(f)
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                  filter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {f} {count > 0 && <span className={`ml-1 text-xs ${filter === f ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>}
              </button>
            )
          })}
        </div>

        {filteredMatches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-sm">No {filter !== 'All' ? filter.toLowerCase() : ''} matches yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMatches.map(m => {
              const cp = m.caregiver_profiles
              const caregiverUser = cp?.users
              const isPending = m.family_interested === null && (m.status === 'admin_matched' || m.status === 'pending')
              const familyAccepted = m.family_interested === true
              const isMutual = m.status === 'accepted'

              return (
                <div key={m.id} className={`bg-white rounded-2xl border p-5 transition ${
                  isMutual ? 'border-green-200'
                  : familyAccepted ? 'border-yellow-200'
                  : m.family_interested === false ? 'border-gray-100 opacity-50'
                  : 'border-[#7FB3FF]/40'
                }`}>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isMutual ? 'bg-green-100 text-green-600'
                          : familyAccepted ? 'bg-yellow-100 text-yellow-600'
                          : m.family_interested === false ? 'bg-gray-100 text-gray-500'
                          : 'bg-blue-100 text-blue-500'
                        }`}>
                          {isMutual ? '🎉 Matched!' : familyAccepted ? '⏳ Waiting for caregiver' : m.family_interested === false ? 'Passed' : '✨ New match'}
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

                  {isPending && m.expires_at && (
                    <div className="mt-2 text-xs text-gray-400">
                      ⏰ Expires {new Date(m.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}

                  {isPending && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => updateMatchInterest(m.id, true)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                        ✓ I'm Interested
                      </button>
                      <button onClick={() => router.push(`/caregiver/${cp?.user_id}`)}
                        className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition">
                        👤 View Profile
                      </button>
                      <button onClick={() => updateMatchInterest(m.id, false)}
                        className="px-4 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-400 hover:border-red-200 hover:text-red-400 transition">
                        ✕
                      </button>
                    </div>
                  )}

                  {familyAccepted && !isMutual && (
                    <div className="mt-3 px-3 py-2 bg-yellow-50 rounded-xl text-xs text-yellow-600 text-center">
                      ⏳ Waiting for caregiver to respond...
                    </div>
                  )}

                  {isMutual && (
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
    </div>
  )
}