import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

(async () => {
  // First show all menus so we can see the exact label
  const { data: allMenus } = await supabase.from('navigation_menus').select('id, label').order('order_index');
  console.log('All menus:', allMenus?.map(m => `${m.id}: "${m.label}"`).join('\n  '));

  // Find FOOTWEAR (case-insensitive)
  const footwear = allMenus?.find(m => m.label.toUpperCase() === 'FOOTWEAR');
  if (!footwear) { console.log('\nNo FOOTWEAR menu found'); process.exit(0); }

  console.log(`\nFOOTWEAR menu id: ${footwear.id}\n`);

  const { data, error } = await supabase
    .from('navigation_items')
    .select('label, logo_url')
    .not('logo_url', 'is', null)
    .eq('menu_id', footwear.id)
    .order('label');

  if (error) { console.error(error.message); process.exit(1); }

  console.log(`Items with logos in FOOTWEAR (${data?.length ?? 0} total):\n`);
  data?.forEach(item => {
    const preview = item.logo_url.substring(0, 70);
    console.log(`  ${item.label}: ${preview}...`);
  });

  process.exit(0);
})();
