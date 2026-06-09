# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## CURRENT STATUS (Checkpoint v1.0)
POS system complete and live. Starting e-commerce development on ecommerce-dev branch.

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

## NEXT: E-COMMERCE (on ecommerce-dev branch)
Build order:
1. Shopping cart (add to cart, quantities, remove)
2. Checkout form (name, email, address, order summary)
3. Order management (save to Supabase, admin view)
4. Customer accounts (login, order history)
5. Email confirmations (Resend.com)
6. Inventory sync (online orders reduce POS stock)
7. Payment - Stripe (LAST - needs paid Vercel plan)

## KEY ARCHITECTURE RULES
- NO /api/ fetch calls - all direct Supabase client calls
- RLS disabled on all tables
- Vercel has no server - no serverless functions yet
- Supabase client imported from shared lib file
- POS backup at src/pages/POSPage.backup.tsx

## DATABASE TABLES
transactions: id, customer_id, total_amount, method, payment_method, items(jsonb), created_at, status, invoice_number, tendered_amount, change_given
products: id, name, price, category, image, images, description, isNewArrival, isOnSale, isFeatured, salePrice, submenu, submenus, is_online, show_sizes, brand, product_code
product_variants: id, product_id, size, barcode, price, stock_quantity, sku
customers: id, first_name, last_name, email, phone, boot_size, club_affinity
gift_cards: id, card_number, initial_balance, current_balance, customer_id, is_active
store_credits: id, card_number, customer_id, amount, remaining_balance, reason, is_active
returns: id, transaction_id, customer_id, items, refund_method, refund_amount, store_credit_id, status
navigation_menus: id, label, path, order_index, is_active
navigation_items: id, menu_id, label, path, logo_url, order_index, parent_id, is_active
settings: key, value (stores site settings as JSON)

## KEY FILES
- src/pages/POSPage.tsx (POS main, 2100+ lines)
- src/pages/POSPage.backup.tsx (backup before redesign)
- src/pages/AdminPage.tsx (admin panel, 3500+ lines)
- src/components/ReturnsModal.tsx
- src/utils/thermalReceipt.ts
- src/hooks/useSEO.ts
- scripts/generate-sitemap.js
- public/sitemap.xml

## RECEIPT INFO
Store: Absolute Soccer Mississauga
Phone: 905-593-3600
Website: torontosoccershop.com
Instagram: @torontosoccershop
