import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function querySupabase() {
  try {
    console.log('=== Query 1: SELECT * FROM settings WHERE key = "navigation" ===');
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'navigation');
    
    if (settingsError) {
      console.error('Error:', settingsError);
    } else {
      console.log(JSON.stringify(settingsData, null, 2));
    }

    console.log('\n=== Query 2: SELECT * FROM navigation_menus ===');
    const { data: menusData, error: menusError } = await supabase
      .from('navigation_menus')
      .select('*');
    
    if (menusError) {
      console.error('Error:', menusError);
    } else {
      console.log(JSON.stringify(menusData, null, 2));
    }

    console.log('\n=== Query 3: SELECT * FROM navigation_items ===');
    const { data: itemsData, error: itemsError } = await supabase
      .from('navigation_items')
      .select('*');
    
    if (itemsError) {
      console.error('Error:', itemsError);
    } else {
      console.log(JSON.stringify(itemsData, null, 2));
    }

  } catch (error) {
    console.error('Connection error:', error);
  }
}

querySupabase();
