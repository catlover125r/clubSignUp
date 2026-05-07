'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import QRCode from 'qrcode'

interface Club {
  id: string
  name: string
  advisorEmail: string
  spreadsheetId: string
}

export default function PrintQRPage() {
  const { user, loading, getToken } = useAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/clubs', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) { router.replace('/admin'); return }
        const data = await res.json()
        const clubList: Club[] = data.clubs ?? []
        setClubs(clubList)

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
        const codes: Record<string, string> = {}
        await Promise.all(
          clubList.map(async (club) => {
            codes[club.id] = await QRCode.toDataURL(`${appUrl}/join/${club.id}`, {
              width: 280,
              margin: 2,
              color: { dark: '#1e3a8a', light: '#ffffff' },
            })
          })
        )
        setQrCodes(codes)
      } finally {
        setFetching(false)
      }
    }

    load()
  }, [user, getToken, router])

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Generating QR codes…</span>
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <p className="font-semibold">QR Codes — {clubs.length} clubs</p>
        <button
          onClick={() => window.print()}
          className="bg-white text-blue-700 font-semibold px-5 py-2 rounded-xl text-sm hover:bg-blue-50"
        >
          Print / Save PDF
        </button>
      </div>

      <div
        className="p-6 grid gap-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      >
        {clubs.map((club) => (
          <div
            key={club.id}
            className="flex flex-col items-center border-2 border-gray-200 rounded-2xl p-4 print:break-inside-avoid"
          >
            {qrCodes[club.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCodes[club.id]} alt={`QR code for ${club.name}`} className="w-40 h-40" />
            ) : (
              <div className="w-40 h-40 bg-gray-100 rounded-xl" />
            )}
            <p className="mt-3 font-bold text-center text-gray-900 text-sm leading-tight">{club.name}</p>
            <p className="mt-1 text-xs text-gray-400 text-center">Scan to join</p>
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </>
  )
}
