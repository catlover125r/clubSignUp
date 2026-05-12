'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

interface ClubProfile {
  id: string
  name: string
  meetingPlace: string
  meetingTime: string
  description: string
}

export default function JoinPage() {
  const { clubId } = useParams<{ clubId: string }>()
  const { user, loading, signIn, getToken } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle')
  const [clubName, setClubName] = useState('')
  const [message, setMessage] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [clubProfile, setClubProfile] = useState<ClubProfile | null>(null)

  useEffect(() => {
    async function loadClubProfile() {
      try {
        const res = await fetch(`/api/clubs/${clubId}`)
        if (!res.ok) return
        const data = await res.json()
        setClubProfile(data.club)
        setClubName(data.club.name)
      } catch {}
    }

    loadClubProfile()
  }, [clubId])

  async function joinClub() {
    setStatus('joining')
    try {
      let token = await getToken()
      let res = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId }),
      })

      if (res.status === 401) {
        token = await getToken(true)
        res = await fetch('/api/signup', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ clubId }),
        })
      }

      if (res.status === 404) {
        setMessage('Club not found.')
        setStatus('error')
        return
      }

      const data = await res.json()
      setClubName(data.clubName)
      setMessage(data.alreadyJoined ? `You're already signed up for ${data.clubName}!` : `You joined ${data.clubName}!`)
      setStatus('done')

      setTimeout(() => router.replace('/scan'), 2000)
    } catch {
      setMessage('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  useEffect(() => {
    if (!loading && user && status === 'idle') joinClub()
  }, [user, loading, status])

  async function handleSignIn() {
    setSigningIn(true)
    try {
      await signIn()
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setSigningIn(false)
    }
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="w-full max-w-sm">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {clubProfile?.name ?? 'Join this club'}
          </h1>
          <p className="text-gray-500 mb-6">Sign in with your school account to complete sign-up</p>

          {clubProfile && <ProfileDetails profile={clubProfile} />}

          {message && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
              {message}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white font-semibold py-4 px-6 rounded-2xl shadow hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60"
          >
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>
      </main>
    )
  }

  if (status === 'joining') return <LoadingScreen label="Signing you up…" />

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-full max-w-sm">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          status === 'done' ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {status === 'done' ? (
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <p className="text-xl font-semibold text-gray-900">{message}</p>
        {clubProfile && <ProfileDetails profile={clubProfile} compact />}
        {status === 'done' && (
          <p className="text-gray-400 text-sm mt-2">Redirecting back…</p>
        )}
        {status === 'error' && (
          <button
            onClick={() => router.replace('/scan')}
            className="mt-6 text-blue-600 font-medium"
          >
            Go to scanner
          </button>
        )}
      </div>
    </main>
  )
}

function ProfileDetails({ profile, compact = false }: { profile: ClubProfile; compact?: boolean }) {
  const hasDetails = profile.meetingPlace || profile.meetingTime || profile.description
  if (!hasDetails) return null

  return (
    <div className={`${compact ? 'mt-5' : 'mb-6'} rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left`}>
      {(profile.meetingPlace || profile.meetingTime) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {profile.meetingPlace && (
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Place</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.meetingPlace}</p>
            </div>
          )}
          {profile.meetingTime && (
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">Time</p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{profile.meetingTime}</p>
            </div>
          )}
        </div>
      )}
      {profile.description && (
        <p className="text-sm text-gray-600 leading-6 mt-3">{profile.description}</p>
      )}
    </div>
  )
}

function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  )
}
