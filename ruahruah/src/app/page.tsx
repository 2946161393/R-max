'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [role, setRole] = useState<'family' | 'caregiver' | null>(null)
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="text-4xl font-bold text-blue-600 mb-2">Ruah</div>
          <p className="text-gray-500 text-lg">Find the right help for your home</p>
        </div>

        {/* Role Selection */}
        <p className="text-center text-gray-700 font-medium mb-6">I am a...</p>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/onboarding/family')}
            className="w-full border-2 border-gray-200 rounded-2xl p-6 text-left hover:border-blue-500 hover:bg-blue-50 transition group"
          >
            <div className="text-3xl mb-2">👨‍👩‍👧</div>
            <div className="font-semibold text-gray-900 text-lg group-hover:text-blue-600">Family</div>
            <div className="text-gray-500 text-sm mt-1">I'm looking for care services</div>
          </button>

          <button
            onClick={() => router.push('/onboarding/caregiver')}
            className="w-full border-2 border-gray-200 rounded-2xl p-6 text-left hover:border-blue-500 hover:bg-blue-50 transition group"
          >
            <div className="text-3xl mb-2">🤝</div>
            <div className="font-semibold text-gray-900 text-lg group-hover:text-blue-600">Caregiver / Helper</div>
            <div className="text-sm text-gray-500 mt-1">I provide care services</div>
          </button>
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          Already have an account?{' '}
          <span
            onClick={() => router.push('/login')}
            className="text-blue-600 cursor-pointer hover:underline"
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  )
}