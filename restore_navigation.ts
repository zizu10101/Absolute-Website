import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function restoreNavigation() {
  try {
    console.log('📖 Reading backup file...');
    const backup = JSON.parse(fs.readFileSync('data/backup-2026-05-02.json', 'utf8'));
    const navigationData = backup.settings.navigation;
    
    console.log('\n✅ Backup loaded');
    console.log(`   - Main menus: ${navigationData.navigationMenus.length}`);
    
    let totalItems = 0;
    let totalLogos = 0;
    navigationData.navigationMenus.forEach((menu: any) => {
      menu.submenus?.forEach((sub: any) => {
        sub.items?.forEach((item: any) => {
          totalItems++;
          if (item.logo) totalLogos++;
        });
      });
    });
    
    console.log(`   - Total items: ${totalItems}`);
    console.log(`   - Items with logos: ${totalLogos}`);
    
    console.log('\n💾 Saving to Supabase settings table...');
    
    // Upsert the navigation data to the settings table
    const { data, error } = await supabase
      .from('settings')
      .upsert(
        { key: 'navigation', data: navigationData },
        { onConflict: 'key' }
      )
      .select();
    
    if (error) {
      console.error('❌ Error saving to Supabase:', error);
      return;
    }
    
    console.log('✅ Navigation saved to Supabase');
    
    console.log('\n🔍 Verifying restore by reading back from Supabase...');
    
    const { data: readBack, error: readError } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'navigation');
    
    if (readError) {
      console.error('❌ Error reading back:', readError);
      return;
    }
    
    if (!readBack || readBack.length === 0) {
      console.error('❌ No data returned from Supabase');
      return;
    }
    
    const restoredNav = readBack[0].data;
    
    console.log('✅ Data verified from Supabase');
    console.log(`   - Main menus: ${restoredNav.navigationMenus.length}`);
    
    // Verify each main menu
    console.log('\n📋 Restored Navigation Structure:');
    restoredNav.navigationMenus.forEach((menu: any, i: number) => {
      const itemCount = menu.submenus?.reduce((sum: number, sub: any) => sum + (sub.items?.length || 0), 0) || 0;
      console.log(`\n${i + 1}. ${menu.label} (${menu.submenus?.length || 0} submenus, ${itemCount} items)`);
      
      menu.submenus?.slice(0, 2).forEach((sub: any, j: number) => {
        console.log(`   └─ ${sub.heading} (${sub.items?.length || 0} items)`);
        sub.items?.slice(0, 2).forEach((item: any, k: number) => {
          const hasLogo = item.logo ? '🖼️' : '  ';
          console.log(`      ${hasLogo} ${item.label || item.path}`);
        });
        if (sub.items && sub.items.length > 2) {
          console.log(`      ... and ${sub.items.length - 2} more items`);
        }
      });
      
      if (menu.submenus && menu.submenus.length > 2) {
        console.log(`   ... and ${menu.submenus.length - 2} more submenus`);
      }
    });
    
    // Detailed logo verification
    console.log('\n🖼️  Logo Verification:');
    let logoCount = 0;
    let noLogoCount = 0;
    const noLogoItems: string[] = [];
    
    restoredNav.navigationMenus.forEach((menu: any) => {
      menu.submenus?.forEach((sub: any) => {
        sub.items?.forEach((item: any) => {
          if (item.logo) {
            logoCount++;
          } else {
            noLogoCount++;
            noLogoItems.push(`${menu.label} > ${sub.heading} > ${item.label || item.path}`);
          }
        });
      });
    });
    
    console.log(`   ✅ Items with logos: ${logoCount}`);
    console.log(`   ❌ Items without logos: ${noLogoCount}`);
    if (noLogoItems.length > 0 && noLogoItems.length <= 10) {
      console.log('   Items missing logos:');
      noLogoItems.forEach(item => console.log(`      - ${item}`));
    }
    
    console.log('\n✨ Navigation restore complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

restoreNavigation();
