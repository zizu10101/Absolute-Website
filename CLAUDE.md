# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## CURRENT STATUS (Main Branch - June 22, 2026)
**Latest:** Left slide-out filter sidebar on product grid pages (session 15)

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
- ✅ `/custom-apparel` route added to sitemap generator (`scripts/generate-sitemap.js` `mainPages` array) — sitemap now 171 URLs (4 main pages)
- ✅ `CustomApparelPage.tsx` hero image: replaced placeholder `<div>` with `<img src="/hero-apparel.png" alt="Custom business apparel and uniforms in Mississauga" className="aspect-[4/3] w-full object-cover" />`
- ✅ `public/hero-apparel.png` added to main branch (1.45 MB) — was only on `custom-apparel` branch, causing missing image on live site
- ✅ `public/custom-apparel-banner.jpg` also in public folder (2.1 MB) — not currently used in hero but available
- ✅ `HomePage.tsx` slider: clicking prev/next arrow now resets the 5s auto-advance timer via `intervalRef` + `resetTimer()` — slide no longer jumps immediately after a manual click
- ✅ `AdminPage.tsx` slider: drag-to-reorder using `@dnd-kit/core` + `@dnd-kit/sortable`; `SortableSlideCard` component with grip handle (top-left); new order saved to DB on drop via `setContextSliderImages`
- ✅ Packages added: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`

**Session 13 improvements:**
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
✅ Expanded apparel sizes: Youth (YXXS, YXS, YS, YM, YL, YXL), Adult (XXS, XS, S, M, L, XL, XXL)
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
✅ JSON-LD schema markup: SportingGoodsStore on homepage, Product schema on product detail pages
✅ SEO: updated title/meta description in index.html with keyword-rich content
✅ SEO: "formerly Golazo Store" brand attribution added to footer
✅ Instagram handle updated to @absolutemississauga across all files (schema, receipts)
✅ Footer SEO paragraph: removed hardcoded opening hours (hours managed via Admin → SEO → Store Information)
✅ SALE page: shows products with isOnSale=true — fetchProductsByCategory skips category filter for special collections (sale/new arrivals)
✅ "UNIFORM SUBMISSION" renamed to "KIT ORDERS" in nav (DB + DEFAULT_NAV + routes + footer + admin); /uniform-submission kept as alias
✅ Header nav: flex-1 center fills all space between logo and icons; 9 items at text-[11px] whitespace-nowrap tracking-normal on one line
✅ Mega menu inner container: px-4 md:px-8 padding matches header — dropdown left edge aligns with nav items
✅ `/custom-apparel` landing page: hero image (`/hero-apparel.png`), Who We Serve, What We Offer, How It Works, Why Choose Us, quote form (mailto), footer contact bar
✅ Sitemap: `/custom-apparel` added to `scripts/generate-sitemap.js` — now 171 URLs (4 main pages)
✅ Homepage slider: prev/next clicks reset auto-advance timer (`intervalRef` + `resetTimer()`) — no more immediate jump after manual navigation
✅ Admin slider: drag-to-reorder slides with `@dnd-kit` — grip handle top-left of each card, order saved to DB on drop
✅ Product grid filter sidebar: left slide-out panel (280px desktop / full-screen mobile) with Sort (radio), Brand (checkboxes + counts), Price (toggles), Size (footwear only), On Sale (toggle switch); "Filters" button with red badge; active filter tags row above grid

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
- `/brands` — Brand pages
- `/reports` — Financial reports
- `/kit-orders` — Kit Orders / Uniform Submission page (also aliased at `/uniform-submission` for backward compat)
- `/sale` — Sale page (filters products where isOnSale=true)
- `/custom-apparel` — Custom Apparel landing page

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

## APPAREL SIZE RANGES (Updated June 17, 2026)
**Toddler:** 12M, 18M, 24M, 2T, 3T, 4T
**Youth:** YXXS, YXS, YS, YM, YL, YXL (6 sizes)
**Adult:** XXS, XS, S, M, L, XL, XXL (7 sizes)

**Footwear:**
- Toddler: 4C, 4.5C, 5C... 13C
- Youth: 1Y, 1.5Y, 2Y... 6.5Y, 7Y
- Adult: 4, 4.5, 5... 14.5, 15

**Implementation:** Size ranges defined in `getSuggestedSizes()` function in:
- `src/pages/AdminPage.tsx` (line 578+)
- `src/components/RapidScanIntakeMatrix.tsx` (line 43+)

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
