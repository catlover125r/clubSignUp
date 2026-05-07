'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { QRScanner } from '@/components/QRScanner'
import { useAuth } from '@/components/AuthProvider'

interface Club {
  id: string
  clubName: string
  joinedAt: string | null
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'info' | 'error'
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export default function ScanPage() {
  const { user, loading, signOut, getToken } = useAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [scanPaused, setScanPaused] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastCounter = useRef(0)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  const fetchClubs = useCallback(async () => {
    if (!user) return
    try {
      const token = await getToken()
      const res = await fetch('/api/my-clubs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setClubs(data.clubs)
      }
    } catch {}
  }, [user, getToken])

  useEffect(() => {
    fetchClubs()
  }, [fetchClubs])

  function addToast(message: string, type: Toast['type']) {
    const id = ++toastCounter.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000)
  }

  async function handleScan(text: string) {
    if (cooldownRef.current) return

    // Extract club ID from URL or plain ID
    let clubId = text
    const urlMatch = text.match(/\/join\/([^/?#]+)/)
    if (urlMatch) clubId = urlMatch[1]

    // Skip if doesn't look like our QR
    if (!urlMatch && !text.startsWith(APP_URL) && text.includes('/')) return

    cooldownRef.current = true
    setScanPaused(true)

    try {
      const token = await getToken()
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId }),
      })

      if (res.status === 404) {
        addToast('QR code not recognized. Try again.', 'error')
      } else {
        const data = await res.json()
        if (data.alreadyJoined) {
          addToast(`Already joined ${data.clubName}`, 'info')
        } else {
          addToast(`Joined ${data.clubName}!`, 'success')
          await fetchClubs()
        }
      }
    } catch {
      addToast('Connection error. Try again.', 'error')
    }

    setTimeout(() => {
      cooldownRef.current = false
      setScanPaused(false)
    }, 2500)
  }

  async function handleLeave(clubId: string, clubName: string) {
    const token = await getToken()
    await fetch('/api/leave', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clubId }),
    })
    setClubs((prev) => prev.filter((c) => c.id !== clubId))
    addToast(`Left ${clubName}`, 'info')
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <h1 className="font-bold text-lg text-gray-900">Club Fair</h1>
        <div className="flex items-center gap-3">
          {user.photoURL && (
            <Image
              src={user.photoURL}
              alt={user.displayName ?? 'Profile'}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Scanner */}
      <QRScanner onScan={handleScan} paused={scanPaused} />

      {/* Toast notifications */}
      <div className="fixed top-16 left-0 right-0 flex flex-col items-center gap-2 px-4 z-50 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold text-white transition-all ${
              toast.type === 'success' ? 'bg-green-500' :
              toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* My Clubs */}
      <div className="flex-1 px-4 py-5">
        <h2 className="font-semibold text-gray-700 mb-3">
          My Clubs
          {clubs.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {clubs.length}
            </span>
          )}
        </h2>

        {clubs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">↑</div>
            <p className="text-sm">Scan a club's QR code above to get started</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {clubs.map((club) => (
              <li
                key={club.id}
                className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{club.clubName}</p>
                  {club.joinedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Joined {new Date(club.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleLeave(club.id, club.clubName)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  aria-label={`Leave ${club.clubName}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
