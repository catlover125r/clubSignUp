import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, adminDb } from '@/lib/firebase-admin'
import { createClubSheet, shareSheet } from '@/lib/sheets'
import { parse } from 'csv-parse/sync'
import { FieldValue } from 'firebase-admin/firestore'

function isAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  return admins.includes(email)
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export async function POST(req: NextRequest) {
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

  const formData = await req.formData()
  const file = formData.get('csv') as File
  if (!file) return NextResponse.json({ error: 'No CSV file' }, { status: 400 })

  const text = await file.text()
  const rows: { name: string; email: string }[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const results: { name: string; status: string; id?: string; error?: string }[] = []

  for (const row of rows) {
    const clubName = row['Club Name'] ?? row['name'] ?? row['Name']
    const advisorEmail = row['Advisor Email'] ?? row['email'] ?? row['Email']

    if (!clubName || !advisorEmail) {
      results.push({ name: clubName ?? 'unknown', status: 'skipped', error: 'Missing name or email' })
      continue
    }

    const baseId = slugify(clubName)
    let clubId = baseId
    let suffix = 1
    while ((await adminDb.collection('clubs').doc(clubId).get()).exists) {
      clubId = `${baseId}-${suffix++}`
    }

    try {
      const spreadsheetId = await createClubSheet(clubName)
      await shareSheet(spreadsheetId, advisorEmail)

      await adminDb.collection('clubs').doc(clubId).set({
        name: clubName,
        advisorEmail,
        spreadsheetId,
        createdAt: FieldValue.serverTimestamp(),
      })

      results.push({ name: clubName, status: 'created', id: clubId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ name: clubName, status: 'error', error: msg })
    }
  }

  return NextResponse.json({ results })
}
