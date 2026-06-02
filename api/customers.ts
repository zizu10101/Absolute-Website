import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('last_name', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([req.body])
        .select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
