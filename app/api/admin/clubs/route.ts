import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'

function isAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  return admins.includes(email)
}

async function deleteInBatches(db: Firestore, refs: DocumentReference[]) {
  const uniqueRefs = Array.from(
    new Map(refs.map((ref) => [ref.path, ref])).values()
  )

  for (let i = 0; i < uniqueRefs.length; i += 450) {
    const batch = db.batch()
    for (const ref of uniqueRefs.slice(i, i + 450)) {
      batch.delete(ref)
    }
    await batch.commit()
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!isAdmin(decoded.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const snap = await getAdminDb().collection('clubs').orderBy('name').get()
  const clubs = snap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    advisorEmail: doc.data().advisorEmail,
    spreadsheetId: doc.data().spreadsheetId,
  }))

  return NextResponse.json({ clubs })
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!isAdmin(decoded.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clubId } = await req.json()
  if (!clubId || typeof clubId !== 'string') {
    return NextResponse.json({ error: 'Missing clubId' }, { status: 400 })
  }

  const db = getAdminDb()
  const clubRef = db.collection('clubs').doc(clubId)
  const signupsSnap = await clubRef.collection('signups').get()
  const refsToDelete: DocumentReference[] = [clubRef]

  for (const signupDoc of signupsSnap.docs) {
    refsToDelete.push(signupDoc.ref)
    refsToDelete.push(
      db.collection('users').doc(signupDoc.id)
        .collection('clubs').doc(clubId)
    )
  }

  await deleteInBatches(db, refsToDelete)
  return NextResponse.json({ success: true })
}
