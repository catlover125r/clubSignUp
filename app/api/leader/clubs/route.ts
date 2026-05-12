import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
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

  const email = normalizeEmail(decoded.email)
  if (!email) return NextResponse.json({ error: 'Email missing from token' }, { status: 401 })

  const snap = await getAdminDb()
    .collection('clubs')
    .orderBy('name')
    .get()

  const clubs: {
    id: string
    name: string
    spreadsheetId: string
    meetingPlace: string
    meetingTime: string
    description: string
  }[] = []

  for (const doc of snap.docs) {
    const data = doc.data()
    const advisorEmails = Array.isArray(data.advisorEmails)
      ? data.advisorEmails.map(normalizeEmail)
      : []
    const legacyAdvisorEmail = normalizeEmail(data.advisorEmail)

    if (!advisorEmails.includes(email) && legacyAdvisorEmail !== email) continue

    clubs.push({
      id: doc.id,
      name: data.name,
      spreadsheetId: data.spreadsheetId,
      meetingPlace: data.meetingPlace ?? '',
      meetingTime: data.meetingTime ?? '',
      description: data.description ?? '',
    })
  }

  return NextResponse.json({ clubs })
}
