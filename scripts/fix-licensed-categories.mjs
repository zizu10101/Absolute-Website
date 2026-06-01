const SUPABASE_URL = 'https://nvyfktdhzhujeltkbgrz.supabase.co'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

const CLUB_KEYWORDS = [
  'AC Milan', 'ACM', 'Manchester City', 'MCFC', 'Real Madrid',
  'Manchester United', 'MUFC', 'FC Barcelona', 'FCB', 'Chelsea', 'CFC',
  'Arsenal', 'Juventus', 'JUVE', 'Liverpool', 'Bayern', 'Benfica',
  'Roma', 'PSG', 'River Plate', 'Celtic',
]

function getCategory(name) {
  const upper = name.toUpperCase()
  for (const kw of CLUB_KEYWORDS) {
    if (upper.includes(kw.toUpperCase())) return 'Clubs'
  }
  return 'National Teams'
}

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/products?category=eq.Licensed&select=id,name`,
  { headers }
)
const products = await res.json()
console.log(`Fetched ${products.length} licensed products\n`)

let clubs = 0, national = 0

for (const p of products) {
  const category = getCategory(p.name)
  await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${p.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ category }),
  })
  console.log(`${category === 'Clubs' ? '🏟 ' : '🌍'} ${p.name} → ${category}`)
  if (category === 'Clubs') clubs++; else national++
}

console.log(`\nDone — ${clubs} Clubs, ${national} National Teams`)
