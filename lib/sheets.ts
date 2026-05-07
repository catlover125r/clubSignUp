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
