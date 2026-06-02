import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transactionId } = req.body || {};
  if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

  try {
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'voided' })
      .eq('id', transactionId)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
};
