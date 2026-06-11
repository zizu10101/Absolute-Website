# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## CURRENT STATUS (Checkpoint v1.0 + E-Commerce Phases 1-5 Complete + Shipping)
POS system live. E-commerce fully functional with customer accounts and shipping options on ecommerce-dev branch.
Ready for merge to main or Phase 6 development (payment processing).

### What's Working (ecommerce-dev)
✅ Shopping cart with real-time stock checks
✅ Checkout with customer form & address validation
✅ Order confirmation emails (Resend via Supabase Edge Function)
✅ Shared inventory between POS and online store
✅ Admin panel for managing online orders
✅ Real-time stock updates across systems
✅ No overbooking possible

**PHASE 1 COMPLETE (June 11, 2026):**
✅ Shopping cart with localStorage persistence
✅ Cart context + drawer UI with HST calculation
✅ Size selector modal for variants
✅ Product cards with add-to-cart buttons
✅ Stock validation (out of stock detection)
✅ Cart icon with item count badge in header

**PHASE 2 COMPLETE (June 11, 2026):**
✅ Checkout page (/checkout) with customer form
✅ Order summary with HST + total
✅ Form validation (email, postal code, required fields)
✅ Order saved to online_orders table
✅ Order confirmation page (/order-confirmation)
✅ Admin panel "Online Orders" tab
✅ Order status management (pending/confirmed/completed/cancelled)
✅ Delete orders capability

**PHASE 3 COMPLETE (June 11, 2026):**
✅ Resend.com integration (free tier - 3000 emails/month)
✅ Customer confirmation email with order details
✅ Store notification email → ziad@golazo.ca
✅ Professional HTML email templates
✅ Email sending on order placement
✅ Supabase Edge Function for server-side email (secure)
✅ API key stored as Supabase secret (not in browser/code)
✅ CORS headers configured for authorization
✅ Edge function deployed with --no-verify-jwt

**PHASE 4 COMPLETE (June 11, 2026):**
✅ Stock validation before checkout
✅ Automatic stock reduction after order placement
✅ Stock restoration on order cancellation
✅ Real-time stock display on product cards
✅ "Only X left!" warning when stock <= 3
✅ "Out of Stock" status when stock = 0
✅ Shared inventory between POS and online store
✅ Cart validation with stock warnings
✅ Real-time Supabase subscriptions for stock updates
✅ Auto-adjust cart quantities if stock changed

**PHASE 5 COMPLETE (June 11, 2026):**
✅ Customer authentication (register, login, password reset)
✅ Register page with email, password, first/last name, phone
✅ Login page with sign in and forgot password link
✅ Forgot Password page with reset link email
✅ Account page (/account) with order history tab
✅ Order history shows all customer orders with details modal
✅ Profile tab: view and edit name, phone, email (read-only)
✅ Header shows "Sign In" when logged out
✅ Header shows account dropdown when logged in
✅ Checkout form pre-fills for logged-in customers
✅ Orders linked to user_id in online_orders table
✅ Guest checkout still allowed (no forced login)

**SHIPPING OPTIONS (June 11, 2026):**
✅ Pickup in Store option - FREE (selected by default)
✅ Ship to Address option - $15.00
✅ Shipping address form shows/hides based on selection
✅ HST applied to shipping cost ($1.95 on $15)
✅ Real-time order summary updates
✅ Order data includes shipping_method and shipping_cost
✅ Customer email shows pickup or shipping section based on method
✅ Store email shows pickup or shipping alert
✅ No "undefined" fields in email templates for missing address data

## COMPLETED FEATURES
- Standalone /pos route with PIN auth (default PIN: 2024, env: VITE_POS_PIN)
- Barcode scanner with global keydown listener
- Thermal receipt printing (Epson 80mm, store: Absolute Soccer Mississauga, 905-593-3600)
- Cash change calculator with preset buttons
- Gift cards: sell/redeem/history (tables: gift_cards, gift_card_transactions)
- Store credits: issue/redeem/scan/balance (tables: store_credits, store_credit_transactions)
- Returns flow with SC receipt printing (table: returns)
- Invoice numbering INV-XXXXX (sequence: invoice_number_seq, trigger: set_invoice_number)
- Transaction history: void/refund/return/reprint
- Reports: EOD, Sales, Products, Customers, SC, Void/Refund (Eastern timezone)
- Customer profiles with GC/SC/purchase history
- SEO tags via useSEO hook, sitemap at public/sitemap.xml
- Navigation tables: navigation_menus, navigation_items
- Duplicate product prevention (unique constraint: name+category)
- Brand + product_code columns on products table
- Google Search Console verified, sitemap submitted
- POS dark theme redesign with action tiles (3 column grid)
- Mobile fixes: edit button visible, PIN pad keyboard suppressed

## BRANCH STRATEGY
- main = stable live site (DO NOT break)
- ecommerce-dev = e-commerce features in development
- Tag v1.0-pos-complete = permanent restore point

## E-COMMERCE BUILD ORDER (ecommerce-dev branch)
1. ✅ Shopping cart (add to cart, quantities, remove, localStorage)
2. ✅ Checkout form (customer form, validation, order saving)
3. ✅ Email confirmations (Resend.com - customer + store)
4. ✅ Inventory sync (stock validation, reduction, restoration)
5. ✅ Customer accounts (login, register, password reset, order history, profile)
6. → READY: Merge to main OR continue Phase 6
7. Payment processing - Stripe (requires paid Vercel plan)

**DECISION POINT:** 
- Option A: Merge ecommerce-dev to main (Phases 1-5 working, no payment yet)
- Option B: Continue Phase 6 (payment processing with Stripe)
- Option C: Build Phase 6 on separate branch, merge later

**Database Migrations Required:**
Run these in Supabase SQL Editor:
1. migrations/add_user_id_to_online_orders.sql - adds user_id column + index
2. migrations/add_shipping_to_online_orders.sql - adds shipping_method and shipping_cost columns

## KEY ARCHITECTURE RULES
- NO /api/ fetch calls - all direct Supabase client calls
- RLS disabled on all tables
- Vercel has no server - no serverless functions yet
- Supabase client imported from shared lib file
- POS backup at src/pages/POSPage.backup.tsx

## DATABASE TABLES (POS + E-Commerce)
**POS Tables:**
transactions: id, customer_id, total_amount, method, payment_method, items(jsonb), created_at, status, invoice_number, tendered_amount, change_given
product_variants: id, product_id, size, barcode, price, stock_quantity, sku
gift_cards: id, card_number, initial_balance, current_balance, customer_id, is_active
store_credits: id, card_number, customer_id, amount, remaining_balance, reason, is_active
returns: id, transaction_id, customer_id, items, refund_method, refund_amount, store_credit_id, status

**E-Commerce Tables:**
online_orders: id, customer_first_name, last_name, email, phone, shipping_address, city, province, postal_code, notes, items(jsonb), subtotal, tax, total, status, created_at

**Shared Tables:**
products: id, name, price, category, image, images, description, isNewArrival, isOnSale, isFeatured, salePrice, submenu, submenus, is_online, show_sizes, brand, product_code
customers: id, first_name, last_name, email, phone, boot_size, club_affinity
navigation_menus: id, label, path, order_index, is_active
navigation_items: id, menu_id, label, path, logo_url, order_index, parent_id, is_active
settings: key, value (stores site settings as JSON)

## KEY FILES
- src/pages/POSPage.tsx (POS main, 2100+ lines)
- src/pages/POSPage.backup.tsx (backup before redesign)
- src/pages/AdminPage.tsx (admin panel, 3500+ lines)
- src/pages/CheckoutPage.tsx (checkout with customer form, stock validation, pre-fill for logged-in users)
- src/pages/AccountPage.tsx (customer account: order history + profile tabs)
- src/pages/LoginPage.tsx (customer login)
- src/pages/RegisterPage.tsx (customer registration)
- src/pages/ForgotPasswordPage.tsx (password reset)
- src/context/CustomerAuthContext.tsx (customer authentication - separate from admin auth)
- src/components/Header.tsx (updated with account dropdown)
- src/components/ReturnsModal.tsx
- src/components/OnlineOrdersAdmin.tsx (admin panel for online orders)
- src/utils/thermalReceipt.ts
- src/hooks/useSEO.ts
- scripts/generate-sitemap.js
- public/sitemap.xml
- migrations/add_user_id_to_online_orders.sql (database schema update)

## RECEIPT INFO
Store: Absolute Soccer Mississauga
Phone: 905-593-3600
Website: torontosoccershop.com
Instagram: @torontosoccershop
