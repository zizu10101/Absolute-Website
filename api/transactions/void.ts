import { createClient } from '@supabase/supabase-js';

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { transactionId } = req.body || {};
  if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

  // Create admin client on each request
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  );

  try {
    // Fetch transaction first to verify it exists
    const { data: transaction, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    console.log('🔵 VOID.TS: Fetch result - error:', fetchErr?.message || 'none', 'transaction exists:', !!transaction);

    if (fetchErr || !transaction) {
      console.error('❌ VOID.TS: Transaction not found');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log('🔵 VOID.TS: Found transaction - current status:', transaction.status);

    // UPDATE transaction status to 'voided' - DO NOT DELETE!
    console.log('🔵 VOID.TS: Updating status to voided...');
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'voided' })
      .eq('id', transactionId)
      .select();

    console.log('🔵 VOID.TS: Update response - error:', error?.message || 'none', 'rows:', data ? data.length : 0);

    if (error) {
      console.error('❌ VOID.TS: Update failed:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log('✅ VOID.TS: Transaction status updated to voided');

    // Handle gift card reversals for voids
    if (transaction.method === 'Gift Card' || transaction.method?.includes('Gift Card')) {
      console.log('🎁 VOID.TS: Reversing gift card for voided transaction:', transactionId);

      // Find gift card transactions associated with this POS transaction
      const { data: gcTransactions, error: gcTxError } = await supabase
        .from('gift_card_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('transaction_type', 'redeem');

      console.log('🎁 VOID.TS: Gift card redemptions found:', gcTransactions ? gcTransactions.length : 0);

      if (gcTransactions && gcTransactions.length > 0) {
        for (const gcTx of gcTransactions) {
          try {
            const refundAmount = Math.abs(gcTx.amount); // Reverse negative amount to positive

            // Fetch current balance and update
            const { data: gc } = await supabase
              .from('gift_cards')
              .select('current_balance')
              .eq('id', gcTx.gift_card_id)
              .single();

            if (gc) {
              await supabase
                .from('gift_cards')
                .update({
                  current_balance: gc.current_balance + refundAmount,
                  is_active: true // Reactivate if voiding
                })
                .eq('id', gcTx.gift_card_id);
            }

            // Record reversal in gift_card_transactions
            await supabase
              .from('gift_card_transactions')
              .insert([{
                gift_card_id: gcTx.gift_card_id,
                transaction_id: null, // Reversal is not linked to a new transaction
                amount: refundAmount, // Positive amount for reversal
                transaction_type: 'void_reversal',
                created_at: new Date().toISOString(),
              }]);

            console.log(`✅ VOID.TS: Reversed $${refundAmount} on gift card ${gcTx.gift_card_id}`);
          } catch (err) {
            console.error('❌ VOID.TS: Error reversing gift card on void:', err);
          }
        }
      }
    }

    return res.status(200).json({ success: true, data, message: 'Transaction voided successfully' });
  } catch (e: any) {
    console.error('❌ VOID.TS: Caught exception:', e);
    return res.status(500).json({ error: e.message });
  }
};
