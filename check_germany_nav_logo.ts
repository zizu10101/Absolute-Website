import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkGermanyNavLogo() {
  try {
    console.log('='.repeat(80));
    console.log('CHECKING GERMANY NAVIGATION ITEM LOGO');
    console.log('='.repeat(80) + '\n');
    
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('key', 'navigation');
    
    if (error || !data?.[0]) {
      console.error('❌ Error reading navigation:', error);
      return;
    }
    
    const nav = data[0].data;
    const nationalTeams = nav.navigationMenus.find((m: any) => m.label === 'NATIONAL TEAMS');
    const europe = nationalTeams?.submenus?.find((s: any) => s.heading === 'Europe');
    const germany = europe?.items?.find((i: any) => i.label === 'Germany');
    
    console.log('GERMANY NAVIGATION ITEM:\n');
    console.log(`Label: ${germany?.label}`);
    console.log(`Path: ${germany?.path}`);
    console.log(`Logo Present: ${germany?.logo ? '✅ YES' : '❌ NO'}`);
    
    if (germany?.logo) {
      console.log(`\nLOGO DETAILS:`);
      console.log(`Format: ${germany.logo.substring(0, 50)}`);
      console.log(`Length: ${germany.logo.length} bytes`);
      console.log(`Full content:`);
      console.log(germany.logo);
      
      // Check if it's valid
      if (germany.logo.startsWith('data:image')) {
        console.log(`\n✅ Format is valid data URI`);
        
        // Extract MIME type and try to decode
        const matches = germany.logo.match(/^data:([^;]+);(base64,)?(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const isBase64 = !!matches[2];
          const data = matches[3];
          
          console.log(`\nMIME Type: ${mimeType}`);
          console.log(`Encoding: ${isBase64 ? 'base64' : 'text'}`);
          console.log(`Data length: ${data.length}`);
          
          if (isBase64) {
            try {
              const decoded = Buffer.from(data, 'base64').toString('utf8');
              console.log(`\n✅ Base64 decodes successfully`);
              console.log(`Decoded length: ${decoded.length} characters`);
              console.log(`First 150 chars: ${decoded.substring(0, 150)}`);
              
              // Check if it's valid SVG
              if (decoded.includes('<svg') || decoded.includes('<?xml')) {
                console.log(`✅ Appears to be valid SVG`);
              }
            } catch (e) {
              console.log(`❌ Failed to decode base64`);
            }
          }
        }
      } else {
        console.log(`❌ Not in data URI format`);
      }
    } else {
      console.log(`\n❌ NO LOGO FOUND FOR GERMANY`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('COMPARISON WITH OTHER COUNTRIES');
    console.log('='.repeat(80) + '\n');
    
    console.log('Other European countries:\n');
    europe?.items?.slice(0, 3).forEach((item: any) => {
      console.log(`${item.label}:`);
      console.log(`  Logo present: ${item.logo ? '✅ YES' : '❌ NO'}`);
      if (item.logo) {
        console.log(`  Logo length: ${item.logo.length} bytes`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkGermanyNavLogo();
