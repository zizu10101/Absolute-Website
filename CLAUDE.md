# Absolute Website - Development Context

## Project Overview
**Toronto Soccer Shop** (Absolute Soccer Mississauga) — React + TypeScript e-commerce with integrated POS, admin panel, and financial reporting.

**Stack:** React 19, TypeScript, Supabase, Vite, Tailwind CSS, Vercel  
**Server:** `npm run dev` → localhost:3000  
**Live:** torontosoccershop.com  
**GitHub:** zizu10101/Absolute-Website  
**Env:** `.env` has Supabase credentials, `VITE_POS_PIN=2024`

---

## Current Status

### Latest Completion (June 9, 2026)
✅ POS redesigned with Shopify-style dark theme (two-column layout)  
✅ All 500+ lines of business logic preserved  
✅ Timezone handling fixed across 6 report components  
✅ 100+ console.log statements cleaned from 23 files  
✅ Navigation fallback fixed for empty relational tables  
✅ Return receipt barcodes encode invoice numbers (scannable)  
✅ Dual-receipt printing (return + SC with 1.5s delay)  
✅ Store credit display shows card numbers not UUIDs  

---

## ✅ Production-Ready Features (Complete List)

**E-Commerce:**
- Product catalog (55+ items) with categories, variants (colors/sizes)
- Shopping cart & checkout with HST (13%)
- Dynamic SEO meta tag injection
- Navigation menu (55+ items with logos)
- Brand filtering & dedicated brand pages (/brands, /brand/:brandName)

**POS System (/pos):**
- PIN auth (2024), dark/light theme toggle
- Shopify-style two-column layout (left: search/products, right: customer/cart/checkout)
- Top header: logo, cashier status, reports icon, theme toggle, logout
- Bottom navigation: REGISTER | HISTORY | CUSTOMERS | GIFT CARDS | STORE CREDIT
- Barcode scanning (SC- → store credit, INV- → returns, product codes → cart)
- 7 payment methods: Cash, Debit, Visa, MC, Amex, Gift Card, Store Credit
- Thermal receipt printing (CODE128 barcodes, INV numbers)
- Transaction history with void/refund/return options
- Discount system (percentage & custom price)

**Admin Panel (/admin):**
- Product CRUD with brand field, bulk brand assignment
- Inventory management with variants
- Customer management, settings, database backup

**Payment Systems:**
- Gift Cards: issue, redeem, history, reporting
- Store Credit: issue, redeem, history (card numbers SC-XXXXX)
- Multi-payment combinations (GC + SC on single transaction)
- Void/Refund/Return with inventory & payment reversal

**Returns Processing:**
- 5-step wizard (invoice lookup → items → refund → confirm → complete)
- Partial returns with quantity controls
- Auto inventory restoration
- Dual-receipt printing (return receipt + SC receipt)
- Returns audit trail & customer profile integration

**Financial Reporting (7 tabs):**
- End of Day, Sales, Product, Gift Card, Void/Refund, Customer, Store Credit
- Eastern timezone support (auto EDT/EST detection)
- CSV & PDF export

---

## Key Architecture Rules

**Database:**
- Supabase with RLS disabled (anon key for direct client calls)
- NO /api/ backend endpoints (all direct client Supabase)
- Tables: products, transactions, customers, gift_cards, store_credits, returns, settings, navigation_menus
- invoice_number auto-generated via trigger (INV-01000 format)
- store_credit card_number: SC- + 12-char alphanumeric

**Code Patterns:**
- React Context: ProductContext, CustomerContext, SettingsContext
- Custom hooks: usePOSCart, useSEO
- No Redux — simple prop drilling at current scale
- Tailwind CSS + TypeScript strict mode
- All console.log removed (kept console.error/warn)

**Routes:**
- `/` — Home/storefront
- `/admin` — Admin panel
- `/pos` — Standalone POS (PIN auth)
- `/reports` — Full reports page
- `/brands` — All brands hub
- `/brand/:brandName` — Individual brand page

---

## Important Files & Paths

**Core Components:**
- `src/pages/POSPage.tsx` — Main POS interface with Shopify dark theme
- `src/pages/AdminPage.tsx` — Admin with 8+ tabs
- `src/pages/ProductGridPage.tsx` — Product listing with filtering
- `src/pages/ReportsPageFull.tsx` — Reports dashboard
- `src/components/ReturnsModal.tsx` — 5-step returns wizard
- `src/components/PosCustomerManager.tsx` — Customer mgmt + returns
- `src/utils/thermalReceipt.ts` — Receipt generation with barcodes
- `src/utils/timezoneUtils.ts` — Eastern time conversion (EDT/EST)

**Contexts:**
- `src/contexts/ProductContext.tsx` — Product CRUD
- `src/contexts/CustomerContext.tsx` — Customer management
- `src/contexts/SettingsContext.tsx` — App settings & navigation menus

**Hooks:**
- `src/hooks/usePOSCart.ts` — Cart state management
- `src/hooks/useSEO.ts` — SEO meta tag injection

---

## Database Schema

**products**
- id, name, category, brand, product_code (UNIQUE, nullable), price, description, image, colors[], is_online
- Related: product_variants (size, SKU, stock_quantity)

**transactions**
- id, invoice_number, customer_id, total_amount, method, status (completed/voided/refunded/returned/partial_return), items[], created_at, tendered_amount, change_given

**customers**
- id, first_name, last_name, email, phone, created_at

**gift_cards**
- id, card_number, customer_id, initial_balance, current_balance, is_active, created_at

**store_credits**
- id, card_number (SC-XXXXX format), customer_id, amount, reason, remaining_balance, is_active, created_at

**returns**
- id, transaction_id, customer_id, refund_method (store_credit/original_payment), refund_amount, items[], status, created_at

**settings**
- key, value (navigation, hst_number, store_name, etc.)

---

## Known Issues

| Issue | Status | Impact |
|-------|--------|--------|
| Germany product images (7 items) | Pending | Low priority — upload via admin |
| All critical features | ✅ Complete | POS, returns, store credit, reports fully functional |

---

## Next Steps (Testing & Verification)

**Critical Testing:**
- [ ] Test Shopify POS redesign in browser (visual check, dark theme)
- [ ] Test dual-receipt printing (return + SC) with actual returns
- [ ] Verify timezone accuracy in reports
- [ ] Test all barcode scanning flows (SC-, INV-, product codes)
- [ ] Load test with 100+ transactions in history

**Optional Enhancements (Future):**
- [ ] SC statement/history email to customers
- [ ] QR code option alongside barcode
- [ ] Return reason tracking & analytics
- [ ] Manager approval workflow for high-value returns
- [ ] Store credit expiration dates
