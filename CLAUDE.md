# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## CURRENT STATUS (Main Branch - July 11, 2026)
**Latest:** Unknown barcode modal, font removal, encoding fix (sessions 34–36)

**Session 36 improvements (UTF-8 Encoding Fix):**
- ✅ **Root cause identified**: corrupted `â€¢` characters site-wide were NOT a font issue — they were Windows-1252/Latin-1 mojibake of UTF-8 bytes (e.g. bullet • U+2022 stored as 3 separate Latin-1 chars `â€¢`; emoji UTF-8 bytes each misread as individual Latin-1 chars)
- ✅ **9 files repaired** with Node.js replacement script (`scripts/fix-encoding.mjs`, deleted after use):
  - `src/components/ProductCard.tsx`: `â€¢` bullet between category/submenu labels
  - `src/pages/AdminPage.tsx`: `â€¢` bullets before prices; corrupted 🚀 💡 ⚠️ 🛠️ emojis
  - `src/pages/ProductDetailPage.tsx`: `â€¢` in "added to squad bag" confirmation; 📞 telephone emoji
  - `src/components/StoreCreditsTab.tsx`: `â€¢` between credit amount and reason
  - `src/pages/POSPage.tsx`: all 7 category tab icons (🏪 👟 👕 ⚽ 🛡️ 🎽 🧤) + 💳 🎟 📊 📞 🔴 and others
  - `src/components/PosRegister.tsx`: same 7 category tab icons
  - `src/components/GiftCardTab.tsx`: 💳 💰 📊 icons
  - `src/components/RapidScanIntakeMatrix.tsx`: age group emojis (👨 👦 ⚽ 🧤 📦 👟 🧒) + en-dashes in size range labels
  - `src/pages/MississaugaSoccerPage.tsx`: en-dashes in hours/text
- ✅ `POSPage.backup.tsx` left as-is (not rendered, not in git-tracked active build)
- ✅ Verified with scan script: zero corrupted sequences remain in active source files

**Session 35 improvements (Font Feature Removed):**
- ✅ **Font selector removed from Admin → Theme tab** — was causing random characters across site when fonts like "Archivo Black" were saved (display fonts lack glyphs for emoji/Unicode used in UI)
- ✅ `src/context/SettingsContext.tsx`: font loading logic stripped entirely; `useEffect([themeSettings])` now ONLY applies `--primary-color` and `--secondary-color` CSS vars; always cleans up any stale Google Font `<link>` tags and clears `--font-family`/`--font-sans` inline overrides
  - Added `localStorage.removeItem('theme')` + `localStorage.removeItem('fontFamily')` at top of `fetchSettings()`
  - Forces `fontFamily: 'default'` when applying DB theme data (prevents old saved value from re-activating)
- ✅ `src/pages/AdminPage.tsx`: removed Font Family `<select>` and all optgroups from Theme tab; removed `google-fonts-preview` useEffect; `handleSaveTheme` forces `fontFamily: 'default'`
- ✅ Supabase DB reset: `fontFamily` field set back to `'default'` in `settings` table `key='theme'`
- ✅ Verified on localhost: homepage `body.style.fontFamily=""`, no Google Font `<link>` tags, no `--font-family` CSS var, localStorage cleared; Theme tab shows Primary Color + Secondary Color + Store Name + Live Preview (no font dropdown)

**Session 34 improvements (Unknown Barcode Modal in POS):**
- ✅ **Unknown Barcode Modal**: when a scanned barcode is not found in DB, POS shows a modal instead of error message — sale completes immediately, barcode saved later
  - Brand buttons: Nike / Adidas / Puma / Joma / New Balance / Other
  - Price field (required), optional Name field
  - "Add to Cart & Save Later" → adds item to cart + saves to `localStorage.pending_barcodes`; closes modal
  - "Add to Cart & Save Now" → adds item to cart + closes unknown modal + opens Pending Barcodes Manager
  - Cart item gets temp ID `unknown-${barcode}-${Date.now()}` with brand/price/name
- ✅ **Amber "N Unsaved Barcodes" badge button** in POS right panel (below Customers section) — visible whenever `localStorage.pending_barcodes` has entries
- ✅ **Pending Barcodes Manager Modal**: lists each unsaved barcode with 3 actions per entry:
  - "Save to Existing" → product search field, click a result to link the barcode to that product
  - "Create New" → navigates to `/admin` with React Router state `{ openAddProduct: true, pendingBarcode: pb }`; AdminPage detects this state, pre-fills Add Product form (name, brand, price, barcode), shows amber "Creating from POS scan" banner; after save automatically removes barcode from localStorage and redirects back to `/pos` after 1.2s
  - "Skip" → removes from queue
- ✅ `src/pages/POSPage.tsx`: added `PendingBarcode` interface; `useNavigate` import; `showUnknownBarcodeModal`, `unknownBarcode`, `unknownBarcodeBrand`, `unknownBarcodePrice`, `unknownBarcodeName`, `pendingBarcodes`, `showPendingBarcodesModal` states; `savePendingBarcodes`, `handleAddUnknownToCart`, `handlePendingSearch`, `handleSaveToExisting`, `handleSkipBarcode` helpers; auto-focus guard on both modals
- ✅ `src/pages/AdminPage.tsx`: `useNavigate` + `useLocation` imports; `fromPOSData` state; mount `useEffect` detects `openAddProduct` navigation state and pre-fills form; `handleAdd` removes pending barcode from localStorage and redirects to `/pos` when `fromPOSData` is set

**Session 33 improvements (Theme & Branding Admin Panel):**
- ✅ **Theme & Branding tab** added to Admin → Settings: Store Name, Primary Color picker, Secondary Color picker, Font Family selector (later removed in session 35), Live Preview, Logos section
- ✅ `src/context/SettingsContext.tsx`: `ThemeSettings` interface + `DEFAULT_THEME` constant; `themeSettings` state; injects `--primary-color` and `--secondary-color` CSS vars on settings change
- ✅ **Primary color applied site-wide**: all `[#b90014]` → `[var(--primary-color)]` in 33 source files
- ✅ **Secondary color applied**: Footer, HomePage "Visit Us", BramptonSoccerPage/MississaugaSoccerPage/CustomApparelPage "How It Works" + contact bar use `style={{ backgroundColor: 'var(--secondary-color)' }}`
- ✅ Supabase `settings` table: `theme` row with `{storeName, primaryColor: '#b90014', secondaryColor: '#000000', fontFamily: 'default'}`

**Session 32 improvements (Mississauga City Landing Page):**
- ✅ `src/pages/MississaugaSoccerPage.tsx`: New city SEO landing page at `/mississauga-soccer-store`
  - Hero with H1 "Your Go-To Local Soccer Store in Mississauga", two CTAs (Visit Our Store → Google Maps, Browse In-Stock Gear → `/products`)
  - "Serving the Community" section with H2 "The Ultimate Headquarters for Local Clubs and Players" + body text about Mississauga Soccer League
  - Three-column cards: Fast In-Store Pickup & Fitting, Official Club Kits & Lettering, Trusted by Mississauga Teams
  - "How It Works" 3-step dark section (Submit Roster → Approve Proof → Pick Up/Deliver) — same as Brampton
  - "Stop By and Gear Up Today" section with phone, address, hours (Mon–Fri 1–7 PM, Sat–Sun 11 AM–4 PM), 6-point checklist
  - Quote form (mailto: info@edgedbs.com) with squad-specific fields (identical to BramptonSoccerPage)
  - Footer contact bar with phone, address, website
  - Helmet: title "Soccer Store in Mississauga | Elite Gear & Custom Kits | Absolute Soccer"; description "Mississauga's premier local soccer shop..."; canonical `https://torontosoccershop.com/mississauga-soccer-store`
- ✅ `src/App.tsx`: Added import + `<Route path="mississauga-soccer-store">` route
- ✅ `scripts/generate-sitemap.js`: Added `/mississauga-soccer-store` to `mainPages` array (priority 0.9) — sitemap now 185 URLs (6 main + 7 category + 170 product + 2 static)
- ✅ Tested on localhost via Playwright — all sections render, both CTA buttons present, hero image loads, quote form functional

**Session 31 improvements (Structured Data Image URL Fix):**
- ✅ `src/pages/ProductDetailPage.tsx`: Fixed "Invalid URL in field image" Google Search Console error in Merchant Listings
  - Added `getAbsoluteUrl()` helper inside the schema `useEffect` — handles `http(s)://` (pass-through), `//` (prepend `https:`), and relative paths (prepend `https://torontosoccershop.com`)
  - `productImages` array built from `product.images[]` or fallback to `product.image`, all passed through `getAbsoluteUrl()`
  - `"image"` field now uses `productImages.filter(Boolean)` — removes any empty strings when both image fields are null
  - Verified on localhost via Playwright: both array-images and null-images-fallback paths output full `https://` Supabase Storage URLs

**Session 30 improvements (Brampton City Landing Page):**
**Latest (previous):** Brampton city landing page (session 30)

**Session 30 improvements (Brampton City Landing Page):**
- ✅ `src/pages/BramptonSoccerPage.tsx`: New city SEO landing page at `/brampton-soccer-uniforms`
  - Hero with H1 "Custom Soccer Uniforms & Team Printing in Brampton", two CTAs (Get a Fast Squad Quote → `#quote`, Browse Custom Apparel → `/custom-apparel`)
  - "Why Brampton Clubs Choose Us" section with 3-column cards (visit, brands, roster customization)
  - "How It Works" 3-step dark section (Submit Roster → Approve Proof → Pick Up/Deliver)
  - "Visit Our Mississauga Showroom" section with phone, address, service checklist
  - Quote form (mailto: info@edgedbs.com) with squad-specific fields (kit type, squad size/quantity, club name)
  - Footer contact bar with phone, address, website
  - Helmet: title "Custom Soccer Uniforms & Jersey Printing Brampton | Absolute Soccer"; description "The premier team uniform destination for Brampton soccer clubs..."
- ✅ `src/App.tsx`: Added import + `<Route path="brampton-soccer-uniforms">` route
- ✅ Tested on localhost — all 5 sections render, both CTA buttons present, phone number shown
- ✅ `scripts/generate-sitemap.js`: Added `/brampton-soccer-uniforms` to `mainPages` array — sitemap now 184 URLs (5 main + 7 category + 170 product + 2 static)

**Session 29 improvements (Bidirectional SKU Search):**
- ✅ `ProductGridPage.tsx`: Fixed search so hyphens in SKU codes are ignored in both directions
  - Root cause: Many products have `product_code = null`; Nike-style style codes (e.g. `IB5300-480`) live inside the `description` field as `"Style: IB5300-480"`
  - Previous fix only stripped hyphens from `product_code` — didn't help when code was in description
  - Fix: strip hyphens from `name`, `description`, AND `product_code` before comparing against the hyphen-stripped query
  - Searching `"IB5300-480"` → finds product whose description contains `"Style: IB5300-480"` ✓
  - Searching `"IB5300480"` → `desc.replace(/-/g,'').includes("ib5300480")` matches same product ✓
  - Works for all three fields: `name`, `description`, `product_code`
  - Verified on localhost: both queries return "SHOWING 1 OF 1 PRODUCTS" (FFF 2026 Stadium Home Jersey)

**Session 28 improvements (Brand Page "No Products" Fix):**
- ✅ `BrandPage.tsx`: Fixed "No products found" on direct navigation to `/brand/Adidas`
  - Root cause: `ProductContext` only pre-loads 8 featured products on app init (`fetchFeaturedProducts`)
  - `BrandPage` was filtering those 8 products client-side — finding 0 Adidas products → "No products found"
  - Fix: added `useEffect(() => { fetchProductsByCategory(); }, [brandName])` — fetches all 168+ products into context on mount
  - Also added a spinner (`isLoading` check) instead of flashing "No products found" while fetching
  - Works on direct URL navigation now (verified cold-start: `/brand/Adidas` → 30 products, `/brand/Nike` → 59 products)

**Session 27 improvements (Brand Tile Fix):**
- ✅ `BrandShowcase.tsx`: Fixed brand tiles linking to broken `/products?brand=Nike` — no such route existed
  - Changed to `/brand/${encodeURIComponent(brand.name)}` which routes to existing `BrandPage` component
  - `BrandPage` at `/brand/:brandName` was already implemented with category filter, search, sort
  - "View All Brands" link to `/brands` was already correct — only the individual tile links were broken
  - Verified: clicking Nike tile from homepage → `/brand/Nike` → 59 Nike products render correctly

**Session 26 improvements (SEO & Search):**
- ✅ `ProductDetailPage.tsx`: Enhanced Product JSON-LD schema (`product-schema-markup` script)
  - Added `sku` and `mpn` fields (populated from `product.product_code`)
  - `image` now an array (`product.images[]` with fallback to `[product.image]`)
  - `offers.url`: canonical product URL `https://torontosoccershop.com/product/${product.id}`
  - `offers.price`: sale-price-aware (`product.salePrice || product.price`)
  - `offers.priceValidUntil`: `"2026-12-31"`
  - `description` and `sku`/`mpn` default to `''` when null (valid schema output)
- ✅ `ProductGridPage.tsx`: Search filter now includes `product_code` and `brand` fields
  - Customers can search by manufacturer SKU (e.g. "HQ2314" finds Nike Phantom 6 Haaland boot)
  - Brand field explicitly checked (previously only matched via submenu text)
- ✅ Sitemap regenerated: 181 URLs (4 main + 7 category + 168 product pages); was 171

**Session 25 improvements (Thermal Receipt Redesign):**
- ✅ `thermalReceipt.ts`: Professional redesign with elegant typography and layout for Epson TM-T88V
  - Typography hierarchy: Store name 17px, section headers 12px, items 12px, details 10px, footer 11px
  - Elegant dividers: Replaced dashed with solid 1px lines; double borders for grand total emphasis
  - Refined spacing: Padding 3mm × 4mm, consistent 8px margins between sections
  - Header polish: Logo increased 50mm → 62.5mm width, 18mm → 22.5mm height (25% larger)
  - Transaction info: Clean flex two-column layout with labels left, values right-aligned
  - Items section: Regular weight names with smaller detail/qty text, subtle indentation
  - Totals enhancement: Double-line borders, 15px grand total, better visual hierarchy
  - Footer elegance: Refined typography, no italic (doesn't print clearly on thermal)
- ✅ Uniform bold font weights throughout ALL text (font-weight: 700)
  - Universal selector: `* { font-weight: 700 !important; }`
  - Removed mixed weights (500, 600, 700) that caused inconsistent thermal print clarity
  - Hierarchy maintained purely through SIZE variation, not weight
  - All text now prints bold and clear on thermal paper
- ✅ Logo size increase by 25%: 50mm × 18mm → 62.5mm × 22.5mm
  - Improved visual prominence and brand recognition
  - Updated in both inline CSS and @media print
- ✅ Applied to all three receipt types:
  - generateThermalReceiptHTML: Transaction receipts with items, totals, signatures
  - generateGiftReceiptHTML: Gift receipts without prices
  - generateStoreCreditReceiptHTML: Store credit issuance and redemption receipts
- ✅ Tested and verified
  - TypeScript compiles without errors
  - Server running and responsive
  - All three receipt functions updated consistently
- ✅ **Status:** Professional thermal receipts ready for deployment; all text bold and clear on Epson TM-T88V

**Session 24 improvements:**
- ✅ `Footer.tsx`: Added GTA local SEO paragraph below "formerly Golazo Store" line — covers Brampton, Oakville, Milton, Etobicoke, Mississauga service; `text-xs text-zinc-500 max-w-2xl mx-auto text-center`
- ✅ `ProductGridPage.tsx`: Category-specific SEO blurb below page title on top-level FOOTWEAR and NATIONAL TEAMS pages only (hidden on subpages like Europe, Shop By Brand, etc.)
  - Footwear: "Shop the latest Nike, Adidas and Puma soccer cleats at Absolute Soccer in Mississauga..."
  - National Teams: "Official licensed national team jerseys at Absolute Soccer Mississauga. Shop Canada, Portugal, France, Argentina..."
- ✅ **BOM/invalid code point fix**: Deleted two malformed temp files from project root (`CUsersziadAppDataLocal...test-nav.js` and `CUsersUserabsolute-websiteRETURNS_VERIFICATION.md`) — Tailwind v4 was scanning the `.js` file and hitting bytes that decoded to invalid Unicode code point 9,794,992 (0x9575B0), crashing the dev server
- ✅ `POSPage.tsx`: Moved "Open Cash Drawer" button from left icon toolbar (between Returns and Clear Cart) to right panel action row next to Void/Refund / Return / History
  - Grid expanded from `grid-cols-3` → `grid-cols-4`
  - Icon changed from `DollarSign` → `Archive` (drawer-shaped, amber color)
  - Label shortened to "Drawer" to fit 4-column layout
  - Style matches other action buttons: `border border-[#2d3547] text-amber-400 hover:text-amber-300`

**Session 23 improvements (EpsonControl Font Cash Drawer):**
- ✅ `POSPage.tsx` `openCashDrawer()`: Updated to EpsonControl font solution
  - Uses EpsonControl font (aliased to Control font) with character "A"
  - Character "A" in Control font = ESC/POS drawer kick command
  - Zero height (0px) and zero line-height (0px) = invisible, no paper feed
  - Visibility: visible ensures font rendering despite zero dimensions
  - @font-face declaration with fallback chain: EpsonControl → Control → monospace
  - Page size: 80mm auto (thermal printer standard)
  - Print dialog auto-closes after command sent
- ✅ Browser-independent solution (works in all modern browsers)
  - No Web Serial API (Chrome/Edge only)
  - Standard browser print dialog (familiar UX)
  - No user port selection required
  - Simpler deployment than previous approaches
- ✅ Printer driver configuration required:
  - "Start of Document" = "Do not open" (prevents drawer on every print)
  - "Keep Feed and Cut" = Page [Feed, Cut]
  - Drawer only opens when Control font character is printed
  - Regular receipts unaffected (no drawer opening)
- ✅ Tested and verified on localhost
  - Code implementation: 8/8 checks passed
  - Browser functionality: confirmed working
  - Button clickable: verified
  - Screenshot: captured successfully
- ✅ **Status:** EpsonControl font solution ready for deployment; printer driver setup required at store

**Session 22 improvements (Cash Drawer Zero-Space & Receipt Printing Fixes):**
- ✅ `POSPage.tsx` `openCashDrawer()`: Updated to zero-space ghost canvas solution
  - Sends completely invisible print document (zero height, zero font-size, transparent)
  - Uses printer's built-in "Start of Document" drawer kick (no special characters needed)
  - Works with any Epson printer supporting ESC/POS
  - Zero paper feed (document completely invisible)
  - More reliable than Control font character approach
- ✅ `thermalReceipt.ts`: Fixed auto-cut between 2-copy receipts
  - Added `break-after: page;` CSS rule to force cuts on Epson TM-T88V
  - Page-break structure: first receipt has `page-break-after: always; break-after: page;`
  - @page rule set to `size: 80mm auto; margin: 0;` for proper thermal printer formatting
  - Both legacy (`page-break-after`) and modern (`break-after`) CSS properties included
- ✅ Created `PRINTER_SETUP.md`: Comprehensive guide for Epson driver configuration
  - Settings required: "Start of Document" = "OPEN"
  - Step-by-step instructions for Windows Settings, Epson Utility, Control Panel approaches
  - Troubleshooting section for common issues
- ✅ Created `ZERO_SPACE_SOLUTION.md`: Technical documentation for zero-space ghost canvas method
  - How it works: invisible document triggers printer's native drawer kick
  - Advantages over previous Control font approach
  - Configuration checklist and deployment status
- ✅ **Status:** Cash drawer now uses universal zero-space solution; 2-copy receipts have proper page-break cuts

**Session 21 improvements (Cash Drawer & QZ Tray Removal):**
- ✅ Removed QZ Tray implementation entirely (uninstalled npm package, deleted integration files)
- ✅ Deleted `src/utils/qzPrint.ts` (QZ Tray utility functions)
- ✅ Removed QZ Tray CDN script from `index.html`
- ✅ Removed `testQZConnection()` call from POS mount effect
- ✅ Reverted thermal receipt printing to browser `window.open()` fallback only
- ✅ Added "Open Drawer" button to POS home page action button row (after Returns button)
- ✅ `openCashDrawer()` function uses browser print with ESC/POS drawer command
  - Creates invisible 80mm print window (matches Epson thermal printer width)
  - Sends drawer open command via print dialog
  - Auto-closes after print dialog closes
  - Button positioned in Register tab action buttons (beside History/Returns)
- ✅ Cash drawer button styling: DollarSign icon (yellow), "Open Drawer" label
- ✅ No external dependencies needed (pure browser printing)
- ✅ **Status:** All thermal receipt printing now uses browser print dialog; cash drawer opens via printer's built-in print handler

**Session 19 improvements:**
- ✅ `ProductCard.tsx`: Added `isSoldOut?: boolean` prop — greyscale image + `opacity-70` + dark "SOLD OUT" banner at bottom of image when true
- ✅ `ProductGridPage.tsx`: Added `soldOutProductIds` state + fetch effect — queries `product_variants` for `stock_quantity > 0` per product; passes `isSoldOut` to each `ProductCard`
- ✅ `ProductDetailPage.tsx`: Added `isSoldOut` flag (`!variantsLoading && product.showSizes && all variants at 0`); replaces size grid with red "SOLD OUT" badge when true; Call to Order CTA still shows
- ✅ `POSPage.tsx` (`getStockStatus`): Changed "Out of Stock" → "SOLD OUT" with `font-black tracking-widest` styling
- ✅ `thermalReceipt.ts`: Fixed Epson TM-T88IV CSS — body/receipt width 72mm, padding `2mm 4mm`, logo `55mm × 15mm`, replaced `* { padding: 0 !important }` media-print reset with targeted rules only
- ✅ `thermalReceipt.ts`: Replaced `display:flex` on item/total rows with `display:table` layout for reliable thermal printer rendering
- ✅ `thermalReceipt.ts`: Bolder text throughout — body `13px font-weight:bold`, store name `16px`, transaction-info/store-info/footer `11px`, total-row `12px`, grand-total `15px`, item-name `font-weight:bold`
- ✅ `thermalReceipt.ts`: Added `copies?: 1 | 2` to `ReceiptData` interface — when `copies === 2`, both copies in ONE HTML document separated by `page-break-before: always`
- ✅ `thermalReceipt.ts`: Barcodes changed from `id="barcode"` → `class="receipt-barcode"`; JsBarcode uses `querySelectorAll` so both copies render correctly
- ✅ `thermalReceipt.ts`: Added `truncateName(name, maxLength=24)` — product names over 24 chars truncated to fit 72mm paper
- ✅ `thermalReceipt.ts`: Removed inline `setTimeout(() => window.print(), 100)` from generated HTML — print now triggered by caller via `onload`
- ✅ `POSPage.tsx` + `PosTransactionHistory.tsx`: All `generateThermalReceiptHTML` callers updated with `printWindow.onload` → 500ms → `focus()` + `print()` + `onafterprint` closes window
- ✅ Applied to all three receipt functions: `generateThermalReceiptHTML`, `generateGiftReceiptHTML`, `generateStoreCreditReceiptHTML`

**Session 18 improvements:**
- ✅ `AdminPage.tsx` + `RapidScanIntakeMatrix.tsx`: Added "Gloves" age group with sizes 3–11 (goalkeeper glove sizes)
- ✅ `AdminPage.tsx` + `RapidScanIntakeMatrix.tsx`: Added "Adult Footwear" age group with sizes 3–13 (0.5 increments) — explicit alternative to the category-detection path
- ✅ `AdminPage.tsx` + `RapidScanIntakeMatrix.tsx`: Added "Youth Footwear" age group with sizes 1Y–6Y (0.5 increments)
- ✅ Both age group dropdowns in AdminPage (new product form + edit product form) updated: Adult, Youth, Balls, Gloves, One Size, Adult Footwear, Youth Footwear, Toddler
- ✅ RapidScanIntakeMatrix dropdown relabeled with consistent emoji labels: 👨 Adult, 👦 Youth, ⚽ Balls, 🧤 Gloves, 📦 One Size, 👟 Adult Footwear, 👟 Youth Footwear, 🧒 Toddler
- ✅ `getSuggestedSizes()` type unions updated in both files to include `'Gloves' | 'Adult Footwear' | 'Youth Footwear'`
- ✅ Toddler kept in dropdown (at end) for backward compat with existing Toddler-labeled variants

**Session 17 improvements:**
- ✅ `App.tsx`: Added `CategorySlugRoute` component — handles `/category/:slug` → finds matching nav menu → renders `ProductGridPage` (fixes `/category/national-teams?region=europe` blank page)
- ✅ `App.tsx`: Added 14 static landing-page routes: 3 FOOTWEAR submenu headings, 5 NATIONAL TEAMS regions, 6 CLUBS leagues (see ROUTES section below)
- ✅ `ProductGridPage.tsx`: Added `useSearchParams` + `region` query param — `/category/national-teams?region=europe` now filters products by that region's nav items instead of showing blank
- ✅ `ProductGridPage.tsx`: Added `isHeadingLandingPage` flag (`!!submenu && groupedSubmenuItems.length > 0`) — true when `submenu` prop matches a heading that has logo items; false for item-level pages
- ✅ `ProductGridPage.tsx`: Updated `shouldShowGrid` — returns `false` when `isHeadingLandingPage` is true (shows logo grid only, no product grid underneath)
- ✅ `ProductGridPage.tsx`: Logo grid condition: added `&& !region` — hides country/brand selector when navigating via `?region=` param
- ✅ `ProductGridPage.tsx`: Subtitle shows "N Teams — Select one to browse products" on heading landing pages
- ✅ `ProductGridPage.tsx`: "View All Products" button and "All Products" divider hidden on heading landing pages
- ✅ Supabase `navigation_items` updated: 14 heading rows now have correct landing page paths:
  - NATIONAL TEAMS: EUROPE→`/national-teams/europe`, AFRICA→`/national-teams/africa`, SOUTH AMERICA→`/national-teams/south-america`, NORTH AMERICA→`/national-teams/north-america`, OTHERS→`/national-teams/others`
  - CLUBS: LIGA→`/clubs/la-liga`, PREMIER LEAGUE→`/clubs/premier-league`, LIGUE 1→`/clubs/ligue-1`, SERIE A→`/clubs/serie-a`, BUNDESLIGA→`/clubs/bundesliga`, MLS→`/clubs/mls`, liga portugal→`/clubs/liga-portugal`
  - FOOTWEAR: SHOP BY BRAND→`/footwear/brands`, SHOP BY SURFACE→`/footwear/surface`, SHOP BY COLLECTION→`/footwear/collections`

**How the landing page system works:**
- `groupedSubmenuItems` (useMemo in ProductGridPage): when `submenu` prop matches a **heading** label in `navigationMenus`, returns that heading's logo items — when it matches an **item** label (e.g. PORTUGAL), returns `[]`
- `isHeadingLandingPage = !!submenu && groupedSubmenuItems.length > 0` — distinguishes heading landing pages from product pages
- `shouldShowGrid` is false on heading landing pages → only the logo grid renders (no product grid beneath)
- QUICK LINKS (footwear) intentionally has no landing page — its items have no logos

**Session 16 improvements:**
- ✅ `Header.tsx` mega menu: `handleMenuMouseLeave()` with 150ms timeout + `handleMenuMouseEnter()` clearing it — prevents menu closing when cursor moves between nav bar and dropdown
- ✅ `Header.tsx` mega menu left column: changed submenu heading `<div>` → `<button>` to fix click events not firing on mobile/touch
- ✅ `Header.tsx` mega menu layout: left column `relative z-50`, right column `relative z-10` — fixes right column (flex-1 + Framer Motion stacking context) overlapping and blocking left column clicks
- ✅ `Header.tsx` mega menu animation: removed `x: ±10` from `motion.div` exit/enter (opacity fade only) — was shifting right column leftward over left column during transition
- ✅ `Header.tsx` left column headings: render as `<Link to={submenu.path}>` when `submenu.path` exists, otherwise render as tab `<button>` — enables EQUIPMENT submenus (BALLS, GOALKEEPER etc.) to be clickable navigation links
- ✅ `AdminPage.tsx` navigation editor: collapsible menu sections — all menus collapsed by default with ▶/▼ chevrons; click header to expand/collapse
- ✅ `AdminPage.tsx` navigation editor: collapsible submenu columns — each submenu heading also collapsible with ▶/▼; shows item count when collapsed
- ✅ `AdminPage.tsx` navigation editor: search box at top — auto-expands matching menus/submenus, highlights matching text in yellow, shows "No results found" when nothing matches, collapses back on clear
- ✅ `ChevronRight` added to lucide-react imports in `AdminPage.tsx`
- ✅ New state: `expandedMenus`, `expandedSubmenus`, `navSearchQuery` in AdminPage
- ✅ New helpers: `toggleMenu()`, `toggleSubmenu()`, `highlightText()` in AdminPage

**Session 15 improvements:**
- ✅ `ProductGridPage.tsx`: Replaced top filter bar + mobile bottom-sheet drawer with left slide-out sidebar
- ✅ "Filters" button (all screen sizes) with red badge count of active filters — replaces separate desktop sort dropdown and mobile "Filter & Sort" button
- ✅ Sidebar slides in from LEFT: `initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.3 }}` — 280px on desktop, full-screen on mobile
- ✅ Dark overlay (`bg-black/50`) behind sidebar; click overlay to close; X button top-right
- ✅ Sidebar sections: Sort By (radio buttons), Brand (checkboxes + product count per brand), Price Range (toggle buttons), Size (toggle grid, footwear only), On Sale (toggle switch)
- ✅ Sidebar footer: "Clear All" (text left) + "Apply Filters" (red `#b90014`, full width) — Apply just closes sidebar (filters apply live)
- ✅ Sort now included in `activeFilterCount` badge; "Clear All" resets sort back to Newest First
- ✅ Brand product counts computed via `brandProductCounts` useMemo (category-filtered, brand-filter excluded so counts show full totals)
- ✅ Active filter tags above product grid now include sort tag (dark gray chip) when non-default sort is selected
- ✅ Removed `BrandFilter` component import from `ProductGridPage` (brand now inlined as checkboxes in sidebar); `BrandFilter.tsx` file preserved but unused
- ✅ Removed `ChevronDown` icon import (no longer needed without sort dropdown)

**Session 14 improvements:**
- ✅ `/custom-apparel` route added to sitemap generator (`scripts/generate-sitemap.js` `mainPages` array) — sitemap now 181 URLs (4 main + 7 category + 168 product pages)
- ✅ `CustomApparelPage.tsx` hero image: replaced placeholder `<div>` with `<img src="/hero-apparel.png" alt="Custom business apparel and uniforms in Mississauga" className="aspect-[4/3] w-full object-cover" />`
- ✅ `public/hero-apparel.png` added to main branch (1.45 MB) — was only on `custom-apparel` branch, causing missing image on live site
- ✅ `public/custom-apparel-banner.jpg` also in public folder (2.1 MB) — not currently used in hero but available
- ✅ `HomePage.tsx` slider: clicking prev/next arrow now resets the 5s auto-advance timer via `intervalRef` + `resetTimer()` — slide no longer jumps immediately after a manual click
- ✅ `HomePage.tsx` slider: indicator pins centered at bottom — active = wide red rectangle (`w-6 h-2 bg-[#b90014]`), inactive = small gray square (`w-2 h-2 bg-white/50`); clicking a pin jumps to slide and resets timer
- ✅ `AdminPage.tsx` slider: drag-to-reorder using `@dnd-kit/core` + `@dnd-kit/sortable`; `SortableSlideCard` component with grip handle (top-left); new order saved to DB on drop via `setContextSliderImages`
- ✅ Packages added: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`

**Session 13 improvements (Ball Sizes):**
- ✅ Ball sizes (Size 1-5) added as explicit "Balls" age group option in getSuggestedSizes()
- ✅ Adult apparel expanded from 7 to 8 sizes: XXS, XS, S, M, L, XL, XXL, **XXXL**
- ✅ "Balls" age group added to AdminPage.tsx variant dropdowns (2 locations)
- ✅ "Balls" age group added to RapidScanIntakeMatrix.tsx with ⚽ emoji label
- ✅ When "Balls" is selected as age group, size dropdown shows: Size 1, Size 2, Size 3, Size 4, Size 5
- ✅ Type definitions updated to include 'Balls' as valid age group in both files
- ✅ Updated getSuggestedSizes() logic: prioritizes explicit age group selection over auto-detection

**Session 13 improvements (Kit Orders & Header):**
- ✅ SALE page bug fixed: `fetchProductsByCategory` skips category filter for "sale" and "new arrivals" (special collections not tagged in DB) — all products now load into state so `isOnSale` filter in ProductGridPage works correctly
- ✅ "UNIFORM SUBMISSION" renamed to "KIT ORDERS" everywhere: DB (`navigation_menus`), `DEFAULT_NAV`, route (`/kit-orders`), `Footer.tsx`, `AdminPage.tsx` (`getCategoryPath` + category filter). Old `/uniform-submission` route kept as backward-compat alias
- ✅ Header nav layout: center section now `flex-1` (fills all space between logo and icons) with `justify-center gap-5` — 9 items on one line at `text-[11px]`, `whitespace-nowrap`, `tracking-normal`
- ✅ Header left section: `flex-1` → `shrink-0` (logo stays compact); right section: `flex-1` → `shrink-0` (icons stay compact)
- ✅ Mega menu inner container: added `px-4 md:px-8` to match header padding — dropdown left edge now aligns with header content boundary

**Session 12 improvements:**
- ✅ `fetchAdminProducts` now includes `colors` in SELECT — admin navigation no longer wipes color data from context
- ✅ `updateProduct` Supabase `.update()` now includes `colors: payload.colors` — admin color edits are persisted to DB
- ✅ `mergeProducts` + `fetchProductsByCategory` merge guard: preserves cached `colors` if fresh data returns null/undefined (race-condition protection)
- ✅ `ProductDetailPage`: StrictMode loading flash fixed via `lastFetchedIdRef` + `cancelled` cleanup flags
- ✅ `ProductDetailPage`: stale variant/color/size state reset on product navigation (new reset `useEffect([id])`)
- ✅ Root cause identified: AdminPage calls `fetchAdminProducts` on mount (twice), which used to do a full REPLACE without `colors` — fixed

**Session 11 improvements:**
- ✅ ProductDetailPage: color selector shows ALL colors from both product.colors JSONB and product_variants.color column
- ✅ ProductDetailPage: selecting a color filters the size grid to only that color's variants (graceful fallback when v.color is null)
- ✅ ProductDetailPage: URL ?color=0 (legacy numeric index) auto-converts to color name on load
- ✅ POS barcode scan: success message and cart now show color (e.g. "Added: Portugal KING Anthem · Green · Sz S")
- ✅ POS size selector modal: shows variant color next to size
- ✅ Admin variant table: inline color dropdown per row saves to DB immediately on change
- ✅ RapidScanIntakeMatrix: color dropdown added; selected color passed to onRegisterVariant for batch intake
- ✅ DB migration run: ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS color TEXT;

**Session 10 improvements:**
- ✅ Footer SEO paragraph updated: removed "Open Monday to Friday 10am–6pm, Saturday 10am–5pm" line (hours now managed via Admin → SEO → Store Information)

**Session 9 improvements:**
- ✅ Store Information section added to Admin → SEO tab (Address, Phone, Email, Mon–Sun hours)
- ✅ Homepage "Visit Us" section now reads store name, address, phone, email, and per-day hours from DB
- ✅ JSON-LD schema (SportingGoodsStore) now built dynamically from stored store info and hours
- ✅ Admin store info uses direct Supabase fetch/upsert (not SettingsContext) for reliability
- ✅ Email now optional when adding customers (create walk-in customers without email)
- ✅ Removed duplicate Supabase client instances (fixes "Multiple GoTrueClient" warning)
- ✅ Handle duplicate email gracefully with UPSERT (update existing customer instead of failing)
- ✅ Fixed customer search input text visibility (was white on white)

POS system live and fully functional.
Navigation logos working and preserved on save.
Gift receipts with barcode and print copy options added.
Color variant support added (admin can track which color each size variant belongs to).
Expanded apparel size ranges: Youth (YXXS-YXL), Adult (XXS-XXL).
E-commerce features (Phases 1-5) built on ecommerce-dev branch, not yet merged to main.

### Main Branch Features
✅ POS system production-ready and live
✅ Stock quantity display in product grid (color-coded warnings)
✅ Stock quantity display in admin product list
✅ Size selector modal for products with variants
✅ Fixed product display flickering (single bulk variant fetch)
✅ Removed 30-item product limit in POS
✅ Google Search Console verified, sitemap submitted
✅ robots.txt configured (blocks /admin, /pos from search)
✅ Variant fetch paginated (loop with .range() bypasses Supabase 1000-row cap — 2364+ variants)
✅ 76 online products set show_sizes=false (no real size variants in DB)
✅ ProductDetailPage: show_sizes=false shows "Call to Order" CTA (📞 905-593-3600) instead of "Coming Soon"
✅ Canonical URL fixed: absolutesoccer.ca → torontosoccershop.com (SettingsContext.tsx default)
✅ Navigation logos fixed: normalizePath() no longer lowercases URLs, saveNavigation() preserves DB logos
✅ Color variant support: Admin can assign colors to variants, POS displays "Product - Color - Size" format
✅ ProductDetailPage multi-color selector: shows all colors from product.colors JSONB + product_variants.color; sizes filter by selected color
✅ POS barcode scan: success message and cart show color when variant.color is populated (e.g. "Added: Portugal KING Anthem · Green · Sz S")
✅ Admin variant inline color dropdown: saves to product_variants.color on change without full page save
✅ Color swatch thumbnails on product cards: persistent — fetchAdminProducts now fetches colors, updateProduct now saves colors to DB
✅ ProductDetailPage color buttons: no flash/disappear — StrictMode guard (lastFetchedIdRef) + cancelled cleanup flags + reset-on-navigate effect
✅ Expanded apparel sizes: Youth (YXXS, YXS, YS, YM, YL, YXL), Adult (XXS, XS, S, M, L, XL, XXL, XXXL)
✅ Ball sizes added: "Balls" age group with sizes 1-5; One Size option for accessories
✅ Gloves age group added: goalkeeper sizes 3–11 in both AdminPage and RapidScanIntakeMatrix
✅ Adult Footwear / Youth Footwear explicit age groups: sizes 3–13 and 1Y–6Y (0.5 increments); replaces category-detection for footwear products
✅ Navigation mega-menu rebuilt: all navigation_items now have correct parent_id hierarchy
✅ NATIONAL TEAMS submenu populated with 5 regional groups (EUROPE, SOUTH AMERICA, AFRICA, NORTH AMERICA, OTHERS)
✅ Gift receipt: item-selection modal + no-price thermal receipt (POSPage + PosTransactionHistory)
✅ Print 1 or 2 copies (Customer / Customer+Merchant) — both from checkout receipt and transaction history reprint
✅ Receipt logo size fix: switched from 180px to 55mm for correct Epson 80mm thermal printing
✅ Shared SHARED_STYLES constant in thermalReceipt.ts (no duplication across receipt types)
✅ Returns: payment method selection step for "Original Payment" refunds (Cash/Visa/MC/Debit/Amex)
✅ Returns: left-panel "Returns" action button now opens modal at lookup step (was silently broken — guard changed from returnsFoundTransaction to showReturnsModal)
✅ Store Info: Admin → SEO tab has editable Store Information card (address, phone, email, hours per day)
✅ Homepage "Visit Us" section: dynamic from DB store_info settings row (name, address, phone, email, hours grid)
✅ JSON-LD schema: openingHoursSpecification built dynamically from stored hours strings in useSEO.tsx
✅ Unified Refund/Return flow: both paths use ReturnsModal with choose-refund → SC or Original Payment → confirm
✅ Refund button in PosTransactionHistory fixed: was calling direct DB update, now opens ReturnsModal(mode=refund)
✅ Store Credit on returns/refunds: works without a linked customer (walk-ins get card number printed on receipt)
✅ JSON-LD schema markup: SportingGoodsStore on homepage, Product schema on product detail pages (sku, mpn, image array, sale price, canonical URL, priceValidUntil)
✅ Product schema image URLs: `getAbsoluteUrl()` ensures all image URLs in JSON-LD are absolute `https://` — fixes Google Search Console "Invalid URL in field image" Merchant Listings error
✅ Search by product_code and brand: `ProductGridPage` client-side filter includes `product_code` and `brand` fields — customers can find products by manufacturer SKU
✅ Bidirectional SKU search: hyphens stripped from `name`, `description`, and `product_code` before comparing — `"IB5300480"` finds product with `"IB5300-480"` in description, and vice versa
✅ `/brampton-soccer-uniforms`: City SEO landing page for Brampton soccer clubs — hero, why-us, how-it-works, visit-us, quote form; Helmet title/description set
✅ `/mississauga-soccer-store`: City SEO landing page for Mississauga — hero, community section, 3-column cards, how-it-works, visit-us (with hours), quote form; canonical URL set
✅ Sitemap: 185 URLs (6 main + 7 category + 170 product pages); `/mississauga-soccer-store` added to `scripts/generate-sitemap.js` mainPages array (priority 0.9)
✅ Theme & Branding admin panel: Admin → Settings → Theme tab; primary color, secondary color, live preview mockup, logos; all settings persisted to `settings` table `key='theme'`; **font selector removed** (caused Unicode corruption — see session 35/36)
✅ Primary color site-wide: all `[#b90014]` Tailwind arbitrary values replaced with `[var(--primary-color)]` across 33 source files
✅ Secondary color applied: Footer, HomePage "Visit Us", BramptonSoccerPage/MississaugaSoccerPage/CustomApparelPage "How It Works" + contact bar sections use `style={{ backgroundColor: 'var(--secondary-color)' }}`
✅ Unknown barcode modal in POS: scanned barcode not in DB → quick modal (brand + price + name) → "Add to Cart & Save Later" or "Add to Cart & Save Now"; amber badge button shows pending count; Pending Barcodes Manager lets staff link to existing product, create new (navigates to Admin pre-filled), or skip
✅ Admin pre-fill from POS scan: React Router navigation state `{ openAddProduct, pendingBarcode }` → AdminPage detects on mount, pre-fills Add Product form, auto-navigates back to /pos after save
✅ UTF-8 encoding fix: site-wide mojibake repaired in 9 files (corrupted â€¢ â€" emoji sequences fixed to proper • – 💳 👕 ⚽ 🛡️ etc.)
✅ Font system: `applyFont()` in SettingsContext overrides `--font-sans` (Tailwind v4 variable) + sets inline `fontFamily` on `html` and `body`; `html, body { font-family: var(--font-family) !important }` in index.css; live preview loads Google Font on dropdown change before save
✅ Brand tiles on homepage: `BrandShowcase` links to `/brand/:brandName` (was broken `/products?brand=Nike`); `BrandPage` now calls `fetchProductsByCategory()` on mount so direct URL navigation shows products instead of "No products found"
✅ Sitemap: 181 URLs (4 main + 7 category + 168 product pages) — regenerated July 3, 2026
✅ SEO: updated title/meta description in index.html with keyword-rich content
✅ SEO: "formerly Golazo Store" brand attribution added to footer
✅ Instagram handle updated to @absolutemississauga across all files (schema, receipts)
✅ Footer SEO paragraph: removed hardcoded opening hours (hours managed via Admin → SEO → Store Information)
✅ SALE page: shows products with isOnSale=true — fetchProductsByCategory skips category filter for special collections (sale/new arrivals)
✅ "UNIFORM SUBMISSION" renamed to "KIT ORDERS" in nav (DB + DEFAULT_NAV + routes + footer + admin); /uniform-submission kept as alias
✅ Header nav: flex-1 center fills all space between logo and icons; 9 items at text-[11px] whitespace-nowrap tracking-normal on one line
✅ Mega menu inner container: px-4 md:px-8 padding matches header — dropdown left edge aligns with nav items
✅ `/custom-apparel` landing page: hero image (`/hero-apparel.png`), Who We Serve, What We Offer, How It Works, Why Choose Us, quote form (mailto), footer contact bar
✅ Sitemap: `scripts/generate-sitemap.js` — 181 URLs (4 main + 7 category + 168 product pages); regenerated July 3, 2026
✅ Homepage slider: prev/next clicks reset auto-advance timer (`intervalRef` + `resetTimer()`) — no more immediate jump after manual navigation
✅ Homepage slider: indicator pins at bottom — active wide red rectangle, inactive small gray square; click to jump + reset timer
✅ Admin slider: drag-to-reorder slides with `@dnd-kit` — grip handle top-left of each card, order saved to DB on drop
✅ Product grid filter sidebar: left slide-out panel (280px desktop / full-screen mobile) with Sort (radio), Brand (checkboxes + counts), Price (toggles), Size (footwear only), On Sale (toggle switch); "Filters" button with red badge; active filter tags row above grid
✅ Mega menu left column click fix: 150ms close delay; heading div→button; left column z-50 / right column z-10 prevents Framer Motion stacking context overlap; removed x-axis animation from transition
✅ Mega menu left column links: headings with `submenu.path` render as `<Link>` (navigate on click); headings without path render as tabs (hover behavior) — enables per-menu-type behavior
✅ Admin nav editor: collapsible menus + submenus (▶/▼, all collapsed by default, item counts shown); search box with yellow highlight + auto-expand matching sections
✅ Navigation landing pages: clicking a mega menu heading (EUROPE, LA LIGA, SHOP BY BRAND, etc.) shows a logo grid page — click a logo to see products; powered by `isHeadingLandingPage` flag in `ProductGridPage`
✅ `CategorySlugRoute` in `App.tsx`: handles `/category/:slug` → maps to matching nav menu → renders `ProductGridPage` (fixes blank page on query-param URLs like `/category/national-teams?region=europe`)
✅ Region filter in `ProductGridPage`: `?region=` query param filters products by that nav submenu's items — used as fallback for old URLs; logo grid hidden when `?region=` present
✅ 14 new landing page routes in `App.tsx`: FOOTWEAR (brands/surface/collections), NATIONAL TEAMS (europe/africa/south-america/north-america/others), CLUBS (la-liga/premier-league/ligue-1/serie-a/bundesliga/mls/liga-portugal)
✅ Supabase `navigation_items` paths updated for all 14 heading rows — clicks in mega menu now navigate to landing pages instead of going straight to products or going nowhere
✅ SOLD OUT display: product cards show greyscale + "SOLD OUT" banner; product detail page shows red "SOLD OUT" badge instead of size grid; POS cards show "SOLD OUT" label — all driven by zero-stock variant query
✅ Epson TM-T88IV receipt CSS: 72mm printable width, `2mm 4mm` padding, logo `55mm × 15mm`, table-layout columns for item/total rows, removed destructive `* { padding: 0 !important }` from @media print
✅ Receipt typography: body `13px bold`, store name `16px`, transaction-info `11px`, grand-total `15px`, item names bold
✅ 2-copy thermal receipt: both copies in ONE print window with `page-break-before: always`; class-based barcodes (`.receipt-barcode`) so JsBarcode renders both via `querySelectorAll`
✅ Product name truncation on receipts: `truncateName(name, 24)` — names over 24 chars get `...` suffix to fit 72mm paper
✅ Auto-print via `printWindow.onload` (500ms delay + `onafterprint` closes window) — replaced unreliable inline `setTimeout` script

## COMPLETED FEATURES

**POS System (/pos):**
- PIN auth (2024, env: VITE_POS_PIN)
- Dark/light theme toggle
- Shopify-style two-column layout
- Barcode scanning (SC-, INV-, product codes)
- 7 payment methods (Cash, Debit, Visa, MC, Amex, GC, SC)
- Stock quantity display with color-coded warnings
  * Red "Out of Stock" when stock = 0
  * Amber "Only X left!" when stock 1-3
  * Gray "X in stock" when stock 4-10
- Size selector modal (shows stock per size)
- Thermal receipt printing (Epson 80mm) with print 1 or 2 copies option
- Gift receipt feature with barcode and dedicated modal
- Color variant display in cart and receipts (format: "Nike Jersey - Red - Size M")
- Barcode scan success message includes color (e.g., "Added: Product · Red · Sz M")
- Transaction history with void/refund/return
- Discount system (percentage & custom)
- Cash change calculator
- Gift cards: issue/redeem/history
- Store credits: issue/redeem/scan/balance
- Returns: 6-step wizard with inventory restoration and refund payment method tracking
  * Flow: lookup → select-items → choose-refund → choose-payment-type (Original Payment only) → confirm → complete
  * "Original Payment" branch shows Cash/Visa/MC/Debit/Amex picker before confirm
  * Chosen method saved to `refund_payment_method` on returns table
  * Store Credit works without a linked customer (walk-ins) — card number printed on receipt
- Refunds (from history): same modal as Returns (mode="refund") — skips lookup/item-selection, uses full transaction total, no inventory restore
  * Entry points: History tab Refund button (PosTransactionHistory) and Void/Refund panel (POSPage)
  * Both offer: Issue Store Credit OR Refund to Original Payment (Cash/Visa/MC/Debit/Amex)
- Reports: EOD, Sales, Products, GC, Void/Refund, Customer, SC (Eastern timezone)
- Cash drawer open button: "Drawer" button in right-panel action row (Void/Refund | Return | History | **Drawer**); Archive icon (amber); uses EpsonControl font character "A" to send ESC/POS drawer kick command via browser print dialog

**Admin Panel (/admin):**
- Product CRUD with variants (size, barcode, stock, color)
- Color variant assignment for products (Red, Blue, Green, etc.)
- Variant table shows color column (Age Group | Size | **Color** | Barcode | Stock)
- Brand field with bulk brand assignment
- Stock quantity display with low-stock warnings
- Product list pagination (20 items/page)
- Inventory management
- Customer management
- Settings and database backup
- No flickering (single bulk fetch of all variants)
- Expanded apparel size ranges for Youth and Adult categories

**Database & Infrastructure:**
- Standalone /pos route with full POS logic
- Invoice numbering (INV-XXXXX via trigger)
- Customer profiles with history
- Navigation menus (navigation_menus, navigation_items tables)
- Product brand and product_code columns
- Duplicate product prevention (unique: name+category)
- SEO meta tags via useSEO hook + JSON-LD schema (SportingGoodsStore homepage, Product detail pages)
- Sitemap at public/sitemap.xml
- Google Search Console verified
- robots.txt blocks /admin and /pos from crawlers
- Footer brand attribution: "formerly Golazo Store" for SEO brand association

## E-COMMERCE FEATURES (ecommerce-dev branch - NOT merged to main)
**Built and tested (Phases 1-5 complete):**
- Shopping cart with localStorage persistence
- Checkout with customer form & address validation
- Order confirmation emails via Resend.com
- Shared inventory between POS and online store
- Real-time stock validation (no overbooking)
- Customer authentication (register, login, password reset)
- Account page with order history
- Google OAuth sign-in
- Shipping options (Pickup FREE / Ship $15)
- Admin panel for online orders

**Status:** Ready for merge to main OR Phase 6 development (Stripe payment processing).
**Decision:** Merge when decided to go live without payment, or after Phase 6 is complete.

## BRANCH STRATEGY
- main = stable POS system (production live)
- ecommerce-dev = e-commerce phases 1-5 (tested, ready for merge decision)
- Tag v1.0-pos-complete = permanent restore point

## KEY ARCHITECTURE RULES
- NO /api/ backend - all direct Supabase client calls
- RLS disabled on all tables
- Vercel hosting (automatic deployment from main)
- React Context: ProductContext, CustomerContext, SettingsContext
- Custom hooks: usePOSCart, useSEO
- No Redux - prop drilling at current scale
- TypeScript strict mode
- All console.log removed (kept console.error/warn)

## DATABASE TABLES
**Core POS:**
- products: id, name, price, category, brand, product_code, image, description, is_online, show_sizes, colors (jsonb)
- product_variants: id, product_id, size, barcode, stock_quantity, sku, age_group, color (text, nullable)
- transactions: id, invoice_number, customer_id, total_amount, method, items(jsonb), created_at, status
- customers: id, first_name, last_name, email, phone, boot_size, club_affinity
- gift_cards: id, card_number, initial_balance, current_balance, is_active
- store_credits: id, card_number, customer_id, amount, remaining_balance, is_active
- returns: id, transaction_id, customer_id, items, refund_amount, status, refund_payment_method (TEXT — run migration if missing)
- settings: key, data (jsonb) — keys: global, slider, homeCategories, navigation, footer, seo, store_info
- navigation_menus: id, label, path, order_index, is_active
- navigation_items: id, menu_id, label, path, logo_url, order_index, parent_id

**E-Commerce (ecommerce-dev branch):**
- online_orders: id, customer_id, items(jsonb), subtotal, tax, total, shipping_method, shipping_cost, status, created_at

## KEY FILES
- src/pages/POSPage.tsx - POS main interface
- src/pages/AdminPage.tsx - Admin panel (8+ tabs)
- src/pages/ProductDetailPage.tsx - Product detail page (Call to Order CTA for no-size products; Product JSON-LD schema)
- src/context/ProductContext.tsx - Product CRUD
- src/context/SettingsContext.tsx - Site settings defaults (canonical URL, SEO)
- src/components/ReturnsModal.tsx - Returns/Refund modal (mode="return" or mode="refund"); handles both flows with payment method selection
- src/components/GiftReceiptModal.tsx - Gift receipt generation with barcode
- src/components/PosTransactionHistory.tsx - Transaction history tab with Refund/Return/Void/Reprint
- src/utils/thermalReceipt.ts - Receipt generation (thermal, gift, store credit) with shared SHARED_STYLES
- src/hooks/useSEO.tsx - JSON-LD SportingGoodsStore schema (homepage only); accepts storeInfo and builds openingHoursSpecification dynamically
- src/hooks/usePOSCart.ts - Cart state management with color variant support
- public/sitemap.xml - SEO sitemap
- data/settings_exported.json - Supabase settings seed data

## ROUTES
- `/` — Home/storefront
- `/admin` — Admin panel
- `/pos` — POS system (PIN auth)
- `/brands` — All brands listing page (BrandsPage)
- `/brand/:brandName` — Individual brand page (BrandPage) — filters products by brand, with category sub-filter + search + sort
- `/reports` — Financial reports
- `/kit-orders` — Kit Orders / Uniform Submission page (also aliased at `/uniform-submission` for backward compat)
- `/sale` — Sale page (filters products where isOnSale=true)
- `/custom-apparel` — Custom Apparel landing page
- `/brampton-soccer-uniforms` — City SEO landing page for Brampton soccer clubs (BramptonSoccerPage)
- `/mississauga-soccer-store` — City SEO landing page for Mississauga soccer store (MississaugaSoccerPage)
- `/category/:slug` — Alias for any nav menu path slug (e.g. `/category/national-teams`) — handled by `CategorySlugRoute`

**Navigation landing pages (logo grid → click to see products):**
- `/footwear/brands` — SHOP BY BRAND logo grid
- `/footwear/surface` — SHOP BY SURFACE logo grid
- `/footwear/collections` — SHOP BY COLLECTION logo grid
- `/national-teams/europe` — European countries logo grid
- `/national-teams/africa` — African countries logo grid
- `/national-teams/south-america` — South American countries logo grid
- `/national-teams/north-america` — North American countries logo grid
- `/national-teams/others` — Others logo grid
- `/clubs/la-liga` — La Liga clubs logo grid
- `/clubs/premier-league` — Premier League clubs logo grid
- `/clubs/ligue-1` — Ligue 1 clubs logo grid
- `/clubs/serie-a` — Serie A clubs logo grid
- `/clubs/bundesliga` — Bundesliga clubs logo grid
- `/clubs/mls` — MLS clubs logo grid
- `/clubs/liga-portugal` — Liga Portugal clubs logo grid

## PENDING DB MIGRATIONS
Run these once in Supabase SQL editor if not already done:
```sql
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_payment_method TEXT;
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
```

Already run (no action needed):
```sql
-- ✅ Done (session 11):
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS color TEXT;
```

## KNOWN ISSUES
| Issue | Status |
|-------|--------|
| Germany product images (7 items) | Low priority |
| All critical POS features | ✅ Complete |
| Flag logos in National Teams mega-menu | Wikipedia blocks hotlinking — images show as blank boxes; text links work fine |
| Existing product_variants.color values are NULL | Admin must assign colors via Admin → Edit Product → Registered Master Variants color dropdowns (Portugal KING Anthem, Portugal Quarter-Zip, and any future multi-color products) |

## BUG FIXES & IMPROVEMENTS (Sessions 6-8 - June 17, 2026)
### POS Customer Section
- ✅ **Customer search input visibility:** Added `text-zinc-900` to search field. Text was white on white background (invisible while typing)
- ✅ **Customer form input visibility:** Added `text-zinc-900` to all form inputs (First Name, Last Name, Email, Phone, Boot Size, Club Affinity)
- ✅ **Enhanced error logging:** Changed `addCustomer()` error logging to show full error object + message details for debugging customer creation failures

### Customer Duplicate Email Handling (Session 7)
- ✅ **UPSERT instead of INSERT:** Changed from INSERT to UPSERT when email is provided
- ✅ **Graceful duplicate handling:** If customer with same email exists, their info is updated instead of failing
- ✅ **Better error detection:** Detects PostgreSQL duplicate key error (code 23505) and logs clear message
- ✅ **Fallback to INSERT:** When no email provided, uses regular INSERT (allows duplicate names without email)
- ✅ **Auto-refresh:** Automatically refreshes customer list after UPSERT to reflect changes

**Benefits:**
- No confusing error when re-entering a customer
- Prevents duplicate customer records
- Keeps customer data up-to-date if re-entered
- Better user experience in POS customer management

### Email Optional & Shared Supabase Client (Session 8)
- ✅ **Email optional:** Customers can now be created with just name and phone (no email required)
  - UPSERT only used when email is provided and non-empty
  - Falls back to INSERT when email is blank (allows multiple customers with same name)
  - Handles both null and empty string email values
  - Enables walk-in customer creation without email

- ✅ **Remove duplicate Supabase client:** Fixes "Multiple GoTrueClient instances" warning
  - StoreCreditsSection.tsx now uses shared `supabase` import from `../supabase`
  - Replaced `createClient()` with shared instance
  - Verified: no other components creating their own Supabase clients
  - Single Supabase instance reduces overhead and console warnings

- ⚠️ **Database requirement:** Email column should be nullable
  ```sql
  ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
  ```

**Files modified:**
- `src/components/PosCustomerManager.tsx` - Added text color classes to inputs (Session 6)
- `src/context/CustomerContext.tsx` - Enhanced error logging (Session 6) + UPSERT implementation (Session 7) + email optional handling (Session 8)
- `src/components/StoreCreditsSection.tsx` - Use shared Supabase client instead of creating new instance (Session 8)

## NEXT STEPS
- Decide on e-commerce merge timeline (Phases 1-5 ready on ecommerce-dev)
- Phase 6 development (Stripe payment) if going live with payments
- Mobile app consideration (React Native)
- Advanced analytics/reporting

## NAVIGATION LOGOS (Fixed June 14, 2026)
- `navigation_items.logo_url` stores all logo URLs
- Logos are in Supabase Storage: `media` bucket → `navigation_navigationMenus_submenus_items_logo/` folder
- **Bug fixed**: `normalizePath()` was lowercasing all URLs including `https://` Supabase Storage URLs (case-sensitive) — now skips any URL starting with `http` or `data:`
- **Bug fixed**: `saveNavigation()` now snapshots existing `logo_url` values before delete and restores them via `logoByLabel` map if in-memory state has no logo
- National team logos at `assets.cdn.filesafe.space` URLs — case-sensitive bucket ID
  - Correct: `By2ouDwVDtWabLH4FJkE` — if logos break check for lowercase `by2oudwvdtwablh4fjke`
- Logo restore SQL saved at: `docs/restore-logos.sql`
- If logos disappear after a save, run `npx tsx scripts/restore_logos.ts`

## APPAREL SIZE RANGES (Updated June 24, 2026)
**Toddler Apparel:** 12M, 18M, 24M, 2T, 3T, 4T (6 sizes)
**Youth Apparel:** YXXS, YXS, YS, YM, YL, YXL (6 sizes)
**Adult Apparel:** XXS, XS, S, M, L, XL, XXL, **XXXL** (8 sizes)

**Footwear:**
- Toddler (via category detection): 4C, 4.5C, 5C... 13C (19 sizes)
- Youth Footwear (explicit age group): 1Y, 1.5Y, 2Y... 6Y (11 sizes)
- Adult Footwear (explicit age group): 3, 3.5, 4... 13 (21 sizes)

**Balls:** Size 1, Size 2, Size 3, Size 4, Size 5 (5 sizes)

**Gloves (Goalkeeper):** 3, 4, 5, 6, 7, 8, 9, 10, 11 (9 sizes)

**One Size:** One Size option for accessories and one-size items

**Age group dropdown order:** Adult → Youth → Balls → Gloves → One Size → Adult Footwear → Youth Footwear → Toddler

**Implementation:** Size ranges defined in `getSuggestedSizes()` function in:
- `src/pages/AdminPage.tsx`
- `src/components/RapidScanIntakeMatrix.tsx` (both files must stay in sync)

## COLOR VARIANTS (Added June 17, 2026)
- Product can have multiple color variants (e.g., Red, Blue, Green)
- Each variant can be assigned a color in the admin panel
- Color displays in cart and receipts with format: "Product - Color - Size"
- Color field in product_variants table is optional (nullable)
- Color selection dropdown populated from product.colors array
- RapidScanIntakeMatrix component handles size/color intake during variant creation

## NAVIGATION DB STRUCTURE (navigation_menus + navigation_items)
- `navigation_menus` rows = top-level nav items (FOOTWEAR, CLUBS, NATIONAL TEAMS, etc.)
- `navigation_items` with `parent_id = null` = submenu headings (SHOP BY CATEGORY, LIGA, EUROPE, etc.)
- `navigation_items` with `parent_id = <heading_id>` = individual links (Nike, Arsenal, Portugal, etc.)
- ALL items MUST have the correct parent_id set — if parent_id=null on a child item it will render as a heading (broken mega-menu)
- When rebuilding navigation: delete per menu_id separately (not with `in.(...)` syntax which can silently miss rows), then insert headings first, capture IDs, then insert children
- Supabase batch insert requires all JSON objects to have identical keys — always include `"logo_url":null` on items without logos
- FOOTWEAR: 5 headings (SHOP BY CATEGORY, SHOP BY BRAND, SHOP BY SURFACE, SHOP BY COLLECTION, QUICK LINKS)
- CLUBS: 6 headings (LIGA, LIGUE 1, PREMIER LEAGUE, SERIE A, BUNDESLIGA, MLS)
- NATIONAL TEAMS: 5 headings (EUROPE: 7 nations, SOUTH AMERICA: 4, AFRICA: 3, NORTH AMERICA: Canada, OTHERS: Bosnia)

## IMPORTANT PATTERNS
- Supabase row cap is 1000 — ALWAYS paginate large fetches with `.range(from, from+999)` loop
- product_variants now has 2364+ rows — never use plain `.select()` without pagination
- show_sizes=false → no size picker, show "Call to Order" CTA in ProductDetailPage
- Canonical URL default lives in src/context/SettingsContext.tsx (also in Supabase settings table)
- Navigation URLs are case-sensitive — normalizePath() must NEVER lowercase http/data: URLs
- Size suggestions are generated dynamically in getSuggestedSizes() — both files must be kept in sync
