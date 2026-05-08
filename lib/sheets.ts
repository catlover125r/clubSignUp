import { google } from 'googleapis'

function getAuth() {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString()
  )
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

export async function createClubSheet(clubName: string): Promise<string> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.create({
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

  return res.data.spreadsheetId!
}

export async function shareSheet(spreadsheetId: string, advisorEmail: string) {
  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })

  await drive.permissions.create({
    fileId: spreadsheetId,
    sendNotificationEmail: true,
    emailMessage: 'Your club sign-up spreadsheet has been created and will update in real time during the club fair.',
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: advisorEmail,
    },
  })
}

export async function readSheetRows(spreadsheetId: string): Promise<Record<string, string>[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A:Z',
  })

  const rows = res.data.values
  if (!rows || rows.length < 2) return []

  const headers = (rows[0] as string[]).map((h) => h.trim())
  return (rows.slice(1) as string[][])
    .filter((row) => row.some((cell) => cell?.trim()))
    .map((row) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = row[i]?.trim() ?? '' })
      return obj
    })
}

export async function readSignups(spreadsheetId: string): Promise<{ name: string; email: string; timestamp: string }[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sign Ups!A:C',
  })

  const rows = res.data.values
  if (!rows || rows.length < 2) return []

  return (rows.slice(1) as string[][])
    .filter((row) => row[0]?.trim() || row[1]?.trim())
    .map((row) => ({
      name: row[0]?.trim() ?? '',
      email: row[1]?.trim() ?? '',
      timestamp: row[2]?.trim() ?? '',
    }))
}

export async function appendSignup(spreadsheetId: string, name: string, email: string) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sign Ups!A:C',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        name,
        email,
        new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          dateStyle: 'short',
          timeStyle: 'short',
        }),
      ]],
    },
  })
}
