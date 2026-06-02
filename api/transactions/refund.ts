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
    const { data: original, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchErr || !original) return res.status(404).json({ error: 'Transaction not found' });

    // Create negative refund record
    const { data, error } = await supabase.from('transactions').insert([{
      total_amount: Number(original.total_amount) * -1,
      method: original.method,
      status: 'refunded',
      items: original.items,
      customer_id: original.customer_id,
      created_at: new Date().toISOString(),
    }]).select();

    if (error) return res.status(500).json({ error: error.message });

    // Restore stock for each variant-tracked item
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
        }
      } catch (stockErr) {
        console.error('Stock restore error for variant', variantId, stockErr);
      }
    }

    return res.status(200).json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
};
