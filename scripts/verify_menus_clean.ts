import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);
(async () => {
  const { data } = await supabase.from('navigation_menus').select('id, label, created_at').order('order_index');
  console.log(`navigation_menus rows: ${data?.length}`);
  data?.forEach(r => console.log(`  ${r.label}: ${r.id}`));
  process.exit(0);
})();
