import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

(async () => {
  try {
    const { data, error } = await supabase
      .from('navigation_items')
      .select('label, logo_url')
      .not('logo_url', 'is', null)
      .limit(20);
    
    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }
    
    console.log('=== Navigation Items with Logos ===');
    data?.forEach((item: any) => {
      console.log(`${item.label}: ${item.logo_url}`);
    });
    console.log('\nJSON:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (err: any) {
    console.error('Exception:', err.message);
    process.exit(1);
  }
  process.exit(0);
})();
