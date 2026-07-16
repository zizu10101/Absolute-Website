import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  try {
    const { data, error } = await supabase
      .from('navigation_items')
      .select('label, logo_url, menu_id, parent_id')
      .not('logo_url', 'is', null)
      .limit(15);
    
    if (error) throw error;
    console.log('=== Database Navigation Logos ===');
    console.log(JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
