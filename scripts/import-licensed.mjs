import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_PATH = resolve(__dirname, '../filtered_inventory_25_26.csv')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nvyfktdhzhujeltkbgrz.supabase.co'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52eWZrdGRoemh1amVsdGtiZ3J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU1OTcyMCwiZXhwIjoyMDkzMTM1NzIwfQ.WL1dpnr5_tFiH9xjjMC3ztCR1xyMjJ3LxK3TmPkFLRY'

const BASE_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const SUBMENU_MAP = {
  Jerseys: 'jerseys',
  KITS: 'kits',
  Beanies: 'beanies',
  hat: 'hats',
  Hoody: 'hoodies',
  Jacket: 'jackets',
  Pants: 'pants',
  Shorts: 'shorts',
  Socks: 'socks',
  Scarf: 'scarves',
  'T-Shirt': 't-shirts',
  Top: 'tops',
  Bag: 'bags',
  Balls: 'balls',
}

function getAgeGroup(size) {
  const s = size.trim().toUpperCase()
  if (['YXS', 'Y2XS', 'YS', 'YM', 'YL', 'YXL'].includes(s)) return 'Youth'
  if (['XS', '2XS', 'XXS', 'XXXS', 'XSS', 'S', 'SM', 'M', 'L', 'LX', 'XL', 'XXL', 'XXXL'].includes(s))
    return 'Adult'
  if (s === 'OS') return 'One Size'
  // Baby / toddler: 12M, 18M, 2T, 3T … or numeric ranges 0-3, 3-6 …
  return 'Child'
}

function parseCSV() {
  const lines = readFileSync(CSV_PATH, 'utf-8').trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim())

  const idx = (name) => headers.indexOf(name)
  const iVendor = idx('VendorID')
  const iSSG = idx('SSG')
  const iPid = idx('Productid')
  const iDesc = idx('Description')
  const iPCode = idx('PCode')
  const iColor = idx('Color')
  const iColorDesc = idx('ColorDesc')
  const iSize = idx('Size')
  const iUpc = idx('upc')
  const iOnHand = idx('onhand')
  const iMSRP = idx('MSRP')
  const iBrand = idx('Brand')

  const productMap = new Map()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 20) continue

    const vendor = cols[iVendor]?.trim()
    if (!vendor) continue

    const ssg = cols[iSSG]?.trim()
    const styleCode = cols[iPid]?.trim()
    const description = cols[iDesc]?.trim()
    const pcode = cols[iPCode]?.trim()
    const colorCode = cols[iColor]?.trim()
    const colorDesc = cols[iColorDesc]?.trim()
    const size = cols[iSize]?.trim()
    const upc = cols[iUpc]?.trim()
    const onHand = parseInt(cols[iOnHand]?.trim(), 10) || 0
    const msrp = parseFloat(cols[iMSRP]?.trim()) || 0
    const brand = cols[iBrand]?.trim() || vendor

    if (!styleCode || !colorCode || !size) continue

    const key = `${styleCode}__${colorCode}`

    if (!productMap.has(key)) {
      productMap.set(key, {
        name: `${description} - ${colorDesc}`,
        brand,
        vendor,
        ssg,
        styleCode,
        pcode,
        description,
        colorDesc,
        price: msrp,
        variants: [],
      })
    }

    const product = productMap.get(key)
    if (msrp > product.price) product.price = msrp

    product.variants.push({
      size,
      barcode: upc,
      stock_quantity: Math.max(0, onHand),
      age_group: getAgeGroup(size),
    })
  }

  return productMap
}

async function supabaseFetch(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: BASE_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function importProduct(product) {
  const submenu = SUBMENU_MAP[product.ssg] ?? product.ssg?.toLowerCase() ?? 'licensed'

  const [inserted] = await supabaseFetch('/products', 'POST', {
    name: product.name,
    price: product.price,
    category: 'Licensed',
    submenu,
    submenus: ['online'],
    colors: [product.colorDesc],
    is_online: true,
    show_sizes: true,
    isNewArrival: false,
    isOnSale: false,
    isFeatured: false,
    images: [],
    description: `${product.brand} ${product.name} | ${product.pcode}`,
  })

  await supabaseFetch(
    '/product_variants',
    'POST',
    product.variants.map((v) => ({ product_id: inserted.id, ...v }))
  )

  return inserted.id
}

async function main() {
  const productMap = parseCSV()
  console.log(`Parsed ${productMap.size} unique products\n`)

  let ok = 0
  let fail = 0

  for (const [, product] of productMap) {
    try {
      await importProduct(product)
      console.log(`✓  ${product.name.padEnd(60)} ${product.variants.length} variants`)
      ok++
    } catch (err) {
      console.error(`✗  ${product.name}: ${err.message}`)
      fail++
    }
  }

  console.log(`\nDone — ${ok} products imported, ${fail} errors`)
}

main().catch(console.error)
