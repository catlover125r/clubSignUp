import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const snap = await getAdminDb()
    .collection('users').doc(decoded.uid)
    .collection('clubs')
    .orderBy('joinedAt', 'asc')
    .get()

  const clubs = snap.docs.map((doc) => ({
    id: doc.id,
    clubName: doc.data().clubName,
    joinedAt: doc.data().joinedAt?.toDate?.()?.toISOString() ?? null,
  }))

  return NextResponse.json({ clubs })
}
