'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

export default function AdminMatching() {
  const [matches, setMatches] = useState<any[]>([])
  const [families, setFamilies] = useState<any[]>([])
  const [caregivers, setCaregivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [manualFamily, setManualFamily] = useState('')
  const [manualCaregiver, setManualCaregiver] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [creating, setCreating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      // Load matches with family and caregiver info
      const { data: matchData } = await supabase
        .from('matches')
        .select(`
          *,
          caregiver_profiles (
            user_id,
            services,
            languages,
            hourly_rate_min,
            hourly_rate_max,
            years_experience,
            bio
          ),
          service_requests (
            id,
            service_type,
            status,
            ai_job_post,
            family_profiles (
              user_id,
              onboarding_answers,
              users (
                full_name,
                email,
                avatar_url
              )
            )
          )
        `)
        .order('created_at', { ascending: false })

      // Load all families for manual matching
      const { data: familyData } = await supabase
        .from('users')
        .select(`
          id, full_name, email,
          family_profiles ( onboarding_answers )
        `)
        .eq('role', 'family')
        .eq('is_banned', false)
        .eq('is_shadow_banned', false)

      // Load all caregivers for manual matching
      const { data: caregiverData } = await supabase
        .from('users')
        .select(`
          id, full_name, email, avatar_url,
          caregiver_profiles (
            id, services, languages,
            hourly_rate_min, hourly_rate_max,
            years_experience, bio
          )
        `)
        .eq('role', 'caregiver')
        .eq('is_banned', false)
        .eq('is_shadow_banned', false)

      setMatches(matchData || [])
      setFamilies(familyData || [])
      setCaregivers(caregiverData || [])
      setLoading(false)
    }
    load()
  }, [])

  const updateMatchStatus = async (matchId: string, status: string) => {
    await supabase.from('matches').update({ status }).eq('id', matchId)
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m))
  }

  const createManualMatch = async () => {
    if (!manualFamily || !manualCaregiver) return
    setCreating(true)

    const family = families.find(f => f.id === manualFamily)
    const caregiver = caregivers.find(c => c.id === manualCaregiver)

    // Create service request first
    const { data: familyProfile } = await supabase
      .from('family_profiles')
      .select('id')
      .eq('user_id', manualFamily)
      .single()

    const { data: reqData } = await supabase
      .from('service_requests')
      .insert({
        family_id: familyProfile?.id,
        service_type: 'manual',
        status: 'open',
        ai_job_post: manualNote || 'Manual match created by admin'
      })
      .select()
      .single()

    if (reqData) {
      const { data: caregiverProfile } = await supabase
        .from('caregiver_profiles')
        .select('id')
        .eq('user_id', manualCaregiver)
        .single()

      await supabase.from('matches').insert({
        request_id: reqData.id,
        caregiver_id: caregiverProfile?.id,
        status: 'admin_matched',
        ai_reasoning: manualNote || 'Manually matched by admin'
      })

      // Notify caregiver
      await supabase.from('notifications').insert({
        user_id: manualCaregiver,
        type: 'new_match',
        title: `${family?.full_name} is interested in you! 🎉`,
        body: manualNote || `The Ruah team has matched you with ${family?.full_name}. Please review and respond!`,
        data: {
          familyUserId: manualFamily,
          familyName: family?.full_name,
          adminMatch: true
        }
      })

      // Notify family
      await supabase.from('notifications').insert({
        user_id: manualFamily,
        type: 'new_match',
        title: `We found a great match for you! 🎉`,
        body: `The Ruah team has matched you with ${caregiver?.full_name}. Check their profile!`,
        data: {
          caregiverUserId: manualCaregiver,
          caregiverName: caregiver?.full_name,
          adminMatch: true
        }
      })
    }

    setManualFamily('')
    setManualCaregiver('')
    setManualNote('')
    setCreating(false)
    alert(`✅ Manual match created between ${family?.full_name} and ${caregiver?.full_name}!`)
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'accepted': return 'bg-green-500/20 text-green-400'
      case 'declined': return 'bg-red-500/20 text-red-400'
      case 'admin_matched': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Matching System</h1>
        <p className="text-gray-400 mt-1">View all matches and manually create new ones</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Matches', value: matches.length, icon: '🎯' },
          { label: 'Pending', value: matches.filter(m => m.status === 'pending').length, icon: '⏳' },
          { label: 'Accepted', value: matches.filter(m => m.status === 'accepted').length, icon: '✅' },
          { label: 'Admin Matched', value: matches.filter(m => m.status === 'admin_matched').length, icon: '👑' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Manual Match Creator */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-8">
        <h2 className="font-semibold text-white mb-4">👑 Create Manual Match</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Select Family</label>
            <select
              value={manualFamily}
              onChange={e => setManualFamily(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7FB3FF]"
            >
              <option value="">Choose a family...</option>
              {families.map(f => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Select Caregiver</label>
            <select
              value={manualCaregiver}
              onChange={e => setManualCaregiver(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7FB3FF]"
            >
              <option value="">Choose a caregiver...</option>
              {caregivers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name} — {c.caregiver_profiles?.services?.join(', ')} (${c.caregiver_profiles?.hourly_rate_min}–${c.caregiver_profiles?.hourly_rate_max}/hr)
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={manualNote}
          onChange={e => setManualNote(e.target.value)}
          placeholder="Note for this match (optional — sent to both parties)..."
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF] resize-none mb-4"
        />
        <button
          onClick={createManualMatch}
          disabled={!manualFamily || !manualCaregiver || creating}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition"
          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
        >
          {creating ? 'Creating...' : '✨ Create Match & Notify Both Parties'}
        </button>
      </div>

      {/* Matches List */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">All Matches ({matches.length})</h2>
        </div>
        <div className="divide-y divide-gray-800">
          {matches.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">
              No matches yet
            </div>
          )}
          {matches.map(m => {
            const family = m.service_requests?.family_profiles
            const caregiver = m.caregiver_profiles
            return (
              <div key={m.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-medium">
                      {family?.users?.full_name || 'Unknown Family'}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="text-sm text-[#7FB3FF] font-medium">
                      Caregiver
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {m.ai_reasoning}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {new Date(m.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>

                {/* Override Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.status !== 'accepted' && (
                    <button
                      onClick={() => updateMatchStatus(m.id, 'accepted')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                    >
                      ✅ Approve
                    </button>
                  )}
                  {m.status !== 'declined' && (
                    <button
                      onClick={() => updateMatchStatus(m.id, 'declined')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                    >
                      ✕ Decline
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}