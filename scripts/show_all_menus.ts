import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

(async () => {
  const { data, error } = await supabase
    .from('navigation_menus')
    .select('id, label, created_at, order_index')
    .order('label')
    .order('created_at');

  if (error) { console.error(error.message); process.exit(1); }

  console.log(`Total rows: ${data?.length}\n`);
  console.log('id                                   | label              | order_index | created_at');
  console.log('-------------------------------------|--------------------|-----------|--------------------------');
  data?.forEach(row => {
    const created = row.created_at ? new Date(row.created_at).toISOString() : 'null';
    console.log(`${row.id} | ${row.label.padEnd(18)} | ${String(row.order_index).padEnd(9)} | ${created}`);
  });

  process.exit(0);
})();
