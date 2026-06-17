# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## CURRENT STATUS (Main Branch - June 17, 2026)
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
✅ Expanded apparel sizes: Youth (YXXS, YXS, YS, YM, YL, YXL), Adult (XXS, XS, S, M, L, XL, XXL)

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
- Returns: 5-step wizard with inventory restoration
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
- SEO meta tags via useSEO hook
- Sitemap at public/sitemap.xml
- Google Search Console verified
- robots.txt blocks /admin and /pos from crawlers

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
- returns: id, transaction_id, customer_id, items, refund_amount, status
- settings: key, value (site settings)
- navigation_menus: id, label, path, order_index, is_active
- navigation_items: id, menu_id, label, path, logo_url, order_index, parent_id

**E-Commerce (ecommerce-dev branch):**
- online_orders: id, customer_id, items(jsonb), subtotal, tax, total, shipping_method, shipping_cost, status, created_at

## KEY FILES
- src/pages/POSPage.tsx - POS main interface
- src/pages/AdminPage.tsx - Admin panel (8+ tabs)
- src/pages/ProductDetailPage.tsx - Product detail page (Call to Order CTA for no-size products)
- src/context/ProductContext.tsx - Product CRUD
- src/context/SettingsContext.tsx - Site settings defaults (canonical URL, SEO)
- src/components/ReturnsModal.tsx - 5-step returns wizard
- src/components/GiftReceiptModal.tsx - Gift receipt generation with barcode
- src/utils/thermalReceipt.ts - Receipt generation (main + gift receipt)
- src/hooks/usePOSCart.ts - Cart state management
- public/sitemap.xml - SEO sitemap
- data/settings_exported.json - Supabase settings seed data

## ROUTES
- `/` — Home/storefront
- `/admin` — Admin panel
- `/pos` — POS system (PIN auth)
- `/brands` — Brand pages
- `/reports` — Financial reports

## KNOWN ISSUES
| Issue | Status |
|-------|--------|
| Germany product images (7 items) | Low priority |
| All critical POS features | ✅ Complete |

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

## IMPORTANT PATTERNS
- Supabase row cap is 1000 — ALWAYS paginate large fetches with `.range(from, from+999)` loop
- product_variants now has 2364+ rows — never use plain `.select()` without pagination
- show_sizes=false → no size picker, show "Call to Order" CTA in ProductDetailPage
- Canonical URL default lives in src/context/SettingsContext.tsx (also in Supabase settings table)
- Navigation URLs are case-sensitive — normalizePath() must NEVER lowercase http/data: URLs
- Size suggestions are generated dynamically in getSuggestedSizes() — both files must be kept in sync
