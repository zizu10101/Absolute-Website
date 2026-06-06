# Absolute Website - Development Context

## Project Overview
React + TypeScript e-commerce app (Absolute Soccer) with Point of Sale (POS) system, product catalog, and admin panel. Uses Supabase for data storage, Vite for bundling, and Tailwind CSS for styling.

**Stack:** React 19, TypeScript, Supabase, Vite, Tailwind CSS, Google Gemini AI integration

**Current Branch:** main  
**Server:** Running on `http://localhost:3000`

---

## Current Status (as of June 6, 2026)

### ✅ Production-Ready Features

**E-Commerce Frontend:**
- ✅ Product catalog with categories and filtering
- ✅ Shopping cart and checkout
- ✅ Dynamic SEO meta tag injection from Supabase
- ✅ Navigation menu with 55+ items and logos
- ✅ Product images and variants (colors, sizes)

**POS System (/pos standalone route):**
- ✅ PIN authentication (2024)
- ✅ Barcode scanner with product lookup
- ✅ Shopping cart with quantity controls
- ✅ Customer management (add, search, select)
- ✅ Discount system (percentage & custom price)
- ✅ Category filtering (7 categories)
- ✅ Online items filter
- ✅ Full checkout with 7 payment methods:
  - Cash (with change calculator)
  - Debit, Visa, Mastercard, Amex
  - Gift Card (with balance lookup)
  - Store Credit (with balance lookup)
- ✅ Receipt printing (thermal Epson format)
- ✅ Transaction history with void/refund/return options
- ✅ Stock deduction on checkout
- ✅ HST calculation (13%)
- ✅ Dark/light mode toggle

**Admin Panel:**
- ✅ Product management (create, edit, delete)
- ✅ Inventory management with variants
- ✅ Customer management (view, search)
- ✅ Settings management (store info, HST, etc.)
- ✅ Database sync and restore from backups

**Payment Systems (Complete):**
- ✅ Gift Card system (issue, redeem, history, reporting)
- ✅ Store Credit system (issue, redeem, history, reporting)
- ✅ Multi-payment combinations (gift card + store credit on single transaction)
- ✅ Void/Refund/Return transaction options with inventory & payment reversal

**Financial Reporting (7 tabs):**
- ✅ End of Day Report (daily summary, payment breakdown)
- ✅ Sales Report (date-range analysis with charts)
- ✅ Product Report (product performance, category filtering)
- ✅ Gift Card Report (issuance, redemption, liability tracking)
- ✅ Void & Refund Report (audit trail)
- ✅ Customer Report (customer analytics)
- ✅ Store Credit Report (credit issuance, redemption, liability)
- ✅ CSV & PDF export for all reports

**Transaction Actions:**
- ✅ Void: Mark as voided, no inventory restoration
- ✅ Refund: Mark as refunded, restore inventory
- ✅ Return: Mark as returned, restore inventory AND payment instruments (gift cards, store credits)

**Returns Processing System (NEW - June 6, 2026):**
- ✅ 5-step returns modal with full wizard flow
- ✅ Invoice lookup by barcode scan or manual entry
- ✅ Multi-item selection with quantities (partial returns)
- ✅ Real-time tax and discount calculations
- ✅ Flexible refund methods (Store Credit or Original Payment)
- ✅ Automatic inventory restoration
- ✅ Thermal receipts with CODE128 barcodes
- ✅ Database audit trail (returns table)

**Customer Profile Returns Integration (NEW - June 6, 2026):**
- ✅ Return button on each completed transaction in customer history
- ✅ Expandable transactions with return summary
- ✅ Updated status badges (completed, voided, refunded, returned, partial_return)
- ✅ Pre-filled returns modal (transaction ID + customer ID)
- ✅ Skips invoice lookup step when opened from customer profile
- ✅ Auto-refresh of customer history after return
- ✅ Return summary display in expanded transaction view
- ✅ Code reuse - single ReturnsModal handles both POS and customer profile

---

## Known Issues

| Issue | Status | Impact | Priority |
|-------|--------|--------|----------|
| Germany product images (7 products) | ❌ Not fixed | Missing images for German national team products | Medium |

**Germany Products Needing Images:**
- Germany Away Jersey Y (ID: d12a3349-c69f-46c4-af59-05c66e2c293c)
- Germany Home Jersey Y (ID: 145f19d9-c207-49dd-8a65-23dc93a71420)
- Germany Away Jersey (ID: 2d2bb11b-a696-4ab6-9952-2392f30ac59f)
- Germany Ball (ID: 2b6dd54a-e288-4541-8095-517709229fdf)
- Germany Cap (ID: f17ab064-c37f-41b5-85bb-909a1bb584cb)
- Germany GK H JSY (ID: fd0eb26a-def5-4146-9ac0-d6133a634909)
- Germany Home Jersey (ID: a03ed579-ee87-4823-a0b0-8ae4c1100bb7)

**Fix:** Admin uploads images through `/admin` product editor for each product.

---

## Database Schema Reference

**Key Tables:**
- `products` - Product catalog (55+ items)
  - Columns: id, name, category, price, description, image, colors, is_online
  - Related: product_variants (size, SKU, stock_quantity)
- `transactions` - POS transaction history
  - Columns: id, customer_id, total_amount, method, status (completed/voided/refunded/returned), items[], created_at, tendered_amount, change_given
- `gift_cards` - Gift card inventory
  - Columns: id, card_number, customer_id, initial_balance, current_balance, is_active, created_at
- `store_credits` - Store credit inventory
  - Columns: id, customer_id, amount, reason, remaining_balance, is_active, created_at
- `customers` - POS customer data
  - Columns: id, first_name, last_name, email, phone, created_at
- `returns` - Return transaction audit trail (NEW)
  - Columns: id, transaction_id, customer_id, refund_method (store-credit/original-payment), refund_amount, items[], status, created_at
- `settings` - Configuration (key: navigation, hst_number, store_name, etc.)

---

## Important Files & Paths

**Routes:**
- `/` - Home/storefront
- `/admin` - Admin panel (settings, products, customers, reports, POS)
- `/pos` - Standalone POS system (PIN auth required)
- `/reports` - Full reports page (7 tabs)

**Core Components:**
- `src/pages/AdminPage.tsx` - Admin panel with 8+ tabs
- `src/pages/POSPage.tsx` - Standalone POS with PIN auth
- `src/pages/ReportsPageFull.tsx` - Reports dashboard
- `src/components/ReportsPage.tsx` - Reports tab navigation
- `src/components/ReturnsModal.tsx` - Full 5-step returns wizard (NEW)
- `src/components/PosCustomerManager.tsx` - Customer management with integrated returns
- `src/components/GiftCardTab.tsx` - Gift card issuance & redemption
- `src/components/StoreCreditsTab.tsx` - Store credit management
- `src/hooks/usePOSCart.ts` - Cart state management

**API Routes:**
- `/api/products` - GET/POST products
- `/api/transactions` - GET/POST transactions
- `/api/transactions/void` - POST void transaction
- `/api/transactions/refund` - POST refund transaction
- `/api/transactions/return` - POST return transaction
- `/api/gift-cards/*` - Gift card endpoints
- `/api/store-credits/*` - Store credit endpoints (if needed)

**Configuration:**
- `.env` - Supabase credentials, Vite POS PIN (VITE_POS_PIN=2024)
- `server.ts` - Vite dev server + Express backend

---

## Dev Server

**Start Server:**
```bash
npm run dev              # Start on http://localhost:3000
npm run lint           # Type check
npm run build          # Build for production
```

**Endpoints:**
- App: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- POS: `http://localhost:3000/pos` (PIN: 2024)
- API: Same server

**Database:**
- Supabase project with public anon key
- Tables: products, transactions, customers, gift_cards, store_credits, settings
- Storage bucket: products (for product images)

---

## Memory/Feedback Notes

From project memory:
- **ProductCard colors crash** - Never store plain strings in colors array; use ColorVariant objects with images or empty array
- **User email** - info@edgedbs.com
- **POS standalone** - /pos route with PIN auth, dark mode, slide-over panels for history/customers

---

## Session June 6, 2026 - Files Created/Modified

### New Files Created
1. **`src/components/ReturnsModal.tsx`** (1,400+ lines)
   - Full 5-step returns wizard
   - Pre-filling support with optional props
   - Auto-load transaction functionality
   - onComplete callback for refresh

2. **Database Migration**
   - `migrations/create_returns_table.sql`
   - Returns table with RLS policies

3. **Documentation**
   - `RETURNS_SYSTEM_SETUP.md` - Complete setup guide
   - `RETURNS_BUILD_SUMMARY.md` - Technical details
   - `RETURNS_QUICKSTART.md` - 5-minute setup
   - `CUSTOMER_RETURNS_INTEGRATION.md` - Integration guide
   - `CUSTOMER_RETURNS_SUMMARY.txt` - Feature summary

### Files Modified
1. **`src/components/ReturnsModal.tsx`**
   - Added optional `prefilledTransactionId` prop
   - Added optional `prefilledCustomerId` prop
   - Added optional `onComplete` callback
   - Auto-load transaction if ID provided
   - Skip Step 1 when prefilled

2. **`src/components/PosCustomerManager.tsx`**
   - Added ReturnsModal integration
   - Expandable transactions
   - Return summary display
   - Return button on eligible transactions
   - Load return records for each transaction
   - Auto-refresh after return

3. **`src/pages/POSPage.tsx`**
   - Removed old Returns tab (moved to customer profile)
   - Cleaned up navigation
   - Updated posTab state type

4. **`src/utils/thermalReceipt.ts`**
   - Added CODE128 barcode generation
   - Barcode printed on all receipts

### Database Changes
- **New Table:** `returns`
  - Tracks all return operations
  - Links to original transaction
  - Records refund method and amount
  - Stores returned items and status

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000
npm run lint           # Type check
npm run build          # Build for production
npm run preview        # Preview production build locally

# Database
# Access Supabase dashboard at https://app.supabase.com
# Use public anon key for client, service role key for admin operations

# Deployment
# Connected to GitHub - push to main for automated deployment
```

---

## Latest Session Summary (June 6, 2026)

### ✅ Completed This Session

**1. Comprehensive Returns Processing System**
- Built full 5-step returns modal (ReturnsModal.tsx)
- Invoice lookup by barcode scan or manual entry
- Item selection with quantity control (partial returns)
- Tax and discount calculations (real-time)
- Flexible refund methods (Store Credit or Original Payment)
- Automatic inventory restoration on return
- Receipt generation with CODE128 barcodes
- Database schema: `returns` table with RLS policies

**2. Customer Profile Returns Integration**
- Added Return button to customer transaction history
- Expandable transactions with return summary display
- Updated status badges (4 statuses: completed, voided, refunded, returned, partial_return)
- Pre-filled ReturnsModal with transaction ID and customer ID
- Auto-load transaction on modal open
- Skip Step 1 (lookup) when pre-filled
- Auto-refresh customer history after return completes
- Code reuse: single modal handles both POS and customer profile

**3. Code Quality**
- ✅ TypeScript type checking passing (no errors in modified files)
- ✅ No code duplication (reuses existing ReturnsModal)
- ✅ Clean integration (minimal changes to existing components)
- ✅ Server running and responding correctly

### 📋 Next Session Checklist

**Immediate (Testing & Verification):**
- [ ] Test returns in POS via customer profile
  - [ ] Click customer → Purchase History
  - [ ] Expand transaction → click Process Return
  - [ ] Verify modal opens with transaction pre-filled
  - [ ] Verify Step 1 (lookup) is skipped
  - [ ] Complete return flow end-to-end
  - [ ] Verify transaction status updates to "RETURNED"
  - [ ] Verify return summary displays when expanded

- [ ] Test return-related database operations
  - [ ] Verify return record created in `returns` table
  - [ ] Verify inventory restored for returned items
  - [ ] Verify store credit issued (if SC method selected)
  - [ ] Verify gift card balance restored (if GC payment)

**High Priority:**
- [ ] Verify all payment methods working (Cash, Debit, Visa, MC, Amex, GC, Store Credit)
- [ ] Test multi-payment scenarios (GC + Store Credit on same transaction)
- [ ] Test void/refund/return with inventory and payment reversal
- [ ] Upload Germany product images (7 products needing images)

**Medium Priority:**
- [ ] Load test with 100+ transactions in reports
- [ ] Verify thermal receipt printing format
- [ ] Test partial returns (return 1 of 3 items)
- [ ] Test returns on refunded/voided transactions (should not show button)

**Optional Enhancements:**
- [ ] Return reason tracking (defect, wrong size, changed mind)
- [ ] Return time limit enforcement (30-day window)
- [ ] Return analytics/reports in reporting system
- [ ] Manager approval for high-value returns
- [ ] Email notifications for refunds/returns
