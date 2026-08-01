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
      .not('logo_url', 'is', null);
    
    if (error) throw error;
    
    console.log('=== Real Logos (Base64 Encoded) ===\n');
    
    const realLogos = data?.filter(item => item.logo_url.startsWith('data:')) || [];
    const placeholders = data?.filter(item => !item.logo_url.startsWith('data:')) || [];
    
    console.log('Items with REAL logos (Base64):');
    realLogos.slice(0, 15).forEach(item => {
      const type = item.logo_url.includes('svg') ? 'SVG' : 'PNG';
      console.log(`  ✅ ${item.label} (${type})`);
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Real logos (base64): ${realLogos.length}`);
    console.log(`Placeholder logos: ${placeholders.length}`);
    console.log(`Total: ${data?.length || 0}`);
    
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
