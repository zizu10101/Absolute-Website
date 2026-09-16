import { google } from 'googleapis'

const getSheetClient = async () => {
  const credentials = JSON.parse(
    process.env.GOOGLE_SHEETS_CREDENTIALS || '{}'
  )
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
  return google.sheets({ version: 'v4', auth })
}

export const syncEODToSheet = async (data: {
  date: string
  pos_cash: number
  pos_debit: number
  pos_visa: number
  pos_mc: number
  pos_amex: number
  other: number
  total: number
  actual_cash: number
  over_short: number
  deposit: number
  opening_total: number
  closing_total: number
}) => {
  try {
    const sheets = await getSheetClient()
    const spreadsheetId = process.env.GOOGLE_SHEET_ID

    // Parse the date — add T12:00:00 to avoid UTC midnight shifting the day
    const date = new Date(`${data.date}T12:00:00`)
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'long' })
    const year = date.getFullYear()

    // First of month: "September 1, 2026" — all others: just the day number "2", "16"
    const todayTab = day === 1 ? `${month} 1, ${year}` : `${day}`
    const prevTab = day === 2 ? `${month} 1, ${year}` : `${day - 1}`

    // Get all existing sheet tabs
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || []

    if (!existingSheets.includes(todayTab)) {
      const prevSheet = spreadsheet.data.sheets?.find(
        s => s.properties?.title === prevTab
      )
      if (!prevSheet?.properties?.sheetId) {
        throw new Error(`Previous tab "${prevTab}" not found. Cannot duplicate.`)
      }

      // Duplicate previous tab
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            duplicateSheet: {
              sourceSheetId: prevSheet.properties.sheetId,
              insertSheetIndex: day,
              newSheetName: todayTab
            }
          }]
        }
      })
      console.log(`Created new tab: ${todayTab}`)
    }

    // G29 cumulative formula: first day has no previous tab
    const g29Formula = day === 1 ? '=K29' : `=SUM(K29+'${prevTab}'!G29)`

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${todayTab}'!J4`, values: [[data.pos_cash]] },
          { range: `'${todayTab}'!J5`, values: [[data.pos_debit]] },
          { range: `'${todayTab}'!J6`, values: [[data.pos_visa]] },
          { range: `'${todayTab}'!J7`, values: [[data.pos_mc]] },
          { range: `'${todayTab}'!J8`, values: [[data.pos_amex]] },
          { range: `'${todayTab}'!J9`, values: [[data.other]] },

          // Summary columns
          { range: `'${todayTab}'!L4`, values: [[data.pos_cash]] },
          { range: `'${todayTab}'!M4`, values: [[data.pos_debit]] },
          { range: `'${todayTab}'!N4`, values: [[data.pos_visa]] },
          { range: `'${todayTab}'!O4`, values: [[data.pos_mc]] },
          { range: `'${todayTab}'!P4`, values: [[data.pos_amex]] },
          { range: `'${todayTab}'!Q4`, values: [[data.other]] },

          { range: `'${todayTab}'!F19`, values: [[data.over_short]] },
          { range: `'${todayTab}'!F20`, values: [[data.deposit]] },
          { range: `'${todayTab}'!G29`, values: [[g29Formula]] },
        ]
      }
    })

    console.log(`EOD synced to Google Sheets tab: ${todayTab}`)
    return { success: true, tab: todayTab }
  } catch (err) {
    console.error('Google Sheets sync error:', err)
    return { success: false, error: String(err) }
  }
}
