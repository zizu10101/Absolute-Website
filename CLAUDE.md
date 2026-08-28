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
- **Session 79:** Size-filtered color swatches (ProductCard.tsx + ProductGridPage.tsx). When exactly one size is selected in the footwear filter, ProductCard now hides color swatches that don't have that size in stock. Implementation: ProductGridPage extends its existing `product_variants` fetch (adds `color` to the select) to build a `productVariantData: Map<productId, Array<{color, size}>>` alongside the existing `sizeToProductIds` map — no extra DB requests. `filteredSize` (the single selected size) and `sizeVariants` (per-product variant data) are passed as new props to ProductCard. ProductCard computes `visibleColors` from `sizeVariants` and `shouldShowSwatches` (`product.colors.length > 1 && visibleColors.length > 0`) — swatches hide entirely if no colors survive the filter. Filtering is inactive when 0 or 2+ sizes are selected. Feature is footwear-only (size filter only exists on the footwear category page). Tested on localhost: 8 swatches → 4 after Size 9 filter → 8 restored after clearing.
- **Session 78:** ProductCard.tsx — further card polish. (1) Image background changed to `bg-[#efefef]` and `style={{ mixBlendMode: 'multiply' }}` added to product images so white/light photo backgrounds blend into the card (major-retailer technique). (2) Swatch section changed to fixed `h-8` with a ternary: 2+ colors → interactive `w-7 h-7` swatch buttons; 0–1 colors → empty `h-7` spacer. Both branches are always rendered so all card titles sit on the same horizontal line regardless of whether swatches are present.
- **Session 77:** ProductCard.tsx — multiple card layout fixes. (1) Color thumbnail visibility: simplified condition to `product.colors.length > 1` (total color count, not filtered) so cards with exactly 2 colors correctly show thumbnails. (2) Card alignment: thumbnail section uses a fixed `min-h-[36px]` wrapper that always reserves space, preventing row misalignment between cards with and without thumbnails. (3) Image container: changed to `aspect-square` + `bg-[#f6f6f6]` + `rounded-lg` + `p-3` padding so product images never touch edges; `max-w-full max-h-full` added to img; container padding replaces old `p-2` on the img itself.
- **Session 75:** Multiple fixes and additions. (1) Expandable variant rows in Admin product list (AdminPage.tsx) — chevron button per product row fetches and shows variants grouped by color with stock badges (green >2, yellow 1–2, red 0); sizes sorted via `sizeOrder` array; color thumbnail beside each color group falls back to master image. (2) POS barcode scan shows color variant image instead of master image (`getVariantImage` helper in POSPage.tsx). (3) `fetchAdminProducts` in ProductContext.tsx now selects `colors,product_code,brand` so admin list has these fields. (4) Admin product search now also matches master `product_code`, color-level `product_code` in `colors` JSONB, and `product_variants.product_code` via async `variantCodeMatchIds` state. (5) Size filter order fixed in ProductGridPage.tsx (`sizeOrder` array covering 8K→7Y→adult→apparel). (6) Size sort on product detail page (ProductDetailPage.tsx) uses same `sizeOrder`. (7) Size lists in Admin and RapidScanIntakeMatrix `getSuggestedSizes` for Youth Footwear / Youth shoes now cover 8K–7Y with all half sizes. (8) POS receipt discount breakdown — POSPage.tsx now bakes `finalPrice` and `originalPrice` into receipt items at print time; thermalReceipt.ts shows Original → Discount (label) → Item Total three-line layout when discounted. (9) Product detail page: "Reserve by Phone" red CTA (`tel:9055933600`) and "Visit Us In Store" card with address, hours, Get Directions link — added below size selector, above certifications bar.
- **Session 74:** Admin product list expandable variant rows (initial implementation, superseded by Session 75 fixes). Chevron expand/collapse per row; `variantCache` state caches fetched variants; `getColorImage` helper shows color-specific thumbnail.
- **Session 73:** (No separate session — work merged into 74/75.)
- **Session 72:** Product card color-hover price (ProductCard.tsx). Added `hoveredColor: ColorVariant | null` state. Color thumbnail buttons now call `setHoveredColor(color)` on `onMouseEnter` and `setHoveredColor(null)` on `onMouseLeave` (default button clears it too). Price display: hovering a sale color shows that color's `salePrice` in red + strikethrough of `product.price`; hovering a non-sale color shows `color.price` if set, else `product.price`; not hovering falls back to existing "From $X" / "$X" logic. Also added `hasColorSale` flag and "From " prefix to the default price when color-specific sales exist (so customers know not every color is at the lowest price). Reverted slider background to white (`bg-white` / `#ffffff`) — the `#f6f6f6` change was backed out.
- **Session 71:** Fix mobile-only slides being silently dropped (AdminPage.tsx + SettingsContext.tsx). Bug: `useEffect` on line 961 of AdminPage re-synced local `sliderImages` from context after every save using `.filter(img => img && img.url && ...)` — `img.url` is falsy for a mobile-only slide (url `''`), so the slide vanished from the UI immediately after saving. Fix: filter now keeps any slide where `img.url || img.mobile_image` is truthy, and checks both fields for `data:` prefixes (not just `url`). Also made `SliderImage.url` optional (`url?: string`) in SettingsContext.tsx to match reality — a slide can exist with only `mobile_image` set.
- **Session 70:** Admin slider independent image controls (AdminPage.tsx). Each slide card now has fully independent desktop and mobile image sections. Desktop section: 16:9 preview + `[Replace]` + `[Remove Desktop]` (sets `url` to `''`, slide stays) or an "Upload Desktop Image" dropzone when empty. Mobile section: 9:16 portrait preview + `[Replace Mobile]` + `[Remove Mobile]` (sets `mobile_image` to `''`, slide stays) or "Upload Mobile Image" dropzone when empty. Title/Link fields always visible (no Edit toggle). "Delete Slide" in the header bar triggers `window.confirm` before calling `onDelete`. `slideId` helper (`img.url || img.mobile_image || \`slide-${i}\``) replaces bare `img.url` as the DnD key/id everywhere (SortableContext items, SortableSlideCard key+id, both findIndex calls in handleSliderDragEnd) so drag-to-reorder keeps working even after a desktop image is cleared.

## Key Settings
- Primary color: `var(--primary-color)`, default `#b90014` (red) — set via Admin → Settings → Theme; don't hardcode the hex elsewhere in code
- Google Analytics: G-LP6TC6XHFW
- Microsoft Clarity: xygbsedpg3
- Supabase Storage bucket: `media`
