import { google } from 'googleapis'
import { readFileSync } from 'fs'

const lines = readFileSync('.env.local', 'utf8').split('\n')
for (const line of lines) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const creds = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString())
console.log('Service account:', creds.client_email)

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
})

async function main() {
  const drive = google.drive({ version: 'v3', auth })
  try {
    const res = await drive.files.create({
      requestBody: { name: 'TEST DELETE ME', mimeType: 'application/vnd.google-apps.spreadsheet' },
      fields: 'id,name',
    })
    console.log('Drive success! id:', res.data.id)
    // clean up
    await drive.files.delete({ fileId: res.data.id! })
    console.log('Cleaned up.')
  } catch (e: any) {
    console.log('Drive error:', JSON.stringify(e?.response?.data ?? e?.message, null, 2))
  }
}

main()
