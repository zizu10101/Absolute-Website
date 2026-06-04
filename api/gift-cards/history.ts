import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  // GET /api/gift-cards/history?gift_card_id=XXXX - Get transaction history for a gift card
  if (req.method === 'GET') {
    try {
      const { gift_card_id } = req.query;

      if (!gift_card_id) {
        return res.status(400).json({ error: 'gift_card_id required' });
      }

      const { data, error } = await supabase
        .from('gift_card_transactions')
        .select('*')
        .eq('gift_card_id', gift_card_id)
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
