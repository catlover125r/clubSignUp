import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'
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

  const db = getAdminDb()
  const clubRef = db.collection('clubs').doc(clubId)
  const clubSnap = await clubRef.get()
  if (!clubSnap.exists) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const club = clubSnap.data()!
  const signupRef = db
    .collection('users').doc(decoded.uid)
    .collection('clubs').doc(clubId)
  const clubSignupRef = clubRef.collection('signups').doc(decoded.uid)

  const name = decoded.name ?? decoded.email ?? ''
  const email = decoded.email ?? ''

  const existing = await signupRef.get()
  if (existing.exists) {
    await clubSignupRef.set({
      name,
      email,
      joinedAt: existing.data()?.joinedAt ?? FieldValue.serverTimestamp(),
    }, { merge: true })
    return NextResponse.json({ alreadyJoined: true, clubName: club.name })
  }

  const joinedAt = FieldValue.serverTimestamp()
  const batch = db.batch()

  batch.create(signupRef, {
    clubName: club.name,
    joinedAt,
  })

  batch.set(clubSignupRef, { name, email, joinedAt })

  try {
    await batch.commit()
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: unknown }).code)
      : ''
    if (code === '6' || code === 'already-exists') {
      return NextResponse.json({ alreadyJoined: true, clubName: club.name })
    }
    throw err
  }

  if (club.spreadsheetId) {
    try {
      await appendSignup(club.spreadsheetId, name, email)
    } catch {
      // best-effort, Firestore is the source of truth
    }
  }

  return NextResponse.json({ success: true, clubName: club.name })
}
