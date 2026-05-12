import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'
import type { DocumentData } from 'firebase-admin/firestore'

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function isAdvisor(club: DocumentData, email: string) {
  const advisorEmails = Array.isArray(club.advisorEmails)
    ? club.advisorEmails.map(normalizeEmail)
    : []
  const legacyAdvisorEmail = normalizeEmail(club.advisorEmail)

  return advisorEmails.includes(email) || legacyAdvisorEmail === email
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<unknown> }) {
  const { clubId } = await params as { clubId: string }
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

  const clubRef = getAdminDb().collection('clubs').doc(clubId)
  const clubSnap = await clubRef.get()
  if (!clubSnap.exists) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const club = clubSnap.data()!
  if (!isAdvisor(club, email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const profile = {
    meetingPlace: cleanText(body.meetingPlace, 120),
    meetingTime: cleanText(body.meetingTime, 120),
    description: cleanText(body.description, 1000),
  }

  await clubRef.update(profile)

  return NextResponse.json({ club: { id: clubId, name: club.name ?? '', ...profile } })
}
