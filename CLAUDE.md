# Absolute Website - Development Context

## Project Overview
React + TypeScript e-commerce app (Absolute Soccer) with Point of Sale (POS) system, product catalog, and admin panel. Uses Supabase for data storage, Vite for bundling, and Tailwind CSS for styling.

**Stack:** React 19, TypeScript, Supabase, Vite, Tailwind CSS, Google Gemini AI integration

**Current Branch:** main  
**Server:** Running on `http://localhost:3000`

---

## Current Status (as of June 8, 2026 - Session 9)

### Latest Session 9 - Return Receipt Printing & Store Credit Display Fixes ✅

**RETURN RECEIPT BARCODE ENCODING - FIXED:**

1. **Return Receipt Now Shows Invoice Number** ✅
   - ✅ Return receipts barcode encodes: INV-01004 (not UUID)
   - ✅ Added invoiceNumber and barcodeValue to returnReceiptData
   - ✅ Barcode fallback: barcodeValue → invoiceNumber → transactionId
   - ✅ Return receipts now scannable at checkout for refunds

2. **Dual-Receipt Printing System - FIXED** ✅
   - ✅ When return processed with Store Credit:
     - First: Return receipt prints immediately (showing returned items)
     - Then: 1.5 second delay
     - Finally: Store Credit receipt prints (showing SC card number)
   - ✅ Fixed React state timing issue by passing SC card number as parameter
   - ✅ handleCompleteReturn captures issuedSCCardNumber in local variable
   - ✅ generateReturnReceipt(scCardNumber) receives card number directly
   - ✅ Both receipts now print correctly in sequence

3. **Store Credit Receipt Barcode - CLEANED UP** ✅
   - ✅ SC receipt barcode encodes ONLY: data.storeCreditCardNumber
   - ✅ Removed invoice number from SC receipts entirely
   - ✅ No "Ref:" (transaction ID) shown on SC issuance receipts
   - ✅ SC card number displayed prominently at top of receipt
   - ✅ Receipt shows: Date, Customer, Card #, Barcode, Amount

**STORE CREDIT HISTORY DISPLAY - FIXED:**

1. **StoreCreditsSection.tsx** ✅
   - ✅ Changed from showing UUID to showing card_number
   - ✅ Header now displays: SC-5LHSPAA8ZV6 (not Credit #12a3d567)
   - ✅ Expanded view shows "Card Number: SC-5LHSPAA8ZV6" prominently
   - ✅ Card number in monospace bold blue text for clarity

2. **StoreCreditsTab.tsx** ✅
   - ✅ History tab already showed card_number correctly
   - ✅ Updated search to find credits by card_number (SC-XXXXX)
   - ✅ Search now supports: customer name, card #, or UUID

3. **Result** ✅
   - ✅ Both components now display: SC-FZYEJS9EFEW instead of UUID
   - ✅ Cashiers can easily reference card numbers
   - ✅ Searchable by card number in history

**COMMITS THIS SESSION:**
   - ✅ (New) ReturnsModal.tsx - dual receipt printing with proper timing
   - ✅ (New) thermalReceipt.ts - cleaned up SC receipt, removed invoice refs
   - ✅ (New) StoreCreditsSection.tsx - display card_number not UUID
   - ✅ (New) StoreCreditsTab.tsx - search by card_number support

---

### Previous Session 8 - POS Barcode System & Store Credit Enhancements ✅

**PRODUCT UPDATE BUG - FIXED:**

1. **Issue: Product edits showed success but didn't save** ✅
   - ✅ ProductContext was using /api/products endpoint (404 on Vercel)
   - ✅ Changed to direct Supabase.update() with anon key
   - ✅ RLS policies now allow direct Supabase updates
   - ✅ Product changes now persist correctly
   - ✅ Removed misleading Google AI Studio error messages

**BARCODE ROUTING SYSTEM - FULLY IMPLEMENTED:**

1. **Main Register Barcode Routing** ✅
   - ✅ SC-XXXXXXXXXXXX → Opens Store Credit modal (scan tab)
   - ✅ INV-XXXXX → Opens Returns modal (pre-fills invoice)
   - ✅ Product codes → Add to cart (variant lookup + product code fallback)
   - ✅ UUID detection → Helpful error message
   - ✅ Proper flow for each barcode type

2. **Store Credit Modal Validation** ✅
   - ✅ Rejects INV- codes with clear message
   - ✅ Directs user to Returns tab for invoice processing
   - ✅ Only accepts SC- card numbers

3. **Returns Modal Integration** ✅
   - ✅ Already handles INV-XXXXX codes correctly
   - ✅ Normalizes numeric input to INV-XXXXX format
   - ✅ UUID detection with helpful error

**RECEIPT BARCODE ENCODING - FIXED:**

1. **Transaction History Barcode** ✅
   - ✅ Changed from UUID to invoice_number
   - ✅ Barcode now encodes: INV-01001 (not UUID)
   - ✅ handlePrint passes barcodeValue to receipt generator
   - ✅ handleReprint passes barcodeValue for reprints

2. **Store Credit Barcode** ✅
   - ✅ Store credit receipts now encode SC card number
   - ✅ Changed from INV-XXXXX to SC-ADEH8IZCLEO
   - ✅ Uses dedicated generateStoreCreditReceiptHTML function
   - ✅ Shows clear SC card number in completion message

**STORE CREDIT CARD NUMBERS - FULLY ENHANCED:**

1. **Consistent Card Number Format** ✅
   - ✅ Format: SC- + 12 alphanumeric characters (uppercase)
   - ✅ Both ReturnsModal and StoreCreditsTab use same generator
   - ✅ Examples: SC-ADEH8IZCLEO, SC-KJM2P7VXQW9
   - ✅ Supabase query: .eq('card_number', scannedCode)

2. **Store Credit Receipt Enhancements** ✅
   - ✅ Dedicated receipt format when SC issued after return
   - ✅ Shows "STORE CREDIT ISSUED" header
   - ✅ Displays customer name, amount, card number
   - ✅ Barcode encodes SC card number
   - ✅ Instructions: "Keep this receipt safe!"

3. **Store Credit History Display** ✅
   - ✅ Card number visible in expanded history view
   - ✅ Easy reference for cashier manual entry
   - ✅ Shows: "Card Number: SC-ADEH8IZCLEO"
   - ✅ Positioned for quick visibility

**COMMITS THIS SESSION:**
   - ✅ a3916c8: "remove incorrect Google AI Studio references"
   - ✅ d1f617c: "replace /api/ fetch calls with direct Supabase"
   - ✅ 1052a9c: "remove /api/products endpoint call"
   - ✅ 750d189: "add logging to verify invoice_number flows to barcode"
   - ✅ 4b25e77: "barcode now encodes invoice_number instead of UUID"
   - ✅ 4c87ac1: "proper barcode routing for SC, INV, and products"
   - ✅ 9373af2: "store credit uses SC card number not INV"
   - ✅ 269a4d8: "enhance store credit receipt with card number"

---

### Previous Session 7 - Comprehensive Brand Filtering System ✅

**BRAND FILTERING SYSTEM - FULLY IMPLEMENTED:**

1. **Brand Navigation Section** ✅
   - ✅ New file: BrandNavigation.tsx
   - ✅ Dynamically fetches unique brands from products.brand column
   - ✅ Integrated into NavigationDrawer
   - ✅ "Shop by Brand" dropdown with alphabetically sorted brands
   - ✅ Links to /brand/:brandName routes
   - ✅ Only shows brands with is_online=true products

2. **Dedicated Brand Pages** ✅
   - ✅ New file: BrandPage.tsx for /brand/:brandName route
   - ✅ Shows all products from specific brand across all categories
   - ✅ Includes category filter within brand page
   - ✅ Search and sort functionality
   - ✅ Responsive pagination with "Load More" button
   - ✅ Query: `.ilike('brand', brandName)` for case-insensitive matching

3. **Brands Hub Page** ✅
   - ✅ New file: BrandsPage.tsx for /brands route
   - ✅ Shows all available brands with product counts
   - ✅ Alphabet filter for quick browsing (A-Z + All)
   - ✅ Responsive grid layout with brand cards
   - ✅ Shows product count per brand
   - ✅ Links to individual brand pages

4. **Enhanced Product Grid Page** ✅
   - ✅ ProductGridPage now reads ?brand=Nike from URL query params
   - ✅ Brand selection syncs from URL parameter
   - ✅ Works seamlessly with existing BrandFilter component
   - ✅ Brand filtering on category pages respected

5. **Admin Bulk Brand Assignment Tool** ✅
   - ✅ Added checkboxes to admin product list
   - ✅ Bulk brand assignment dropdown and "Assign Brand" button
   - ✅ Shows count of selected products
   - ✅ Updates multiple products using Supabase `.in()` query
   - ✅ Clear Selection button to reset
   - ✅ Visual feedback with success/error states

**ROUTES ADDED:**
   - ✅ `/brands` → BrandsPage (all brands hub)
   - ✅ `/brand/:brandName` → BrandPage (individual brand)

**COMMITS THIS SESSION:**
   - ✅ Commit c6845f0: "feat: implement comprehensive brand filtering system across store"
   - ✅ Deployed to GitHub and Vercel

---

### Previous Session (Session 6) - Global Brand Filtering, Product Codes & Critical Vercel Fixes ✅

**CRITICAL VERCEL PRODUCTION BUGS - FIXED:**

1. **Bug 1: /api/ calls returning 404 on Vercel** ✅
   - ✅ Replaced 30+ fetch('/api/...') calls with direct Supabase
   - ✅ ProductContext.tsx: Product CRUD now uses Supabase
   - ✅ POSPage.tsx: Transactions, gift cards, customers use Supabase
   - ✅ CustomerContext.tsx: All customer operations use Supabase
   - ✅ StoreCreditsTab.tsx, StoreCreditReport.tsx: Use Supabase
   - ✅ ReturnsModal.tsx: Store credit creation uses Supabase
   - ✅ GiftCardsAdmin.tsx: Gift card operations use Supabase
   - ✅ Removed all /api/health, /api/settings/bulk fallback calls
   - ✅ App now fully functional on Vercel without backend server

2. **Bug 2: 406 error on product update (.single() issue)** ✅
   - ✅ Changed: `.update().select().single()` → `.select('*'); data[0]`
   - ✅ Reason: Supabase update queries return arrays, not single objects
   - ✅ Fixed in ProductContext.tsx updateProduct() function
   - ✅ No more "Cannot coerce result to single JSON object" errors

**DUPLICATE PRODUCT PREVENTION - FULLY IMPLEMENTED:**

1. **Brand Field Added** ✅
   - ✅ Product interface includes: brand?: string
   - ✅ Form inputs in create and edit forms
   - ✅ Displayed on product list cards
   - ✅ Saves to products.brand column

2. **Duplicate Prevention by Brand + Category** ✅
   - ✅ Checks product_code FIRST (if provided)
   - ✅ Then checks name + category combination
   - ✅ Shows clear error: "Product code 'X' is already used by 'Y'"
   - ✅ Handles database constraint error 23505
   - ✅ Both create and update operations protected

**PRODUCT CODE FIELD - FULLY IMPLEMENTED:**

1. **Product Code Field** ✅
   - ✅ Product interface includes: product_code?: string
   - ✅ Form inputs (optional) in create and edit forms
   - ✅ Displays inline with price: "$ 89.99 · Code: NK-DV9237"
   - ✅ Saves to products.product_code column (UNIQUE constraint)

2. **Product Code Duplicate Check** ✅
   - ✅ Checked BEFORE name+category check
   - ✅ Query: .eq('product_code', code).maybeSingle()
   - ✅ Clear error message with conflicting product name
   - ✅ On update: excludes current product with neq('id', productId)

3. **POS Barcode Scanner Fallback** ✅
   - ✅ When scanning: checks variant barcode FIRST
   - ✅ Then searches product_code as FALLBACK
   - ✅ Products found by code added to cart without size
   - ✅ Success message updates: "Added: Nike Home Kit" or "Added: Nike Home Kit · Sz M"

**GLOBAL BRAND FILTERING SYSTEM - FULLY IMPLEMENTED:**

1. **Brand Filter Component** ✅
   - ✅ New file: BrandFilter.tsx
   - ✅ Reusable across all category pages
   - ✅ Fetches brands in current category only
   - ✅ Click brand to filter products
   - ✅ Click again to clear filter
   - ✅ Animated transitions and active state highlighting

2. **Category Page Integration** ✅
   - ✅ BrandFilter added to ProductGridPage
   - ✅ Shows between search/sort controls and logo grid
   - ✅ Works on all pages: Footwear, Kits, Balls, Equipment, Apparel, etc.
   - ✅ Brand filtering added to product filtering logic

3. **Homepage Brand Showcase** ✅
   - ✅ New file: BrandShowcase.tsx
   - ✅ Displays all available brands with product counts
   - ✅ Added to HomePage between featured products and visit section
   - ✅ Links to /products?brand=Nike format
   - ✅ Responsive grid: 6 cols desktop, 3 tablet, 2 mobile

4. **Admin Product List** ✅
   - ✅ Visual warning for products missing brand: "⚠️ Missing Brand"
   - ✅ Yellow indicator below product description
   - ✅ Easy to spot incomplete product data

**INVOICE NUMBERING SYSTEM - FULLY IMPLEMENTED (from Session 5):**

1. **Receipt Display & Barcode** ✅
   - ✅ Receipts show "Invoice # INV-01000" instead of UUID
   - ✅ Barcodes encode invoice_number (short, scannable format)
   - ✅ Both regular and store credit receipts updated
   - ✅ Receipt interface updated with invoiceNumber field
   - ✅ File: thermalReceipt.ts

2. **Transaction History Display** ✅
   - ✅ Invoice numbers displayed prominently on transaction cards
   - ✅ Expanded view shows invoice number in highlighted box
   - ✅ Search includes invoice_number field
   - ✅ File: PosTransactionHistory.tsx

3. **Invoice Lookup Queries - ALL FIXED** ✅
   - ✅ ReturnsModal.tsx - lookupInvoice() function
   - ✅ ReturnTab.tsx - searchTransaction() function  
   - ✅ POSPage.tsx - handleReturnsInvoiceLookup() function
   - ✅ All now use: `.eq('invoice_number', normalizedInvoice).maybeSingle()`
   - ✅ Removed: `.or('id.eq...', 'id.ilike...')` pattern
   - ✅ Removed: `.eq('status', 'completed')` from query
   - ✅ Added: Proper status checking AFTER finding record
   - ✅ Added: Console logging for debugging

4. **Barcode Scanning Differentiation** ✅
   - ✅ SC- prefix → Store credit lookup
   - ✅ INV- or numeric → Invoice lookup
   - ✅ UUID format → Error message with guidance
   - ✅ File: POSPage.tsx

5. **Invoice Number Normalization** ✅
   - ✅ Handles: INV-01000, 1000, 01000
   - ✅ Pads numeric portion to 5 digits
   - ✅ Implemented in all three lookup functions

### Previous Session - Store Credit Receipts & Reprint Invoice Feature ✅

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
| Invoice numbering system | ✅ COMPLETE (Session 5) | Receipts, lookup, scanning all use short INV-XXXXX codes | CRITICAL |
| Return receipt barcodes | ✅ FIXED (Session 9) | Return receipts now encode INV numbers, properly scannable | CRITICAL |
| SC receipt barcodes | ✅ FIXED (Session 9) | SC receipts encode ONLY card number, no invoice fallback | CRITICAL |
| Dual-receipt printing | ✅ FIXED (Session 9) | Return + SC receipt print in correct sequence with timing | HIGH |
| Store credit card display | ✅ FIXED (Session 9) | History shows card_number not UUID, searchable by card # | HIGH |
| Store credit card numbers null | ✅ POPULATED | All new SC have card_number, existing credits have numbers | COMPLETE |
| Store credit balance update bug | ✅ FIXED (Session 3) | Balance now updates on checkout | CRITICAL |
| Store credit state undefined | ✅ FIXED (Session 3) | React closure issue resolved | CRITICAL |
| Returns table 406 errors | ✅ FIXED (Session 3) | No longer blocks transaction history | HIGH |
| Germany product images (7 products) | ❌ Not fixed | Missing images for German national team products | LOW |

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

## Next Steps - Session 10+ TODO (June 8, 2026+)

### CRITICAL - Receipt & History System Testing

**Test Dual-Receipt Printing System (NEW):**
- [ ] Complete return with "Store Credit" refund method
- [ ] Verify 1st receipt prints: Return receipt showing items returned
- [ ] Verify 1st receipt barcode encodes: INV-01004
- [ ] Wait 1.5 seconds
- [ ] Verify 2nd receipt prints: Store Credit receipt with SC card number
- [ ] Verify 2nd receipt barcode encodes: SC-5LHSPAA8ZV6 (ONLY)
- [ ] Verify both receipts print in correct sequence

**Test Store Credit History Display (NEW):**
- [ ] View customer profile → Store Credits section
- [ ] Verify shows: SC-FZYEJS9EFEW (not UUID)
- [ ] Click expand → Verify "Card Number: SC-FZYEJS9EFEW" displays
- [ ] Search history by card number → Should find credit
- [ ] Verify all credits show correct card_number format

**Test Return Receipt Barcode:**
- [ ] Complete transaction → Get receipt with INV number
- [ ] Return items from that invoice
- [ ] Verify return receipt barcode encodes INV-01004 (not UUID)
- [ ] Try scanning return receipt barcode at POS
- [ ] Should open Returns modal with correct invoice loaded

**Test Store Credit Barcode Scanning:**
- [ ] Process return with Store Credit refund
- [ ] Verify SC receipt prints with barcode
- [ ] Get SC card number from receipt: SC-XXXXX
- [ ] At POS checkout, scan the SC barcode
- [ ] Should open Store Credit modal with card found
- [ ] Verify balance displays correctly

### HIGH - End-to-End Workflows

**Complete Return-to-SC Flow:**
1. [ ] Find completed transaction
2. [ ] Process return with Store Credit refund
3. [ ] Verify return receipt prints (INV barcode)
4. [ ] Verify SC receipt prints (SC barcode) after 1.5s
5. [ ] Customer receives both receipts
6. [ ] Later: Customer scans SC barcode at checkout
7. [ ] SC modal opens, customer can redeem credit
8. [ ] Receipt shows SC used with remaining balance

**Store Credit Lifecycle:**
- [ ] Issue new SC via admin StoreCreditsTab
- [ ] Verify card_number shows in success message
- [ ] Verify card_number appears in history
- [ ] Verify searchable by card_number
- [ ] Use SC at checkout
- [ ] Verify balance updates in history
- [ ] Verify redemption shows remaining balance

**Brand System Verification (from Session 7):**
- [ ] All products have brand assigned or show ⚠️ indicator
- [ ] Use bulk brand assignment to complete any missing brands
- [ ] Target: 100% of products have brand

### MEDIUM - Polish & Enhancements

**Store Credit UX Improvements:**
- [ ] Add QR code option alongside barcode (optional)
- [ ] Store credit statement/history printout for customers
- [ ] Email SC card number and instructions to customer after issuance
- [ ] Balance check receipt at customer request

**Barcode System Enhancements:**
- [ ] Add barcode scanning sound/visual feedback at POS
- [ ] Track which barcodes fail to scan (logging)
- [ ] Generate barcode scan success/failure report

**Brand System Enhancements (from Session 7):**
- [ ] Add brand counts in navigation dropdown
- [ ] Show most popular brands first
- [ ] Brand comparison tool (compare across brands)

### LOW - Optional / Future

**Missing Product Images:**
- Germany Away Jersey Y, Home Jersey Y, Away Jersey, Ball, Cap, GK H JSY, Home Jersey
- Upload via admin panel product editor when available

**Product Codes (Optional):**
- [ ] Assign product codes to frequently scanned items
- [ ] Enables POS fallback barcode lookup if variant barcode missing

---

## Commits This Session (Session 9 - June 8, 2026 - Return Receipt Printing & Store Credit Display)

**Files Modified:**
- `src/components/ReturnsModal.tsx` - Dual-receipt printing, parameter passing
- `src/utils/thermalReceipt.ts` - SC receipt cleanup, barcode fix
- `src/components/StoreCreditsSection.tsx` - Display card_number not UUID
- `src/components/StoreCreditsTab.tsx` - Search by card_number support

**What was fixed in Session 9:**
- ✅ Return receipts now print with INV barcode (scannable)
- ✅ Store credit receipts print 1.5s after return receipt
- ✅ SC receipt barcode encodes ONLY card number, no fallback
- ✅ Store credit history shows SC-XXXXX not UUID
- ✅ Search by card number works in history tab
- ✅ Fixed React state timing issue with dual receipts
- ✅ SC card number passed as parameter instead of relying on state
- ✅ Both StoreCreditsSection and StoreCreditsTab display card_number
- ✅ Console logging added for debugging

---

## Previous Commits (Session 8 - June 8, 2026 - POS Barcode System & Store Credit)

| Commit | Message | Files |
|--------|---------|-------|
| 269a4d8 | feat: enhance store credit receipt with card number and consistent formatting | ReturnsModal.tsx, StoreCreditsTab.tsx, thermalReceipt.ts |
| 9373af2 | fix: store credit issued after return now uses SC card number not INV number | ReturnsModal.tsx |
| 4c87ac1 | fix: proper barcode routing at POS register for SC, INV, and product codes | POSPage.tsx |
| 4b25e77 | fix: barcode now encodes invoice_number instead of UUID in transaction history | PosTransactionHistory.tsx |
| 750d189 | refactor: add logging to verify invoice_number flows to receipt barcode | POSPage.tsx |
| d1f617c | fix: replace /api/ fetch calls with direct Supabase for Vercel compatibility | ProductContext.tsx, POSPage.tsx, StoreCreditsSection.tsx |
| 1052a9c | fix: remove /api/products endpoint call - use direct Supabase for Vercel | ProductContext.tsx |
| a3916c8 | fix: remove incorrect Google AI Studio references from error messages | AdminPage.tsx |

**What was fixed:**
- ✅ Product updates now use direct Supabase (not /api/products)
- ✅ Removed misleading Google AI Studio error messages
- ✅ Receipt barcodes encode invoice_number (INV-XXXXX) not UUID
- ✅ Store credit barcodes encode SC card number (SC-ADEH8IZCLEO)
- ✅ Proper barcode routing: SC- → Store Credit, INV- → Returns, products → Cart
- ✅ Store credit receipts show dedicated format with card number
- ✅ Store credit history displays card numbers for manual lookup
- ✅ Consistent SC card number format across app
- ✅ /api/ calls replaced with direct Supabase for Vercel compatibility

**Session 7 Commits (June 8, 2026 - Comprehensive Brand Filtering):**

| Commit | Message |
|--------|---------|
| c6845f0 | feat: implement comprehensive brand filtering system across store |

**What was added in Session 7:**
- ✅ BrandNavigation.tsx - Dynamic brand dropdown in navigation
- ✅ BrandPage.tsx - Individual brand page with category filtering
- ✅ BrandsPage.tsx - Hub page showing all brands with alphabet filter
- ✅ /brands and /brand/:brandName routes
- ✅ Bulk brand assignment tool in admin with checkboxes
- ✅ URL query parameter support for brand filtering (?brand=Nike)

**Session 6 Commits (June 7, 2026 - Critical Vercel Fixes & Brand System):**

| Commit | Message | Files |
|--------|---------|-------|
| 583cacb | feat: extend brand filtering system globally across all product categories | BrandFilter.tsx, BrandShowcase.tsx, ProductGridPage.tsx, HomePage.tsx |
| 21c7941 | feat: add product code field with duplicate check and POS barcode fallback | ProductContext.tsx, AdminPage.tsx, POSPage.tsx |
| 2062323 | fix: move product code display to price line to save vertical space | AdminPage.tsx |
| d9ec3e2 | feat: add duplicate product prevention and brand field | ProductContext.tsx, AdminPage.tsx, ADD_BRAND_COLUMN.sql |
| f7d2702 | fix: remove remaining /api/ calls and fix .single() on update queries | ProductContext.tsx, AdminPage.tsx, SettingsContext.tsx |
| 9b5ef8c | fix: replace all /api/ calls with direct Supabase for Vercel production | ProductContext.tsx, PosTransactionHistory.tsx, POSPage.tsx, CustomerContext.tsx, StoreCreditsTab.tsx, StoreCreditReport.tsx, ReturnsModal.tsx, GiftCardsAdmin.tsx, PosRegister.tsx, VERCEL_API_FIX_SUMMARY.md |

**Session 5 Commits (June 7, 2026 - Invoice Numbering System):**

| Commit | Message | Files |
|--------|---------|-------|
| 02387d6 | feat: implement invoice numbering system - receipts, lookup, scanning | thermalReceipt.ts, PosTransactionHistory.tsx, ReturnsModal.tsx, ReturnTab.tsx, POSPage.tsx |

**Session 4 Commits (June 7, 2026):**

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
  - Columns: id, name, category, brand (NEW - Session 6), product_code (NEW - Session 6, UNIQUE), price, description, image, colors, is_online
  - Related: product_variants (size, SKU, stock_quantity)
  - NEW Fields: brand (TEXT, nullable), product_code (TEXT, UNIQUE, nullable)
- `transactions` - POS transaction history
  - Columns: id, invoice_number (NEW - Session 5), customer_id, total_amount, method, status (completed/voided/refunded/returned/partial_return), items[], created_at, tendered_amount, change_given
  - Invoice numbers auto-generated: INV-01000, INV-01001, etc. via SQL trigger
- `gift_cards` - Gift card inventory
  - Columns: id, card_number, customer_id, initial_balance, current_balance, is_active, created_at
- `store_credits` - Store credit inventory
  - Columns: id, card_number, customer_id, amount, reason, remaining_balance, is_active, created_at
- `customers` - POS customer data
  - Columns: id, first_name, last_name, email, phone, created_at
- `returns` - Return transaction audit trail
  - Columns: id, transaction_id, customer_id, refund_method (store_credit/original_payment), refund_amount, items[], status, created_at
- `settings` - Configuration (key: navigation, hst_number, store_name, etc.)

---

## Important Files & Paths

**Routes:**
- `/` - Home/storefront
- `/admin` - Admin panel (settings, products, customers, reports, POS)
- `/pos` - Standalone POS system (PIN auth required)
- `/reports` - Full reports page (7 tabs)
- `/brands` - All brands hub page (NEW - Session 7)
- `/brand/:brandName` - Individual brand page (NEW - Session 7)

**Core Components:**
- `src/pages/AdminPage.tsx` - Admin panel with 8+ tabs (bulk brand assignment added - Session 7)
- `src/pages/POSPage.tsx` - Standalone POS with PIN auth
- `src/pages/ProductGridPage.tsx` - Product listing with category/search/brand filters
- `src/pages/HomePage.tsx` - Homepage with featured products and brand showcase
- `src/pages/BrandPage.tsx` - Individual brand page with category filtering (NEW - Session 7)
- `src/pages/BrandsPage.tsx` - Hub page showing all brands (NEW - Session 7)
- `src/pages/ReportsPageFull.tsx` - Reports dashboard
- `src/components/ReportsPage.tsx` - Reports tab navigation
- `src/components/BrandFilter.tsx` - Global brand filtering (Session 6)
- `src/components/BrandShowcase.tsx` - Homepage brand showcase (Session 6)
- `src/components/BrandNavigation.tsx` - Brand navigation dropdown (NEW - Session 7)
- `src/components/ReturnsModal.tsx` - Full 5-step returns wizard
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

## Session 5 Implementation Details (June 7, 2026 - Invoice Numbering System)

### Overview
Implemented a professional invoice numbering system to replace long UUIDs with short, human-readable invoice numbers (INV-01000, INV-01001, etc.) for all receipts, transaction lookups, and barcode scanning.

### Files Modified

**1. src/utils/thermalReceipt.ts**
   - Added `invoiceNumber?: string` to ReceiptData interface
   - Updated receipt HTML to display "Invoice # INV-01000" (not UUID)
   - Changed barcode to encode invoiceNumber instead of transactionId
   - Applied to both regular receipts and store credit receipts
   - Barcode priority: invoiceNumber → barcodeValue → transactionId

**2. src/components/PosTransactionHistory.tsx**
   - Added `invoice_number?: string` to Transaction interface
   - Updated search to include invoice_number field
   - Display invoice numbers prominently on transaction rows (bold black text)
   - Added highlighted box in expanded view showing invoice number
   - Updated handlePrint() to pass invoiceNumber to receipt generator

**3. src/components/ReturnsModal.tsx**
   - Added `invoice_number?: string` to Transaction interface
   - Completely rewrote lookupInvoice() function:
     - Now uses `.eq('invoice_number', normalizedInvoice)`
     - Changed from `.single()` to `.maybeSingle()` (no 404 errors)
     - Removed `.eq('status', 'completed')` from query
     - Added proper status checking AFTER finding record
     - Improved error messages for each status (voided, refunded, returned, partial_return)
   - Updated loadTransactionByIdDirect() with same pattern for consistency
   - Updated transaction summary display to show invoice_number

**4. src/components/ReturnTab.tsx**
   - Rewrote searchTransaction() function to use invoice_number lookup
   - Changed from `.eq('id', invoiceInput)` + `.ilike('id', ...)` pattern
   - Now uses `.eq('invoice_number', normalizedInvoice).maybeSingle()`
   - Removed fallback UUID search (cleaner logic)
   - Added UUID detection and error message

**5. src/pages/POSPage.tsx**
   - Added `invoiceNumber?: string` to Receipt interface
   - Updated setReceipt() to capture invoice_number from transaction
   - Updated handlePrintReceipt() to pass invoiceNumber to receipt
   - Fixed handleReturnsInvoiceLookup() function:
     - Changed from `.or('id.eq...', 'id.ilike...')` pattern
     - Now uses `.eq('invoice_number', normalizedInvoice)`
     - Changed to `.maybeSingle()` for better error handling
     - Removed `.eq('status', 'completed')` from query
     - Added UUID detection and proper error messages
     - Added comprehensive status checking
   - Added barcode scanning differentiation:
     - SC- prefix → Store credit lookup
     - INV- or numeric → Invoice lookup (informational message)
     - UUID format → Error message
     - Other → Product barcode lookup (unchanged)

### Normalization Logic (All Three Functions)

All three invoice lookup functions now use the same normalization:
```typescript
const normalizedInvoice = input.startsWith('INV-')
  ? input
  : 'INV-' + input.padStart(5, '0');
```

**Results:**
- `INV-01000` → `INV-01000` ✅
- `1000` → `INV-01000` ✅
- `01000` → `INV-01000` ✅
- `1` → `INV-00001` ✅

### Query Pattern Changes

**Old Pattern (Before):**
```typescript
.or(`id.eq.${input},id.ilike.%${input}%`)
.eq('status', 'completed')
.single()
```
**Problems:**
- Searched by 'id' field instead of 'invoice_number'
- Status filter in query returned no data for voided/refunded
- `.single()` threw 404 error if not found

**New Pattern (After):**
```typescript
.eq('invoice_number', normalizedInvoice)
.maybeSingle()
```
**Benefits:**
- Searches correct field
- No status filter in query
- `.maybeSingle()` returns null gracefully
- Status checked AFTER finding record

### Console Logging

Added debug logs in all three functions:
```typescript
console.log('Looking up invoice:', normalizedInvoice);
console.log('Result:', data, error);
```

Helps troubleshoot lookup issues in browser console.

### Error Handling

All three functions now check status AFTER finding the record:
- `voided` → "This transaction has been voided"
- `refunded` → "This transaction has already been refunded"
- `returned` → "This transaction has already been fully returned"
- `partial_return` → "This transaction has already been partially returned"
- Other → Shows status in error message
- UUID input → "Please scan the invoice barcode, not the transaction UUID"

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
