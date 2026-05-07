'use client'

import { useEffect, useState } from 'react'
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
  const [unauthorized, setUnauthorized] = useState(false)
  const [sheetUrl, setSheetUrl] = useState('')

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
      if (res.status === 403) { setUnauthorized(true); return }
      const data = await res.json()
      setClubs(data.clubs ?? [])
    } finally {
      setLoadingClubs(false)
    }
  }

  function extractSheetId(urlOrId: string): string | null {
    const trimmed = urlOrId.trim()
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed
    return null
  }

  async function handleImportSheet(e: React.FormEvent) {
    e.preventDefault()
    const sheetId = extractSheetId(sheetUrl)
    if (!sheetId) { alert('Paste a valid Google Sheets URL or ID.'); return }

    setUploading(true)
    setResults([])
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setResults(data.results ?? [])
      await fetchClubs()
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(clubId: string, clubName: string) {
    if (!confirm(`Delete ${clubName}? This won't delete the Google Sheet.`)) return
    const token = await getToken()
    await fetch('/api/admin/clubs', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId }),
    })
    setClubs((prev) => prev.filter((c) => c.id !== clubId))
  }

  if (loading || !user) return <Spinner />

  if (unauthorized) {
    return (
      <main className="flex items-center justify-center min-h-screen px-6">
        <div className="text-center">
          <p className="text-red-500 font-semibold text-lg">Access denied</p>
          <p className="text-gray-400 text-sm mt-1">Your account is not an admin.</p>
          <Link href="/scan" className="mt-4 inline-block text-blue-600 text-sm">Go to scanner</Link>
        </div>
      </main>
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Club Fair Admin</h1>
        <div className="flex gap-3">
          <Link href="/print-qr" className="text-sm bg-blue-50 text-blue-700 font-medium px-4 py-2 rounded-xl hover:bg-blue-100">
            Print QR Codes
          </Link>
          <Link href="/scan" className="text-sm text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100">
            Student view
          </Link>
        </div>
      </div>

      {/* Import from Google Sheet */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Import Clubs from Google Sheet</h2>
        <p className="text-sm text-gray-400 mb-1">
          Paste the URL of your Google Sheet. It must have columns:{' '}
          <code className="bg-gray-100 px-1 rounded">Club Name</code> and{' '}
          <code className="bg-gray-100 px-1 rounded">Advisor Email</code>
        </p>
        <p className="text-xs text-amber-600 mb-4">
          Share your sheet with the service account email in your <code className="bg-amber-50 px-1 rounded">.env.local</code> (the <code className="bg-amber-50 px-1 rounded">client_email</code> field in your Google credentials) so it can read it.
        </p>

        <form onSubmit={handleImportSheet} className="flex gap-3 items-end flex-wrap">
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            required
            className="flex-1 min-w-0 text-sm border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
          >
            {uploading ? 'Creating…' : 'Create Clubs + Sheets'}
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
                <span>{r.status === 'created' ? '— created' : r.status === 'error' ? `— error: ${r.error}` : '— skipped'}</span>
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
            {clubs.length > 0 && (
              <span className="ml-2 text-gray-400 font-normal text-sm">({clubs.length})</span>
            )}
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
                  <th className="px-6 py-3 text-left">Advisor</th>
                  <th className="px-6 py-3 text-left">QR URL</th>
                  <th className="px-6 py-3 text-left">Sheet</th>
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
                    <td className="px-6 py-3">
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${club.spreadsheetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Open sheet
                      </a>
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
