'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminFamilies() {
  const [families, setFamilies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('users')
        .select(`
          *,
          family_profiles (
            onboarding_answers,
            languages
          ),
          notifications (
            id, type, read, created_at
          )
        `)
        .eq('role', 'family')
        .order('created_at', { ascending: false })

      setFamilies(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const banUser = async (userId: string, type: 'hard' | 'shadow', reason: string) => {
    await supabase.from('users').update({
      is_banned: type === 'hard',
      is_shadow_banned: type === 'shadow',
      ban_reason: reason,
    }).eq('id', userId)
    setFamilies(prev => prev.map(f =>
      f.id === userId ? {
        ...f,
        is_banned: type === 'hard',
        is_shadow_banned: type === 'shadow',
        ban_reason: reason
      } : f
    ))
    setSelected(null)
  }

  const unbanUser = async (userId: string) => {
    await supabase.from('users').update({
      is_banned: false,
      is_shadow_banned: false,
      ban_reason: null
    }).eq('id', userId)
    setFamilies(prev => prev.map(f =>
      f.id === userId ? { ...f, is_banned: false, is_shadow_banned: false, ban_reason: null } : f
    ))
    setSelected(null)
  }

  const filtered = families.filter(f =>
    f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const answers = (f: any) => f.family_profiles?.onboarding_answers || {}

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Families</h1>
          <p className="text-gray-400 mt-1">{families.length} registered families</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Families', value: families.length, icon: '👨‍👩‍👧' },
          { label: 'Active', value: families.filter(f => !f.is_banned && !f.is_shadow_banned).length, icon: '✅' },
          { label: 'Banned', value: families.filter(f => f.is_banned || f.is_shadow_banned).length, icon: '🚫' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or email..."
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF] mb-4"
      />

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="divide-y divide-gray-800">
          {filtered.map(f => (
            <div key={f.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {f.avatar_url ? (
                  <img src={f.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                    {f.full_name?.[0] || '?'}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm">{f.full_name}</span>
                  {f.is_banned && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">🚫 Banned</span>}
                  {f.is_shadow_banned && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">👻 Shadow</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{f.email}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {answers(f).services?.length
                    ? `Looking for: ${answers(f).services.join(', ')}`
                    : 'No services specified'}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Joined {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Notifications count */}
              <div className="text-center hidden md:block">
                <div className="text-sm font-bold text-white">{f.notifications?.length || 0}</div>
                <div className="text-xs text-gray-500">notifications</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelected(f)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
                >
                  View
                </button>
                {f.is_banned || f.is_shadow_banned ? (
                  <button
                    onClick={() => unbanUser(f.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    onClick={() => setSelected(f)}
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

      {/* Detail Modal */}
      {selected && (
        <FamilyModal
          family={selected}
          onClose={() => setSelected(null)}
          onBan={banUser}
          onUnban={unbanUser}
        />
      )}
    </div>
  )
}

function FamilyModal({ family, onClose, onBan, onUnban }: {
  family: any
  onClose: () => void
  onBan: (id: string, type: 'hard' | 'shadow', reason: string) => void
  onUnban: (id: string) => void
}) {
  const [banReason, setBanReason] = useState('')
  const [banType, setBanType] = useState<'shadow' | 'hard'>('shadow')
  const answers = family.family_profiles?.onboarding_answers || {}

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {family.avatar_url ? (
              <img src={family.avatar_url} className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-300">
                {family.full_name?.[0] || '?'}
              </div>
            )}
            <div>
              <div className="font-bold text-white">{family.full_name}</div>
              <div className="text-sm text-gray-400">{family.email}</div>
              <div className="text-xs text-gray-500">{family.id}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">Services Needed</div>
            <div className="text-sm text-white">{answers.services?.join(', ') || '—'}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">Schedule</div>
            <div className="text-sm text-white">{answers.childcare_schedule || answers.house_frequency || '—'}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">Budget</div>
            <div className="text-sm text-white">
              {answers.childcare_budget || answers.chef_budget || answers.house_budget || answers.elder_budget || answers.tutor_budget || '—'}
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">Notifications</div>
            <div className="text-sm text-white">{family.notifications?.length || 0} total</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">Joined</div>
            <div className="text-sm text-white">
              {new Date(family.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {family.is_banned && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <div className="text-xs text-red-400 mb-1">🚫 Hard Banned</div>
              <div className="text-sm text-red-300">{family.ban_reason}</div>
            </div>
          )}
          {family.is_shadow_banned && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
              <div className="text-xs text-yellow-400 mb-1">👻 Shadow Banned</div>
              <div className="text-sm text-yellow-300">{family.ban_reason}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!family.is_banned && !family.is_shadow_banned ? (
          <div className="space-y-3">
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
                <div className="text-xs font-normal opacity-70 mt-0.5">Invisible to caregivers</div>
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
                <div className="text-xs font-normal opacity-70 mt-0.5">Blocked from platform</div>
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
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => onBan(family.id, banType, banReason)}
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
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white transition"
            >
              Close
            </button>
            <button
              onClick={() => onUnban(family.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition"
            >
              ✅ Remove Ban
            </button>
          </div>
        )}
      </div>
    </div>
  )
}