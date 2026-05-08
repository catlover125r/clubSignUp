import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const email = decoded.email ?? ''
  const clubRef = getAdminDb().collection('clubs').doc(params.clubId)
  const clubSnap = await clubRef.get()
  if (!clubSnap.exists) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const club = clubSnap.data()!
  const advisorEmails: string[] = club.advisorEmails ?? [club.advisorEmail]
  if (!advisorEmails.includes(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const snap = await clubRef.collection('signups').orderBy('joinedAt').get()
  const signups = snap.docs.map((doc) => {
    const d = doc.data()
    return {
      name: d.name ?? '',
      email: d.email ?? '',
      timestamp: d.joinedAt?.toDate?.()?.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'short',
        timeStyle: 'short',
      }) ?? '',
    }
  })

  return NextResponse.json({ signups })
}
