import { createClient } from '@supabase/supabase-js';

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  // Create client on each request to ensure fresh env vars
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  );

  if (req.method === 'POST') {
    try {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .insert([req.body])
        .select();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const { customer_id, limit } = req.query;

      // Build query - NO status filtering, return ALL transactions (completed, voided, refunded)
      let query = supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (customer_id) {
        query = query.eq('customer_id', customer_id);
      }

      if (limit) {
        query = query.limit(parseInt(limit));
      }

      console.log('🔍 DEBUG: Executing query to fetch transactions...');
      const { data, error, count } = await query;

      console.log('🔍 DEBUG: Query complete - error:', error ? error.message : 'none', 'data length:', data ? data.length : 0);

      if (data && data.length > 0) {
        console.log('🔍 DEBUG: Transaction statuses returned:', data.map((t: any) => t.status));
      }

      if (error) {
        console.error('🔍 DEBUG: Supabase error details:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log('🔍 DEBUG: Returning', data ? data.length : 0, 'transactions to client');
      return res.status(200).json({ success: true, data, count });
    } catch (e: any) {
      console.error('🔍 DEBUG: Exception:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
