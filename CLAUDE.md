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
- src/components/reports/CashReport.tsx — EOD Cash Report tab (denomination counter, Over/Short, Deposit/Other, print, save)
- src/components/ManagerPinModal.tsx — PIN modal gating Cash Report; never persists access (see Session 63)
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
- `docs/cash-report-migration.sql` must be run in Supabase before Cash Report works — already applied to this project's live Supabase instance during Session 63 testing; only relevant if this project is ever pointed at a different DB

## Recent Changes (last 3 sessions)
- **Session 64:** Variant style code + quantity breakdowns. Product detail page (`ProductDetailPage.tsx`) now shows a "Style: <code>" line under the price — falls back to `product.product_code` when no color is selected, and swaps to the selected color's `product_code` (via `selectedColorEntry`) when a color is picked, updating live. POS cart (`POSPage.tsx`) shows a unit-price breakdown ("N @ $X.XX each" + "Total: $Y") in the plain-price case when `quantity > 1` (override/discount branches already show their own per-line totals). Sale thermal receipt (`thermalReceipt.ts`) shows "N @ $X.XX" in place of "Qty: N" when `quantity > 1`, using the discounted unit price so it always reconciles with the line total (`lineTotal = discountedPrice × quantity`); qty 1 still shows "Qty: 1". Order-confirmation and layaway/pay-later receipts left unchanged.
- **Session 63:** EOD Cash Report — new protected Reports tab: denomination counter ($0.05–$100, opening/closing), sales auto-filled from `transactions` grouped by payment method, Over/Short calc (green if balanced, red if not — cash-only, unaffected by Deposit/Other), Deposit + Other manual fields, full-page (not thermal-width) print, saves to the new `cash_reports` table (upserts per date so opening counts saved in the morning survive a closing-time revisit same day). Gated behind a Manager PIN (0852) that is deliberately never remembered — no sessionStorage, re-prompts on every lock-icon click, and re-locks the instant you switch to any other Reports tab. Also added an "Other" payment method to POS checkout (single-method only, not split payments) for off-books/miscellaneous tender: fully excluded from the regular EOD report and its totals, auto-fills into Cash Report's dedicated Other field instead (editable, and preserved once a report for that date has been saved).
- **Session 62:** "You Might Also Like" related products on the product detail page — matches category + brand + surface type (fg/ag/mg/turf/indoor/sg, parsed from name/submenus) + age group (adult/youth, parsed from name), never mixing surface types even if that yields fewer than 4 results. Replaced the inaccurate "Free Delivery" badge with "In-Store Pickup" (store is pickup-only). Removed a misleading duplicate "Call to order" CTA that rendered under a working size picker.

## Key Settings
- Primary color: `var(--primary-color)`, default `#b90014` (red) — set via Admin → Settings → Theme; don't hardcode the hex elsewhere in code
- Google Analytics: G-LP6TC6XHFW
- Microsoft Clarity: xygbsedpg3
- Supabase Storage bucket: `media`
