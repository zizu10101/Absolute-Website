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
    // Fetch original transaction
    const { data: original, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    console.log('🟠 REFUND.TS: Fetch result - error:', fetchErr?.message || 'none', 'transaction exists:', !!original);

    if (fetchErr || !original) {
      console.error('❌ REFUND.TS: Transaction not found');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log('🟠 REFUND.TS: Found transaction - current status:', original.status);

    // STEP 1: Update original transaction status to 'refunded' - DO NOT DELETE!
    console.log('🟠 REFUND.TS: Updating original transaction status to refunded...');
    const { data: updateData, error: updateErr } = await supabase
      .from('transactions')
      .update({ status: 'refunded' })
      .eq('id', transactionId)
      .select();

    console.log('🟠 REFUND.TS: Update response - error:', updateErr?.message || 'none', 'rows:', updateData ? updateData.length : 0);

    if (updateErr) {
      console.error('❌ REFUND.TS: Update failed:', updateErr.message);
      return res.status(500).json({ error: `Database error: ${updateErr.message}` });
    }

    // STEP 2: Create negative refund record for tracking
    console.log('🟠 REFUND.TS: Creating refund record...');
    const { data, error } = await supabase.from('transactions').insert([{
      total_amount: Number(original.total_amount) * -1,
      method: original.method,
      status: 'refunded',
      items: original.items,
      customer_id: original.customer_id,
      created_at: new Date().toISOString(),
    }]).select();

    console.log('🟠 REFUND.TS: Refund record created - error:', error?.message || 'none', 'rows:', data ? data.length : 0);

    if (error) {
      console.error('❌ REFUND.TS: Refund insert failed:', error.message);
      return res.status(500).json({ error: error.message });
    }

    // STEP 3: Restore stock for each variant-tracked item
    console.log('🟠 REFUND.TS: Restoring stock for', (original.items || []).length, 'items');
    for (const item of (original.items || [])) {
      const variantId = item.variantId;
      if (!variantId) continue;
      try {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', variantId)
          .single();
        if (variant) {
          await supabase
            .from('product_variants')
            .update({ stock_quantity: (variant.stock_quantity || 0) + (item.quantity || 1) })
            .eq('id', variantId);
          console.log(`✅ REFUND.TS: Restored stock for variant ${variantId.slice(0, 8)}`);
        }
      } catch (stockErr) {
        console.error('❌ REFUND.TS: Stock restore error for variant', variantId, stockErr);
      }
    }

    // STEP 4: Handle gift card reversals
    if (original.method === 'Gift Card' || original.method?.includes('Gift Card')) {
      console.log('🎁 REFUND.TS: Reversing gift card for transaction:', transactionId);

      const { data: gcTransactions, error: gcTxError } = await supabase
        .from('gift_card_transactions')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('transaction_type', 'redeem');

      console.log('🎁 REFUND.TS: Gift card redemptions found:', gcTransactions ? gcTransactions.length : 0);

      if (gcTransactions && gcTransactions.length > 0) {
        for (const gcTx of gcTransactions) {
          try {
            const refundAmount = Math.abs(gcTx.amount);

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
                  is_active: true
                })
                .eq('id', gcTx.gift_card_id);
            }

            await supabase
              .from('gift_card_transactions')
              .insert([{
                gift_card_id: gcTx.gift_card_id,
                transaction_id: null,
                amount: refundAmount,
                transaction_type: 'refund_reversal',
                created_at: new Date().toISOString(),
              }]);

            console.log(`✅ REFUND.TS: Reversed $${refundAmount} on gift card ${gcTx.gift_card_id}`);
          } catch (err) {
            console.error('❌ REFUND.TS: Error reversing gift card:', err);
          }
        }
      }
    }

    console.log('✅ REFUND.TS: Refund completed successfully');
    return res.status(200).json({ success: true, data, message: 'Refund processed successfully' });
  } catch (e: any) {
    console.error('❌ REFUND.TS: Caught exception:', e);
    return res.status(500).json({ error: e.message });
  }
};
