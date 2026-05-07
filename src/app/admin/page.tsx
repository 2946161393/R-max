'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ADMIN_EMAILS = ['zwang168@seas.upenn.edu', 'zijinwang97@gmail.com', 'zijinwang168@gmail.com']

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'family' | 'caregiver'>('all')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [banReason, setBanReason] = useState('')
  const [banType, setBanType] = useState<'shadow' | 'hard'>('shadow')
  const [stats, setStats] = useState({ total: 0, families: 0, caregivers: 0, banned: 0, shadowBanned: 0 })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
        router.push('/')
        return
      }

      const { data: usersData } = await supabase
        .from('users')
        .select(`
          *,
          caregiver_profiles (
            services, languages, years_experience, hourly_rate_min, hourly_rate_max, bio, background_check_status
          ),
          family_profiles (
            onboarding_answers
          )
        `)
        .order('created_at', { ascending: false })

      setUsers(usersData || [])
      setStats({
        total: usersData?.length || 0,
        families: usersData?.filter(u => u.role === 'family').length || 0,
        caregivers: usersData?.filter(u => u.role === 'caregiver').length || 0,
        banned: usersData?.filter(u => u.is_banned).length || 0,
        shadowBanned: usersData?.filter(u => u.is_shadow_banned).length || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  // Hard ban — user sees banned page, cannot access platform
  const hardBanUser = async (userId: string, reason: string) => {
    await supabase.from('users').update({
      is_banned: true,
      is_shadow_banned: false,
      ban_reason: reason
    }).eq('id', userId)
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, is_banned: true, is_shadow_banned: false, ban_reason: reason } : u
    ))
    setSelectedUser(null)
    setBanReason('')
  }

  // Shadow ban — user can still log in but is invisible to others
  const shadowBanUser = async (userId: string, reason: string) => {
    await supabase.from('users').update({
      is_shadow_banned: true,
      is_banned: false,
      ban_reason: reason
    }).eq('id', userId)
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, is_shadow_banned: true, is_banned: false, ban_reason: reason } : u
    ))
    setSelectedUser(null)
    setBanReason('')
  }

  // Remove all bans
  const unbanUser = async (userId: string) => {
    await supabase.from('users').update({
      is_banned: false,
      is_shadow_banned: false,
      ban_reason: null
    }).eq('id', userId)
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, is_banned: false, is_shadow_banned: false, ban_reason: null } : u
    ))
    setSelectedUser(null)
  }

  const handleBan = () => {
    if (!banReason.trim()) return
    if (banType === 'hard') {
      hardBanUser(selectedUser.id, banReason)
    } else {
      shadowBanUser(selectedUser.id, banReason)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || u.role === filter
    return matchSearch && matchFilter
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-gray-400">Loading admin...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ruah-logo.png" className="w-8 h-8" />
          <div>
            <div className="font-bold text-white">Ruah! Admin</div>
            <div className="text-xs text-gray-400">Internal Dashboard</div>
          </div>
        </div>
        <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-white">
          ← Back to site
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Users', value: stats.total, icon: '👥' },
            { label: 'Families', value: stats.families, icon: '👨‍👩‍👧' },
            { label: 'Caregivers', value: stats.caregivers, icon: '🤝' },
            { label: 'Hard Banned', value: stats.banned, icon: '🚫' },
            { label: 'Shadow Banned', value: stats.shadowBanned, icon: '👻' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF]"
          />
          {['all', 'family', 'caregiver'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                filter === f
                  ? 'bg-[#7FB3FF] text-white'
                  : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Users Table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Users ({filteredUsers.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {filteredUsers.map(u => (
              <div key={u.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                      {u.full_name?.[0] || '?'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{u.full_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === 'family'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {u.role}
                    </span>
                    {u.is_banned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                        🚫 Hard Banned
                      </span>
                    )}
                    {u.is_shadow_banned && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        👻 Shadow Banned
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                  {u.role === 'caregiver' && u.caregiver_profiles && (
                    <div className="text-xs text-gray-500 mt-1">
                      {u.caregiver_profiles.services?.join(', ')} · {u.caregiver_profiles.languages?.join(', ')} · ${u.caregiver_profiles.hourly_rate_min}–${u.caregiver_profiles.hourly_rate_max}/hr
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mt-0.5">
                    Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                {/* Bio preview */}
                {u.role === 'caregiver' && u.caregiver_profiles?.bio && (
                  <div className="hidden md:block max-w-xs">
                    <p className="text-xs text-gray-400 line-clamp-2">{u.caregiver_profiles.bio}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setSelectedUser(u); setBanReason(''); setBanType('shadow') }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
                  >
                    View
                  </button>
                  {(u.is_banned || u.is_shadow_banned) ? (
                    <button
                      onClick={() => unbanUser(u.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                    >
                      Unban
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSelectedUser(u); setBanReason(''); setBanType('shadow') }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                    >
                      Ban
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-300">
                    {selectedUser.full_name?.[0] || '?'}
                  </div>
                )}
                <div>
                  <div className="font-bold text-white">{selectedUser.full_name}</div>
                  <div className="text-sm text-gray-400">{selectedUser.email}</div>
                  <div className="text-xs text-gray-500">{selectedUser.id}</div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-6">
              <div className="bg-gray-800 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">Role</div>
                <div className="text-sm text-white">{selectedUser.role}</div>
              </div>

              {selectedUser.role === 'caregiver' && selectedUser.caregiver_profiles && (
                <>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">Services</div>
                    <div className="text-sm text-white">{selectedUser.caregiver_profiles.services?.join(', ') || '—'}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">Languages</div>
                    <div className="text-sm text-white">{selectedUser.caregiver_profiles.languages?.join(', ') || '—'}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">Bio</div>
                    <div className="text-sm text-white">{selectedUser.caregiver_profiles.bio || '—'}</div>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">Rate</div>
                    <div className="text-sm text-white">${selectedUser.caregiver_profiles.hourly_rate_min}–${selectedUser.caregiver_profiles.hourly_rate_max}/hr</div>
                  </div>
                </>
              )}

              {selectedUser.role === 'family' && selectedUser.family_profiles && (
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">Onboarding Answers</div>
                  <pre className="text-xs text-gray-300 overflow-auto max-h-32">
                    {JSON.stringify(selectedUser.family_profiles.onboarding_answers, null, 2)}
                  </pre>
                </div>
              )}

              {/* Current ban status */}
              {selectedUser.is_banned && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <div className="text-xs text-red-400 mb-1">🚫 Hard Banned</div>
                  <div className="text-sm text-red-300">{selectedUser.ban_reason}</div>
                </div>
              )}
              {selectedUser.is_shadow_banned && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                  <div className="text-xs text-yellow-400 mb-1">👻 Shadow Banned</div>
                  <div className="text-sm text-yellow-300">{selectedUser.ban_reason}</div>
                </div>
              )}
            </div>

            {/* Ban / Unban Actions */}
            {!selectedUser.is_banned && !selectedUser.is_shadow_banned ? (
              <div className="space-y-3">
                {/* Ban type selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBanType('shadow')}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                      banType === 'shadow'
                        ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                        : 'border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    👻 Shadow Ban
                    <div className="text-xs font-normal opacity-70 mt-0.5">Invisible, can still login</div>
                  </button>
                  <button
                    onClick={() => setBanType('hard')}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                      banType === 'hard'
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    🚫 Hard Ban
                    <div className="text-xs font-normal opacity-70 mt-0.5">Blocked, sees banned page</div>
                  </button>
                </div>

                <textarea
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Reason for ban (internal only)..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBan}
                    disabled={!banReason.trim()}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition ${
                      banType === 'hard' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-600 hover:bg-yellow-700'
                    }`}
                  >
                    {banType === 'hard' ? '🚫 Hard Ban' : '👻 Shadow Ban'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white transition"
                >
                  Close
                </button>
                <button
                  onClick={() => unbanUser(selectedUser.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition"
                >
                  ✅ Remove Ban
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}