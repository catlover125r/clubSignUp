import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, adminDb } from '@/lib/firebase-admin'
import { appendSignup } from '@/lib/sheets'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { clubId } = await req.json()
  if (!clubId) return NextResponse.json({ error: 'Missing clubId' }, { status: 400 })

  const clubRef = adminDb.collection('clubs').doc(clubId)
  const clubSnap = await clubRef.get()
  if (!clubSnap.exists) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const club = clubSnap.data()!
  const signupRef = adminDb
    .collection('users').doc(decoded.uid)
    .collection('clubs').doc(clubId)

  const existing = await signupRef.get()
  if (existing.exists) {
    return NextResponse.json({ alreadyJoined: true, clubName: club.name })
  }

  await signupRef.set({
    clubName: club.name,
    joinedAt: FieldValue.serverTimestamp(),
  })

  try {
    await appendSignup(club.spreadsheetId, decoded.name ?? decoded.email ?? '', decoded.email ?? '')
  } catch (err) {
    console.error('Sheets append failed:', err)
  }

  return NextResponse.json({ success: true, clubName: club.name })
}
