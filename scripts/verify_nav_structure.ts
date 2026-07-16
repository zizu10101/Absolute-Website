import { DEFAULT_NAV } from '../src/constants/navigation';

console.log('=== Verifying Navigation Structure ===\n');

const footwear = DEFAULT_NAV.find(m => m.label === 'FOOTWEAR');

if (footwear) {
  console.log(`FOOTWEAR submenus: ${footwear.submenus.length}\n`);
  
  footwear.submenus.forEach(sub => {
    console.log(`  ${sub.heading}: ${sub.items?.length || 0} items`);
  });
  
  const hasShopByCategory = footwear.submenus.some(s => s.heading === 'SHOP BY CATEGORY');
  console.log(`\n${hasShopByCategory ? '❌' : '✅'} SHOP BY CATEGORY: ${hasShopByCategory ? 'PRESENT' : 'REMOVED'}`);
  
  const hasShopByBrand = footwear.submenus.some(s => s.heading === 'SHOP BY BRAND');
  const hasShopBySurface = footwear.submenus.some(s => s.heading === 'SHOP BY SURFACE');
  const hasShopByCollection = footwear.submenus.some(s => s.heading === 'SHOP BY COLLECTION');
  
  console.log(`✅ SHOP BY BRAND: ${hasShopByBrand ? 'PRESENT' : 'MISSING'}`);
  console.log(`✅ SHOP BY SURFACE: ${hasShopBySurface ? 'PRESENT' : 'MISSING'}`);
  console.log(`✅ SHOP BY COLLECTION: ${hasShopByCollection ? 'PRESENT' : 'MISSING'}`);
}
