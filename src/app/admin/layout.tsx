'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAILS = ['zwang168@seas.upenn.edu', 'zijinwang97@gmail.com', 'zijinwang168@gmail.com']

const NAV_ITEMS = [
  { label: 'Overview', path: '/admin', icon: '📊' },
  { label: 'Families', path: '/admin/families', icon: '👨‍👩‍👧' },
  { label: 'Caregivers', path: '/admin/caregivers', icon: '🤝' },
  { label: 'Matching', path: '/admin/matching', icon: '🎯' },
  { label: 'Moderation', path: '/admin/moderation', icon: '🛡️' },
  { label: 'Operations', path: '/admin/operations', icon: '⚙️' },
  { label: 'Analytics', path: '/admin/analytics', icon: '📈' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
        router.push('/')
        return
      }
      setAuthorized(true)
      setLoading(false)
    }
    check()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-gray-400">Checking authorization...</div>
    </div>
  )

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-800 flex items-center gap-2">
          <img src="/ruah-logo.png" className="w-8 h-8" />
          <div>
            <div className="font-bold text-white text-sm">Ruah! Admin</div>
            <div className="text-xs text-gray-500">Internal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                pathname === item.path
                  ? 'bg-[#7FB3FF]/20 text-[#7FB3FF] font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={() => router.push('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <span>🌐</span>
            <span>Back to site</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  )
}