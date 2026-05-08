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

  const email = decoded.email ?? ''
  const snap = await getAdminDb()
    .collection('clubs')
    .where('advisorEmails', 'array-contains', email)
    .orderBy('name')
    .get()

  // Also check legacy single-email field for clubs created before multi-email support
  const legacySnap = await getAdminDb()
    .collection('clubs')
    .where('advisorEmail', '==', email)
    .orderBy('name')
    .get()

  const seen = new Set<string>()
  const clubs: { id: string; name: string; spreadsheetId: string }[] = []

  for (const doc of [...snap.docs, ...legacySnap.docs]) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    clubs.push({
      id: doc.id,
      name: doc.data().name,
      spreadsheetId: doc.data().spreadsheetId,
    })
  }

  clubs.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ clubs })
}
