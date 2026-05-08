'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminOperations() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'activity' | 'notifications' | 'matches'>('activity')
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const [notifsRes, matchesRes, usersRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('matches')
          .select('*, caregiver_profiles(user_id), service_requests(family_profiles(user_id))')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, full_name, email, role, avatar_url, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      setNotifications(notifsRes.data || [])
      setMatches(matchesRes.data || [])
      setUsers(usersRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const notifIcon = (type: string) => {
    switch (type) {
      case 'new_match': return '🎯'
      case 'caregiver_interested': return '🎉'
      case 'message': return '💬'
      default: return '🔔'
    }
  }

  const matchStatusColor = (status: string) => {
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

  // Recent activity feed — combine users + notifications sorted by date
  const activityFeed = [
    ...users.map(u => ({
      type: 'signup',
      icon: u.role === 'family' ? '👨‍👩‍👧' : '🤝',
      text: `${u.full_name} signed up as ${u.role}`,
      email: u.email,
      time: u.created_at,
      color: u.role === 'family' ? 'text-blue-400' : 'text-green-400',
    })),
    ...notifications.map(n => ({
      type: 'notification',
      icon: notifIcon(n.type),
      text: n.title,
      email: n.body?.substring(0, 60) + '...',
      time: n.created_at,
      color: 'text-purple-400',
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 30)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Operations</h1>
        <p className="text-gray-400 mt-1">Real-time platform activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Notifications', value: notifications.length, icon: '🔔' },
          { label: 'New Matches', value: notifications.filter(n => n.type === 'new_match').length, icon: '🎯' },
          { label: 'Caregiver Responses', value: notifications.filter(n => n.type === 'caregiver_interested').length, icon: '🎉' },
          { label: 'Unread', value: notifications.filter(n => !n.read).length, icon: '📬' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <div className="text-xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'activity', label: '⚡ Live Activity' },
          { id: 'notifications', label: '🔔 Notifications' },
          { id: 'matches', label: '🎯 Matches' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-[#7FB3FF] text-white'
                : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live Activity Feed */}
      {activeTab === 'activity' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Activity Feed</h2>
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Live
            </span>
          </div>
          <div className="divide-y divide-gray-800">
            {activityFeed.map((item, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-800/50 transition">
                <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${item.color}`}>{item.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{item.email}</div>
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(item.time).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
            {activityFeed.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No activity yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">All Notifications ({notifications.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {notifications.map(n => (
              <div key={n.id} className="px-6 py-4 flex items-start gap-3 hover:bg-gray-800/50 transition">
                <span className="text-xl flex-shrink-0">{notifIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">{n.title}</span>
                    {!n.read && (
                      <span className="w-1.5 h-1.5 bg-[#7FB3FF] rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2">{n.body}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Type: <span className="text-gray-500">{n.type}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(n.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Matches */}
      {activeTab === 'matches' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">All Matches ({matches.length})</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {matches.map(m => (
              <div key={m.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-800/50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${matchStatusColor(m.status)}`}>
                      {m.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {m.ai_reasoning?.substring(0, 50)}...
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Match ID: {m.id}
                  </div>
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  {new Date(m.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No matches yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}