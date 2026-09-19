import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'

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

async function syncEODToSheet(
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
) {
  try {
    const sheets = getSheetClient()
    const spreadsheetId = process.env.GOOGLE_SHEET_ID

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

      const j4j9Formulas = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${prevTab}'!J4:J9`,
        valueRenderOption: 'FORMULA' as any
      })

      await sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: {
          ranges: [
            `'${todayTab}'!L4:Q28`,
            `'${todayTab}'!J4:J14`
          ]
        }
      })

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

    const rows = buildRows(transactions)

    console.log('Rows written:', rows.length, '| Transactions:', transactions.length)

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${todayTab}'!L4:Q28`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows }
    })

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

    const nowInEST = DateTime.now().setZone('America/Toronto')
    const startOfDay = nowInEST.startOf('day').toUTC().toISO()
    const endOfDay = nowInEST.endOf('day').toUTC().toISO()

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'completed')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)

    const result = await syncEODToSheet(req.body, transactions || [])
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}
