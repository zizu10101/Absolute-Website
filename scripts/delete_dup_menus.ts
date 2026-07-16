import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

(async () => {
  // First: count before
  const { data: before } = await supabase.from('navigation_menus').select('id');
  console.log(`Rows before: ${before?.length}`);

  // Find the newest id per label to keep
  const { data: allMenus } = await supabase
    .from('navigation_menus')
    .select('id, label, created_at')
    .order('label')
    .order('created_at', { ascending: false });

  // Pick newest id per label
  const keepIds = new Map<string, string>();
  for (const row of allMenus || []) {
    if (!keepIds.has(row.label)) keepIds.set(row.label, row.id);
  }

  const keepList = [...keepIds.values()];
  console.log(`\nKeeping ${keepList.length} rows (one per label):`);
  for (const [label, id] of keepIds) {
    console.log(`  ${label}: ${id}`);
  }

  // Delete everything NOT in keepList
  const { error, count } = await supabase
    .from('navigation_menus')
    .delete({ count: 'exact' })
    .not('id', 'in', `(${keepList.join(',')})`);

  if (error) { console.error('\nDelete error:', error.message); process.exit(1); }

  // Count after
  const { data: after } = await supabase.from('navigation_menus').select('id');
  console.log(`\nRows deleted: ${count ?? '?'}`);
  console.log(`Rows after:  ${after?.length}`);

  process.exit(0);
})();
