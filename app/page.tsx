'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const router = useRouter()
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/scan')
  }, [user, loading, router])

  async function handleSignIn() {
    setError('')
    setSigningIn(true)
    try {
      await signIn()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-10">Club Fair</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-2xl shadow-sm hover:border-blue-300 hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.8 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.7-3.3-11.3-8H6.4C9.8 35.5 16.4 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l6.2 5.2C37 38.4 44 33 44 24c0-1.3-.1-2.7-.4-3.9z" />
          </svg>
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </button>

        {process.env.NEXT_PUBLIC_ALLOWED_DOMAIN && (
          <p className="mt-4 text-xs text-gray-400">
            Use your @{process.env.NEXT_PUBLIC_ALLOWED_DOMAIN} account
          </p>
        )}

        <a href="/admin" className="mt-6 block text-sm text-gray-400 underline hover:text-gray-600 transition-colors">
          sign in as club leader
        </a>
      </div>
    </main>
  )
}
