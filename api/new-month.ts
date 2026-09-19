import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const getOAuthClient = () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return oauth2Client
}

const getSheetClient = () => google.sheets({ version: 'v4', auth: getOAuthClient() })
const getDriveClient = () => google.drive({ version: 'v3', auth: getOAuthClient() })

async function createNewMonthSheet() {
  try {
    const sheets = getSheetClient()
    const drive = getDriveClient()
    const currentSpreadsheetId = process.env.GOOGLE_SHEET_ID!

    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long' })
    const year = now.getFullYear()
    const newSheetTitle = `${monthName} ${year}`
    const firstTabName = `${monthName} 1, ${year}`

    const prevSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: currentSpreadsheetId })
    const prevSheets = prevSpreadsheet.data.sheets || []
    const lastTab = prevSheets[prevSheets.length - 1]?.properties?.title || '1'

    const closingCountsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: currentSpreadsheetId,
      range: `'${lastTab}'!E4:G13`
    })
    const closingCounts = closingCountsResp.data.values || []

    console.log('=== NEW MONTH DEBUG ===')
    console.log('Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID)
    console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID)

    let newSpreadsheetId: string
    try {
      console.log('Step 1: Copying spreadsheet', currentSpreadsheetId, '→ folder', process.env.GOOGLE_DRIVE_FOLDER_ID)
      const response = await drive.files.copy({
        fileId: process.env.GOOGLE_SHEET_ID!,
        requestBody: {
          name: newSheetTitle,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!]
        },
        supportsAllDrives: true
      })
      newSpreadsheetId = response.data.id!
      console.log('Step 1 success — new spreadsheet ID:', newSpreadsheetId)
    } catch (err: any) {
      console.error('Step 1 FAILED — drive.files.copy error:')
      console.error('  message:', err.message)
      console.error('  code:', err.code)
      console.error('  status:', err.status)
      console.error('  errors:', JSON.stringify(err.errors ?? err.response?.data ?? ''))
      throw err
    }

    let copiedSheets: any[]
    let lastCopied: any
    try {
      console.log('Step 2: Reading tabs in new spreadsheet...')
      const newSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: newSpreadsheetId })
      copiedSheets = newSpreadsheet.data.sheets || []
      lastCopied = copiedSheets[copiedSheets.length - 1]
      console.log('Step 2 success —', copiedSheets.length, 'tabs, last tab:', lastCopied?.properties?.title)
    } catch (err: any) {
      console.error('Step 2 FAILED — spreadsheets.get error:', err.message)
      throw err
    }

    const toDelete = copiedSheets.filter(s => s.properties?.sheetId !== lastCopied.properties?.sheetId)
    if (toDelete.length > 0) {
      try {
        console.log('Step 3: Deleting', toDelete.length, 'tabs...')
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: newSpreadsheetId,
          requestBody: {
            requests: toDelete.map(s => ({
              deleteSheet: { sheetId: s.properties!.sheetId! }
            }))
          }
        })
        console.log('Step 3 success')
      } catch (err: any) {
        console.error('Step 3 FAILED — deleteSheet error:', err.message)
        throw err
      }
    }

    try {
      console.log('Step 4: Renaming tab to', firstTabName)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSpreadsheetId,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: { sheetId: lastCopied.properties!.sheetId!, title: firstTabName },
              fields: 'title'
            }
          }]
        }
      })
      console.log('Step 4 success')
    } catch (err: any) {
      console.error('Step 4 FAILED — rename error:', err.message)
      throw err
    }

    if (closingCounts.length > 0) {
      try {
        console.log('Step 5: Writing closing→opening counts...')
        await sheets.spreadsheets.values.update({
          spreadsheetId: newSpreadsheetId,
          range: `'${firstTabName}'!A4:C13`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: closingCounts }
        })
        console.log('Step 5 success')
      } catch (err: any) {
        console.error('Step 5 FAILED — values.update error:', err.message)
        throw err
      }
    }

    try {
      console.log('Step 6: Clearing sales/closing/carry-over columns...')
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId: newSpreadsheetId,
        requestBody: {
          ranges: [
            `'${firstTabName}'!J4:J14`,
            `'${firstTabName}'!L4:R4`,
            `'${firstTabName}'!E4:G13`,
            `'${firstTabName}'!R4:R28`,
            `'${firstTabName}'!S4:S28`,
            `'${firstTabName}'!L29:Q29`
          ]
        }
      })
      console.log('Step 6 success')
    } catch (err: any) {
      console.error('Step 6 FAILED — batchClear error:', err.message)
      throw err
    }

    try {
      console.log('Step 7: Setting G29 formula...')
      await sheets.spreadsheets.values.update({
        spreadsheetId: newSpreadsheetId,
        range: `'${firstTabName}'!G29`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['=K29']] }
      })
      console.log('Step 7 success')
    } catch (err: any) {
      console.error('Step 7 FAILED — G29 update error:', err.message)
      throw err
    }

    console.log(`New month sheet created: ${newSheetTitle} (${newSpreadsheetId})`)
    return { success: true, spreadsheetId: newSpreadsheetId, sheetTitle: newSheetTitle, firstTab: firstTabName }
  } catch (err) {
    console.error('New month creation error:', err)
    return { success: false, error: String(err) }
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: setting } = await supabase
      .from('settings')
      .select('data')
      .eq('key', 'google_sheet_id')
      .maybeSingle()
    if (setting?.data?.id) {
      process.env.GOOGLE_SHEET_ID = setting.data.id
    }

    const result = await createNewMonthSheet()

    if (result.success && result.spreadsheetId) {
      await supabase
        .from('settings')
        .upsert({ key: 'google_sheet_id', data: { id: result.spreadsheetId } }, { onConflict: 'key' })
    }

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}
