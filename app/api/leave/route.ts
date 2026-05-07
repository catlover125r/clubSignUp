import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, adminDb } from '@/lib/firebase-admin'

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

  await adminDb
    .collection('users').doc(decoded.uid)
    .collection('clubs').doc(clubId)
    .delete()

  return NextResponse.json({ success: true })
}
