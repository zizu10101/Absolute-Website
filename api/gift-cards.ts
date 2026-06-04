import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Generate unique 16-digit gift card number
function generateCardNumber(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 16);
}

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  // GET /api/gift-cards - List all gift cards
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*, customers(first_name, last_name, email)')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/gift-cards - Issue a new gift card
  if (req.method === 'POST') {
    try {
      const { initial_balance, customer_id, card_number: providedCardNumber } = req.body;

      console.log('🎁 POST /api/gift-cards - Request body:', req.body);

      if (!initial_balance || initial_balance <= 0) {
        console.error('❌ Invalid amount:', initial_balance);
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Use provided card number or generate new one
      const card_number = providedCardNumber || generateCardNumber();
      console.log('🔢 Card number:', card_number, '(auto-generated:', !providedCardNumber, ')');

      const insertPayload = {
        card_number,
        initial_balance: Number(initial_balance),
        current_balance: Number(initial_balance),
        customer_id: customer_id || null,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      console.log('📦 Insert payload:', insertPayload);

      const { data, error } = await supabase
        .from('gift_cards')
        .insert([insertPayload])
        .select();

      console.log('📊 Supabase insert result:', { data, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      if (!data || data.length === 0) {
        console.error('❌ No data returned from insert');
        return res.status(500).json({ error: 'Insert succeeded but no data returned' });
      }

      console.log('✅ Gift card created:', data[0]);
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      console.error('❌ Exception in POST /api/gift-cards:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
