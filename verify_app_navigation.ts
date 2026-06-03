import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const anonKey = 'sb_publishable_BztYXdD_jH-krermY1kwkQ_Fgxez6Y4';

const supabase = createClient(supabaseUrl, anonKey);

async function verifyAppCanAccess() {
  try {
    console.log('🔍 Verifying app can access navigation via public anon key...\n');
    
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'navigation');
    
    if (error) {
      console.error('❌ Error accessing via anon key:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.error('❌ No navigation data found');
      return;
    }
    
    const nav = data[0].data;
    console.log('✅ App can access navigation data');
    console.log(`\n📦 Navigation structure accessible to app:`);
    console.log(`   - Main menus loaded: ${nav.navigationMenus.length}`);
    
    // Sample the structure the app will see
    console.log(`\n🧪 Sample navigation structure (what the app will render):`);
    const footwear = nav.navigationMenus[0];
    console.log(`\nFOOTWEAR menu:`);
    console.log(`  - path: ${footwear.path}`);
    console.log(`  - submenus: ${footwear.submenus.length}`);
    console.log(`    1. ${footwear.submenus[0].heading} - ${footwear.submenus[0].items.length} items`);
    console.log(`       • ${footwear.submenus[0].items[0].label} [has logo: ${!!footwear.submenus[0].items[0].logo}]`);
    
    const nationalTeams = nav.navigationMenus[2];
    console.log(`\nNATIONAL TEAMS menu:`);
    console.log(`  - path: ${nationalTeams.path}`);
    console.log(`  - submenus: ${nationalTeams.submenus.length}`);
    console.log(`    1. ${nationalTeams.submenus[0].heading} - ${nationalTeams.submenus[0].items.length} countries`);
    console.log(`       • ${nationalTeams.submenus[0].items[0].label} [has logo: ${!!nationalTeams.submenus[0].items[0].logo}]`);
    
    console.log('\n✨ Navigation is ready for the app to use!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyAppCanAccess();
