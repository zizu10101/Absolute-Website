# Toronto Soccer Shop - Project Reference

## Project
- Site: torontosoccershop.com
- Store: Absolute Soccer Mississauga
- Stack: React + Vite + Supabase + Vercel
- GitHub: zizu10101/Absolute-Website
- Supabase ref: nvyfktdhzhujeltkbgrz
- Admin email: info@edgedbs.com
- POS PIN: 2024 (env: VITE_POS_PIN)
- Cash Report Manager PIN: 0852 (env: VITE_MANAGER_PIN) — gates Reports → Cash Report; intentionally never remembered, see Session 63 below

## Key Files
- src/pages/POSPage.tsx
- src/pages/AdminPage.tsx
- src/pages/ProductDetailPage.tsx
- src/utils/thermalReceipt.ts
- src/utils/invoice.ts
- src/context/SettingsContext.tsx
- src/context/ProductContext.tsx
- src/components/BrandBanners.tsx — live "Shop by Brand" component rendered by HomePage.tsx. `BrandShowcase.tsx` also exists in the repo but is unused dead code (not imported anywhere) — don't edit it expecting it to affect the site.
- src/pages/HomePage.tsx — hero slider (peek-carousel: `slideWidthVw`/`gapVw`/`peekVw` drive width + `translateX`, not a plain single-slide layout). Frame sizing is inline-style, not a Tailwind class: mobile fixed `height: '65vw'`, desktop `aspectRatio: '16/9'` (not a fixed px height — that cropped heads off portrait/square uploads at Session 67's `550px`). Slide `backgroundColor: '#ffffff'`. All breakpoints use `object-cover object-top` (crops from the bottom, not the top, so heads/faces survive) — see Session 68. Image is wrapped in `<picture>`; a `<source media="(max-width:767px)">` serves `slide.mobile_image` when set, falling back to `slide.url` otherwise.
- src/components/reports/CashReport.tsx — EOD Cash Report tab (denomination counter, Over/Short, Deposit/Other, print, save)
- src/components/ManagerPinModal.tsx — PIN modal gating Cash Report; never persists access (see Session 63)
- src/pages/InventoryCountPage.tsx — `/inventory-count` stocktake page for staff phones (see Session 65 and 66)
- src/components/InventoryCountsAdmin.tsx — Admin → Inventory Counts tab, history/view/print of past counts (see Session 66)
- src/components/POSPinEntry.tsx — shared PIN keypad. Optional `title`/`subtitle`/`maxLength` props; defaults reproduce the POS register screen exactly (6 slots, min 4 digits, OK button)
- server.ts — Express server. Most of the app calls Supabase directly from the client; server.ts's `/api/*` routes are only used for POS drawer control, a few admin DB-sync utilities, and Returns. Cash drawer: `POST /api/open-drawer`.
- public/logo-black.png — receipt logo, used across all thermal receipt types

## Database Tables (main branch)
- products, product_variants
- transactions — line items are a `jsonb` column on the row, not a separate table
- customers
- gift_cards, gift_card_transactions
- store_credits, store_credit_transactions
- layaways, pay_later
- returns
- navigation_menus, navigation_items
- settings, blog_posts
- cash_reports — see Session 63 below; columns: `id, report_date, opening_counts, closing_counts, opening_total, closing_total, pos_cash, pos_debit, pos_visa, pos_mc, pos_amex, pos_cheque, pos_other, pos_total, pos_breakdown, actual_cash, expected_cash, over_short, deposit, other, notes, created_at`. `pos_other`/`pos_breakdown` catch any payment method without its own fixed column (Gift Card, Store Credit, etc.) so nothing is silently dropped
- inventory_counts — one row per submitted stocktake (see Session 65/66); columns: `id, count_date, counted_by, total_variants_counted, total_discrepancies, adjustments, created_at`. `adjustments` holds the FULL session (every counted variant, matches included — not just discrepancies) as `{variant_id, barcode, product_name, color, size, system_qty, counted_qty, diff, status}` where `status` is `match`/`discrepancy`/`new`, so Admin → Inventory Counts → View can show everything that was counted, not only what changed
- `online_orders` — merged from ecommerce-dev (August 21, 2026); columns: `id, customer_first_name, last_name, email, phone, shipping_address, city, province, postal_code, notes, items(jsonb), subtotal, tax, total, status, created_at, user_id, shipping_method, shipping_cost`

**IMPORTANT:** `product_variants` has 2364+ rows. Supabase/PostgREST caps every request at 1000 rows regardless of the `.range()` bounds requested — a single `.range(0, 9999)` call will silently truncate to 1000 rows. Always paginate with a loop:
```js
const batchSize = 1000;
let from = 0;
const all = [];
while (true) {
  const { data } = await supabase.from('product_variants').select('*').range(from, from + batchSize - 1);
  if (!data) break;
  all.push(...data);
  if (data.length < batchSize) break;
  from += batchSize;
}
```

## Printer
- Epson TM-T88V Receipt (1) — Windows printer name
- POS machine's Chrome is launched with `--kiosk-printing` for silent thermal printing
- `POST /api/open-drawer` (server.ts) opens the cash drawer via ESC/POS
- public/logo-black.png used on all receipt types

## Current Branches
- main: live site — ecommerce-dev merged August 21, 2026
- ecommerce-dev: merged into main; can continue as staging branch for Phase 6

## E-Commerce Features (merged August 21, 2026)
- Shopping cart (CartContext, CartDrawer, SizeSelector) with localStorage persistence
- Checkout page (/checkout) with address form, HST, shipping options ($0 pickup / $15 ship)
- Order confirmation emails via Resend.com (Supabase Edge Function `send-order-email`)
- Stock validation + automatic reduction/restoration (shared with POS)
- Customer auth: register, login, forgot password, Google OAuth, account page with order history
- Admin → Online Orders tab (OnlineOrdersAdmin.tsx) — manage status, view details
- New pages: /checkout, /order-confirmation, /register, /login, /forgot-password, /account
- New contexts: CartContext, CustomerAuthContext (separate from admin AuthContext)
- Google OAuth redirect: https://torontosoccershop.com/account
- Migrations needed on a fresh DB: migrations/add_user_id_to_online_orders.sql, migrations/add_shipping_to_online_orders.sql

## Pending Items
- Stripe payment integration — next phase if/when going live with online payments
- Receipt width fine-tuning on the Epson TM-T88V — not yet verified against real hardware
- Re-upload logos through Admin → Settings → Theme so existing uploads pick up WebP transparency (the code fix only applies to new uploads, not retroactively)
- Inventory Count (including the Session 66 Add Missing Variant / Print / CSV / Admin-history additions) not yet verified on a real phone or with a real barcode scanner — tested only in an emulated iPhone viewport, and Admin tab tested at desktop width. Not pushed pending that confirmation
- Hero slider device filtering (Session 69) not yet confirmed on a real phone — tested only in emulated viewports
- `docs/inventory-count-migration.sql` — the `inventory_counts` table already existed on this project's live Supabase instance and was verified working during Session 65; the file only matters if this project is ever pointed at a different DB
- `docs/cash-report-migration.sql` must be run in Supabase before Cash Report works — already applied to this project's live Supabase instance during Session 63 testing; only relevant if this project is ever pointed at a different DB

## Recent Changes (last 3 sessions)
- **Session 73 (ecommerce-dev merge):** Merged e-commerce Phases 1-5 + admin/POS enhancements into main. Admin product list now has expandable variant rows (chevron → groups by color with stock badges + color image thumbnails, falls back to master image). `fetchAdminProducts` now selects `colors`, `brand`, `product_code`. POS barcode scan now resolves the correct color variant image via `getVariantImage(product, variant.color)` instead of always using master image.
- **Session 72:** Product card color-hover price (ProductCard.tsx). Added `hoveredColor: ColorVariant | null` state. Color thumbnail buttons now call `setHoveredColor(color)` on `onMouseEnter` and `setHoveredColor(null)` on `onMouseLeave` (default button clears it too). Price display: hovering a sale color shows that color's `salePrice` in red + strikethrough of `product.price`; hovering a non-sale color shows `color.price` if set, else `product.price`; not hovering falls back to existing "From $X" / "$X" logic. Also added `hasColorSale` flag and "From " prefix to the default price when color-specific sales exist (so customers know not every color is at the lowest price). Reverted slider background to white (`bg-white` / `#ffffff`) — the `#f6f6f6` change was backed out.
- **Session 71:** Fix mobile-only slides being silently dropped (AdminPage.tsx + SettingsContext.tsx). Bug: `useEffect` on line 961 of AdminPage re-synced local `sliderImages` from context after every save using `.filter(img => img && img.url && ...)` — `img.url` is falsy for a mobile-only slide (url `''`), so the slide vanished from the UI immediately after saving. Fix: filter now keeps any slide where `img.url || img.mobile_image` is truthy, and checks both fields for `data:` prefixes (not just `url`). Also made `SliderImage.url` optional (`url?: string`) in SettingsContext.tsx to match reality — a slide can exist with only `mobile_image` set.
- **Session 70:** Admin slider independent image controls (AdminPage.tsx). Each slide card now has fully independent desktop and mobile image sections. Desktop section: 16:9 preview + `[Replace]` + `[Remove Desktop]` (sets `url` to `''`, slide stays) or an "Upload Desktop Image" dropzone when empty. Mobile section: 9:16 portrait preview + `[Replace Mobile]` + `[Remove Mobile]` (sets `mobile_image` to `''`, slide stays) or "Upload Mobile Image" dropzone when empty. Title/Link fields always visible (no Edit toggle). "Delete Slide" in the header bar triggers `window.confirm` before calling `onDelete`. `slideId` helper (`img.url || img.mobile_image || \`slide-${i}\``) replaces bare `img.url` as the DnD key/id everywhere (SortableContext items, SortableSlideCard key+id, both findIndex calls in handleSliderDragEnd) so drag-to-reorder keeps working even after a desktop image is cleared.
- **Session 69:** Hero slider overhaul (HomePage.tsx + AdminPage.tsx). (1) Device filtering — `visibleSlides` useMemo filters `sliderImages` before the infinite-loop clone: mobile only shows slides where `mobile_image` is non-empty, desktop only shows slides where `url` is non-empty. `isMobile` state hoisted above `infiniteSlides` so the filter can reference it. All carousel logic updated to use `visibleSlides.length`. (2) Image rendering — img src is `isMobile ? slide.mobile_image : slide.url`. Desktop: `object-contain` + `aspectRatio: 16/9` + white bg. Mobile: `object-cover object-center` + `90dvh`. (3) Admin slide cards — `[Replace Image] [Replace Mobile] [Edit ▼] [Delete]` button row (superseded by Session 70).
- **Session 68:** Hero slider desktop fix — switched to `aspectRatio: '16/9'` and `object-top` so portrait/square uploads don't get heads cropped.
- **Session 67:** Hero slider — added per-slide `mobile_image` field, `<picture>/<source>` tag (later replaced by direct src switching in Session 69), and "Upload Mobile Image" admin control compressed to 900×1200 WebP.
- **Session 66:** Three additions to Inventory Count. (1) "Add Missing Size"/"Add Missing Item" — opens an Add Missing Variant form that inserts a real `product_variants` row and adds it to the current count session flagged `isNew`. Barcode uniqueness is checked client-side and against the DB before insert. (2) Print Report / Export CSV — available in the pre-apply Review Count modal and on the post-apply success screen. (3) Admin → Inventory Counts tab (`InventoryCountsAdmin.tsx`) — history table of past counts with View (full item-level detail modal) and Print.
- **Session 65:** Inventory Count — new `/inventory-count` route for stocktakes on staff phones, gated by the POS PIN (2024, shares the `pos_authenticated` session flag with /pos). Products grouped into one card per product + colour, each size row showing system qty against a large physical-count field that turns green on a match and red on a mismatch. Barcode scan or Enter in the search bar jumps to the exact variant, highlights it and focuses its input; unknown barcodes fall back to text filtering. Sticky bottom bar tracks Counted/Discrepancies, Submit shows a full discrepancy report, and Apply writes each physical count to `product_variants.stock_quantity` and logs the session to the new `inventory_counts` table. In-progress counts persist to localStorage per date so a phone refresh doesn't lose work. Note `/inventory-count` also allows private-LAN hostnames (10.x, 192.168.x, 172.16–31.x) on top of the usual admin-domain check, since staff phones reach the dev server by IP.
- **Session 64:** Variant style code + quantity breakdowns. Product detail page (`ProductDetailPage.tsx`) now shows a "Style: <code>" line under the price — falls back to `product.product_code` when no color is selected, and swaps to the selected color's `product_code` (via `selectedColorEntry`) when a color is picked, updating live. POS cart (`POSPage.tsx`) shows a unit-price breakdown ("N @ $X.XX each" + "Total: $Y") in the plain-price case when `quantity > 1` (override/discount branches already show their own per-line totals). Sale thermal receipt (`thermalReceipt.ts`) shows "N @ $X.XX" in place of "Qty: N" when `quantity > 1`, using the discounted unit price so it always reconciles with the line total (`lineTotal = discountedPrice × quantity`); qty 1 still shows "Qty: 1". Order-confirmation and layaway/pay-later receipts left unchanged.
- **Session 63:** EOD Cash Report — new protected Reports tab: denomination counter ($0.05–$100, opening/closing), sales auto-filled from `transactions` grouped by payment method, Over/Short calc (green if balanced, red if not — cash-only, unaffected by Deposit/Other), Deposit + Other manual fields, full-page (not thermal-width) print, saves to the new `cash_reports` table (upserts per date so opening counts saved in the morning survive a closing-time revisit same day). Gated behind a Manager PIN (0852) that is deliberately never remembered — no sessionStorage, re-prompts on every lock-icon click, and re-locks the instant you switch to any other Reports tab. Also added an "Other" payment method to POS checkout (single-method only, not split payments) for off-books/miscellaneous tender: fully excluded from the regular EOD report and its totals, auto-fills into Cash Report's dedicated Other field instead (editable, and preserved once a report for that date has been saved).
- **Session 62:** "You Might Also Like" related products on the product detail page — matches category + brand + surface type (fg/ag/mg/turf/indoor/sg, parsed from name/submenus) + age group (adult/youth, parsed from name), never mixing surface types even if that yields fewer than 4 results. Replaced the inaccurate "Free Delivery" badge with "In-Store Pickup" (store is pickup-only). Removed a misleading duplicate "Call to order" CTA that rendered under a working size picker.

## Key Settings
- Primary color: `var(--primary-color)`, default `#b90014` (red) — set via Admin → Settings → Theme; don't hardcode the hex elsewhere in code
- Google Analytics: G-LP6TC6XHFW
- Microsoft Clarity: xygbsedpg3
- Supabase Storage bucket: `media`
