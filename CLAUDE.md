# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## CURRENT STATUS (Main Branch - June 16, 2026 — updated session 2)
POS system live and fully functional.
Navigation logos working and preserved on save.
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
✅ Navigation mega-menu rebuilt: all navigation_items now have correct parent_id hierarchy
✅ NATIONAL TEAMS submenu populated with 5 regional groups (EUROPE, SOUTH AMERICA, AFRICA, NORTH AMERICA, OTHERS)
✅ Gift receipt: item-selection modal + no-price thermal receipt (POSPage + PosTransactionHistory)
✅ Print 1 or 2 copies (Customer / Customer+Merchant) — both from checkout receipt and transaction history reprint
✅ Receipt logo size fix: switched from 180px to 55mm for correct Epson 80mm thermal printing
✅ Shared SHARED_STYLES constant in thermalReceipt.ts (no duplication across receipt types)
✅ Returns: payment method selection step for "Original Payment" refunds (Cash/Visa/MC/Debit/Amex)

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
- Thermal receipt printing (Epson 80mm)
- Transaction history with void/refund/return
- Discount system (percentage & custom)
- Cash change calculator
- Gift cards: issue/redeem/history
- Store credits: issue/redeem/scan/balance
- Returns: 6-step wizard with inventory restoration and refund payment method tracking
  * Flow: lookup → select-items → choose-refund → choose-payment-type (Original Payment only) → confirm → complete
  * "Original Payment" branch shows Cash/Visa/MC/Debit/Amex picker before confirm
  * Chosen method saved to `refund_payment_method` on returns table
- Reports: EOD, Sales, Products, GC, Void/Refund, Customer, SC (Eastern timezone)

**Admin Panel (/admin):**
- Product CRUD with variants (size, barcode, stock)
- Brand field with bulk brand assignment
- Stock quantity display with low-stock warnings
- Product list pagination (20 items/page)
- Inventory management
- Customer management
- Settings and database backup
- No flickering (single bulk fetch of all variants)

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
- products: id, name, price, category, brand, product_code, image, description, is_online, show_sizes
- product_variants: id, product_id, size, barcode, stock_quantity, sku, age_group
- transactions: id, invoice_number, customer_id, total_amount, method, items(jsonb), created_at, status
- customers: id, first_name, last_name, email, phone, boot_size, club_affinity
- gift_cards: id, card_number, initial_balance, current_balance, is_active
- store_credits: id, card_number, customer_id, amount, remaining_balance, is_active
- returns: id, transaction_id, customer_id, items, refund_amount, status, refund_payment_method (TEXT — run migration if missing)
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
- src/components/ReturnsModal.tsx - 6-step returns wizard (lookup → select → choose-refund → choose-payment-type → confirm → complete)
- src/utils/thermalReceipt.ts - Receipt generation (thermal, gift, store credit)
- src/hooks/usePOSCart.ts - Cart state management
- public/sitemap.xml - SEO sitemap
- data/settings_exported.json - Supabase settings seed data

## ROUTES
- `/` — Home/storefront
- `/admin` — Admin panel
- `/pos` — POS system (PIN auth)
- `/brands` — Brand pages
- `/reports` — Financial reports

## PENDING DB MIGRATIONS
Run these once in Supabase SQL editor if not already done:
```sql
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_payment_method TEXT;
```

## KNOWN ISSUES
| Issue | Status |
|-------|--------|
| Germany product images (7 items) | Low priority |
| All critical POS features | ✅ Complete |
| Flag logos in National Teams mega-menu | Wikipedia blocks hotlinking — images show as blank boxes; text links work fine |

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
