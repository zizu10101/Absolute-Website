import { syncEODToSheet } from '../src/utils/googleSheets'
import { createClient } from '@supabase/supabase-js'
import { DateTime } from 'luxon'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Load current sheet ID from Supabase (may have been updated by new-month)
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
