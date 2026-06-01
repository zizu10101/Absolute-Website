import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CSV_PATH = resolve(__dirname, '../Balls inventory - Balls inventory.csv.csv')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
  process.exit(1)
}

const BASE_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const SUBMENU_MAP = {
  TRAINING: 'training',
  'Match Ball': 'match-ball',
  'MINI BALLS': 'mini-balls',
  OMB: 'omg',
  FUTSAL: 'futsal',
  BASKETBALL: 'basketball',
}

function parseCSV() {
  const text = readFileSync(CSV_PATH, 'utf-8')
  const lines = text.trim().split('\n')
  const productMap = new Map()

  for (const line of lines) {
    const cols = line.split(',')
    if (cols.length < 21) continue

    const brand = cols[1].trim()
    if (!brand) continue // skip summary row

    const subcategory = cols[3].trim()
    const styleCode = cols[5].trim()
    const productName = cols[6].trim()
    const sku = cols[7].trim()
    const colorCode = cols[8].trim()
    const colorName = cols[9].trim()
    const size = cols[10].trim()
    const barcode = cols[12].trim()
    const stockQty = parseInt(cols[13].trim(), 10) || 0
    const retailPrice = parseFloat(cols[20].trim()) || 0

    if (!styleCode || !colorCode) continue

    const key = `${styleCode}__${colorCode}`

    if (!productMap.has(key)) {
      productMap.set(key, {
        name: `${productName} - ${colorName}`,
        brand,
        sku,
        styleCode,
        subcategory,
        colorName,
        price: retailPrice,
        variants: [],
      })
    }

    const product = productMap.get(key)
    if (retailPrice > product.price) product.price = retailPrice

    const isNumericSize = /^\d+$/.test(size)
    const ageGroup = isNumericSize
      ? parseInt(size, 10) === 5
        ? 'Adult'
        : 'Youth'
      : size // Youth / Mid / Full for basketball

    product.variants.push({
      size,
      barcode,
      stock_quantity: Math.max(0, stockQty),
      age_group: ageGroup,
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
  const submenu = SUBMENU_MAP[product.subcategory] ?? product.subcategory.toLowerCase()

  const [inserted] = await supabaseFetch('/products', 'POST', {
    name: product.name,
    price: product.price,
    category: 'Balls',
    submenu,
    submenus: ['online'],
    colors: [product.colorName],
    is_online: true,
    show_sizes: true,
    isNewArrival: false,
    isOnSale: false,
    isFeatured: false,
    images: [],
    description: `${product.brand} ${product.name}`,
  })

  await supabaseFetch(
    '/product_variants',
    'POST',
    product.variants.map((v) => ({ product_id: inserted.id, ...v }))
  )

  return { id: inserted.id, variantCount: product.variants.length }
}

async function main() {
  const productMap = parseCSV()
  console.log(`Parsed ${productMap.size} unique products from CSV\n`)

  let ok = 0
  let fail = 0

  for (const [, product] of productMap) {
    try {
      const { variantCount } = await importProduct(product)
      console.log(`✓  ${product.name.padEnd(55)} ${variantCount} variants`)
      ok++
    } catch (err) {
      console.error(`✗  ${product.name}: ${err.message}`)
      fail++
    }
  }

  console.log(`\nDone — ${ok} products imported, ${fail} errors`)
}

main().catch(console.error)
