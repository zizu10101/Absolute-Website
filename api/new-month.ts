import { createNewMonthSheet } from '../src/utils/googleSheets'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Load current sheet ID from Supabase before creating new month
    const { data: setting } = await supabase
      .from('settings')
      .select('data')
      .eq('key', 'google_sheet_id')
      .maybeSingle()
    if (setting?.data?.id) {
      process.env.GOOGLE_SHEET_ID = setting.data.id
    }

    const result = await createNewMonthSheet()

    // Persist new sheet ID to Supabase so future invocations pick it up
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
