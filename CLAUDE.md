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
- src/pages/HomePage.tsx — hero slider (peek-carousel: `slideWidthVw`/`gapVw`/`peekVw` drive width + `translateX`, not a plain single-slide layout). Frame sizing is inline-style, not a Tailwind class: mobile fixed `height: '65vw'`, desktop `aspectRatio: '16/9'` (not a fixed px height — that cropped heads off portrait/square uploads at Session 66's `550px`). Slide `backgroundColor: '#ffffff'`. All breakpoints use `object-cover object-top` (crops from the bottom, not the top, so heads/faces survive) — see Session 67. Image is wrapped in `<picture>`; a `<source media="(max-width:767px)">` serves `slide.mobile_image` when set, falling back to `slide.url` otherwise.
- src/components/reports/CashReport.tsx — EOD Cash Report tab (denomination counter, Over/Short, Deposit/Other, print, save)
- src/components/ManagerPinModal.tsx — PIN modal gating Cash Report; never persists access (see Session 63)
- src/pages/InventoryCountPage.tsx — `/inventory-count` stocktake page for staff phones (see Session 64 and 65)
- src/components/InventoryCountsAdmin.tsx — Admin → Inventory Counts tab, history/view/print of past counts (see Session 65)
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
- inventory_counts — one row per submitted stocktake (see Session 64/65); columns: `id, count_date, counted_by, total_variants_counted, total_discrepancies, adjustments, created_at`. `adjustments` holds the FULL session (every counted variant, matches included — not just discrepancies) as `{variant_id, barcode, product_name, color, size, system_qty, counted_qty, diff, status}` where `status` is `match`/`discrepancy`/`new`, so Admin → Inventory Counts → View can show everything that was counted, not only what changed
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
- Hero slider mobile/desktop changes (Session 66/67) not yet pushed — confirmed only in an emulated headless viewport, not a real phone yet
- Stripe payment integration (`ecommerce-dev` branch) — if/when going live with online payments
- Receipt width fine-tuning on the Epson TM-T88V — not yet verified against real hardware
- Re-upload logos through Admin → Settings → Theme so existing uploads pick up WebP transparency (the code fix only applies to new uploads, not retroactively)
- Inventory Count (including the Session 65 Add Missing Variant / Print / CSV / Admin-history additions) not yet verified on a real phone or with a real barcode scanner — tested only in an emulated iPhone viewport, and Admin tab tested at desktop width. Not pushed pending that confirmation
- `docs/inventory-count-migration.sql` — the `inventory_counts` table already existed on this project's live Supabase instance and was verified working during Session 64; the file only matters if this project is ever pointed at a different DB
- `docs/cash-report-migration.sql` must be run in Supabase before Cash Report works — already applied to this project's live Supabase instance during Session 63 testing; only relevant if this project is ever pointed at a different DB

## Recent Changes (last 3 sessions)
- **Session 67:** Hero slider desktop fix (not yet pushed) — Session 66's fixed `550px` desktop height was too short for portrait/square uploads and cropped heads. Switched to `aspectRatio: '16/9'` (frame adapts to slide width instead of a guessed fixed height) and `object-top` instead of `object-center` (crops from the bottom on both breakpoints, keeping heads/faces intact). Confirmed the slider already had no `max-w-*` wrapper — it was already full-bleed edge to edge; the dark strips visible at the sides on desktop are the peeking prev/next slide thumbnails (dimmed by the existing carousel design), not letterbox bars.
- **Session 66:** Hero slider (HomePage.tsx) mobile sizing went through 3 iterations to land here (not yet pushed): fixed `90dvh` + `object-contain` produced black-bar letterboxing; `object-cover` at that height cropped too aggressively. Settled on `height: isMobile ? '65vw' : '550px'` with `object-cover object-center` on both breakpoints — no more letterboxing anywhere, desktop's old `bg-zinc-900` section background (which showed through as dark bars around `object-contain`-fitted images) is now `bg-white`. Also added optional per-slide `mobile_image` (new field on `SliderImage` in SettingsContext.tsx) — the image is now wrapped in `<picture>` with a `<source media="(max-width:767px)">` for it, falling back to the regular desktop `url` when unset. Admin → Slider tab (`SortableSlideCard` in AdminPage.tsx) gained an "Upload Mobile Image" control per slide (portrait/square hint, compressed to 900×1200 vs. the desktop upload's 1600×640), stored/loaded through the same `sliderImages` JSONB blob — no migration needed.
- **Session 65:** Three additions to Inventory Count (not yet pushed, pending Session 64's real-device confirmation too — see Pending Items). (1) "Add Missing Size"/"Add Missing Item" — a button on every product card, plus one on the unmatched-barcode banner, opens an Add Missing Variant form (Product [locked or searchable], Size, Color, Barcode, Physical Count) that inserts a real `product_variants` row (with `stock_quantity` set to the physical count immediately, and `age_group` auto-inferred from the product's existing variants since that column is NOT NULL with no default) and adds it to the current count session flagged `isNew`, so it always appears in the discrepancy report with a NEW badge even if counted at exactly 0. Barcode uniqueness is checked client-side and against the DB before insert. (2) Print Report / Export CSV — available both in the pre-apply Review Count modal and on the post-apply success screen (same hidden-iframe print pattern as CashReport). Both operate on the full counted session (matches + discrepancies + new items, not just mismatches) per spec; CSV columns are `Date, Product, Size, Color, Barcode, System Qty, Physical Count, Difference, Status`. (3) Admin → Inventory Counts tab (`InventoryCountsAdmin.tsx`) — history table of past counts from `inventory_counts` with View (full item-level detail modal) and Print (reprints the same report). This changed what `adjustments` stores — see the `inventory_counts` table note above.
- **Session 64:** Inventory Count — new `/inventory-count` route for stocktakes on staff phones, gated by the POS PIN (2024, shares the `pos_authenticated` session flag with /pos). Products grouped into one card per product + colour, each size row showing system qty against a large physical-count field that turns green on a match and red on a mismatch. Barcode scan or Enter in the search bar jumps to the exact variant, highlights it and focuses its input; unknown barcodes fall back to text filtering. Sticky bottom bar tracks Counted/Discrepancies, Submit shows a full discrepancy report, and Apply writes each physical count to `product_variants.stock_quantity` and logs the session to the new `inventory_counts` table. In-progress counts persist to localStorage per date so a phone refresh doesn't lose work. Note `/inventory-count` also allows private-LAN hostnames (10.x, 192.168.x, 172.16–31.x) on top of the usual admin-domain check, since staff phones reach the dev server by IP.
- **Session 63:** EOD Cash Report — new protected Reports tab: denomination counter ($0.05–$100, opening/closing), sales auto-filled from `transactions` grouped by payment method, Over/Short calc (green if balanced, red if not — cash-only, unaffected by Deposit/Other), Deposit + Other manual fields, full-page (not thermal-width) print, saves to the new `cash_reports` table (upserts per date so opening counts saved in the morning survive a closing-time revisit same day). Gated behind a Manager PIN (0852) that is deliberately never remembered — no sessionStorage, re-prompts on every lock-icon click, and re-locks the instant you switch to any other Reports tab. Also added an "Other" payment method to POS checkout (single-method only, not split payments) for off-books/miscellaneous tender: fully excluded from the regular EOD report and its totals, auto-fills into Cash Report's dedicated Other field instead (editable, and preserved once a report for that date has been saved).
- **Session 62:** "You Might Also Like" related products on the product detail page — matches category + brand + surface type (fg/ag/mg/turf/indoor/sg, parsed from name/submenus) + age group (adult/youth, parsed from name), never mixing surface types even if that yields fewer than 4 results. Replaced the inaccurate "Free Delivery" badge with "In-Store Pickup" (store is pickup-only). Removed a misleading duplicate "Call to order" CTA that rendered under a working size picker.

## Key Settings
- Primary color: `var(--primary-color)`, default `#b90014` (red) — set via Admin → Settings → Theme; don't hardcode the hex elsewhere in code
- Google Analytics: G-LP6TC6XHFW
- Microsoft Clarity: xygbsedpg3
- Supabase Storage bucket: `media`
