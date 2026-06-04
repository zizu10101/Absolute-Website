import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  // POST /api/gift-cards/redeem - Redeem a gift card
  if (req.method === 'POST') {
    try {
      const { card_number, amount, transaction_id } = req.body;

      if (!card_number || !amount || amount <= 0) {
        return res.status(400).json({ error: 'card_number and amount required' });
      }

      // Look up the gift card
      const { data: giftCard, error: lookupError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('card_number', card_number.toUpperCase())
        .single();

      if (lookupError || !giftCard) {
        return res.status(404).json({ error: 'Gift card not found' });
      }

      if (!giftCard.is_active) {
        return res.status(400).json({ error: 'Gift card is inactive' });
      }

      if (giftCard.current_balance <= 0) {
        return res.status(400).json({ error: 'Gift card has no balance' });
      }

      if (giftCard.current_balance < amount) {
        return res.status(400).json({ error: `Insufficient balance. Available: $${giftCard.current_balance.toFixed(2)}` });
      }

      // Deduct from gift card
      const newBalance = giftCard.current_balance - amount;
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update({ current_balance: newBalance, is_active: newBalance > 0 })
        .eq('id', giftCard.id);

      if (updateError) return res.status(500).json({ error: updateError.message });

      // Record transaction
      const { data: txnData, error: txnError } = await supabase
        .from('gift_card_transactions')
        .insert([{
          gift_card_id: giftCard.id,
          transaction_id: transaction_id || null,
          amount: -amount, // negative for redemption
          transaction_type: 'redeem',
          created_at: new Date().toISOString(),
        }])
        .select();

      if (txnError) return res.status(500).json({ error: txnError.message });

      return res.status(200).json({
        success: true,
        data: { giftCard: { ...giftCard, current_balance: newBalance }, transaction: txnData[0] }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
