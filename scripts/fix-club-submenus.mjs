const SUPABASE_URL = 'https://nvyfktdhzhujeltkbgrz.supabase.co'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// Maps keywords in product name → nav item label (must match navigation.ts item.label exactly)
const CLUB_SUBMENU_MAP = [
  { keywords: ['AC Milan', 'ACM', 'AC Culture'],      submenu: 'AC Milan' },
  { keywords: ['Manchester City', 'MCFC'],             submenu: 'Manchester City' },
  { keywords: ['Real Madrid', 'Ream Madrid'],          submenu: 'Real Madrid' },
  { keywords: ['Manchester United', 'MUFC'],           submenu: 'Manchester United' },
  { keywords: ['FC Barcelona', 'FCB'],                 submenu: 'FC Barcelona' },
  { keywords: ['Chelsea', 'CFC'],                      submenu: 'Chelsea FC' },
  { keywords: ['Arsenal'],                             submenu: 'Arsenal' },
  { keywords: ['Juventus', 'JUVE'],                    submenu: 'Juventus' },
  { keywords: ['Liverpool'],                           submenu: 'Liverpool FC' },
  { keywords: ['Bayern'],                              submenu: 'FC Bayern' },
  { keywords: ['PSG'],                                 submenu: 'Paris Saint-Germain' },
]

function getClubSubmenu(name) {
  const upper = name.toUpperCase()
  for (const { keywords, submenu } of CLUB_SUBMENU_MAP) {
    if (keywords.some(k => upper.includes(k.toUpperCase()))) return submenu
  }
  return null
}

// Fetch all Clubs products
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/products?category=eq.Clubs&select=id,name,submenu,submenus`,
  { headers: HEADERS }
)
const products = await res.json()
console.log(`Fetched ${products.length} Clubs products\n`)

let updated = 0, skipped = 0

for (const p of products) {
  const clubSubmenu = getClubSubmenu(p.name)
  if (!clubSubmenu) {
    console.log(`⚠  No club match for: ${p.name}`)
    skipped++
    continue
  }

  // Build new submenus array: keep 'online', add club name
  const existing = Array.isArray(p.submenus) ? p.submenus : []
  const newSubmenus = [...new Set([...existing, clubSubmenu])]

  await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ submenu: clubSubmenu, submenus: newSubmenus }),
  })

  console.log(`✓  ${p.name.padEnd(55)} → ${clubSubmenu}`)
  updated++
}

console.log(`\nDone — ${updated} updated, ${skipped} no match`)
