import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'

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
  const batch = db.batch()

  batch.delete(
    db.collection('users').doc(decoded.uid)
      .collection('clubs').doc(clubId)
  )
  batch.delete(
    db.collection('clubs').doc(clubId)
      .collection('signups').doc(decoded.uid)
  )

  await batch.commit()

  return NextResponse.json({ success: true })
}
