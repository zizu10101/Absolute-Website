const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nvyfktdhzhujeltkbgrz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'
);

// DEFAULT_NAV from src/constants/navigation.ts
const DEFAULT_NAV = [
  {
    label: 'FOOTWEAR',
    path: '/footwear',
    submenus: [
      {
        heading: 'SHOP BY CATEGORY',
        items: [
          { label: "Men's Footwear", path: '/footwear/men', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: "Women's Footwear", path: '/footwear/women', logo: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: "Kids' Footwear", path: '/footwear/kids', logo: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'New Arrivals', path: '/footwear/new-arrivals', logo: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=200&h=200' },
        ]
      },
      {
        heading: 'SHOP BY BRAND',
        items: [
          { label: 'Nike', path: '/footwear/nike', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/1200px-Logo_NIKE.svg.png' },
          { label: 'adidas', path: '/footwear/adidas', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Adidas_Logo.svg/1200px-Adidas_Logo.svg.png' },
          { label: 'PUMA', path: '/footwear/puma', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Puma_Logo.svg/1200px-Puma_Logo.svg.png' },
          { label: 'Joma', path: '/footwear/joma', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Joma_logo.svg/1200px-Joma_logo.svg.png' },
          { label: 'New Balance', path: '/footwear/new-balance', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/New_Balance_logo.svg/1200px-New_Balance_logo.svg.png' },
          { label: 'All Brands', path: '/footwear/all' },
        ]
      },
      {
        heading: 'SHOP BY SURFACE',
        items: [
          { label: 'Firm Ground', path: '/footwear/firm-ground', logo: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'Artificial Grass', path: '/footwear/artificial-grass', logo: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'Turf', path: '/footwear/turf', logo: 'https://images.unsplash.com/photo-1431324155629-1a6eda1eed2e?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'Indoor / Futsal', path: '/footwear/indoor-futsal', logo: 'https://images.unsplash.com/photo-1518605336396-6a727c5c044f?auto=format&fit=crop&q=80&w=200&h=200' },
        ]
      },
      {
        heading: 'SHOP BY COLLECTION',
        items: [
          { label: 'Nike Mercurial', path: '/footwear/nike/mercurial', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'Nike Phantom', path: '/footwear/nike/phantom', logo: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'Nike Tiempo', path: '/footwear/nike/tiempo', logo: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'adidas F50', path: '/footwear/adidas/f50', logo: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'adidas Predator', path: '/footwear/adidas/predator', logo: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'adidas Copa', path: '/footwear/adidas/copa', logo: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'PUMA Future', path: '/footwear/puma/future', logo: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=200&h=200' },
          { label: 'PUMA Ultra', path: '/footwear/puma/ultra', logo: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&q=80&w=200&h=200' },
        ]
      },
      {
        heading: 'QUICK LINKS',
        items: [
          { label: 'New Arrivals', path: '/footwear/new-arrivals' },
          { label: 'Sale', path: '/footwear/sale' },
          { label: 'Youth Footwear', path: '/footwear/youth' },
          { label: 'All Footwear', path: '/footwear/all' },
        ]
      }
    ]
  },
  {
    label: 'CLUBS',
    path: '/clubs',
    submenus: [
      {
        heading: 'LIGA',
        items: [
          { label: 'Atlético Madrid', path: '/clubs/liga/atletico-madrid', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atletico_Madrid_2017_logo.svg/1200px-Atletico_Madrid_2017_logo.svg.png' },
          { label: 'FC Barcelona', path: '/clubs/liga/fc-barcelona', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28logo%29.svg/1200px-FC_Barcelona_%28logo%29.svg.png' },
          { label: 'Real Madrid', path: '/clubs/liga/real-madrid', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/1200px-Real_Madrid_CF.svg.png' },
          { label: 'Official Printing', path: '/clubs/liga/official-printing' },
        ]
      },
      {
        heading: 'LIGUE 1',
        items: [
          { label: 'Paris Saint-Germain', path: '/clubs/ligue-1/psg', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/1200px-Paris_Saint-Germain_F.C..svg.png' },
        ]
      },
      {
        heading: 'PREMIER LEAGUE',
        items: [
          { label: 'Arsenal', path: '/clubs/premier-league/arsenal', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/1200px-Arsenal_FC.svg.png' },
          { label: 'Chelsea FC', path: '/clubs/premier-league/chelsea', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/1200px-Chelsea_FC.svg.png' },
          { label: 'Liverpool FC', path: '/clubs/premier-league/liverpool', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png' },
          { label: 'Manchester City', path: '/clubs/premier-league/manchester-city', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png' },
          { label: 'Manchester United', path: '/clubs/premier-league/manchester-united', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/1200px-Manchester_United_FC_crest.svg.png' },
          { label: 'Tottenham Hotspur', path: '/clubs/premier-league/tottenham', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/1200px-Tottenham_Hotspur.svg.png' },
          { label: 'Official Printing', path: '/clubs/premier-league/official-printing' },
        ]
      },
      {
        heading: 'SERIE A',
        items: [
          { label: 'AC Milan', path: '/clubs/serie-a/ac-milan', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/1200px-Logo_of_AC_Milan.svg.png' },
          { label: 'Juventus', path: '/clubs/serie-a/juventus', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Juventus_FC_2017_logo.svg/1200px-Juventus_FC_2017_logo.svg.png' },
          { label: 'Inter Milan', path: '/clubs/serie-a/inter-milan', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Inter_Milan_2021_logo.svg/1200px-Inter_Milan_2021_logo.svg.png' },
        ]
      },
      {
        heading: 'BUNDESLIGA',
        items: [
          { label: 'FC Bayern', path: '/clubs/bundesliga/fc-bayern', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/1200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png' },
        ]
      },
      {
        heading: 'MLS',
        items: [
          { label: 'Inter Miami', path: '/clubs/mls/inter-miami', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/5c/Inter_Miami_CF_logo.svg/1200px-Inter_Miami_CF_logo.svg.png' },
        ]
      }
    ]
  },
  { label: 'NATIONAL TEAMS', path: '/national-teams', submenus: [] },
  { label: 'TRAINING APPAREL', path: '/apparel', submenus: [] },
  { label: 'EQUIPMENT', path: '/equipment', submenus: [] },
  { label: 'CUSTOM LAB', path: '/custom-lab', submenus: [] },
  { label: 'UNIFORM SUBMISSION', path: '/uniform-submission', submenus: [] },
  { label: 'SALE', path: '/sale', submenus: [] },
];

async function resetNavigation() {
  try {
    console.log('🔄 Resetting navigation from DEFAULT_NAV...\n');

    // Step 1: Delete existing data
    console.log('🗑️  Clearing navigation_items...');
    const { error: itemsError } = await supabase
      .from('navigation_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (itemsError) console.warn('   (table may be empty)');
    else console.log('   ✅ Cleared');

    console.log('🗑️  Clearing navigation_menus...');
    const { error: menusError } = await supabase
      .from('navigation_menus')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (menusError) console.warn('   (table may be empty)');
    else console.log('   ✅ Cleared\n');

    // Step 2: Insert main menus
    console.log('📝 Inserting navigation_menus...');
    const menuInserts = DEFAULT_NAV.map((menu, idx) => ({
      label: menu.label,
      path: menu.path,
      order_index: idx,
      is_active: true
    }));

    const { data: insertedMenus, error: insertMenusError } = await supabase
      .from('navigation_menus')
      .insert(menuInserts)
      .select();

    if (insertMenusError) {
      console.error('   ❌ Error:', insertMenusError);
      return;
    }

    console.log(`   ✅ Inserted ${insertedMenus.length} menus\n`);

    // Step 3: Build menu ID map
    const menuMap = {};
    insertedMenus.forEach(m => {
      const menuDef = DEFAULT_NAV.find(d => d.label === m.label);
      menuMap[m.label] = m.id;
    });

    // Step 4: Insert submenus and items
    console.log('📝 Inserting navigation_items...');
    let itemCount = 0;
    const itemInserts = [];

    DEFAULT_NAV.forEach(menu => {
      const menuId = menuMap[menu.label];

      menu.submenus.forEach((submenu, subIdx) => {
        // Insert submenu as parent item
        itemInserts.push({
          menu_id: menuId,
          label: submenu.heading,
          path: submenu.path || '',
          logo_url: submenu.logo || null,
          order_index: subIdx,
          parent_id: null
        });

        // Insert submenu items as children
        submenu.items.forEach((item, itemIdx) => {
          itemInserts.push({
            menu_id: menuId,
            label: item.label,
            path: item.path || '',
            logo_url: item.logo || null,
            order_index: itemIdx,
            parent_id: null
          });
          itemCount++;
        });
      });
    });

    // Insert in batches
    const batchSize = 50;
    let insertedTotal = 0;

    for (let i = 0; i < itemInserts.length; i += batchSize) {
      const batch = itemInserts.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('navigation_items')
        .insert(batch)
        .select();

      if (error) {
        console.error(`   ❌ Batch error: ${error.message}`);
        return;
      }

      insertedTotal += data.length;
      console.log(`   ✅ Inserted batch: ${data.length} items (total: ${insertedTotal})`);
    }

    console.log(`\n✨ Navigation reset complete!`);
    console.log(`   - Menus: ${insertedMenus.length}`);
    console.log(`   - Items: ${insertedTotal}`);

    // Verify
    console.log('\n🔍 Verifying...');
    const { data: verifyMenus } = await supabase
      .from('navigation_menus')
      .select('id, label');

    const { data: verifyItems } = await supabase
      .from('navigation_items')
      .select('id, label, logo_url')
      .not('logo_url', 'is', null);

    console.log(`   ✅ Menus in DB: ${verifyMenus.length}`);
    console.log(`   ✅ Items with logos: ${verifyItems.length}\n`);

    console.log('🚀 Navigation ready to use!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

resetNavigation();
