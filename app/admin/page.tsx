'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

interface ClubRow {
  id: string
  name: string
  advisorEmail: string
  spreadsheetId: string
}

interface SetupResult {
  name: string
  status: 'created' | 'skipped' | 'error'
  id?: string
  error?: string
}

export default function AdminPage() {
  const { user, loading, getToken } = useAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [loadingClubs, setLoadingClubs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<SetupResult[]>([])
  const [accessError, setAccessError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
    if (!loading && user) fetchClubs()
  }, [user, loading])

  async function fetchClubs() {
    setLoadingClubs(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/clubs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) { setAccessError('Could not verify your account. Try signing out and back in.'); return }
      if (res.status === 403) { setAccessError('Your account is not an admin.'); return }
      const data = await res.json()
      setClubs(data.clubs ?? [])
    } catch {
      setAccessError('Could not connect. Try refreshing.')
    } finally {
      setLoadingClubs(false)
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setResults([])
    try {
      const token = await getToken()
      const form = new FormData()
      form.append('csv', file)
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (res.status === 401) { alert('Session expired — sign out and back in.'); return }
      if (res.status === 403) { alert('Not an admin account.'); return }
      const data = await res.json()
      setResults(data.results ?? [])
      if (fileRef.current) fileRef.current.value = ''
      await fetchClubs()
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(clubId: string, clubName: string) {
    if (!confirm(`Delete ${clubName}? This cannot be undone.`)) return
    const token = await getToken()
    await fetch('/api/admin/clubs', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId }),
    })
    setClubs((prev) => prev.filter((c) => c.id !== clubId))
  }

  if (loading || !user) return <Spinner />

  if (accessError) {
    return (
      <main className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-red-500 font-semibold text-lg">Access denied</p>
          <p className="text-gray-400 text-sm mt-1">{accessError}</p>
          <Link href="/" className="mt-4 inline-block text-blue-600 text-sm">Go back</Link>
        </div>
      </main>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Club Fair Admin</h1>
        <Link href="/print-qr" className="text-sm bg-blue-50 text-blue-700 font-medium px-4 py-2 rounded-xl hover:bg-blue-100">
          Print QR Codes
        </Link>
      </div>

      {/* CSV Upload */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Add Clubs via CSV</h2>
        <p className="text-sm text-gray-400 mb-4">
          Columns: <code className="bg-gray-100 px-1 rounded">Club Name</code> and{' '}
          <code className="bg-gray-100 px-1 rounded">Advisor Email</code>. Multiple advisor emails can be comma-separated. Clubs that already exist will be skipped.
        </p>

        <form onSubmit={handleUpload} className="flex gap-3 items-center flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            required
            className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
          />
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60"
          >
            {uploading ? 'Adding…' : 'Add Clubs'}
          </button>
        </form>

        {results.length > 0 && (
          <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg ${
                r.status === 'created' ? 'bg-green-50 text-green-700' :
                r.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
              }`}>
                <span className="font-medium">{r.name}</span>
                <span>{r.status === 'created' ? '— added' : r.status === 'error' ? `— error: ${r.error}` : '— skipped'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clubs Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            All Clubs
            {clubs.length > 0 && <span className="ml-2 text-gray-400 font-normal text-sm">({clubs.length})</span>}
          </h2>
          {loadingClubs && <Spinner size="sm" />}
        </div>

        {clubs.length === 0 && !loadingClubs ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No clubs yet. Upload a CSV to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Club</th>
                  <th className="px-6 py-3 text-left">Advisor Email</th>
                  <th className="px-6 py-3 text-left">QR URL</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clubs.map((club) => (
                  <tr key={club.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{club.name}</td>
                    <td className="px-6 py-3 text-gray-500">{club.advisorEmail}</td>
                    <td className="px-6 py-3">
                      <code className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                        /join/{club.id}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(club.id, club.name)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const cls = size === 'sm' ? 'w-4 h-4 border-2' : 'w-8 h-8 border-4'
  return (
    <div className={`flex items-center justify-center ${size === 'default' ? 'min-h-screen' : ''}`}>
      <div className={`${cls} border-blue-500 border-t-transparent rounded-full animate-spin`} />
    </div>
  )
}
