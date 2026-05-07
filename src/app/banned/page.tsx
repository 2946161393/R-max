'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function BannedContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const supabase = createClient()

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h1>
        <p className="text-gray-500 mb-4">Your account has been suspended from Ruah.</p>
        {reason && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-600">
              <strong>Reason:</strong> {reason}
            </p>
          </div>
        )}
        <p className="text-sm text-gray-400 mb-8">
          If you believe this is a mistake, please contact us at{' '}
          <a href="mailto:support@ruahruah.com" className="text-[#7FB3FF] hover:underline">
            support@ruahruah.com
          </a>
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/'
          }}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function BannedPage() {
  return (
    <Suspense>
      <BannedContent />
    </Suspense>
  )
}