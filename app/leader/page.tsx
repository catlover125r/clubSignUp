'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

interface Club {
  id: string
  name: string
  spreadsheetId: string
}

interface Signup {
  name: string
  email: string
  timestamp: string
}

export default function LeaderPage() {
  const { user, loading, getToken } = useAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [signups, setSignups] = useState<Record<string, Signup[]>>({})
  const [loadingClubs, setLoadingClubs] = useState(true)
  const [loadingSignups, setLoadingSignups] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [noClubs, setNoClubs] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
    if (!loading && user) fetchClubs()
  }, [user, loading])

  async function fetchClubs() {
    setLoadingClubs(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/leader/clubs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      const list: Club[] = data.clubs ?? []
      setClubs(list)
      if (list.length === 0) setNoClubs(true)
      // Auto-expand and load signups if only one club
      if (list.length === 1) {
        setExpanded({ [list[0].id]: true })
        fetchSignups(list[0].id)
      }
    } finally {
      setLoadingClubs(false)
    }
  }

  async function fetchSignups(clubId: string) {
    if (signups[clubId]) return
    setLoadingSignups((prev) => ({ ...prev, [clubId]: true }))
    try {
      const token = await getToken()
      const res = await fetch(`/api/leader/signups/${clubId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSignups((prev) => ({ ...prev, [clubId]: data.signups ?? [] }))
    } finally {
      setLoadingSignups((prev) => ({ ...prev, [clubId]: false }))
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
