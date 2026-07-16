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
      .limit(10);
    
    if (error) throw error;
    
    console.log('=== Sample of restored logos ===');
    data?.forEach((item: any) => {
      const logoPreview = item.logo_url.substring(0, 80) + '...';
      console.log(`${item.label}: ${logoPreview}`);
    });
    
    console.log(`\n✅ Total logos in database: ${data?.length || 0}`);
    
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
