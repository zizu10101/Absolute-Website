import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

(async () => {
  try {
    // Fetch navigation from database (same as SettingsContext does)
    const { data: menus, error: menusError } = await supabase
      .from('navigation_menus')
      .select('*')
      .order('order_index');
    
    const { data: items, error: itemsError } = await supabase
      .from('navigation_items')
      .select('*')
      .order('order_index');
    
    if (menusError || itemsError) throw new Error('Fetch error');
    
    console.log('=== Fresh Navigation Fetch ===\n');
    console.log(`✅ Navigation menus: ${menus?.length || 0}`);
    console.log(`✅ Navigation items: ${items?.length || 0}`);
    
    // Show sample items with logos
    const itemsWithLogos = items?.filter((item: any) => item.logo_url && item.logo_url.startsWith('data:')) || [];
    console.log(`\n✅ Items with REAL logos (base64): ${itemsWithLogos.length}`);
    
    if (itemsWithLogos.length > 0) {
      console.log('\nSample real logos:');
      itemsWithLogos.slice(0, 5).forEach((item: any) => {
        const preview = item.logo_url.substring(0, 50) + '...';
        console.log(`  ${item.label}: ${preview}`);
      });
    }
    
    console.log('\n✅ Fresh fetch from database is working correctly');
    
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
