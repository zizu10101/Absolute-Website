import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ReturnItem {
  itemId: string;
  name: string;
  quantity: number;
  amount: number;
  returnType: 'refund' | 'store_credit';
}

interface ReturnRequest {
  transactionId: string;
  returnItems: ReturnItem[];
  refundAmount: number;
  storeCreditAmount: number;
  originalPaymentMethod: string;
  customerId?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { transactionId, returnItems, refundAmount, storeCreditAmount, originalPaymentMethod, customerId } = req.body as ReturnRequest;

  try {
    console.log('🔄 Processing return:', {
      transactionId,
      refundAmount,
      storeCreditAmount,
      itemCount: returnItems.length,
    });

    // 1. Create return record
    const { data: returnRecord, error: returnError } = await supabase
      .from('returns')
      .insert({
        transaction_id: transactionId,
        refund_amount: refundAmount,
        store_credit_amount: storeCreditAmount,
        items: returnItems,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (returnError) {
      console.error('❌ Error creating return record:', returnError);
      return res.status(400).json({ error: 'Failed to create return record' });
    }

    console.log('✅ Return record created:', returnRecord.id);

    // 2. Restore inventory for returned items
    for (const item of returnItems) {
      try {
        // Extract variant ID from item (assume it's in the itemId or we need to look it up)
        // For now, we'll look up the transaction to get the actual items
        const { data: tx } = await supabase
          .from('transactions')
          .select('items')
          .eq('id', transactionId)
          .single();

        if (tx && tx.items) {
          const origItem = tx.items.find((i: any) => i.name === item.name);
          if (origItem && origItem.variantId) {
            const { data: variant } = await supabase
              .from('product_variants')
              .select('stock_quantity')
              .eq('id', origItem.variantId)
              .single();

            if (variant) {
              const newQty = (variant.stock_quantity || 0) + item.quantity;
              await supabase
                .from('product_variants')
                .update({ stock_quantity: newQty })
                .eq('id', origItem.variantId);

              console.log(`✅ Restored ${item.quantity} units of ${item.name}, new stock: ${newQty}`);
            }
          }
        }
      } catch (err) {
        console.error(`⚠️ Could not restore stock for ${item.name}:`, err);
      }
    }

    // 3. Issue store credit if needed
    if (storeCreditAmount > 0 && customerId) {
      try {
        const { data: scRecord } = await supabase
          .from('store_credits')
          .insert({
            customer_id: customerId,
            amount: storeCreditAmount,
            remaining_balance: storeCreditAmount,
            reason: 'Return',
            is_active: true,
            created_at: new Date().toISOString(),
            reference_transaction_id: transactionId,
          })
          .select()
          .single();

        if (scRecord) {
          // Record the store credit transaction
          await supabase.from('store_credit_transactions').insert({
            store_credit_id: scRecord.id,
            type: 'issued',
            amount: storeCreditAmount,
            created_at: new Date().toISOString(),
            reference_transaction_id: transactionId,
          });

          console.log(`✅ Store credit issued: $${storeCreditAmount} (ID: ${scRecord.id})`);
        }
      } catch (err) {
        console.error('❌ Error issuing store credit:', err);
        // Don't fail the whole return if SC creation fails
      }
    }

    // 4. Create refund record in transactions table (for audit trail)
    if (refundAmount > 0) {
      try {
        await supabase.from('transactions').insert({
          type: 'refund',
          original_transaction_id: transactionId,
          method: originalPaymentMethod,
          total_amount: refundAmount,
          customer_id: customerId,
          items: returnItems,
          created_at: new Date().toISOString(),
          status: 'completed',
        });

        console.log(`✅ Refund record created: $${refundAmount} to ${originalPaymentMethod}`);
      } catch (err) {
        console.error('⚠️ Could not create refund record:', err);
      }
    }

    return res.status(200).json({
      success: true,
      returnId: returnRecord.id,
      refundAmount,
      storeCreditAmount,
      message: `Return processed. Refund: $${refundAmount.toFixed(2)}, Store Credit: $${storeCreditAmount.toFixed(2)}`,
    });
  } catch (error) {
    console.error('❌ Return processing error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process return',
    });
  }
}
