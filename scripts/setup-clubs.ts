/**
 * One-time setup: reads clubs.csv and creates Firestore docs + Google Sheets.
 *
 * Usage:
 *   1. Copy .env.local.example to .env.local and fill in all values
 *   2. Create clubs.csv with columns: Club Name, Advisor Email
 *   3. Run: npm run setup-clubs
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'csv-parse/sync'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { google } from 'googleapis'

function loadEnv() {
  try {
    const lines = readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.warn('Could not load .env.local — make sure env vars are set')
  }
}

loadEnv()

function getServiceAccount() {
  return JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString()
  )
}

function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString()
    ),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

async function main() {
  const csvPath = process.argv[2] ?? join(process.cwd(), 'clubs.csv')
  console.log(`Reading: ${csvPath}\n`)

  const text = readFileSync(csvPath, 'utf8')
  const rows: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const app = initializeApp({ credential: cert(getServiceAccount()) })
  const db = getFirestore(app)
  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  let created = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const clubName = row['Club Name'] ?? row['name'] ?? row['Name']
    const advisorEmail = row['Advisor Email'] ?? row['email'] ?? row['Email']

    if (!clubName || !advisorEmail) {
      console.log(`  SKIP  — missing name or email in row: ${JSON.stringify(row)}`)
      skipped++
      continue
    }

    const baseId = slugify(clubName)
    let clubId = baseId
    let suffix = 1
    while ((await db.collection('clubs').doc(clubId).get()).exists) {
      clubId = `${baseId}-${suffix++}`
    }

    process.stdout.write(`  Creating "${clubName}" (${clubId})… `)

    try {
      const sheetRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: `${clubName} – Sign Ups` },
          sheets: [{
            properties: { title: 'Sign Ups' },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: [
                  { userEnteredValue: { stringValue: 'Name' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Email' }, userEnteredFormat: { textFormat: { bold: true } } },
                  { userEnteredValue: { stringValue: 'Timestamp' }, userEnteredFormat: { textFormat: { bold: true } } },
                ],
              }],
            }],
          }],
        },
      })

      const spreadsheetId = sheetRes.data.spreadsheetId!

      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: true,
        emailMessage: 'Your club sign-up spreadsheet has been created. It will update in real time during the club fair.',
        requestBody: { role: 'writer', type: 'user', emailAddress: advisorEmail },
      })

      await db.collection('clubs').doc(clubId).set({
        name: clubName,
        advisorEmail,
        spreadsheetId,
        createdAt: FieldValue.serverTimestamp(),
      })

      console.log('done')
      created++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`ERROR: ${msg}`)
      errors++
    }
  }

  console.log(`\nDone — created: ${created}, skipped: ${skipped}, errors: ${errors}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
