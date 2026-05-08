/**
 * One-time setup: reads clubs.csv and creates Firestore docs.
 *
 * Usage:
 *   1. Create clubs.csv with columns: Club Name, Advisor Email
 *   2. Run: npm run setup-clubs
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'csv-parse/sync'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString()
  )
  const app = initializeApp({ credential: cert(serviceAccount) })
  const db = getFirestore(app)

  let created = 0
  let skipped = 0

  for (const row of rows) {
    const clubName = row['Club Name'] ?? row['name'] ?? row['Name']
    const advisorEmailRaw = row['Advisor Email'] ?? row['email'] ?? row['Email']
    const advisorEmails = advisorEmailRaw
      ? advisorEmailRaw.split(',').map((e: string) => e.trim()).filter(Boolean)
      : []

    if (!clubName || advisorEmails.length === 0) {
      console.log(`  SKIP  — missing name or email: ${JSON.stringify(row)}`)
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

    await db.collection('clubs').doc(clubId).set({
      name: clubName,
      advisorEmail: advisorEmails[0],
      advisorEmails,
      createdAt: FieldValue.serverTimestamp(),
    })

    console.log('done')
    created++
  }

  console.log(`\nDone — created: ${created}, skipped: ${skipped}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
