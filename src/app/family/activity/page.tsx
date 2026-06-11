'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FamilyNav from '@/components/FamilyNav'

export default function FamilyActivityPage() {
  const [user, setUser] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })

      setUser(userData)
      setNotifications(notifData || [])
      setUnreadCount((notifData || []).filter(n => !n.read).length)
      setLoading(false)
    }
    load()
  }, [])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const unread = notifications.filter(n => !n.read)
  const read = notifications.filter(n => n.read)

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <FamilyNav userName={user?.full_name} unreadCount={unreadCount} />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/family/dashboard')}
              className="text-gray-400 hover:text-gray-600 text-sm">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
          </div>
          {unread.length > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-[#7FB3FF] hover:underline">
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📬</div>
            <p className="text-sm">No activity yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unread.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">New</p>
                {unread.map(n => (
                  <div key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className="bg-white rounded-2xl border border-[#7FB3FF]/30 bg-blue-50/20 p-4 cursor-pointer hover:shadow-sm transition">
                    <div className="flex items-start gap-3">
                      <div className="text-xl mt-0.5">
                        {n.type === 'new_match' ? '🎯'
                          : n.type === 'mutual_match' ? '🎉'
                          : n.type === 'caregiver_interested' ? '🎉'
                          : n.type === 'message' ? '💬'
                          : '📬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm">{n.title}</div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                        <p className="text-xs text-gray-300 mt-1">
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="w-2 h-2 bg-[#7FB3FF] rounded-full flex-shrink-0 mt-1" />
                    </div>
                    {n.type === 'new_match' && n.data?.caregiverUserId && (
                      <button
                        onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/caregiver/${n.data.caregiverUserId}`) }}
                        className="mt-3 w-full text-white py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                        👤 View Profile
                      </button>
                    )}
                    {n.type === 'mutual_match' && n.data?.caregiverUserId && (
                      <button
                        onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/messages/${n.data.caregiverUserId}`) }}
                        className="mt-3 w-full text-white py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                        💬 Start Chatting
                      </button>
                    )}
                    {n.type === 'message' && n.data?.senderId && (
                      <button
                        onClick={e => { e.stopPropagation(); markAsRead(n.id); router.push(`/messages/${n.data.senderId}`) }}
                        className="mt-3 w-full text-white py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                        💬 Reply
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            {read.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Earlier</p>
                {read.map(n => (
                  <div key={n.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition">
                    <div className="flex items-start gap-3">
                      <div className="text-xl mt-0.5 opacity-50">
                        {n.type === 'new_match' ? '🎯'
                          : n.type === 'mutual_match' ? '🎉'
                          : n.type === 'caregiver_interested' ? '🎉'
                          : n.type === 'message' ? '💬'
                          : '📬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-500 text-sm">{n.title}</div>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{n.body}</p>
                        <p className="text-xs text-gray-300 mt-1">
                          {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}