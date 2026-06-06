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

    console.log('🔵 RETURN.TS: Fetch result - error:', fetchErr?.message || 'none', 'transaction exists:', !!transaction);

    if (fetchErr || !transaction) {
      console.error('❌ RETURN.TS: Transaction not found');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log('🔵 RETURN.TS: Found transaction - current status:', transaction.status);

    // UPDATE transaction status to 'returned' - DO NOT DELETE!
    console.log('🔵 RETURN.TS: Updating status to returned...');
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'returned' })
      .eq('id', transactionId)
      .select();

    console.log('🔵 RETURN.TS: Update response - error:', error?.message || 'none', 'rows:', data ? data.length : 0);

    if (error) {
      console.error('❌ RETURN.TS: Update failed:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log('✅ RETURN.TS: Transaction status updated to returned');

    // Restore stock for all items in the transaction
    if (transaction.items && Array.isArray(transaction.items)) {
      console.log('📦 RETURN.TS: Restoring stock for', transaction.items.length, 'items');

      for (const item of transaction.items) {
        try {
          const variantId = item.variantId || (item.id.startsWith('var-') ? item.id.replace('var-', '') : null);

          if (variantId) {
            // Fetch current stock
            const { data: variant, error: varFetchErr } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', variantId)
              .single();

            if (!varFetchErr && variant) {
              const newQuantity = (variant.stock_quantity || 0) + (item.quantity || 1);

              await supabase
                .from('product_variants')
                .update({ stock_quantity: newQuantity })
                .eq('id', variantId);

              console.log(`✅ RETURN.TS: Restored ${item.quantity || 1} units to variant ${variantId}`);
            }
          }
        } catch (err) {
          console.error('❌ RETURN.TS: Error restoring stock for item:', err);
        }
      }
    }

    // Handle gift card reversals for returns
    if (transaction.method === 'Gift Card' || transaction.method?.includes('Gift Card')) {
      console.log('🎁 RETURN.TS: Reversing gift card for returned transaction:', transactionId);

      // Find gift card transactions associated with this POS transaction
      const { data: gcTransactions, error: gcTxError } = await supabase
        .from('gift_card_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('transaction_type', 'redeemed');

      console.log('🎁 RETURN.TS: Gift card redemptions found:', gcTransactions ? gcTransactions.length : 0);

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
                  is_active: true // Reactivate if returning
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
                transaction_type: 'return_reversal',
                created_at: new Date().toISOString(),
              }]);

            console.log(`✅ RETURN.TS: Reversed $${refundAmount} on gift card ${gcTx.gift_card_id}`);
          } catch (err) {
            console.error('❌ RETURN.TS: Error reversing gift card on return:', err);
          }
        }
      }
    }

    // Handle store credit reversals for returns
    if (transaction.method === 'Store Credit' || transaction.method?.includes('Store Credit')) {
      console.log('🎟 RETURN.TS: Reversing store credit for returned transaction:', transactionId);

      // Find store credit transactions associated with this POS transaction
      const { data: scTransactions, error: scTxError } = await supabase
        .from('store_credit_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('transaction_type', 'redeemed');

      console.log('🎟 RETURN.TS: Store credit redemptions found:', scTransactions ? scTransactions.length : 0);

      if (scTransactions && scTransactions.length > 0) {
        for (const scTx of scTransactions) {
          try {
            const refundAmount = Math.abs(scTx.amount); // Reverse negative amount to positive

            // Fetch current balance and update
            const { data: sc } = await supabase
              .from('store_credits')
              .select('remaining_balance')
              .eq('id', scTx.store_credit_id)
              .single();

            if (sc) {
              const newBalance = (sc.remaining_balance || 0) + refundAmount;
              await supabase
                .from('store_credits')
                .update({
                  remaining_balance: newBalance,
                  is_active: newBalance > 0 // Keep active if balance > 0
                })
                .eq('id', scTx.store_credit_id);
            }

            // Record reversal in store_credit_transactions
            await supabase
              .from('store_credit_transactions')
              .insert([{
                store_credit_id: scTx.store_credit_id,
                transaction_id: null, // Reversal is not linked to a new transaction
                amount: refundAmount, // Positive amount for reversal
                transaction_type: 'return_reversal',
                created_at: new Date().toISOString(),
              }]);

            console.log(`✅ RETURN.TS: Reversed $${refundAmount} on store credit ${scTx.store_credit_id}`);
          } catch (err) {
            console.error('❌ RETURN.TS: Error reversing store credit on return:', err);
          }
        }
      }
    }

    return res.status(200).json({ success: true, data, message: 'Transaction returned successfully' });
  } catch (e: any) {
    console.error('❌ RETURN.TS: Caught exception:', e);
    return res.status(500).json({ error: e.message });
  }
};
