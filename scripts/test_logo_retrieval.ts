import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

// These are the DEFAULT_NAV URLs (placeholders)
const DEFAULT_NIKE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/1200px-Logo_NIKE.svg.png';
const DEFAULT_ARSENAL = 'https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/1200px-Arsenal_FC.svg.png';

(async () => {
  try {
    const { data, error } = await supabase
      .from('navigation_items')
      .select('label, logo_url')
      .in('label', ['Nike', 'NIKE', 'Arsenal'])
      .limit(10);
    
    if (error) throw error;
    
    console.log('=== Logo Retrieval Test ===\n');
    
    let passCount = 0;
    let totalTests = 0;

    data?.forEach((item: any) => {
      if (item.label.toUpperCase() === 'NIKE') {
        totalTests++;
        const isBase64 = item.logo_url.startsWith('data:');
        const isWikimedia = item.logo_url.includes('wikimedia');
        console.log(`Nike Logo:`);
        console.log(`  URL Type: ${isBase64 ? '✅ BASE64 (Real Logo)' : isWikimedia ? '❌ WIKIMEDIA (Placeholder)' : 'OTHER'}`);
        if (isBase64) passCount++;
      }
      
      if (item.label === 'Arsenal') {
        totalTests++;
        const isBase64 = item.logo_url.startsWith('data:');
        const isWikimedia = item.logo_url.includes('wikimedia');
        console.log(`\nArsenal Logo:`);
        console.log(`  URL Type: ${isBase64 ? '✅ BASE64 (Real Logo)' : isWikimedia ? '❌ WIKIMEDIA (Placeholder)' : 'OTHER'}`);
        if (isBase64) passCount++;
      }
    });

    console.log(`\n=== RESULT ===`);
    console.log(`Tests Passed: ${passCount}/${totalTests}`);
    
    if (passCount === totalTests) {
      console.log('✅ All logos are using REAL data (not defaults)');
    } else {
      console.log('⚠️ Some logos are still using default placeholders');
    }
    
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
