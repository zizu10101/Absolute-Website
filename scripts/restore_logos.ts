import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

(async () => {
  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync('data/backup-2026-05-02.json', 'utf-8'));
    
    // Look for navigation in settings
    let navigationMenus = null;
    
    if (backupData.settings?.navigation?.navigationMenus) {
      navigationMenus = backupData.settings.navigation.navigationMenus;
    } else if (backupData.navigation?.navigationMenus) {
      navigationMenus = backupData.navigation.navigationMenus;
    }

    if (!navigationMenus) {
      console.error('No navigation data found');
      console.log('Backup keys:', Object.keys(backupData));
      if (backupData.settings) {
        console.log('Settings keys:', Object.keys(backupData.settings).slice(0, 10));
      }
      process.exit(1);
    }

    let updatedCount = 0;
    const itemsToUpdate: Array<{label: string; logo: string}> = [];

    // Extract all items with logos
    for (const menu of navigationMenus) {
      for (const submenu of menu.submenus || []) {
        for (const item of submenu.items || []) {
          if (item.logo && item.label) {
            itemsToUpdate.push({
              label: item.label,
              logo: item.logo
            });
          }
        }
      }
    }

    console.log(`Found ${itemsToUpdate.length} items with logos to restore\n`);

    // Update each item
    for (const item of itemsToUpdate) {
      const { error } = await supabase
        .from('navigation_items')
        .update({ logo_url: item.logo })
        .ilike('label', item.label);

      if (error) {
        console.error(`❌ ${item.label}: ${error.message}`);
      } else {
        console.log(`✅ ${item.label}`);
        updatedCount++;
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total items restored: ${updatedCount}/${itemsToUpdate.length}`);

    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
