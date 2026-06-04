import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  // GET /api/gift-cards/lookup?card_number=XXXX - Lookup a gift card
  if (req.method === 'GET') {
    try {
      const { card_number } = req.query;

      if (!card_number) {
        return res.status(400).json({ error: 'card_number required' });
      }

      const { data, error } = await supabase
        .from('gift_cards')
        .select('*, customers(first_name, last_name)')
        .eq('card_number', card_number.toUpperCase())
        .single();

      if (error) return res.status(404).json({ error: 'Gift card not found' });
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
