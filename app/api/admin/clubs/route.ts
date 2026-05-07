import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'

function isAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  return admins.includes(email)
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
  await getAdminDb().collection('clubs').doc(clubId).delete()
  return NextResponse.json({ success: true })
}
