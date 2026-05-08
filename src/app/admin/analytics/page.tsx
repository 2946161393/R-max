'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminAnalytics() {
  const [data, setData] = useState<any>({
    users: [],
    matches: [],
    notifications: [],
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const [usersRes, matchesRes, notifsRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: true }),
        supabase.from('matches').select('*').order('created_at', { ascending: true }),
        supabase.from('notifications').select('*').order('created_at', { ascending: true }),
      ])

      setData({
        users: usersRes.data || [],
        matches: matchesRes.data || [],
        notifications: notifsRes.data || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const { users, matches, notifications } = data

  const families = users.filter((u: any) => u.role === 'family')
  const caregivers = users.filter((u: any) => u.role === 'caregiver')
  const acceptedMatches = matches.filter((m: any) => m.status === 'accepted')
  const matchRate = matches.length > 0
    ? Math.round((acceptedMatches.length / matches.length) * 100)
    : 0
  const caregiverResponseRate = notifications.length > 0
    ? Math.round((notifications.filter((n: any) => n.type === 'caregiver_interested').length / notifications.filter((n: any) => n.type === 'new_match').length) * 100) || 0
    : 0

  // Signups by day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const signupsByDay = last7Days.map(day => ({
    day: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    families: families.filter((u: any) => u.created_at?.startsWith(day)).length,
    caregivers: caregivers.filter((u: any) => u.created_at?.startsWith(day)).length,
  }))

  const maxSignups = Math.max(...signupsByDay.map(d => d.families + d.caregivers), 1)

  // Service breakdown
  const serviceCount: Record<string, number> = {}
  caregivers.forEach((c: any) => {
    // We need to get this from caregiver_profiles but keeping it simple
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Platform performance metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: users.length, icon: '👥', change: '+' + users.filter((u: any) => {
            const d = new Date(u.created_at)
            const now = new Date()
            return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
          }).length + ' this week' },
          { label: 'Match Rate', value: matchRate + '%', icon: '🎯', change: acceptedMatches.length + ' accepted' },
          { label: 'Response Rate', value: caregiverResponseRate + '%', icon: '💬', change: 'Caregiver responses' },
          { label: 'Total Matches', value: matches.length, icon: '🤝', change: acceptedMatches.length + ' successful' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <div className="text-2xl mb-3">{stat.icon}</div>
            <div className="text-3xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
            <div className="text-xs text-gray-600 mt-1">{stat.change}</div>
          </div>
        ))}
      </div>

      {/* User Growth Chart */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <h2 className="font-semibold text-white mb-6">Signups — Last 7 Days</h2>
        <div className="flex items-end gap-3 h-40">
          {signupsByDay.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col gap-0.5 justify-end" style={{ height: '120px' }}>
                {/* Caregivers bar */}
                <div
                  className="w-full rounded-t bg-[#A78BFA] transition-all"
                  style={{
                    height: `${(d.caregivers / maxSignups) * 100}px`,
                    minHeight: d.caregivers > 0 ? '4px' : '0'
                  }}
                />
                {/* Families bar */}
                <div
                  className="w-full rounded-t bg-[#7FB3FF] transition-all"
                  style={{
                    height: `${(d.families / maxSignups) * 100}px`,
                    minHeight: d.families > 0 ? '4px' : '0'
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 text-center">{d.day}</div>
              <div className="text-xs text-white font-medium">{d.families + d.caregivers}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#7FB3FF]" />
            <span className="text-xs text-gray-400">Families</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#A78BFA]" />
            <span className="text-xs text-gray-400">Caregivers</span>
          </div>
        </div>
      </div>

      {/* Supply vs Demand */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="font-semibold text-white mb-4">Supply vs Demand</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Families (demand)</span>
                <span className="text-white">{families.length}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-[#7FB3FF]"
                  style={{ width: `${(families.length / Math.max(users.length, 1)) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Caregivers (supply)</span>
                <span className="text-white">{caregivers.length}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-[#A78BFA]"
                  style={{ width: `${(caregivers.length / Math.max(users.length, 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="text-xs text-gray-500">
              Ratio: {families.length > 0 && caregivers.length > 0
                ? (caregivers.length / families.length).toFixed(1) + ' caregivers per family'
                : 'Not enough data'}
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="font-semibold text-white mb-4">Match Funnel</h2>
          <div className="space-y-3">
            {[
              { label: 'Families registered', value: families.length, color: 'bg-[#7FB3FF]' },
              { label: 'Matches initiated', value: matches.length, color: 'bg-purple-500' },
              { label: 'Caregivers responded', value: notifications.filter((n: any) => n.type === 'caregiver_interested').length, color: 'bg-yellow-500' },
              { label: 'Matches accepted', value: acceptedMatches.length, color: 'bg-green-500' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-white">{item.value}</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${item.color}`}
                    style={{ width: `${(item.value / Math.max(families.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Health */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h2 className="font-semibold text-white mb-4">Platform Health</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Banned Users',
              value: users.filter((u: any) => u.is_banned).length,
              total: users.length,
              icon: '🚫',
              color: 'text-red-400',
              good: users.filter((u: any) => u.is_banned).length === 0
            },
            {
              label: 'Shadow Banned',
              value: users.filter((u: any) => u.is_shadow_banned).length,
              total: users.length,
              icon: '👻',
              color: 'text-yellow-400',
              good: users.filter((u: any) => u.is_shadow_banned).length === 0
            },
            {
              label: 'Verified Caregivers',
              value: caregivers.filter((c: any) => c.caregiver_profiles?.is_verified).length,
              total: caregivers.length,
              icon: '✅',
              color: 'text-green-400',
              good: true
            },
          ].map(item => (
            <div key={item.label} className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">{item.icon}</span>
                <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
              </div>
              <div className="text-sm text-gray-400">{item.label}</div>
              <div className="text-xs text-gray-600 mt-1">
                {item.total > 0
                  ? Math.round((item.value / item.total) * 100) + '% of total'
                  : 'No data'}
              </div>
              <div className={`text-xs mt-1 ${item.good ? 'text-green-500' : 'text-red-500'}`}>
                {item.good ? '● Healthy' : '● Needs attention'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}