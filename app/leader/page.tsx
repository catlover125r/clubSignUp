'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

interface Club {
  id: string
  name: string
  spreadsheetId: string
  meetingPlace: string
  meetingTime: string
  description: string
}

interface Signup {
  name: string
  email: string
  timestamp: string
}

type ProfileDraft = Pick<Club, 'meetingPlace' | 'meetingTime' | 'description'>

export default function LeaderPage() {
  const { user, loading, getToken } = useAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [signups, setSignups] = useState<Record<string, Signup[]>>({})
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [loadingSignups, setLoadingSignups] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [noClubs, setNoClubs] = useState(false)
  const [error, setError] = useState('')
  const [profileDrafts, setProfileDrafts] = useState<Record<string, ProfileDraft>>({})
  const [savingProfile, setSavingProfile] = useState<Record<string, boolean>>({})
  const [savedProfile, setSavedProfile] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!loading && !user) router.replace('/')
    if (!loading && user) fetchClubs()
  }, [user, loading])

  async function fetchWithToken(url: string, init: RequestInit = {}) {
    let token = await getToken()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    let res = await fetch(url, {
      ...init,
      headers,
    })

    if (res.status === 401) {
      token = await getToken(true)
      const refreshedHeaders = new Headers(init.headers)
      refreshedHeaders.set('Authorization', `Bearer ${token}`)
      res = await fetch(url, {
        ...init,
        headers: refreshedHeaders,
      })
    }

    return res
  }

  async function fetchClubs() {
    setLoadingClubs(true)
    setError('')
    setNoClubs(false)
    try {
      const res = await fetchWithToken('/api/leader/clubs')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not load your clubs.')
        setClubs([])
        return
      }
      const list: Club[] = data.clubs ?? []
      setClubs(list)
      setProfileDrafts(Object.fromEntries(
        list.map((club) => [club.id, {
          meetingPlace: club.meetingPlace ?? '',
          meetingTime: club.meetingTime ?? '',
          description: club.description ?? '',
        }])
      ))
      if (list.length === 0) setNoClubs(true)
      // Auto-expand and load signups if only one club
      if (list.length === 1) {
        setExpanded({ [list[0].id]: true })
        fetchSignups(list[0].id)
      }
    } catch {
      setError('Could not connect. Try refreshing.')
      setClubs([])
    } finally {
      setLoadingClubs(false)
    }
  }

  async function fetchSignups(clubId: string) {
    if (signups[clubId]) return
    setLoadingSignups((prev) => ({ ...prev, [clubId]: true }))
    try {
      const res = await fetchWithToken(`/api/leader/signups/${clubId}`)
      const data = await res.json()
      if (!res.ok) {
        setSignups((prev) => ({ ...prev, [clubId]: [] }))
        return
      }
      setSignups((prev) => ({ ...prev, [clubId]: data.signups ?? [] }))
    } finally {
      setLoadingSignups((prev) => ({ ...prev, [clubId]: false }))
    }
  }

  function updateProfileDraft(clubId: string, field: keyof ProfileDraft, value: string) {
    setSavedProfile((prev) => ({ ...prev, [clubId]: false }))
    setProfileDrafts((prev) => {
      const current = prev[clubId] ?? {
        meetingPlace: '',
        meetingTime: '',
        description: '',
      }

      return {
        ...prev,
        [clubId]: { ...current, [field]: value },
      }
    })
  }

  async function saveProfile(clubId: string) {
    const draft = profileDrafts[clubId]
    if (!draft) return

    setSavingProfile((prev) => ({ ...prev, [clubId]: true }))
    setSavedProfile((prev) => ({ ...prev, [clubId]: false }))

    try {
      const res = await fetchWithToken(`/api/leader/clubs/${clubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not save club profile.')
        return
      }

      setClubs((prev) => prev.map((club) => (
        club.id === clubId ? { ...club, ...data.club } : club
      )))
      setProfileDrafts((prev) => ({ ...prev, [clubId]: {
        meetingPlace: data.club.meetingPlace ?? '',
        meetingTime: data.club.meetingTime ?? '',
        description: data.club.description ?? '',
      } }))
      setSavedProfile((prev) => ({ ...prev, [clubId]: true }))
    } finally {
      setSavingProfile((prev) => ({ ...prev, [clubId]: false }))
    }
  }

  function toggleClub(clubId: string) {
    const next = !expanded[clubId]
    setExpanded((prev) => ({ ...prev, [clubId]: next }))
    if (next) fetchSignups(clubId)
  }

  if (loading || (!user && !noClubs)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Club Sign-Ups</h1>
        {user && (
          <p className="text-sm text-gray-400 mt-1">{user.email}</p>
        )}
      </div>

      {loadingClubs ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-2xl px-6 py-12 text-center">
          <p className="text-red-600 font-medium">Could not load clubs.</p>
          <p className="text-gray-400 text-sm mt-1">{error}</p>
        </div>
      ) : noClubs ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
          <p className="text-gray-500 font-medium">No clubs found for your account.</p>
          <p className="text-gray-400 text-sm mt-1">Contact your administrator if this seems wrong.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clubs.map((club) => {
            const isOpen = expanded[club.id] ?? false
            const clubSignups = signups[club.id] ?? []
            const isLoadingThis = loadingSignups[club.id] ?? false
            const draft = profileDrafts[club.id] ?? {
              meetingPlace: '',
              meetingTime: '',
              description: '',
            }

            return (
              <div key={club.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleClub(club.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-gray-900">{club.name}</span>
                    {signups[club.id] !== undefined && (
                      <span className="ml-2 text-sm text-gray-400">
                        {clubSignups.length} {clubSignups.length === 1 ? 'student' : 'students'}
                      </span>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/60">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="font-semibold text-gray-900 text-sm">Club Profile</h2>
                        {savedProfile[club.id] && (
                          <span className="text-xs font-medium text-green-600">Saved</span>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-500 mb-1">Meeting place</span>
                          <input
                            value={draft.meetingPlace}
                            onChange={(e) => updateProfileDraft(club.id, 'meetingPlace', e.target.value)}
                            maxLength={120}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400"
                            placeholder="Room 204"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-medium text-gray-500 mb-1">Meeting time</span>
                          <input
                            value={draft.meetingTime}
                            onChange={(e) => updateProfileDraft(club.id, 'meetingTime', e.target.value)}
                            maxLength={120}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400"
                            placeholder="Tuesdays at lunch"
                          />
                        </label>
                      </div>

                      <label className="block mt-3">
                        <span className="block text-xs font-medium text-gray-500 mb-1">Description</span>
                        <textarea
                          value={draft.description}
                          onChange={(e) => updateProfileDraft(club.id, 'description', e.target.value)}
                          maxLength={1000}
                          rows={4}
                          className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400"
                          placeholder="What students should know before joining"
                        />
                      </label>

                      <button
                        onClick={() => saveProfile(club.id)}
                        disabled={savingProfile[club.id]}
                        className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingProfile[club.id] ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>

                    {isLoadingThis ? (
                      <div className="flex justify-center py-8">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : clubSignups.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-8">No sign-ups yet.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                          <tr>
                            <th className="px-6 py-3 text-left">Name</th>
                            <th className="px-6 py-3 text-left">Email</th>
                            <th className="px-6 py-3 text-left hidden sm:table-cell">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {clubSignups.map((s, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-6 py-3 font-medium text-gray-900">{s.name}</td>
                              <td className="px-6 py-3 text-gray-500">{s.email}</td>
                              <td className="px-6 py-3 text-gray-400 hidden sm:table-cell">{s.timestamp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
