'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminOverview() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    families: 0,
    caregivers: 0,
    banned: 0,
    shadowBanned: 0,
    matches: 0,
    notifications: 0,
  })
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: matches } = await supabase
        .from('matches')
        .select('id')

      const { data: notifications } = await supabase
        .from('notifications')
        .select('id')

      setStats({
        totalUsers: users?.length || 0,
        families: users?.filter(u => u.role === 'family').length || 0,
        caregivers: users?.filter(u => u.role === 'caregiver').length || 0,
        banned: users?.filter(u => u.is_banned).length || 0,
        shadowBanned: users?.filter(u => u.is_shadow_banned).length || 0,
        matches: matches?.length || 0,
        notifications: notifications?.length || 0,
      })
      setRecentUsers(users?.slice(0, 5) || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-gray-400 mt-1">Platform health at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: '👥', sub: 'All time' },
          { label: 'Families', value: stats.families, icon: '👨‍👩‍👧', sub: 'Registered' },
          { label: 'Caregivers', value: stats.caregivers, icon: '🤝', sub: 'Registered' },
          { label: 'Matches', value: stats.matches, icon: '🎯', sub: 'All time' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
            <div className="text-xs text-gray-600 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Hard Banned', value: stats.banned, icon: '🚫', color: 'text-red-400' },
          { label: 'Shadow Banned', value: stats.shadowBanned, icon: '👻', color: 'text-yellow-400' },
          { label: 'Notifications Sent', value: stats.notifications, icon: '🔔', color: 'text-blue-400' },
          { label: 'Platform Health', value: '✓', icon: '💚', color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Manage Families', desc: 'View and manage family accounts', path: '/admin/families', icon: '👨‍👩‍👧' },
          { label: 'Manage Caregivers', desc: 'Verify and manage caregiver profiles', path: '/admin/caregivers', icon: '🤝' },
          { label: 'Moderation Queue', desc: 'Review flagged content', path: '/admin/moderation', icon: '🛡️' },
        ].map(action => (
          <button
            key={action.path}
            onClick={() => router.push(action.path)}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left hover:border-[#7FB3FF] transition"
          >
            <div className="text-2xl mb-2">{action.icon}</div>
            <div className="font-semibold text-white text-sm">{action.label}</div>
            <div className="text-xs text-gray-500 mt-1">{action.desc}</div>
          </button>
        ))}
      </div>

      {/* Recent Users */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Signups</h2>
          <button
            onClick={() => router.push('/admin/families')}
            className="text-xs text-[#7FB3FF] hover:underline"
          >
            View all →
          </button>
        </div>
        <div className="divide-y divide-gray-800">
          {recentUsers.map(u => (
            <div key={u.id} className="px-6 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                  : u.full_name?.[0] || '?'
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{u.full_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.role === 'family'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {u.role}
                  </span>
                  {u.is_banned && <span className="text-xs text-red-400">🚫</span>}
                  {u.is_shadow_banned && <span className="text-xs text-yellow-400">👻</span>}
                </div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <div className="text-xs text-gray-600">
                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}