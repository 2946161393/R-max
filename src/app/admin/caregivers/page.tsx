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

// Convert array of objects to CSV and trigger browser download
function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) {
    alert('No data to export')
    return
  }
  const headers = Object.keys(rows[0])
  const escapeCell = (val: any) => {
    if (val == null) return ''
    const str = Array.isArray(val) ? val.join('; ') : String(val)
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const DATE_RANGES = [
  { label: 'All time', days: null },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

type SortKey = 'newest' | 'oldest' | 'name'

export default function AdminCaregivers() {
  const [caregivers, setCaregivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified' | 'banned'>('all')
  const [dateRange, setDateRange] = useState<number | null>(null)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('users')
        .select(`
          *,
          caregiver_profiles (
            id, services, languages, years_experience,
            hourly_rate_min, hourly_rate_max,
            bio, background_check_status, is_verified,
            onboarding_answers, rating, review_count,
            verification_status, id_photo_path, selfie_path, verification_submitted_at
          )
        `)
        .eq('role', 'caregiver')
        .order('created_at', { ascending: false })

      setCaregivers(data || [])
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
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? { ...c, is_banned: type === 'hard', is_shadow_banned: type === 'shadow', ban_reason: reason } : c
    ))
    setSelected(null)
  }

  const unbanUser = async (userId: string) => {
    await supabase.from('users').update({
      is_banned: false, is_shadow_banned: false, ban_reason: null
    }).eq('id', userId)
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? { ...c, is_banned: false, is_shadow_banned: false, ban_reason: null } : c
    ))
    setSelected(null)
  }

  const verifyCaregiver = async (userId: string) => {
    const res = await fetch('/api/admin/verify-caregiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'approve' }),
    })
    if (!res.ok) {
      alert('Failed to verify. Please try again.')
      return
    }
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? {
        ...c,
        caregiver_profiles: { ...c.caregiver_profiles, is_verified: true, verification_status: 'approved' }
      } : c
    ))
    setSelected(null)
  }

  const rejectVerification = async (userId: string) => {
    const res = await fetch('/api/admin/verify-caregiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'reject' }),
    })
    if (!res.ok) {
      alert('Failed to reject. Please try again.')
      return
    }
    setCaregivers(prev => prev.map(c =>
      c.id === userId ? {
        ...c,
        caregiver_profiles: { ...c.caregiver_profiles, verification_status: 'rejected' }
      } : c
    ))
    setSelected(null)
  }

  // Pending verification queue (not affected by filters)
  const pendingVerifications = caregivers.filter(
    c => c.caregiver_profiles?.verification_status === 'pending'
  )

  // Apply all filters: search + status + date range
  let filtered = caregivers.filter(c => {
    const matchSearch =
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'verified' && c.caregiver_profiles?.is_verified) ||
      (filter === 'unverified' && !c.caregiver_profiles?.is_verified) ||
      (filter === 'banned' && (c.is_banned || c.is_shadow_banned))

    let matchDate = true
    const hasCustomRange = customFrom || customTo
    if (hasCustomRange && c.created_at) {
      const created = new Date(c.created_at).getTime()
      if (customFrom) matchDate = matchDate && created >= new Date(customFrom).getTime()
      if (customTo) matchDate = matchDate && created < new Date(customTo).getTime() + 24 * 60 * 60 * 1000
    } else if (dateRange != null && c.created_at) {
      const cutoff = Date.now() - dateRange * 24 * 60 * 60 * 1000
      matchDate = new Date(c.created_at).getTime() >= cutoff
    }
    return matchSearch && matchFilter && matchDate
  })

  // Apply sort
  filtered = [...filtered].sort((a, b) => {
    if (sortKey === 'name') return (a.full_name || '').localeCompare(b.full_name || '')
    const at = new Date(a.created_at || 0).getTime()
    const bt = new Date(b.created_at || 0).getTime()
    return sortKey === 'oldest' ? at - bt : bt - at
  })

  const exportCaregiversCSV = () => {
    const rows = filtered.map(c => ({
      name: c.full_name,
      email: c.email,
      services: c.caregiver_profiles?.services,
      languages: c.caregiver_profiles?.languages,
      experience: c.caregiver_profiles?.years_experience,
      rate_min: c.caregiver_profiles?.hourly_rate_min,
      rate_max: c.caregiver_profiles?.hourly_rate_max,
      verified: c.caregiver_profiles?.is_verified ? 'yes' : 'no',
      verification_status: c.caregiver_profiles?.verification_status || '',
      banned: c.is_banned ? 'yes' : 'no',
      shadow_banned: c.is_shadow_banned ? 'yes' : 'no',
      signed_up: c.created_at ? new Date(c.created_at).toLocaleDateString('en-US') : '',
    }))
    downloadCSV(rows, `ruah-caregivers-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)))
    }
  }

  const copySelectedEmails = async () => {
    const emails = filtered
      .filter(c => selectedIds.has(c.id))
      .map(c => c.email)
      .filter(Boolean)
    if (emails.length === 0) return
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      alert(`Copied ${emails.length} email${emails.length > 1 ? 's' : ''} to clipboard`)
    } catch {
      alert('Could not copy. Your browser may block clipboard access.')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const hasCustomRange = customFrom || customTo

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Caregivers</h1>
        <p className="text-gray-400 mt-1">{caregivers.length} registered caregivers</p>
      </div>

      {/* Pending Verification Queue */}
      {pendingVerifications.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🛡️</span>
            <h2 className="font-bold text-amber-300">
              {pendingVerifications.length} awaiting verification
            </h2>
          </div>
          <div className="space-y-2">
            {pendingVerifications.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-gray-900/50 rounded-xl p-3">
                {c.avatar_url
                  ? <img src={c.avatar_url} className="w-9 h-9 rounded-full object-cover" />
                  : <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">{c.full_name?.[0] || '?'}</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{c.full_name}</div>
                  <div className="text-xs text-gray-400">
                    Submitted {c.caregiver_profiles?.verification_submitted_at
                      ? new Date(c.caregiver_profiles.verification_submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(c)}
                  className="text-xs px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition">
                  Review →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: caregivers.length, icon: '🤝' },
          { label: 'Verified', value: caregivers.filter(c => c.caregiver_profiles?.is_verified).length, icon: '✅' },
          { label: 'Pending', value: pendingVerifications.length, icon: '⏳' },
          { label: 'Banned', value: caregivers.filter(c => c.is_banned || c.is_shadow_banned).length, icon: '🚫' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters row 1: search + status + export */}
      <div className="flex gap-3 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FB3FF]"
        />
        {(['all', 'verified', 'unverified', 'banned'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              filter === f ? 'bg-[#7FB3FF] text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={exportCaregiversCSV}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-[#7FB3FF] transition whitespace-nowrap">
          ⬇ Export CSV
        </button>
      </div>

      {/* Filters row 2: date range + sort */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-gray-500">Joined:</span>
        {DATE_RANGES.map(r => (
          <button key={r.label}
            onClick={() => { setDateRange(r.days); setCustomFrom(''); setCustomTo('') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              !hasCustomRange && dateRange === r.days ? 'bg-[#7FB3FF] text-white' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
            }`}>
            {r.label}
          </button>
        ))}
        <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border ${
          hasCustomRange ? 'border-[#7FB3FF]' : 'border-gray-700'
        }`}>
          <input type="date" value={customFrom}
            onChange={e => { setCustomFrom(e.target.value); setDateRange(null) }}
            className="bg-gray-900 text-xs text-gray-300 focus:outline-none [color-scheme:dark]" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={customTo}
            onChange={e => { setCustomTo(e.target.value); setDateRange(null) }}
            className="bg-gray-900 text-xs text-gray-300 focus:outline-none [color-scheme:dark]" />
          {hasCustomRange && (
            <button onClick={() => { setCustomFrom(''); setCustomTo('') }}
              className="text-xs text-gray-500 hover:text-white ml-1">✕</button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">Sort:</span>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#7FB3FF]">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-[#7FB3FF]/10 border border-[#7FB3FF]/30 rounded-xl px-4 py-2.5 mb-4">
          <span className="text-sm text-[#7FB3FF] font-medium">{selectedIds.size} selected</span>
          <button onClick={copySelectedEmails}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#7FB3FF] text-white font-medium hover:bg-[#6BA3F5] transition">
            📋 Copy emails
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-400 hover:text-white ml-auto">Clear</button>
        </div>
      )}

      {/* Result count + select all */}
      <div className="flex items-center gap-3 mb-2 px-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
            className="w-4 h-4 rounded accent-[#7FB3FF]" />
          <span className="text-xs text-gray-500">Select all ({filtered.length})</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="divide-y divide-gray-800">
          {filtered.map(c => (
            <div key={c.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition">
              <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)}
                className="w-4 h-4 rounded accent-[#7FB3FF] flex-shrink-0" />
              <div className="flex-shrink-0">
                {c.avatar_url
                  ? <img src={c.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">{c.full_name?.[0] || '?'}</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white text-sm">{c.full_name}</span>
                  {c.caregiver_profiles?.is_verified && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Verified</span>
                  )}
                  {c.caregiver_profiles?.verification_status === 'pending' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">⏳ Pending</span>
                  )}
                  {c.is_banned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">🚫 Banned</span>
                  )}
                  {c.is_shadow_banned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">👻 Shadow</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{c.email}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.caregiver_profiles?.services?.join(', ')} ·{' '}
                  {c.caregiver_profiles?.languages?.join(', ')} ·{' '}
                  ${c.caregiver_profiles?.hourly_rate_min}–${c.caregiver_profiles?.hourly_rate_max}/hr
                </div>
              </div>
              <div className="text-xs text-gray-600 hidden md:block flex-shrink-0">
                {c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setSelected(c)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition">
                  View
                </button>
                {!c.caregiver_profiles?.is_verified && !c.is_banned && (
                  <button onClick={() => verifyCaregiver(c.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition">
                    Verify
                  </button>
                )}
                {(c.is_banned || c.is_shadow_banned) ? (
                  <button onClick={() => unbanUser(c.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition">
                    Unban
                  </button>
                ) : (
                  <button onClick={() => setSelected(c)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
                    Ban
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <CaregiverModal
          caregiver={selected}
          onClose={() => setSelected(null)}
          onBan={banUser}
          onUnban={unbanUser}
          onVerify={verifyCaregiver}
          onReject={rejectVerification}
        />
      )}
    </div>
  )
}

function CaregiverModal({ caregiver, onClose, onBan, onUnban, onVerify, onReject }: {
  caregiver: any
  onClose: () => void
  onBan: (id: string, type: 'hard' | 'shadow', reason: string) => void
  onUnban: (id: string) => void
  onVerify: (userId: string) => void
  onReject: (userId: string) => void
}) {
  const [banReason, setBanReason] = useState('')
  const [banType, setBanType] = useState<'shadow' | 'hard'>('shadow')
  const [photos, setPhotos] = useState<{ idUrl: string | null; selfieUrl: string | null } | null>(null)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const profile = caregiver.caregiver_profiles
  const answers = profile?.onboarding_answers || {}
  const hasVerificationDocs = profile?.id_photo_path || profile?.selfie_path

  useEffect(() => {
    const loadPhotos = async () => {
      if (!hasVerificationDocs) return
      setLoadingPhotos(true)
      try {
        const res = await fetch('/api/admin/verification-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idPath: profile.id_photo_path,
            selfiePath: profile.selfie_path,
          })
        })
        const data = await res.json()
        setPhotos(data)
      } catch (err) {
        console.error('Failed to load photos', err)
      }
      setLoadingPhotos(false)
    }
    loadPhotos()
  }, [])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {caregiver.avatar_url
              ? <img src={caregiver.avatar_url} className="w-14 h-14 rounded-full object-cover" />
              : <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-300">{caregiver.full_name?.[0] || '?'}</div>
            }
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                {caregiver.full_name}
                {profile?.is_verified && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✓ Verified</span>
                )}
              </div>
              <div className="text-sm text-gray-400">{caregiver.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>

        {/* Verification Documents */}
        {hasVerificationDocs && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🛡️</span>
              <span className="text-sm font-semibold text-amber-300">Verification Documents</span>
              {profile?.verification_status === 'pending' && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-auto">Pending review</span>
              )}
            </div>

            {loadingPhotos ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading documents...</div>
            ) : photos ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-400 mb-1">ID Document</div>
                  {photos.idUrl
                    ? <a href={photos.idUrl} target="_blank" rel="noopener noreferrer">
                        <img src={photos.idUrl} className="w-full h-32 object-cover rounded-lg border border-gray-700 hover:border-amber-500 transition" />
                      </a>
                    : <div className="w-full h-32 rounded-lg bg-gray-800 flex items-center justify-center text-xs text-gray-500">No ID uploaded</div>
                  }
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Selfie</div>
                  {photos.selfieUrl
                    ? <a href={photos.selfieUrl} target="_blank" rel="noopener noreferrer">
                        <img src={photos.selfieUrl} className="w-full h-32 object-cover rounded-lg border border-gray-700 hover:border-amber-500 transition" />
                      </a>
                    : <div className="w-full h-32 rounded-lg bg-gray-800 flex items-center justify-center text-xs text-gray-500">No selfie uploaded</div>
                  }
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">Could not load documents</div>
            )}

            {profile?.verification_status === 'pending' && !profile?.is_verified && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => onReject(caregiver.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
                  ✕ Reject
                </button>
                <button onClick={() => onVerify(caregiver.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition">
                  ✓ Approve & Verify
                </button>
              </div>
            )}
          </div>
        )}

        {/* Details */}
        <div className="space-y-3 mb-4">
          {[
            { label: 'Services', value: profile?.services?.join(', ') },
            { label: 'Languages', value: profile?.languages?.join(', ') },
            { label: 'Experience', value: EXPERIENCE_LABELS[String(profile?.years_experience)] },
            { label: 'Rate', value: `$${profile?.hourly_rate_min}–$${profile?.hourly_rate_max}/hr` },
          ].map(item => (
            <div key={item.label} className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">{item.label}</div>
              <div className="text-sm text-white">{item.value || '—'}</div>
            </div>
          ))}
          {profile?.bio && (
            <div className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Bio</div>
              <div className="text-sm text-white leading-relaxed">{profile.bio}</div>
            </div>
          )}
          {caregiver.is_banned && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <div className="text-xs text-red-400 mb-1">🚫 Hard Banned</div>
              <div className="text-sm text-red-300">{caregiver.ban_reason}</div>
            </div>
          )}
          {caregiver.is_shadow_banned && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
              <div className="text-xs text-yellow-400 mb-1">👻 Shadow Banned</div>
              <div className="text-sm text-yellow-300">{caregiver.ban_reason}</div>
            </div>
          )}
        </div>

        {/* Manual verify (when no docs uploaded) */}
        {!profile?.is_verified && !hasVerificationDocs && !caregiver.is_banned && !caregiver.is_shadow_banned && (
          <button onClick={() => onVerify(caregiver.id)}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition mb-3">
            ✅ Manually Verify This Caregiver
          </button>
        )}

        {/* Ban / Unban */}
        {!caregiver.is_banned && !caregiver.is_shadow_banned ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setBanType('shadow')}
                className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                  banType === 'shadow' ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400' : 'border-gray-700 text-gray-400 hover:text-white'
                }`}>
                👻 Shadow Ban
                <div className="text-xs font-normal opacity-70 mt-0.5">Hidden from families</div>
              </button>
              <button onClick={() => setBanType('hard')}
                className={`py-2.5 rounded-xl text-xs font-medium border transition ${
                  banType === 'hard' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-gray-700 text-gray-400 hover:text-white'
                }`}>
                🚫 Hard Ban
                <div className="text-xs font-normal opacity-70 mt-0.5">Blocked from platform</div>
              </button>
            </div>
            <textarea value={banReason} onChange={e => setBanReason(e.target.value)}
              placeholder="Reason for ban (internal only)..." rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none" />
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white transition">
                Cancel
              </button>
              <button onClick={() => onBan(caregiver.id, banType, banReason)} disabled={!banReason.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition ${
                  banType === 'hard' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-600 hover:bg-yellow-700'
                }`}>
                {banType === 'hard' ? '🚫 Hard Ban' : '👻 Shadow Ban'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm border border-gray-700 text-gray-400 hover:text-white transition">
              Close
            </button>
            <button onClick={() => onUnban(caregiver.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition">
              ✅ Remove Ban
            </button>
          </div>
        )}
      </div>
    </div>
  )
}