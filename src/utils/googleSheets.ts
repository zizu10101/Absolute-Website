import { google } from 'googleapis'

const getOAuthClient = () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  })
  return oauth2Client
}

const getSheetClient = () => {
  const auth = getOAuthClient()
  return google.sheets({ version: 'v4', auth })
}

const getDriveClient = () => {
  const auth = getOAuthClient()
  return google.drive({ version: 'v3', auth })
}


// One row per transaction; amount in its payment column (L–Q only).
// R and S are manual columns — never touched by sync.
function buildRows(transactions: any[]): (number | string)[][] {
  const rows: (number | string)[][] = []

  for (const t of transactions) {
    // indices: 0=L(Cash) 1=M(Debit) 2=N(Visa) 3=O(MC) 4=P(Amex) 5=Q(Cheque)
    const row: (number | string)[] = ['', '', '', '', '', '']
    const amount = Number(t.total_amount) || 0

    if (t.payment_splits && Array.isArray(t.payment_splits) && t.payment_splits.length > 0) {
      t.payment_splits.forEach((split: any) => {
        const m = (split.method || '').toLowerCase()
        const a = Number(split.amount) || 0
        switch (m) {
          case 'cash':                    row[0] = a; break
          case 'debit':                   row[1] = a; break
          case 'visa':                    row[2] = a; break
          case 'mastercard': case 'mc':   row[3] = a; break
          case 'amex':                    row[4] = a; break
          case 'cheque': case 'check':    row[5] = a; break
        }
      })
    } else {
      const method = (t.method || '').toLowerCase()
      switch (method) {
        case 'cash':                    row[0] = amount; break
        case 'debit':                   row[1] = amount; break
        case 'visa':                    row[2] = amount; break
        case 'mastercard': case 'mc':   row[3] = amount; break
        case 'amex':                    row[4] = amount; break
        case 'cheque': case 'check':    row[5] = amount; break
      }
    }

    rows.push(row)
  }

  while (rows.length < 25) rows.push(['', '', '', '', '', ''])
  return rows.slice(0, 25)
}

export const syncEODToSheet = async (
  data: {
    date: string
    over_short: number
    deposit: number
    pos_cash: number
    pos_debit: number
    pos_visa: number
    pos_mc: number
    pos_amex: number
    other: number
    total: number
    actual_cash: number
    opening_total: number
    closing_total: number
  },
  transactions: any[]
) => {
  try {
    const sheets = getSheetClient()
    const spreadsheetId = process.env.GOOGLE_SHEET_ID

    // T12:00:00 avoids UTC midnight shifting the calendar day
    const date = new Date(`${data.date}T12:00:00`)
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'long' })
    const year = date.getFullYear()

    const todayTab = day === 1 ? `${month} 1, ${year}` : `${day}`
    const prevTab  = day === 2 ? `${month} 1, ${year}` : `${day - 1}`

    console.log('Transactions fetched:', transactions?.length)
    console.log('Today tab:', todayTab)

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const existingTabs = spreadsheet.data.sheets?.map(s => s.properties?.title) || []
    const tabExists = existingTabs.includes(todayTab)

    // Step 1: Create tab if needed, or clear stale entries if it exists
    if (!tabExists) {
      const prevSheet = spreadsheet.data.sheets?.find(s => s.properties?.title === prevTab)
      if (!prevSheet?.properties?.sheetId) {
        throw new Error(`Previous tab "${prevTab}" not found. Cannot duplicate.`)
      }

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

      const g29Formula = day === 1 ? '=K29' : `=SUM(K29+'${prevTab}'!G29)`
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${todayTab}'!G29`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[g29Formula]] }
      })

      // Read J4:J9 SUM formulas from previous tab BEFORE clearing
      const j4j9Formulas = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${prevTab}'!J4:J9`,
        valueRenderOption: 'FORMULA' as any
      })

      // Clear carried-over data (this also wipes J4:J9 formulas)
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: {
          ranges: [
            `'${todayTab}'!L4:Q28`,
            `'${todayTab}'!J4:J14`
          ]
        }
      })

      // Restore J4:J9 SUM formulas after clear
      if (j4j9Formulas.data.values) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${todayTab}'!J4:J9`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: j4j9Formulas.data.values }
        })
      }

      console.log(`Created new tab: ${todayTab}`)
    } else {
      // Tab exists: clear L4:Q28 only — R and S are manual, never touched
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${todayTab}'!L4:Q28`
      })
    }

    // Step 2: One row per transaction — amount in payment column (L–Q only)
    const rows = buildRows(transactions)

    console.log('Rows written:', rows.length, '| Transactions:', transactions.length)

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${todayTab}'!L4:Q28`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows }
    })

    // Step 3: Always write F19 (over/short) and F20 (deposit)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${todayTab}'!F19`, values: [[data.over_short]] },
          { range: `'${todayTab}'!F20`, values: [[data.deposit]] },
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

export const createNewMonthSheet = async () => {
  try {
    const sheets = getSheetClient()
    const drive = getDriveClient()
    const currentSpreadsheetId = process.env.GOOGLE_SHEET_ID!

    // Called on the 1st of a new month — use today's date
    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long' })
    const year = now.getFullYear()
    const newSheetTitle = `${monthName} ${year}`    // e.g. "October 2026"
    const firstTabName = `${monthName} 1, ${year}` // e.g. "October 1, 2026"

    // Read the previous month's sheet to find the last tab
    const prevSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: currentSpreadsheetId })
    const prevSheets = prevSpreadsheet.data.sheets || []
    const lastTab = prevSheets[prevSheets.length - 1]?.properties?.title || '1'

    // Grab closing counts from the last day before copying (E4:G13 → new opening)
    const closingCountsResp = await sheets.spreadsheets.values.get({
      spreadsheetId: currentSpreadsheetId,
      range: `'${lastTab}'!E4:G13`
    })
    const closingCounts = closingCountsResp.data.values || []

    // Step 1: Copy current sheet into folder as new month template
    console.log('=== NEW MONTH DEBUG ===')
    console.log('Folder ID:', process.env.GOOGLE_DRIVE_FOLDER_ID)
    console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID)
    console.log('Credentials loaded:', !!process.env.GOOGLE_SHEETS_CREDENTIALS)
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

    // Step 2: Read all tabs in the new copy
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

    // Step 3: Delete all tabs except the last one
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

    // Step 4: Rename surviving tab to "October 1, 2026"
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

    // Step 5: Closing counts → opening counts (E4:G13 → A4:C13)
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

    // Step 6: Clear sales, closing, and carry-over columns
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

    // Step 7: G29 = =K29 (first day of month, no previous tab)
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
