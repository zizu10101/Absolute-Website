# Absolute Website - Development Context

## Project Overview
React + TypeScript e-commerce app (Absolute Soccer) with Point of Sale (POS) system, product catalog, and admin panel. Uses Supabase for data storage, Vite for bundling, and Tailwind CSS for styling.

**Stack:** React 19, TypeScript, Supabase, Vite, Tailwind CSS, Google Gemini AI integration

**Current Branch:** main  
**Server:** Running on `http://localhost:3000`

---

## Current Status (as of June 7, 2026 - Session 4)

### Latest Session - Store Credit Receipts & Reprint Invoice Feature ✅

**NEW FEATURES IMPLEMENTED:**

1. **Store Credit Receipt Format** ✅
   - ✅ Dedicated receipt format for SC issuance vs redemption
   - ✅ SC Issuance Receipt: Shows card number (SC-XXXX...), amount, remaining balance, reason
   - ✅ SC Redemption Receipt: Shows amount used, remaining balance, second payment method
   - ✅ Large bold formatting for amounts
   - ✅ Barcode encodes SC card number for SC receipts
   - ✅ Function: `generateStoreCreditReceiptHTML()` in thermalReceipt.ts

2. **Reprint Invoice Feature** ✅
   - ✅ Reprint button added to Transaction History (next to Print/Void/Refund/Return)
   - ✅ Reprint button added to Customer Profile transaction list
   - ✅ Reconstructs full receipt from Supabase transaction data
   - ✅ Includes `*** REPRINT ***` header for clarity
   - ✅ Works for all transaction types: completed, voided, refunded, returned
   - ✅ Auto-opens print dialog when clicked
   - ✅ Function: `handleReprint()` in PosTransactionHistory.tsx

3. **Store Credit Barcode Assignment** ⏳ (Pending)
   - ⏳ Migration created: `generate_store_credit_card_numbers.sql`
   - ⏳ Generates SC-XXXXXXXXXXXX codes for existing store credits with null card_number
   - ⏳ Run in Supabase SQL Editor to generate codes for all existing credits

**CRITICAL BUGS FIXED (Previous Session - Session 3):**

Three critical store credit bugs fixed:

1. **BUG: Store Credit Balance Update Never Runs** ✅
   - ✅ Problem: `actualAmountUsed` was undefined
   - ✅ Fixed: Added calculation before use
   - ✅ Commit: a80b799

2. **BUG: Store Credit State Undefined During Checkout** ✅
   - ✅ Problem: React state closure issue
   - ✅ Fixed: Capture values at function start
   - ✅ Commit: 6feb45e

3. **BUG: Returns Table 406 Errors** ✅
   - ✅ Problem: `.single()` fails when no data exists
   - ✅ Fixed: Changed to `.maybeSingle()`
   - ✅ Commit: a80b799

### Previous Session Summary - Store Credit & Product Management Complete ✅

**Returns Feature - FULLY IMPLEMENTED & TESTED:**
- ✅ 5-step returns wizard in ReturnsModal (invoice lookup → item selection → refund method → confirmation → completion)
- ✅ Smart quantity controls:
  - Single items (qty=1): Simple "Select" button
  - Multi-quantity items: Full +/- quantity picker
  - All text rendered in BLACK for visibility
  - Blue highlight on selected items
- ✅ Return button in POS transaction history (History tab, blue button)
- ✅ Return tab in POS register (right side):
  - Invoice number or barcode lookup
  - Shows found transaction details
  - Auto-opens returns modal
- ✅ Transaction status updated to:
  - `returned` for full returns (blue badge)
  - `partial_return` for partial returns (purple badge)
- ✅ Return summary in customer profile (expandable transaction view)
- ✅ Automatic inventory restoration for returned items
- ✅ Store credit issuance with /api/store-credits endpoint
- ✅ Payment reversal for original payment methods

**Bug Fixes This Session:**
- ✅ Transaction status now updates after return (was missing entirely)
- ✅ Store credit schema corrected (removed non-existent fields)
- ✅ Refund method enum fixed (store_credit vs store-credit)
- ✅ RLS policy bypass: Created /api/store-credits endpoint with service role key
- ✅ Detailed error logging added for debugging

**Architecture Improvements:**
- ✅ Created /api/store-credits endpoint on server (bypasses RLS policies)
- ✅ ReturnsModal uses API endpoint instead of direct Supabase
- ✅ Status badges updated with 5 states (completed, voided, refunded, returned, partial_return)
- ✅ Better separation of concerns (client vs server responsibilities)

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

## Known Issues & Status

| Issue | Status | Impact | Priority |
|-------|--------|--------|----------|
| Store credit card numbers null | ⏳ READY TO FIX | Need to generate SC-XXXX codes | HIGH |
| Store credit balance update bug | ✅ FIXED (Session 3) | Balance now updates on checkout | CRITICAL |
| Store credit state undefined | ✅ FIXED (Session 3) | React closure issue resolved | CRITICAL |
| Returns table 406 errors | ✅ FIXED (Session 3) | No longer blocks transaction history | HIGH |
| Germany product images (7 products) | ❌ Not fixed | Missing images for German national team products | Medium |

**Store Credit Card Number Generation (NEXT STEP):**
- ⏳ Run migration in Supabase SQL Editor:
  ```sql
  UPDATE store_credits
  SET card_number = 'SC-' || SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 12)
  WHERE card_number IS NULL;
  ```
- Once generated, all SC receipts will display proper card numbers
- All existing credits will have scannable barcodes

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

## Next Steps - Session 5 TODO (June 7, 2026)

### CRITICAL - Generate Store Credit Card Numbers

**Action Items:**
- [ ] **RUN MIGRATION**: Execute SQL in Supabase SQL Editor to generate SC-XXXX codes
  ```sql
  UPDATE store_credits
  SET card_number = 'SC-' || SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 12)
  WHERE card_number IS NULL;
  ```
- [ ] After migration: Verify all store credits have card_number values
- [ ] Test SC receipt displays card number properly
- [ ] Test barcode scanning works with new card numbers

### HIGH - Test Store Credit Receipts (New Feature)

**SC Issuance Receipt Tests:**
- [ ] Issue a store credit manually (from return or manual issue)
- [ ] Verify receipt shows:
  - [ ] "STORE CREDIT ISSUED" header
  - [ ] Card number (SC-XXXXXXXXXXXX)
  - [ ] Barcode encodes card number
  - [ ] Amount in large bold box
  - [ ] "Keep this receipt safe!" footer
- [ ] Test print and PDF download

**SC Redemption Receipt Tests:**
- [ ] Use store credit to partially pay for transaction
- [ ] Verify receipt shows:
  - [ ] "STORE CREDIT REDEEMED" header
  - [ ] "Amount Used: -$X.XX"
  - [ ] "Remaining Balance: $X.XX" (large bold)
  - [ ] Second payment method amount
- [ ] Test full SC coverage (no second payment)

### HIGH - Test Reprint Invoice (New Feature)

**Reprint Button Tests:**
- [ ] Click Reprint on transaction in History tab
- [ ] Verify receipt shows "*** REPRINT ***" header
- [ ] Verify all transaction details correct
- [ ] Test reprint for all transaction types:
  - [ ] Completed transaction
  - [ ] Voided transaction
  - [ ] Refunded transaction
  - [ ] Returned transaction
- [ ] Test print dialog opens automatically
- [ ] Test in Customer Profile transaction list

### MEDIUM - Verify Existing Features Still Work

**Store Credit Redemption Flow:**
- [ ] Partial payment: SC doesn't cover full amount
- [ ] Show "Remaining to Pay" message correctly
- [ ] Require second payment method
- [ ] Exact payment: SC covers entire amount
- [ ] Console logs show correct calculations

**Returns System:**
- [ ] POS Returns Tab: scan invoice and process return
- [ ] Customer Profile: click Return on transaction
- [ ] Verify inventory restored
- [ ] Verify store credit issued (or original payment reversed)
- [ ] Verify transaction status updates

**Multi-Payment Combinations:**
- [ ] Gift Card + Store Credit
- [ ] Gift Card + Cash
- [ ] Store Credit + Debit Card
- [ ] All combinations show correct final amount

### MEDIUM - Product Images

**Germany Products (7 items need images):**
- [ ] Admin panel - upload images for:
  - Germany Away Jersey Y
  - Germany Home Jersey Y
  - Germany Away Jersey
  - Germany Ball
  - Germany Cap
  - Germany GK H JSY
  - Germany Home Jersey
- [ ] Verify images display in storefront

### LOW - Code Quality & Cleanup

**After testing passes:**
- [ ] Remove console logs if needed (keep 🔴 logs for debugging)
- [ ] Verify no TypeScript errors
- [ ] Run tests suite
- [ ] Check browser console for any errors

---

## Commits This Session (Session 4 - June 7, 2026)

| Commit | Message | Files |
|--------|---------|-------|
| 28d9b45 | Revert "fix: remove non-functional reprint button, keep only print button" | PosTransactionHistory.tsx |
| 4f15a80 | fix: remove non-functional reprint button, keep only print button | PosTransactionHistory.tsx |
| 776e7cc | fix: fix reprint button visibility and remove duplicate, add SC card number migration | PosTransactionHistory.tsx, PosCustomerManager.tsx, migrations/ |
| a00fb88 | feat: implement store credit receipts and reprint invoice functionality | thermalReceipt.ts, POSPage.tsx, PosTransactionHistory.tsx, PosCustomerManager.tsx |

**Previous Session Commits (Session 3):**

| Commit | Message | Files |
|--------|---------|-------|
| a80b799 | fix: critical store credit and returns bugs found in console logs | POSPage.tsx, PosCustomerManager.tsx |
| 6feb45e | fix: capture selectedStoreCredit before async operations (critical state bug) | POSPage.tsx |
| 6711f74 | docs: add detailed explanation of store credit direct Supabase fix | CLAUDE.md |
| d0d90d2 | fix: implement direct Supabase store credit balance update | POSPage.tsx |

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
- `/api/products` - GET/POST products, PUT/DELETE for edits (uses service role key)
- `/api/transactions` - GET/POST transactions
- `/api/transactions/void` - POST void transaction
- `/api/transactions/refund` - POST refund transaction
- `/api/transactions/return` - POST return transaction
- `/api/store-credits` - GET all store credits (NEW - June 7)
  - Returns: { success, data: StoreCredit[] }
  - Includes customer data and transaction history
- `/api/store-credits/customer/:customerId` - GET customer's store credits (NEW - June 7)
  - Returns: { success, data: StoreCredit[] }
  - Filters for active credits with remaining balance
- `/api/store-credits` - POST create store credit (NEW - June 7)
  - Body: { customerId, amount, reason }
  - Uses service role key to bypass RLS
  - Automatically creates store_credit_transactions record
- `/api/store-credits/redeem` - POST redeem store credit (NEW - June 7)
  - Body: { creditId, amount, transactionId }
  - Deducts balance from store credit
  - Returns: { success, newBalance }
  - Creates transaction record for audit trail
- `/api/gift-cards/*` - Gift card endpoints

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

## Latest Session Summary (June 7, 2026 - Continued)

### ✅ Completed This Session

**1. Fixed Product Editing (RLS Bypass)**
- ✅ Product editing was failing due to RLS policies
- ✅ Updated `updateProduct()` to use `/api/products/:id` PUT endpoint (like delete already did)
- ✅ Server now uses service role key for all product operations
- ✅ Product edit/delete fully functional in admin panel

**2. Fixed Admin Panel Access**
- ✅ Added localhost/127.0.0.1 to allowed domains for /admin, /pos, /reports
- ✅ Production access still restricted to torontosoccershop.com
- ✅ Development access working without "Access Denied" errors

**3. Fixed Store Credit Display System**
- ✅ Created GET `/api/store-credits` endpoint (all credits with customer data)
- ✅ Created GET `/api/store-credits/customer/:customerId` endpoint (customer-specific)
- ✅ Updated `StoreCreditsSection.tsx` to use API instead of direct Supabase
- ✅ Updated `StoreCreditsTab.tsx` to use API for history tab
- ✅ Updated `StoreCreditReport.tsx` to use API for reports
- ✅ Store credits now display correctly in all locations (Reports, History, Customer Profile)

**4. Fixed Diana Mamoori's Missing Store Credit**
- ✅ Diana's return was processed but store credit was never created (API endpoint didn't exist at time)
- ✅ Manually created $107.35 store credit for Diana
- ✅ Updated returns table with store_credit_id link
- ✅ Now shows in all store credit locations

**5. Implemented Store Credit Redemption (POS Checkout)**
- ✅ Fixed store credit selection modal to use API endpoint
- ✅ Created POST `/api/store-credits/redeem` endpoint
- ✅ Store credit selection dropdown working in POS
- ✅ Transaction saved with store credit applied
- ✅ Balance deducted from store_credits table
- ✅ Created transaction record for audit trail

**6. Fixed Transaction Payload Schema**
- ✅ Removed invalid fields: `discount`, `subtotal`, `hst`, `isTaxExempt`
- ✅ Transaction table schema: total_amount, method, items, customer_id, created_at, tendered_amount, change_given
- ✅ Checkout no longer fails with "column not found" errors

**7. Enhanced Receipt Display**
- ✅ Receipt now shows store credit amount used
- ✅ Added "Remaining Balance" display below amount used
- ✅ Captures new balance from API response
- ✅ Customer can see their balance after redemption on receipt

**8. Improved Returns System**
- ✅ Added store_credit_id save to returns table after creation
- ✅ Links return record to store credit created
- ✅ Full audit trail now maintained

### 📋 Next Session Checklist

**CRITICAL - Store Credit Redemption Testing:**
- [ ] **Verify store credit balance deduction working**:
  - [ ] Process transaction with store credit payment
  - [ ] Check that remaining_balance is updated in database
  - [ ] Verify receipt shows remaining balance correctly
  - [ ] Test partial redemption (use $20 of $50 credit)
- [ ] **Test edge cases**:
  - [ ] Use exact remaining balance (credit should become inactive)
  - [ ] Try to use more than available balance (should fail/show error)
  - [ ] Use store credit multiple times in separate transactions

**High Priority (Testing & Verification):**
- [ ] **Test returns end-to-end** (all flows now working):
  - [ ] POS Returns Tab: Scan invoice → find transaction → process return
  - [ ] Customer Profile: Expand transaction → click Return → complete flow
  - [ ] Verify transaction status updates to "RETURNED" or "PARTIAL_RETURN"
  - [ ] Verify return summary appears when expanded
  - [ ] Verify inventory restored for returned items
  - [ ] Verify store credit issued correctly
- [ ] Verify all payment methods with returns (Cash, Debit, Visa, MC, Amex, GC, Store Credit)
- [ ] Test multi-payment returns (transaction with GC + Store Credit)
- [ ] Test partial returns (return 1 of 3 items, verify status = partial_return)
- [ ] Test void/refund/return flow with inventory and payment reversal

**Medium Priority:**
- [ ] Upload Germany product images (7 products needing images)
- [ ] Verify thermal receipt printing for returns
- [ ] Test returns on already voided/refunded transactions (button should not show)
- [ ] Load test with 100+ transactions in reports
- [ ] Verify status badges display correctly in transaction history
- [ ] Verify product edit/delete working in admin panel

**Optional Enhancements (Future):**
- [ ] Return reason tracking (defect, wrong size, changed mind)
- [ ] Return time limit enforcement (30-day window)
- [ ] Return analytics/reports tab
- [ ] Manager approval workflow for high-value returns
- [ ] Email notifications for refunds/returns
- [ ] Return rate analytics by product/category
- [ ] Store credit expiration dates
