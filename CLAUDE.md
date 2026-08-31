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
- `online_orders` exists only on the unmerged `ecommerce-dev` branch — not present on `main`

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
- main: live site
- ecommerce-dev: e-commerce Phases 1-5 complete, on hold pending a Stripe integration decision

## Pending Items
- Stripe payment integration (`ecommerce-dev` branch) — if/when going live with online payments
- Receipt width fine-tuning on the Epson TM-T88V — not yet verified against real hardware
- Re-upload logos through Admin → Settings → Theme so existing uploads pick up WebP transparency (the code fix only applies to new uploads, not retroactively)
- Inventory Count (including the Session 66 Add Missing Variant / Print / CSV / Admin-history additions) not yet verified on a real phone or with a real barcode scanner — tested only in an emulated iPhone viewport, and Admin tab tested at desktop width. Not pushed pending that confirmation
- Hero slider device filtering (Session 69) not yet confirmed on a real phone — tested only in emulated viewports
- `docs/inventory-count-migration.sql` — the `inventory_counts` table already existed on this project's live Supabase instance and was verified working during Session 65; the file only matters if this project is ever pointed at a different DB
- `docs/cash-report-migration.sql` must be run in Supabase before Cash Report works — already applied to this project's live Supabase instance during Session 63 testing; only relevant if this project is ever pointed at a different DB

## Recent Changes (last 3 sessions)
- **Session 81:** ProductCard.tsx + ProductGridPage.tsx — three rounds of size-filter swatch improvements (all confirmed working, all pushed). (1) **Swatch isDefault bug fix** — removed the separate "default" button (which always showed regardless of filter) and the `nonDefaultColors` exemption; replaced with `allColors` (all product.colors with a name) filtered uniformly by `visibleColorSet`. All colors, including `isDefault`, now go through the same size filter. `allColors.map()` with `!visibleColorSet.has(color) → null` preserves original `product.colors[idx]` indices so `?color=N` in the link is correct. (2) **N/A thumbnails removed + card image follows filter** — `visibleColorSet` also requires `c.images?.length > 0` so image-less colors are never rendered. Added `cardImage` IIFE: when `filteredSize` and `sizeVariants` are both set, finds the first matching color with an image and uses its `images[0]` as the resting card image; falls back to `product.image`. `displayImage` now uses `cardImage` instead of `product.image`. (3) **ProductGridPage.tsx sizeVariants loading guard** — `sizeVariants` prop now passes `productVariantData.size > 0 ? (productVariantData.get(id) ?? []) : undefined` so during data load `sizeVariants` is `undefined` (swatches show all), and after load a product with no color-tagged variants gets `[]` (swatches correctly hide). The `sizeVariants?.some()` optional-chain in ProductCard handles the `undefined` loading state without a separate guard branch.
- **Session 80:** Four fixes across product detail, admin image upload, layaway EOD, and size-filter navigation. (1) **ProductDetailPage.tsx size filter by color** — `displayedSizesList` now adds `stockMatch = !selectedColor || stock_quantity > 0` so only in-stock sizes show for the selected color; `setSelectedSize(null)` added to the color-change effect so stale selections clear. (2) **ProductDetailPage.tsx default color auto-select** — new `useEffect` on `[product?.id]` sets `selectedColor` to the `isDefault` color (fallback: first color) as soon as the product loads, before variants arrive, so the size filter is already active when variants finish fetching; skipped when `?color=` or `?size=` URL params are present. (3) **AdminPage.tsx async image upload stale closure fix** — `handleProductImageUpload`, `handleAdditionalImageUpload`, `handleColorImageUpload`, and `updateEditingProductImage` all switched from `setEditingProduct({ ...editingProduct, ... })` to functional `setEditingProduct(prev => ({ ...prev, ... }))` so concurrent uploads or any intervening re-render cannot overwrite color images with stale state. (4) **LayawayPayLaterModal.tsx EOD deposit tracking** — added `depositMethod` state (default `'Cash'`) with a 5-button selector (Cash / Debit / Visa / Mastercard / Amex); when a layaway is saved, a `transactions` row is inserted (`total_amount = deposit_paid`, `method = depositMethod`) so it naturally appears in EOD under the correct payment method column without any CashReport changes. (5) **ProductCard.tsx + ProductDetailPage.tsx size-filter URL passthrough** — ProductCard builds `productLink` with `URLSearchParams` combining existing `?color=N` and new `?size=X` (when `filteredSize` active); ProductDetailPage reads `sizeParam`, has a new `useEffect([variants.length, sizeParam])` that finds the first in-stock variant for that size and sets both `selectedColor` and `selectedSize`.
- **Session 79:** Size-filtered color swatches (ProductCard.tsx + ProductGridPage.tsx). When exactly one size is selected in the footwear filter, ProductCard now hides color swatches that don't have that size in stock. Implementation: ProductGridPage extends its existing `product_variants` fetch (adds `color` to the select) to build a `productVariantData: Map<productId, Array<{color, size}>>` alongside the existing `sizeToProductIds` map — no extra DB requests. `filteredSize` (the single selected size) and `sizeVariants` (per-product variant data) are passed as new props to ProductCard. ProductCard computes `visibleColors` from `sizeVariants` and `shouldShowSwatches` (`product.colors.length > 1 && visibleColors.length > 0`) — swatches hide entirely if no colors survive the filter. Filtering is inactive when 0 or 2+ sizes are selected. Feature is footwear-only (size filter only exists on the footwear category page). Tested on localhost: 8 swatches → 4 after Size 9 filter → 8 restored after clearing.

## Key Settings
- Primary color: `var(--primary-color)`, default `#b90014` (red) — set via Admin → Settings → Theme; don't hardcode the hex elsewhere in code
- Google Analytics: G-LP6TC6XHFW
- Microsoft Clarity: xygbsedpg3
- Supabase Storage bucket: `media`
