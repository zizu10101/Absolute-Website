import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://nvyfktdhzhujeltkbgrz.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function diagnose() {
  try {
    console.log('='.repeat(80));
    console.log('DIAGNOSING RESTORE ISSUES');
    console.log('='.repeat(80));
    
    // 1. Get what's in Supabase
    console.log('\n1️⃣ QUERYING SUPABASE...\n');
    const { data: supabaseData, error } = await supabase
      .from('settings')
      .select('data')
      .eq('key', 'navigation');
    
    if (error) {
      console.error('❌ Error querying Supabase:', error);
      return;
    }
    
    const supabaseNav = supabaseData?.[0]?.data;
    
    // Count items and logos in Supabase
    let supabaseItemCount = 0;
    let supabaseLogoCount = 0;
    const supabaseMissingLogos: string[] = [];
    
    supabaseNav?.navigationMenus?.forEach((menu: any) => {
      menu.submenus?.forEach((sub: any) => {
        sub.items?.forEach((item: any) => {
          supabaseItemCount++;
          if (item.logo) {
            supabaseLogoCount++;
          } else {
            supabaseMissingLogos.push(`${menu.label} > ${sub.heading} > ${item.label}`);
          }
        });
      });
    });
    
    console.log(`✅ Supabase data loaded`);
    console.log(`   - Menus: ${supabaseNav?.navigationMenus?.length}`);
    console.log(`   - Total items: ${supabaseItemCount}`);
    console.log(`   - Items with logos: ${supabaseLogoCount}`);
    console.log(`   - Items without logos: ${supabaseMissingLogos.length}`);
    
    // 2. Get backup data
    console.log('\n2️⃣ READING BACKUP FILE...\n');
    const backup = JSON.parse(fs.readFileSync('data/backup-2026-05-02.json', 'utf8'));
    const backupNav = backup.settings.navigation;
    
    let backupItemCount = 0;
    let backupLogoCount = 0;
    const backupItems: Map<string, any> = new Map();
    
    backupNav.navigationMenus.forEach((menu: any) => {
      menu.submenus?.forEach((sub: any) => {
        sub.items?.forEach((item: any) => {
          backupItemCount++;
          const key = `${menu.label}|${sub.heading}|${item.label || item.path}`;
          backupItems.set(key, item);
          if (item.logo) {
            backupLogoCount++;
          }
        });
      });
    });
    
    console.log(`✅ Backup data loaded`);
    console.log(`   - Menus: ${backupNav.navigationMenus.length}`);
    console.log(`   - Total items: ${backupItemCount}`);
    console.log(`   - Items with logos: ${backupLogoCount}`);
    
    // 3. Compare - find missing items
    console.log('\n3️⃣ COMPARING SUPABASE vs BACKUP...\n');
    
    const missingItems: string[] = [];
    backupNav.navigationMenus.forEach((menu: any) => {
      menu.submenus?.forEach((sub: any) => {
        sub.items?.forEach((item: any) => {
          const supabaseMenu = supabaseNav?.navigationMenus?.find((m: any) => m.label === menu.label);
          const supabaseSub = supabaseMenu?.submenus?.find((s: any) => s.heading === sub.heading);
          const supabaseItem = supabaseSub?.items?.find((i: any) => i.label === item.label || i.path === item.path);
          
          if (!supabaseItem) {
            missingItems.push(`${menu.label} > ${sub.heading} > ${item.label || item.path}`);
          }
        });
      });
    });
    
    if (missingItems.length > 0) {
      console.log(`⚠️  MISSING ITEMS IN SUPABASE (${missingItems.length}):`);
      missingItems.forEach(item => console.log(`   ❌ ${item}`));
    } else {
      console.log('✅ All items present in Supabase');
    }
    
    // 4. Check logo truncation
    console.log('\n4️⃣ CHECKING LOGO DATA...\n');
    
    // Get a sample logo from both
    const backupNike = backupNav.navigationMenus[0].submenus[0].items[0];
    const supabaseNike = supabaseNav?.navigationMenus?.[0]?.submenus?.[0]?.items?.[0];
    
    console.log('NIKE Logo (Backup):');
    console.log(`   - Present: ${!!backupNike.logo}`);
    console.log(`   - Length: ${backupNike.logo?.length || 0} characters`);
    console.log(`   - First 80 chars: ${backupNike.logo?.substring(0, 80)}`);
    console.log(`   - Last 80 chars: ${backupNike.logo?.substring(-80)}`);
    
    console.log('\nNIKE Logo (Supabase):');
    console.log(`   - Present: ${!!supabaseNike?.logo}`);
    console.log(`   - Length: ${supabaseNike?.logo?.length || 0} characters`);
    if (supabaseNike?.logo) {
      console.log(`   - First 80 chars: ${supabaseNike.logo.substring(0, 80)}`);
      console.log(`   - Last 80 chars: ${supabaseNike.logo.substring(-80)}`);
    }
    
    const logoMatch = backupNike.logo === supabaseNike?.logo;
    console.log(`\n   Match: ${logoMatch ? '✅ YES' : '❌ NO - LOGOS ARE DIFFERENT!'}`);
    
    if (!logoMatch && supabaseNike?.logo) {
      const backupLen = backupNike.logo.length;
      const supabaseLen = supabaseNike.logo.length;
      console.log(`   Size difference: Backup ${backupLen} vs Supabase ${supabaseLen}`);
      if (supabaseLen < backupLen) {
        console.log(`   ⚠️  Data appears to be TRUNCATED by ${backupLen - supabaseLen} characters`);
      }
    }
    
    // 5. Check Germany specifically
    console.log('\n5️⃣ CHECKING GERMANY (National Teams > Europe > Germany)...\n');
    
    const backupGermany = backupNav.navigationMenus[2].submenus[0].items.find((i: any) => i.label === 'Germany');
    const supabaseNT = supabaseNav?.navigationMenus?.[2];
    const supabaseEurope = supabaseNT?.submenus?.[0];
    const supabaseGermany = supabaseEurope?.items?.find((i: any) => i.label === 'Germany');
    
    console.log('Backup Germany:');
    console.log(`   - Found: ${!!backupGermany}`);
    console.log(`   - Label: ${backupGermany?.label}`);
    console.log(`   - Path: ${backupGermany?.path}`);
    console.log(`   - Has logo: ${!!backupGermany?.logo}`);
    console.log(`   - Logo length: ${backupGermany?.logo?.length || 0}`);
    
    console.log('\nSupabase Germany:');
    console.log(`   - Found: ${!!supabaseGermany}`);
    console.log(`   - Label: ${supabaseGermany?.label}`);
    console.log(`   - Path: ${supabaseGermany?.path}`);
    console.log(`   - Has logo: ${!!supabaseGermany?.logo}`);
    console.log(`   - Logo length: ${supabaseGermany?.logo?.length || 0}`);
    
    if (!supabaseGermany) {
      console.log('\n   ⚠️  GERMANY IS MISSING FROM SUPABASE!');
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nIssue 1 - Missing Items: ${missingItems.length > 0 ? '❌ YES' : '✅ NO'}`);
    console.log(`Issue 2 - Missing Logos: ${supabaseLogoCount < backupLogoCount ? '❌ YES' : '✅ NO'}`);
    console.log(`Issue 3 - Logo Truncation: ${logoMatch ? '✅ NO' : '❌ YES'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

diagnose();
