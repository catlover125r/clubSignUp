import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getAdminDb } from '@/lib/firebase-admin'
import { createClubSheet, shareSheet } from '@/lib/sheets'
import { parse } from 'csv-parse/sync'
import { FieldValue } from 'firebase-admin/firestore'

function isAdmin(email: string) {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)
  return admins.includes(email)
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Unknown error'
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
  const rows: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const db = getAdminDb()
  const results: { name: string; status: string; id?: string; error?: string; warning?: string }[] = []

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

    const clubId = slugify(clubName)
    if (!clubId) {
      results.push({ name: clubName, status: 'skipped', error: 'Invalid club name' })
      continue
    }

    const clubRef = db.collection('clubs').doc(clubId)
    if ((await clubRef.get()).exists) {
      results.push({ name: clubName, status: 'skipped', id: clubId, error: 'Club already exists' })
      continue
    }

    try {
      await clubRef.set({
        name: clubName,
        advisorEmail: advisorEmails[0],
        advisorEmails,
        createdAt: FieldValue.serverTimestamp(),
      })

      let warning: string | undefined
      if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
        try {
          const spreadsheetId = await createClubSheet(clubName)
          await clubRef.update({ spreadsheetId })
          const shareResults = await Promise.allSettled(
            advisorEmails.map((email) => shareSheet(spreadsheetId, email))
          )
          const failedShares = shareResults.filter((result) => result.status === 'rejected')
          if (failedShares.length > 0) {
            warning = `Sheet created, but ${failedShares.length} share ${failedShares.length === 1 ? 'failed' : 'attempts failed'}`
          }
        } catch (err: unknown) {
          warning = `Sheet not created: ${getErrorMessage(err)}`
        }
      }

      results.push({ name: clubName, status: 'created', id: clubId, warning })
    } catch (err: unknown) {
      results.push({ name: clubName, status: 'error', error: getErrorMessage(err) })
    }
  }

  return NextResponse.json({ results })
}
