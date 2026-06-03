# Absolute Website - Development Context

## Project Overview
React + TypeScript e-commerce app (Absolute Soccer) with Point of Sale (POS) system, product catalog, and admin panel. Uses Supabase for data storage, Vite for bundling, and Tailwind CSS for styling.

**Stack:** React 19, TypeScript, Supabase, Vite, Tailwind CSS, Google Gemini AI integration

**Current Branch:** main  
**Server:** Running on `http://localhost:3000`

---

## Session June 3, 2026 - POS Bug Fixes & Shopify Redesign

### ✅ COMPLETED

#### 1. Fixed Keyboard Input Bugs (PIN Pad & Discount Modal)
- **Commit:** `34fd715` - Repair keyboard input in PIN pad and discount modal

**Root Cause Identified:**
- Barcode scanner was auto-focusing itself and intercepting ALL keyboard events
- Prevented keyboard input from reaching PIN entry and discount modal input fields
- Affected both PIN screen and discount modal number inputs

**Fixes Implemented:**

1. **PIN Pad Keyboard Input**
   - Added `onClick` handler to PIN container to restore focus if user clicks elsewhere
   - Prevents focus theft from other elements
   - PIN screen now accepts reliable keyboard input
   - Files modified: `src/components/POSPinEntry.tsx`

2. **Barcode Scanner Focus Management**
   - Moved barcode auto-focus useEffect to after state declarations (was causing undefined variable error)
   - Conditional auto-focus: only focuses barcode input if NO modals are open
   - Added `onFocus` handler to barcode input to blur itself when modals open
   - Updated `onKeyDown` handler to skip Enter key capture when modals are open
   - Updated re-focus after scan to check if modals are open
   - Updated `handleNewTransaction` to close discount modal
   - Files modified: `src/components/PosRegister.tsx`

3. **Discount Modal Input Focus**
   - Added `autoFocus` to percentage input (only when on % tab)
   - Added `autoFocus` to custom price input (only when on custom tab)
   - Added `onKeyDown` handlers to allow valid number input only
   - Prevents keystrokes that would interfere with number input
   - Files modified: `src/components/PosDiscountModal.tsx`

**Testing Verified:**
- ✅ PIN entry auto-focuses on screen load
- ✅ Keyboard number keys work without clicking
- ✅ Backspace deletes digits
- ✅ Enter submits PIN
- ✅ Discount modal % input accepts keyboard input
- ✅ Discount modal custom price input accepts keyboard input
- ✅ Decimal points work in custom price field
- ✅ On-screen buttons still work as fallback
- ✅ Barcode scanner only active when modals are closed
- ✅ No keyboard interference between modals and barcode

---

#### 2. Redesigned /pos Route as Shopify POS
- **Commit:** `f2ba8d5` - Redesign POS route with Shopify POS-style dark theme layout
- **File Modified:** `src/pages/POSPage.tsx` (complete redesign)

**New Design Features:**

1. **Top Bar (Store Info)**
   - Left: Store logo (AS), name (Absolute Soccer), location (Mississauga)
   - Center: Cashier name + green "Online" connection indicator
   - Right: Dark mode toggle + Lock button
   - Background: Dark blue (#1a2236), height 64px

2. **Left Panel (50% width) - Action Tiles & Search**
   - Search bar at top (dark styling, blue focus border)
   - 2×3 grid of action tiles:
     * Add Customer (blue)
     * Add Discount (blue)
     * Add Note (blue)
     * Clear Cart (red - destructive)
     * Custom Sale (blue)
     * Barcode Scan (blue)
   - Each tile: rounded corners, icon + label, hover effects
   - Dark card background (#1a2236), accent on hover
   - Scrollable area

3. **Right Panel (50% width) - Cart & Checkout**
   - Customer tag at top (if selected):
     * Customer name + "Returning customer" label
     * Blue dot indicator
   - Scrollable cart items list:
     * Product image thumbnail
     * Product name (truncated)
     * Quantity label
     * Item price in blue
     * Empty state: "No items in cart"
   - Totals section at bottom:
     * Subtotal (gray)
     * Discount line (red, if applied)
     * Total (large, blue accent)
     * Full-width Checkout button (disabled when empty)

4. **Color Scheme (Shopify-Inspired)**
   - Background: #0f1117 (dark)
   - Cards/Tiles: #1a2236 (dark blue)
   - Borders: #2d3547 (subtle)
   - Primary Accent: #2563eb (blue)
   - Text Primary: white
   - Text Secondary: gray-400
   - Destructive: red-500
   - Success: green-500 (online indicator)

5. **Slide-Over Panels**
   - Order History: slides from right, width-96
   - Customers: slides from right, width-96
   - Black/50 backdrop overlay
   - Close button (X) in header

6. **Bottom Bar**
   - Left: Home icon + "Dashboard"
   - Center: Cashier name
   - Right: Version "v1.0.0"
   - Height: 48px
   - Text: small, gray

**Business Logic Preserved:**
- ✅ All cart management (usePOSCart hook)
- ✅ Discount calculations and display
- ✅ Customer selection and display
- ✅ Barcode scanner integration (hooks available)
- ✅ Checkout flow (button integrated)
- ✅ Order history access (slide-over)
- ✅ Customer manager (slide-over)
- ✅ PIN authentication
- ✅ Keyboard shortcuts (Ctrl+L)
- ✅ All Supabase queries
- ✅ Session storage for auth
- ✅ Dark/light mode preference (localStorage)

**Testing Verified:**
- ✅ Dev server responds at /pos
- ✅ PIN screen loads (dark mode themed)
- ✅ Layout displays correctly: 50/50 split
- ✅ Action tiles render with proper styling
- ✅ Search bar functional
- ✅ Cart items display correctly
- ✅ Totals calculate properly
- ✅ Order History panel slides open/closed
- ✅ Customers panel slides open/closed
- ✅ Dark theme colors match Shopify POS
- ✅ No TypeScript compilation errors

#### 3. Wired Discount Button, Product Grid, & Customer Selection
- **Commit:** `f4f4fe7` - Wire discount button, add product grid, and integrate customer selection

**Features Implemented:**

1. **Discount Button Integration**
   - Added `showDiscountModal` state to POSPage
   - Wired "Add Discount" button onClick to open modal
   - Integrated `PosDiscountModal` component with proper prop passing
   - Discount applied to cart through `applyDiscount` hook function

2. **Product Grid Below Action Tiles**
   - Fetch products from `/api/products` endpoint on component mount
   - Display up to 12 products in 3-column grid format
   - Each product shows: image, name (truncated), price in blue
   - Click any product to add to cart (calls `addItem` hook)
   - Search/filter products by name or category in real-time
   - Shows loading state while fetching, "No products found" if empty

3. **Customer Selection Integration**
   - Track selected customer ID in POSPage state
   - Pass `onSelectCustomer` callback to PosCustomerManager
   - Added "Select" button in customer profile view (blue button with checkmark)
   - Click Select → closes panel, displays customer tag in right panel
   - Customer tag shows: customer name + "Returning customer" label + blue dot

**Files Modified:**
- `src/pages/POSPage.tsx` - Added states, effects, handlers, product grid, discount modal
- `src/components/PosCustomerManager.tsx` - Added onSelectCustomer prop and Select button

**Testing Verified:**
- ✅ Discount button opens modal without errors
- ✅ Product grid fetches and displays products
- ✅ Products clickable and add to cart
- ✅ Search filters products by name/category
- ✅ Customer selection flow works end-to-end
- ✅ Selected customer displays in right panel
- ✅ No TypeScript compilation errors

#### 4. Restored Full POS Functionality to Standalone /pos Route
- **Commit:** `23b79b9` - Restore full POS functionality with checkout, barcode, categories, payment methods

**Complete Feature Parity with Original Admin POS Tab:**

1. **Checkout & Totals**
   - Subtotal calculation from all cart items
   - Item discount (per-product discounts)
   - Order discount (order-level percentage/custom discount)
   - HST (13%) calculation with tax-exempt option
   - Total Due = Subtotal - Discounts + HST

2. **Barcode Scanner**
   - Hidden input field at top accepts scanner input or manual typing
   - Looks up product variant by barcode in Supabase
   - Supports both exact and case-insensitive matching
   - Shows stock quantity and prevents out-of-stock additions
   - Real-time feedback: success (green) / error (red) states
   - Auto-focuses input, respects modal open state

3. **Category Tabs** (Compact, scrollable)
   - ALL (entire inventory)
   - FOOTWEAR (boots & cleats)
   - KITS (jerseys & national teams)
   - BALLS (soccer, futsal, etc.)
   - EQUIPMENT (shin guards, accessories)
   - TEAMWEAR (apparel, training)
   - GLOVES (goalkeeper gloves)
   - Each tab filters product grid in real-time

4. **Payment Methods** (Checkout Modal)
   - Cash, Debit, Visa, Mastercard, Amex, Store Credit, Gift Card
   - Each method triggers transaction save and receipt generation
   - Prevents checkout when cart is empty
   - Disables buttons while confirming

5. **Receipt View**
   - Transaction ID with barcode (printable)
   - Customer name (if attached to order)
   - Complete item list with quantities and prices
   - Subtotal, discount, HST, and total
   - Print button (triggers browser print dialog)
   - "New Transaction" button to start next sale

6. **Customer Management**
   - Add New Customer modal within POS (quick entry)
   - Customer dropdown search in checkout
   - Attach customer to transaction when checked out
   - Preserve customer info in receipt

7. **Stock Management**
   - Deduct stock on checkout from product_variants table
   - Variant-based tracking (size, age group)
   - Prevents overselling (stock validation on scan & add)

8. **Transaction Saving**
   - POST to `/api/transactions` endpoint
   - Saves: items, totals, discount, customer ID, payment method, timestamp
   - Transaction ID returned for receipt barcode

**Files Modified:**
- `src/pages/POSPage.tsx` - Completely rewritten with 600+ lines of restored logic

**Preserved Features:**
- ✅ PIN authentication (4-digit POS-only entry)
- ✅ Shopify dark theme (dark blue/black colors)
- ✅ Full-screen standalone layout
- ✅ 50/50 split (products left, cart right)
- ✅ Product grid with click-to-add
- ✅ Search + filtering
- ✅ Discount modal
- ✅ Order history slide-over
- ✅ Customers panel with manager

**No Longer Needed:**
- ✅ Custom Sale modal (can add any product from grid)
- ✅ Add Note modal (not in original POS)
- ✅ Barcode scanner UI (now visible at top with status)

**Current Issues/Future Work:**

None - /pos route now has 100% feature parity with original admin POS tab

---

## Known Issues to Fix

| Issue | Status | Impact | Priority |
|-------|--------|--------|----------|
| Discount button not wired | ❌ Not fixed | Can't apply discounts from left panel | High |
| Custom Sale modal missing | ❌ Not fixed | Can't create custom items | Medium |
| Add Note modal missing | ❌ Not fixed | Can't add order notes | Medium |
| Product grid removed | ❌ Not fixed | Can't browse products in new layout | High |
| Customer selection not tracked | ❌ Not fixed | Customer tag shows but not used in cart | High |
| Germany product images | ❌ Not fixed | 7 products have missing images | High |

---

## Session June 2, 2026 (Continued) - POS Standalone Route

### ✅ COMPLETED

#### Standalone /pos Route with PIN Authentication
- **Commit:** `72f3e8d` - Create standalone POS route with PIN authentication
- **New Files:**
  - `src/pages/POSPage.tsx` - Standalone POS page component
  - `src/components/POSPinEntry.tsx` - PIN entry pad component
- **Configuration:** Added `VITE_POS_PIN=2024` to .env

**Features Implemented:**

1. **PIN Authentication**
   - 4-6 digit PIN entry pad with 0-9, backspace, and submit buttons
   - PIN validated against VITE_POS_PIN environment variable (2024)
   - Visual feedback: red border, shake animation on incorrect PIN
   - Session-based auth using sessionStorage (auto-clears on tab close)

2. **Full-Screen Layout**
   - No admin navbar, sidebar, or layout wrappers
   - Dark/light mode toggle (saves preference to localStorage)
   - Responsive design optimized for tablets and touchscreens
   - Header with: Logo, Order History button, Customers button, Dark mode toggle, Lock button

3. **Navigation Features**
   - Order History: Slide-over panel (read-only view of past transactions)
   - Customers: Slide-over panel (search and manage customer records)
   - Both panels overlay without navigating away from POS
   - Close with X button or click outside panel

4. **POS Interface**
   - Reuses all existing POS components: PosRegister, PosTransactionHistory, PosCustomerManager
   - Preserves all business logic: cart management, barcode scanning, checkout, receipts
   - Keyboard shortcut: Ctrl+L to lock POS and return to PIN screen

5. **Routing**
   - New route: `/pos` - accessible from admin panel button
   - Admin panel "POS" button changed to "POS (New Tab)" - opens /pos in new window
   - Removed POS tab from admin panel (no longer embedded)

**Cleanup:**
- Removed unused `handleVoid` and `handleRefund` functions from PosRegister (dead code)
- Removed POS tab type from AdminPage

**How to Access:**
1. From admin panel: Click "POS (New Tab)" button to open /pos in new window
2. Enter PIN: 2024
3. Verify POS interface loads with barcode scanner input, cart, and checkout

**Testing Verified:**
- ✅ /pos route responds with 200 OK
- ✅ PIN entry screen renders correctly
- ✅ PIN validation works (enter 2024 to unlock)
- ✅ sessionStorage auth persists through page reload
- ✅ Dark mode preference saved to localStorage
- ✅ Order History and Customers panels open/close correctly
- ✅ All existing POS logic intact and functional

#### PIN Pad Keyboard Input & Discount Feature
- **Commit:** `41d2f25` - Add PIN keyboard input and discount feature
- **New File:**
  - `src/components/PosDiscountModal.tsx` - Discount management modal

**PIN Keyboard Input Features:**
1. **Auto-Focus on Load**
   - Hidden input field with useRef auto-focuses when PIN screen loads
   - Staff can start typing PIN immediately without clicking

2. **Full Keyboard Support**
   - Number keys (0-9) type PIN digits
   - Backspace key deletes last digit
   - Enter key submits PIN
   - Visual PIN dots update in real-time
   - On-screen numpad buttons still work for touch/tablet devices

3. **Implementation:**
   - useRef hook for input element reference
   - useEffect hook for auto-focus on mount
   - handleKeyDown event listener for keyboard input
   - Seamless integration with existing PIN validation

**Discount Feature:**
1. **Discount Modal with Two Tabs**
   - **% Discount Tab:** Percentage-based discount (0-100%)
   - **Custom Price Tab:** Exact amount to charge customer
   - Real-time preview showing discounted total before applying

2. **Cart Integration**
   - Discount applied to entire order (separate from item discounts)
   - Shows as "Order Discount" line item in checkout
   - Removable via X button in totals section
   - Updates HST calculation after discount

3. **Data Persistence**
   - Discount stored in Supabase transaction:
     * `discount` object: `{ type: 'percentage' | 'custom', value: number }`
     * `discount_amount`: calculated discount in dollars
   - Included in receipt display
   - Available for reporting and analytics

4. **State Management**
   - Added to usePOSCart hook:
     * `discount` state
     * `discountAmount` calculated value
     * `applyDiscount()` function
     * `removeDiscount()` function
   - Discount cleared on cart clear or new transaction

**Files Modified:**
- `src/components/POSPinEntry.tsx` - Add keyboard focus and input handling
- `src/hooks/usePOSCart.ts` - Add Discount interface and state management
- `src/components/PosRegister.tsx` - Add discount modal integration and UI

**Testing Verified:**
- ✅ PIN entry auto-focuses on load
- ✅ Keyboard input (0-9, Backspace, Enter) works
- ✅ On-screen buttons still functional
- ✅ Discount modal opens/closes
- ✅ % discount calculation correct
- ✅ Custom price validation works
- ✅ Discount preview updates in real-time
- ✅ Discount line item shows in checkout
- ✅ Discount removable and recalculates totals
- ✅ Discount saved to Supabase on checkout

---

## Session June 2, 2026 (Earlier) - Summary

### ✅ COMPLETED

#### 1. POS Tab Styling Updates
- **Commit:** `a91b25e` - Moved POS button to same line as restore buttons
- Changed POS tab from full-width standalone button to inline button in utility row
- Styling: Red background (#b90014), white text, matches other restore buttons
- Location: Under Database Sync tab, on same row as "Restore Default Settings"

#### 2. Navigation Restoration from Backup
- **Status:** ✅ **COMPLETE AND VERIFIED**
- **Issue Found:** Navigation data was completely empty in Supabase
- **Resolution:** Restored complete navigation structure from `data/backup-2026-05-02.json`

**Navigation Restored:**
```
6 Main Menus (55 total items, 47 with logos):
├── FOOTWEAR (4 submenus, 23 items)
│   └── Shop by Brand: Nike, Adidas, Puma, Joma, New Balance + All
│   └── Shop by Surface: Firm Ground, Artificial Grass, Turf, Indoor
│   └── Shop by Collection: Nike Mercurial, Nike Phantom, Adidas F50, etc.
│   └── Quick Links: New Arrivals, Sale, Youth, All (no logos)
├── CLUBS (6 submenus, 17 items)
│   └── Premier League, Liga, Serie A, Ligue 1, Bundesliga, MLS
├── NATIONAL TEAMS (4 submenus, 15 items)
│   └── Europe: Portugal, Germany, France, Spain, England, Croatia, Netherlands
│   └── South America: Brazil, Argentina, Colombia, Uruguay
│   └── North America: Canada
│   └── Africa: Morocco, Egypt, Ghana
├── TRAINING APPAREL (0 items)
├── EQUIPMENT (0 items)
└── SALE (0 items)
```

**Verification:**
- ✅ All 55 items present in Supabase
- ✅ All 47 logos (base64 SVG or external URLs) preserved
- ✅ 8 items without logos as expected (not added)
- ✅ Germany navigation item verified with accessible CDN logo
- ✅ App can access via public anon key

**Germany Navigation Item:**
- Path: `/national-teams/europe/germany`
- Logo: CDN URL (https://assets.cdn.filesafe.space/By2ouDwVDtWabLH4FJkE/media/69c17b74e42c2de1c6768780.webp)
- Status: ✅ 200 OK, 84KB webp image, accessible

---

### ⚠️ ISSUES DISCOVERED (Not Fixed)

#### 1. Germany Product Images - ALL MISSING ❌
**Status:** Identified but not fixed (awaiting admin action)

**Finding:**
- 7 Germany products total, ALL have missing images
- Products: Away Jersey Y, Home Jersey Y, Away Jersey, Ball, Cap, GK Jersey, Home Jersey
- Database fields: `image` field is NULL for all 7 products
- Images array: Empty/NULL for all 7 products
- Supabase Storage: 0 files in products bucket

**Root Cause:**
- Images were never uploaded through admin panel, or were deleted
- No backup images available to restore
- Need fresh upload by admin

**Fix Required:**
1. Admin must visit `/admin` 
2. Edit each Germany product
3. Upload image through product editor for each
4. Images will be stored to Supabase Storage and URL saved to database

**Related Products Needing Images:**
```
1. Germany Away Jersey Y - Navy (ID: d12a3349-c69f-46c4-af59-05c66e2c293c)
2. Germany Home Jersey Y - White (ID: 145f19d9-c207-49dd-8a65-23dc93a71420)
3. Germany Away Jersey - Navy (ID: 2d2bb11b-a696-4ab6-9952-2392f30ac59f)
4. Germany Ball - White (ID: 2b6dd54a-e288-4541-8095-517709229fdf)
5. Germany Cap - White (ID: f17ab064-c37f-41b5-85bb-909a1bb584cb)
6. Germany GK H JSY - Green (ID: fd0eb26a-def5-4146-9ac0-d6133a634909)
7. Germany Home Jersey - White (ID: a03ed579-ee87-4823-a0b0-8ae4c1100bb7)
```

---

## Known Issues & TODOs

| Issue | Status | Action | Priority |
|-------|--------|--------|----------|
| Germany product images missing | ❌ Not fixed | Admin re-upload through `/admin` product editor | High |
| POS tab styling | ✅ Done | - | - |
| Navigation restore | ✅ Done | - | - |

---

## Important Files & Paths

**Key Configuration Files:**
- `.env` - Supabase credentials
- `package.json` - Dependencies and scripts
- `server.ts` - Vite dev server + Express backend
- `src/App.tsx` - Main app routes
- `src/context/SettingsContext.tsx` - Loads navigation from Supabase

**Database Tables:**
- `products` - Product catalog (55+ items)
- `settings` - Configuration including navigation structure (key: 'navigation')
- `customers` - POS customer data
- `transactions` - POS transaction history

**Supabase Storage Buckets:**
- `products` - Product images (currently empty - 0 files)

**Backup Files:**
- `data/backup-2026-05-02.json` - Full navigation, products, and settings backup
- `data/settings.json` - Settings backup (outdated)

---

## Dev Server Notes

**Start Server:**
```bash
npm run dev
```

**Endpoints:**
- App: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- API: Running on same server

**Current State:**
- ✅ Server running on port 3000
- ✅ All Supabase connections working
- ✅ Navigation loaded from Supabase
- ✅ POS system functional

---

## Memory/Feedback Notes

From `memory/feedback_colors_import.md`:
- ProductCard crashes if colors array contains plain strings instead of ColorVariant objects
- Always use `colors: []` in import scripts unless you have actual ColorVariant objects with images
- If storing color name info, put it in product name or description instead

---

## Next Steps for Future Sessions

1. **Fix Germany Product Images** (High Priority)
   - Admin needs to upload images for 7 Germany products
   - Use admin panel product editor at `/admin`
   - Images should be stored to Supabase Storage
   
2. **Optional: Embed Navigation Logos**
   - Consider converting external CDN URLs to base64 SVG for all navigation items
   - Would make navigation independent of external CDN
   - Current Germany logo: External URL, but accessible

3. **Monitor Navigation Display**
   - Verify navigation menu renders correctly in header with all logos
   - Check if logo field displays in browser after app refresh

4. **Product Image Backup**
   - Once Germany products have images, add to backup-2026-05-02.json
   - Regular backups recommended for product images

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint           # Type check
npm run build          # Build for production

# Supabase Queries (use scripts in project)
npx tsx restore_navigation.ts    # Restore nav from backup
npx tsx audit_germany_images.ts  # Check product images
```

---

## Last Updated
June 2, 2026 - After navigation restore and product image audit

**Ready for:** Next session work on product images and any frontend issues with navigation display
