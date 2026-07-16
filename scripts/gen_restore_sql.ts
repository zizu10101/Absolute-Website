import * as fs from 'fs';

const backup = JSON.parse(fs.readFileSync('data/backup-2026-05-02.json', 'utf-8'));
const menus = backup.settings?.navigation?.navigationMenus || [];

const updates: string[] = [];
for (const menu of menus) {
  for (const sub of menu.submenus || []) {
    for (const item of sub.items || []) {
      if (item.logo && item.label) {
        // Use first 80 chars of logo for display, full value in SQL
        const escaped = item.logo.replace(/'/g, "''");
        updates.push(`UPDATE navigation_items SET logo_url = '${escaped}' WHERE UPPER(label) = UPPER('${item.label.replace(/'/g, "''")}') AND (logo_url IS NULL OR logo_url NOT LIKE 'data:%' AND logo_url NOT LIKE 'https://nvyfktdhzhujeltkbgrz%' AND logo_url NOT LIKE 'https://assets.cdn%');`);
      }
    }
  }
}

console.log(updates.join('\n'));
console.log(`\n-- Total: ${updates.length} UPDATE statements`);
