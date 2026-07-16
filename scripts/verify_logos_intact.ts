import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);
(async () => {
  const { data } = await supabase
    .from('navigation_items')
    .select('label, logo_url')
    .not('logo_url', 'is', null)
    .order('label');
  console.log(`Items with logos: ${data?.length}`);
  data?.forEach(r => {
    const src = r.logo_url.startsWith('data:') ? '[base64]'
      : r.logo_url.includes('supabase.co') ? '[supabase storage]'
      : r.logo_url.includes('filesafe') ? '[filesafe CDN]'
      : '[other URL]';
    console.log(`  ${r.label}: ${src}`);
  });
  process.exit(0);
})();
