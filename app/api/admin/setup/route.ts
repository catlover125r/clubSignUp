import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'
import { createClubSheet, shareSheet, readSheetRows } from '@/lib/sheets'
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

  let rows: Record<string, string>[]

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await req.json()
    const sheetId = body.sheetId as string
    if (!sheetId) return NextResponse.json({ error: 'No sheetId provided' }, { status: 400 })
    try {
      rows = await readSheetRows(sheetId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: `Could not read sheet: ${msg}` }, { status: 400 })
    }
  } else {
    const formData = await req.formData()
    const file = formData.get('csv') as File
    if (!file) return NextResponse.json({ error: 'No CSV file' }, { status: 400 })
    const text = await file.text()
    rows = parse(text, { columns: true, skip_empty_lines: true, trim: true })
  }

  const results: { name: string; status: string; id?: string; error?: string }[] = []

  for (const row of rows) {
    const clubName = row['Club Name'] ?? row['name'] ?? row['Name']
    const advisorEmailRaw = row['Advisor Email'] ?? row['email'] ?? row['Email']
    const advisorEmails = advisorEmailRaw
      ? advisorEmailRaw.split(',').map((e: string) => e.trim()).filter(Boolean)
      : []

    if (!clubName || advisorEmails.length === 0) {
      results.push({ name: clubName ?? 'unknown', status: 'skipped', error: 'Missing name or email' })
      continue
    }

    const baseId = slugify(clubName)
    let clubId = baseId
    let suffix = 1
    while ((await getAdminDb().collection('clubs').doc(clubId).get()).exists) {
      clubId = `${baseId}-${suffix++}`
    }

    try {
      const spreadsheetId = await createClubSheet(clubName)
      for (const email of advisorEmails) {
        await shareSheet(spreadsheetId, email)
      }

      await getAdminDb().collection('clubs').doc(clubId).set({
        name: clubName,
        advisorEmail: advisorEmails[0],
        advisorEmails,
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
