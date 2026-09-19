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

function buildColumnArrays(transactions: any[]) {
  const colL: (number | string)[] = []
  const colM: (number | string)[] = []
  const colN: (number | string)[] = []
  const colO: (number | string)[] = []
  const colP: (number | string)[] = []
  const colQ: (number | string)[] = []

  transactions.forEach(t => {
    const method = (t.method || '').toLowerCase()
    const amount = Number(t.total_amount) || 0

    if (t.payment_splits && Array.isArray(t.payment_splits) && t.payment_splits.length > 0) {
      t.payment_splits.forEach((split: any) => {
        const m = (split.method || '').toLowerCase()
        const a = Number(split.amount) || 0
        switch (m) {
          case 'cash':                    colL.push(a); break
          case 'debit':                   colM.push(a); break
          case 'visa':                    colN.push(a); break
          case 'mastercard': case 'mc':   colO.push(a); break
          case 'amex':                    colP.push(a); break
          case 'cheque': case 'check':    colQ.push(a); break
        }
      })
    } else {
      switch (method) {
        case 'cash':                    colL.push(amount); break
        case 'debit':                   colM.push(amount); break
        case 'visa':                    colN.push(amount); break
        case 'mastercard': case 'mc':   colO.push(amount); break
        case 'amex':                    colP.push(amount); break
        case 'cheque': case 'check':    colQ.push(amount); break
      }
    }
  })

  return { colL, colM, colN, colO, colP, colQ }
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
            `'${todayTab}'!R4:S28`,
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
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${todayTab}'!L4:Q28`
      })
    }

    const { colL, colM, colN, colO, colP, colQ } = buildColumnArrays(transactions)

    const rows: (number | string)[][] = []
    for (let i = 0; i < 25; i++) {
      rows.push([
        colL[i] ?? '',
        colM[i] ?? '',
        colN[i] ?? '',
        colO[i] ?? '',
        colP[i] ?? '',
        colQ[i] ?? ''
      ])
    }

    console.log('Rows written: 25 | Cash:', colL.length, 'Debit:', colM.length, 'Visa:', colN.length, 'MC:', colO.length, 'Amex:', colP.length, 'Cheque:', colQ.length)

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
