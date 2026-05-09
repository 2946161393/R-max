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

export default function CaregiverRequestsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [myApplications, setMyApplications] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [applyingTo, setApplyingTo] = useState<any>(null)
  const [message, setMessage] = useState('')
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

      // Fetch all open requests
      const { data: requestsData } = await supabase
        .from('service_requests')
        .select(`
          *,
          family_profiles (
            id, onboarding_answers,
            users ( full_name, avatar_url )
          ),
          applications ( id )
        `)
        .eq('status', 'open')
        .neq('service_type', 'manual')
        .order('created_at', { ascending: false })

      // Fetch my existing applications
      let myApps = new Set<string>()
      if (caregiverData?.id) {
        const { data: appsData } = await supabase
          .from('applications')
          .select('request_id')
          .eq('caregiver_id', caregiverData.id)
        appsData?.forEach(a => myApps.add(a.request_id))
      }

      setUser(userData)
      setProfile(caregiverData)
      setRequests(requestsData || [])
      setMyApplications(myApps)
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
      // Notify the family
      const familyUserId = applyingTo.family_profiles?.users?.id
      if (familyUserId) {
        await supabase.from('notifications').insert({
          user_id: familyUserId,
          type: 'new_application',
          title: `${user?.full_name} applied to your request! 📩`,
          body: message || `${user?.full_name} is interested in your ${applyingTo.service_type} position.`,
          data: {
            caregiverUserId: user?.id,
            caregiverName: user?.full_name,
            requestId: applyingTo.id
          }
        })
      }

      setMyApplications(prev => new Set([...prev, applyingTo.id]))
      setApplyingTo(null)
      setMessage('')
    }

    setApplying(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/caregiver/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div>
          <div className="font-semibold text-gray-900 text-sm">Browse Requests</div>
          <div className="text-xs text-gray-400">{requests.length} open positions</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {requests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No open requests right now.</p>
            <p className="text-xs mt-1 text-gray-300">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => {
              const familyUser = r.family_profiles?.users
              const answers = r.family_profiles?.onboarding_answers || {}
              const alreadyApplied = myApplications.has(r.id)
              const appCount = r.applications?.length || 0

              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 transition">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {familyUser?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {SERVICE_LABELS[r.service_type] || r.service_type}
                        </span>
                        {appCount > 0 && (
                          <span className="text-xs text-gray-400">{appCount} applicant{appCount > 1 ? 's' : ''}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Posted {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Job post */}
                  {r.ai_job_post && (
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{r.ai_job_post}</p>
                  )}

                  {/* Key details from onboarding */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {answers.childcare_schedule && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">🕐 {answers.childcare_schedule}</span>
                    )}
                    {(answers.childcare_budget || answers.chef_budget || answers.pet_budget) && (
                      <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
                        💰 {answers.childcare_budget || answers.chef_budget || answers.pet_budget}/hr
                      </span>
                    )}
                    {answers.childcare_when && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full">📅 {answers.childcare_when}</span>
                    )}
                    {answers.childcare_extras?.includes('bilingual') && (
                      <span className="text-xs bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full">🗣 Bilingual preferred</span>
                    )}
                  </div>

                  {/* Apply button */}
                  {alreadyApplied ? (
                    <div className="w-full py-2.5 rounded-xl text-xs font-medium text-center bg-gray-50 text-gray-400 border border-gray-100">
                      ✓ Applied
                    </div>
                  ) : (
                    <button
                      onClick={() => setApplyingTo(r)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-white transition"
                      style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
                    >
                      📩 Apply Now
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Apply modal */}
      {applyingTo && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setApplyingTo(null)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6 shadow-2xl">
            <h3 className="font-semibold text-gray-900 mb-1">
              Apply for {SERVICE_LABELS[applyingTo.service_type] || applyingTo.service_type}
            </h3>
            <p className="text-xs text-gray-400 mb-4">Write a short intro message to the family</p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Hi! I'm interested in this ${applyingTo.service_type} position. I have experience with...`}
              rows={4}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setApplyingTo(null)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={submitApplication}
                disabled={applying === applyingTo.id}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
              >
                {applying === applyingTo.id ? 'Sending...' : '📩 Send Application'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}