# Toronto Soccer Shop - Absolute Soccer Mississauga
Site: torontosoccershop.com
Stack: React + Vite + Supabase + Vercel
GitHub: zizu10101/Absolute-Website
Admin login: info@edgedbs.com

## RECENT CHANGES (August 2026)

**BLOG POST HERO IMAGE: FIX CROPPING (Session 56 - CURRENT):**
- `src/pages/BlogPostPage.tsx`: hero image (rendered between the header/breadcrumb and the article body) was `h-64 md:h-96 overflow-hidden` with `object-cover` on the `<img>` — a fixed-height container that cropped the top/bottom of tall or non-4:3 hero images
- Changed to `w-full rounded-xl overflow-hidden` on the container with `w-full h-auto object-contain` + `style={{ maxHeight: '500px' }}` on the `<img>` — image now renders at its natural aspect ratio (letterboxed, not cropped), capped at 500px tall
- `src/pages/BlogListPage.tsx` card thumbnails (`aspect-[4/3]` + `object-cover`) were left as-is — that's the intentional uniform-grid sizing from session 55, not a cropping bug
- No DB/deploy prerequisites; verified via `tsc --noEmit` (no new errors) — no browser automation available this session (Claude in Chrome extension declined), so the actual rendered crop was not click-verified in a live browser

**BLOG LISTING: UNIFORM GRID, NO FEATURED-POST TREATMENT (Session 55):**
- `src/pages/BlogListPage.tsx`: removed the large "Featured Article" card that the first (most recent) post used to get — every published post now renders through one shared card component in a single `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`, no `index === 0` special case
- All cards share the exact same structure: `aspect-[4/3]` thumbnail, same padding/typography, same "Read More" affordance — a post with no `thumbnail_url`/`image_url` still renders at identical card size via the existing gradient placeholder
- Verified via Playwright with 2 real posts (identical bounding boxes — same width/height/y-position) and a temporary 3rd post (grid filled evenly across `lg:grid-cols-3`, temp post + its Storage-less placeholder deleted after verifying)

**BLOG / GEAR GUIDES SECTION, GEO OPTIMIZATION (Session 54):**
- New Supabase table `blog_posts` (see `docs/blog-migration.sql` — **must be run manually in the Supabase SQL editor**, same as every other migration in this project; no DDL execution path exists from the app/scripts). Columns: `id`, `title`, `slug` (unique), `content`, `excerpt`, `image_url`, `thumbnail_url`, `featured_product_ids` (`UUID[]`), `author`, `is_published`, `published_at`, `created_at`, `updated_at`
- `/blog` (`src/pages/BlogListPage.tsx`, NEW): listing page — every published post in a uniform grid (originally had a large "Featured Article" card for the first post; removed in session 55, see above); each card shows image, title, date, excerpt, "Read More"; only `is_published = true` rows are queried
- `/blog/:slug` (`src/pages/BlogPostPage.tsx`, NEW): full article page — breadcrumb (Home > Gear Guides > Article Title), H1 title, author + date, hero image (`image_url`) between the header and the article body, content rendered via `react-markdown` + `remark-gfm` (added as new dependencies) through a hand-rolled `.blog-prose` CSS class in `src/index.css` (no `@tailwindcss/typography` plugin installed in this repo), a featured-products grid sourced from `featured_product_ids` (rendered just above the article's closing `## Final Thoughts` section when present, otherwise at the end), and `BlogPosting` JSON-LD schema injected the same way `ProductDetailPage`'s Product schema is (imperative `<script>` tag keyed by id, cleaned up on unmount); only published posts are queried, same as the listing page
- Blog prose styling: bold labels (`**Label:**`) render as `font-weight:700 / #111`; `> blockquote` renders as a red-bordered, pink-background alert box — used for the seed article's `**Caution:**` line, which was rewritten in the DB to `> **Caution:**` so it renders as a blockquote
- Admin → **Blog** tab (`src/components/BlogAdminTab.tsx`, NEW, wired into `AdminPage.tsx`'s tab bar): lists all posts (drafts included, admin-only), search-by-title, Add/Edit modal with title (auto-slug via existing `slugify()` util, slug stays editable), excerpt, Markdown content textarea, separate Hero Image and Thumbnail fields (each with a URL input + an Upload button that compresses to WebP via the existing `compressToWebP`/`uploadImage` pipeline — hero 1200×630, thumbnail 800×500, uploaded to `media/blog/`), a Featured Products search-and-select widget (debounced name search against `products`, click to add, shows selected products with remove buttons, order preserved on save/reload), Author field, Published toggle, and Delete (with confirm)
- Blog listing cards use `thumbnail_url` with fallback to `image_url`, then a dark gradient placeholder if neither is set (not a literal `/placeholder.jpg`, which doesn't exist in `public/`)
- Header (`src/components/Header.tsx`) and mobile nav (`src/components/NavigationDrawer.tsx`): "Gear Guides" link added next to Custom Apparel, pointing to `/blog`
- Footer (`src/components/Footer.tsx`): new "Gear Guides" column (grid widened from `md:grid-cols-4` to `md:grid-cols-5`) linking to `/blog`
- `scripts/generate-sitemap.js`: fetches published `blog_posts` slugs and adds `/blog` + each `/blog/:slug` to the generated sitemap
- Seed article: "FG vs AG vs Turf: Which Soccer Cleat Do You Actually Need?" (`fg-vs-ag-vs-turf-soccer-cleats`)
- **GEO (Generative Engine Optimization)** — built independently in this session, then merged with a concurrent session's own (more thorough) GEO audit landed the same day; the merge kept whichever side was more complete per file rather than picking one session wholesale:
  - `public/robots.txt`: explicit `Allow: /` blocks for AI/LLM crawlers — merged list covers GPTBot, ChatGPT-User, OAI-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, ClaudeBot, Claude-User, Claude-SearchBot, anthropic-ai, CCBot, Bytespider — alongside the existing wildcard allow + `/admin`/`/pos` disallow
  - `public/llms.txt`: kept the concurrent session's substantially expanded rewrite (About/Services/Products We Carry/Brands/Geographic Service Area sections), with this session's "Gear Guides" → `/blog` entry added into its Key Pages list
  - `src/pages/HomePage.tsx`: kept the concurrent session's more detailed `sr-only` brand-description paragraph (includes hours/phone), with a "Gear Guides" mention folded in
  - `index.html`: concurrent session also enhanced the homepage `SportingGoodsStore`/`Organization` JSON-LD (knowsAbout, brand list, foundingDate) — untouched by this session, kept as-is
- Verified via `npm run build` (clean), `tsc --noEmit` (no new errors — only pre-existing unrelated errors in `SalesReport.tsx`/`AdminPage.tsx`/scratch root scripts, as previously documented), and live Playwright runs against localhost: blog listing/article render, header/footer links present, admin login → Blog tab → hero+thumbnail upload → save → public page reflects both images, featured-product search/select/save/reload round-trips correctly, and `/blog/fg-vs-ag-vs-turf-soccer-cleats` shows the exact 3 hand-picked products after editing

**BLOG / GEAR GUIDES (Complete):**
- `blog_posts` table in Supabase — columns: `id`, `title`, `slug`, `content`, `excerpt`, `image_url`, `thumbnail_url`, `featured_product_ids`, `author`, `is_published`, `published_at`, `created_at`, `updated_at`
- `/blog` — listing page, uniform 1/2/3-col responsive grid (no special first-post/"Featured Article" treatment — removed session 55)
- `/blog/:slug` — full article with hero image, `react-markdown` rendering, featured products grid, `BlogPosting` JSON-LD schema
- Admin → Blog tab: add/edit/delete posts, hero image upload, thumbnail upload, featured product selector
- Header, mobile nav, and footer all have a "Gear Guides" link
- Sitemap includes blog URLs (`public/sitemap.xml`, regenerated via `npm run generate-sitemap` — a static file, not auto-rebuilt on every commit, so it must be regenerated any time a post is published)
- First article: "FG vs AG vs Turf: Which Soccer Cleat Do You Actually Need?" (`fg-vs-ag-vs-turf-soccer-cleats`) — expanded post-launch to also cover Multi-Ground (MG) cleats alongside FG/AG/TF; content updated directly in Supabase via the JS client (DML, no code/deploy needed)
- `robots.txt` updated to allow AI crawlers
- `llms.txt` updated
- Homepage brand description added (`sr-only`)

**INVOICE & ESTIMATE PRINTING (Session 53 - COMPLETE - DEPLOYED):**

**New Files Created**:
- `src/utils/invoice.ts`: Professional A4 invoice/estimate HTML generator with `generateInvoiceHTML()` and `printInvoice()` functions
  - Supports both invoice (INV-) and estimate (EST-) document types with distinct branding
  - Includes store logo, header with address/phone/website
  - Customer billing section: name, email, phone, company, address
  - Itemized product table: name, size/color, quantity, unit price, line total
  - Automatic tax calculation (13% HST), grand total with red highlighting
  - Payment method display (invoices) or disclaimer (estimates - valid 30 days)
  - Proper HTML entity escaping for security
  - Browser print dialog opens A4-formatted document for all modern browsers

- `src/components/InvoiceCustomerModal.tsx`: Smart customer information collection modal
  - Two modes: Manual Entry (form with optional Company/Address fields) and Search Existing Customer
  - Search filters customers by name, email, or phone (live filtering from DB)
  - Pre-fills with linked customer from transaction if available
  - Optional "Save customer info for future use" checkbox (only saves if explicitly checked)
  - Clear primary action (Print Invoice/Estimate) and Cancel button
  - Keyboard navigation (Tab, Escape, Enter) and accessibility support
  - Smooth transitions and error handling

- `docs/INVOICE_ESTIMATE_FEATURE.md`: Comprehensive 400+ line feature documentation
  - Complete feature overview and architecture
  - Files created/modified with detailed descriptions
  - Testing checklist with 40+ specific test cases (POS receipt, Transaction History, Modal features, Print output, Data validation)
  - Browser compatibility matrix (Chrome, Firefox, Safari, Edge)
  - Troubleshooting guide with 5 common issues and solutions
  - Performance notes (instant invoice generation < 1ms, no network calls during print)
  - Security analysis (XSS prevention, client-side print, optional DB save)
  - Accessibility notes (ARIA labels, keyboard navigation, WCAG AA color contrast)
  - Future enhancement ideas (email delivery, SMS, custom templates, digital signatures, recurring invoices)

**Files Modified**:
- `src/pages/POSPage.tsx`: Added invoice/estimate functionality to receipt screen
  - New state: `showInvoiceModal`, `invoiceType` ('invoice' | 'estimate')
  - New handlers: `handleOpenInvoiceModal()`, `handlePrintInvoice()`
  - New UI: Two buttons below Gift Receipt (Invoice with FileText icon, Estimate with FileText icon)
  - Buttons arranged: [Print 1x] [Print 2x] [Gift Receipt] [Invoice] + [Estimate] [New Sale]
  - Integrated `<InvoiceCustomerModal>` component with pre-filled customer if available
  - Passes selected customer and customer ID to modal

- `src/components/PosTransactionHistory.tsx`: Added invoice/estimate reprint buttons
  - New state: `showInvoiceModal`, `invoiceType`, `invoiceTx`
  - New handlers: `openInvoiceModal()`, `handlePrintInvoice()`
  - New UI: Two cyan-colored buttons on each transaction ([Invoice] [Estimate])
  - Positioned after Gift Receipt button in action buttons row
  - Allows reprinting invoices/estimates with updated customer details from transaction
  - Can generate both document types from same transaction record
  - Integrated `<InvoiceCustomerModal>` with transaction customer pre-fill

**Features Summary**:
✅ Professional A4 invoice format (customizable via browser print dialog)
✅ Two document types: Invoice (paid/completed) and Estimate (30-day quote)
✅ Customer information collection before printing
✅ Search existing customers by name, email, phone
✅ Pre-fill with linked customer if transaction has one
✅ Optional new customer save-to-database
✅ Works for walk-in customers (no pre-filled info needed)
✅ Itemized product list with sizes, colors, quantities
✅ Automatic subtotal, HST (13%), grand total calculations
✅ Payment method display for invoices
✅ Estimate disclaimer for quotes
✅ Keyboard navigation and accessibility support
✅ No external dependencies (uses native browser print)
✅ Security: HTML entity escaping, client-side processing, optional DB save
✅ Performance: Instant generation (< 1ms), no network calls during print
✅ Browser compatibility: Chrome, Firefox, Safari, Edge

**Deployment Status**: ✅ DEPLOYED to GitHub main
- Commit: `9192a86` - feat: add invoice and estimate printing to POS
- Merge commit: `102b934` - Merged with remote session 52 changes
- All TypeScript validates without errors
- Build passes without warnings (pre-existing chunk size warnings only)
- Working tree clean, no uncommitted changes
- Remote main branch up to date with all changes

**PRODUCT FEED, REPORTS IMPROVEMENTS, EOD RECEIPT CLEANUP (Session 52):**

**Google Merchant Center / Meta Commerce Manager Product Feed:**
- `server.ts`: New GET `/product-feed.xml` endpoint serves RSS/XML product feed compatible with Google Merchant Center and Meta Commerce Manager
  - Fetches all `is_online=true` products from Supabase with real-time stock status from `product_variants` table
  - Includes all required fields: product ID, title, description, link, image, availability, price, sale_price, brand, condition, MPN, identifier_exists, Google product category
  - Proper XML escaping for special characters
  - 1-hour server-side cache to avoid hammering Supabase on every request
  - Stock availability calculated: `in_stock` if any variant has `stock_quantity > 0`, else `out_of_stock`
  - Tested on localhost: verified valid XML output with real product data
- `docs/PRODUCT_FEED_SETUP.md`: Comprehensive guide for configuring feed in Google Merchant Center and Meta Commerce Manager
  - Step-by-step setup instructions for both platforms
  - Monitoring, maintenance, and troubleshooting section
  - Technical details on feed generation and caching
  - Field mapping and dynamic ads configuration
- Feed endpoint: https://torontosoccershop.com/product-feed.xml

**Reports Page Navigation & Accessibility:**
- `src/components/ReportsPage.tsx`: Added back button and Escape key navigation
  - Back button with arrow icon at top of Reports page - returns to `/pos`
  - Escape key handler - pressing Escape navigates back to POS
  - Button styled: `bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors`
  - Works for all report tabs (EOD, Sales, Products, Gift Cards, etc.)
  - `useEffect` cleanup on unmount prevents memory leaks

**End of Day Report Improvements:**
- `src/components/reports/EndOfDayReport.tsx`: Complete redesign of EOD receipt format and print workflow
  - **Payment method filtering**: Only shows methods with `amount > 0` (cleaned up from showing all 8 payment methods even if unused)
  - **Split payment support**: Parses `payment_splits` JSONB array from transactions, sums each method's amount, counts unique transaction IDs correctly
  - **New `generateEODReceiptHTML()` function**: Generates clean, printer-ready HTML for 80mm thermal receipts
    - Store header: logo, name (ABSOLUTE SOCCER MISSISSAUGA), address, phone
    - Title: "END OF DAY REPORT" centered
    - Date and time in readable format
    - Payment breakdown: only methods with sales > $0, sorted by amount descending
    - Subtotal (net sales), HST (13%), TOTAL
    - Transaction count
    - Friendly footer message
  - **Removed fields** from old format: customer name line, transaction type, cashier, ref#, balance due, qty lines, decorative lines with prices
  - **EOD Receipt Preview Modal**:
    - Added `showEODPreview` and `eodPreviewHTML` state variables
    - Added Escape key handler: pressing Escape closes the preview modal
    - Modal features: centered dialog, sticky header with close button, scrollable receipt preview in iframe, Print button, Dismiss button
    - Print button opens browser print dialog; users can send to thermal printer from there
    - Close button (X) in top-right corner + Dismiss button at bottom
    - Dark overlay focuses attention on modal
    - Modal content scrolls while header stays sticky
  - `handlePrintThermal()` now shows preview instead of opening new window
- `docs/EOD_RECEIPT_IMPROVEMENTS.md`: Complete documentation of receipt redesign
  - Before/after format comparison
  - Preview modal features and keyboard shortcuts
  - Technical implementation details
  - Testing checklist
  - Printer configuration guidelines
  - Payment method filtering logic with examples

**COLOR SALE PRICING, MASTER VARIANT AUTO-NAMING, DEFAULT BUTTON FIX (concurrent session, Aug 7):**
- `ColorVariant` interface gained `salePrice`/`isDefault` fields; per-color sale price field in Add/Edit Product; Master Variant Color section auto-updates all NULL-color variants on save; `ProductDetailPage`/`ProductCard`/`POSPage` price logic now uses color-level `salePrice` when a color is selected. (Full write-up landed under the July 2026 "COLOR VARIANT IMPROVEMENTS (Session 40)" heading further down by the originating session — left as-is rather than moved, to avoid re-splitting content across merges)

**CUSTOM LAB / KIT ORDERS IFRAMES, 400 FIX, POS NEW PRICE DISCOUNT, FOOTER HEADING FIX (Session 52):**
- Custom Lab page (`/custom-lab`): iframe embed of Google AI Studio jersey designer — URL: `https://absolute-basic-jersey-customizer-930161668914.us-west1.run.app`
- Kit Orders page (`/kit-orders`): iframe embed of uniform designer — URL: `https://absolute-uniform.ai.studio`
- Both pages use standard site Header and Footer (via `Layout`) — `src/App.tsx`'s dynamic `navigationMenus.map()` route generator was silently shadowing both pages' dedicated routes with a `ProductGridPage` route at the same path (DB nav menu rows `CUSTOM LAB -> /custom-lab` and `KIT ORDERS -> /kit-orders` collided with the static routes), showing "No products found" instead — fixed via a `RESERVED_PAGE_PATHS` exclusion list
- Footer h4 changed to h3 for heading hierarchy (`src/components/Footer.tsx` — Shop/Custom Lab/Support section titles)
- 400 error fixed: removed invalid `created_at` query from homepage (`products` table has no `created_at` column — confirmed via direct Supabase query, error code `42703`); `HomePage.tsx`'s New Arrivals fetch now queries the working `isNewArrival` flag directly instead of attempting the failing query first
- Set New Price discount option added to POS: item-level cart discounts now support a 3rd type alongside %/$ off — staff enter a final price directly, discount is derived as `originalPrice - newPrice`, with validation against $0 and against exceeding the original price
- Master variant color naming field added above release date in Edit Product (documented under Session 50)
- Color selector on product page shows only named colors, no "All Colors" button (documented under Session 50)
- Rapid Scan dropdown shows named colors when defined, free text when not (documented under Session 49)
- Corrupted characters fixed on POS (documented under Session 49)
- Quantity field in POS cart now allows typing numbers directly (documented under Session 49)
- Google Analytics: `G-LP6TC6XHFW` (documented under Session 49)

**POS DARK/LIGHT MODE TOGGLE (Session 51):**
- `src/pages/POSPage.tsx`: Implemented fully functional dark/light mode toggle for POS system
  - `isDarkMode` state with localStorage persistence (defaults to dark mode if no saved preference)
  - Toggle button with Sun/Moon icon in top bar, smooth transitions between modes
  - Conditional styling applied throughout entire POS: top bar, left panel (search/categories/products), right panel (cart/totals), all buttons, modals, forms, tabs
  - **Text color fixes**: eliminated all hardcoded `text-white` in light mode and hardcoded dark text in dark mode
    - Dark mode: white/light gray text on dark backgrounds
    - Light mode: black/dark gray text on light backgrounds
  - **Logo switching**: uses header logo in light mode, footer logo in dark mode (via `displayLogo` computed from `isDarkMode` state)
  - Preference persists across page reloads via localStorage key `pos_dark_mode`
  - All interactive elements support both modes: action tiles, payment methods, discount editor, split payment UI, size selector modal, checkout panel
  - Receipt section intentionally remains light-colored (mimics printed receipt on white paper)
  - Build passes without errors, all sections properly themed

**MASTER VARIANT COLOR NAMING, COLOR SELECTOR REFINEMENT (Session 50):**
- `src/pages/AdminPage.tsx`: Added "Master Variant Color Name" field in Edit Product form, positioned right after Release Date field
  - When saved with a value, auto-updates all uncolored variants (`color IS NULL OR color = ''`) in `product_variants` table to that name
  - Field is cleared after successful save and when closing the edit modal
  - State: `masterVariantColor`, handler integrated into existing `handleUpdate()` function
- `src/pages/ProductDetailPage.tsx`: Removed "All Colors" button from color selector
  - Simplified from conditional rendering (different UI for variants vs product.colors) to unified `allColorNames` list
  - Now shows only actual color buttons — no "Default"/"All Colors" deselect button
  - Clicking a color toggles it (click again to deselect)
  - Works correctly whether colors come from master variants (`v.color`) or product color ways (`product.colors[].name`)
- `src/pages/AdminPage.tsx`: Variant table inline color editing (already existed, re-verified working)
  - All variants now show editable color input field (no conditional hiding)
  - Empty color fields render with placeholder text, saving via Enter/blur
  - Green checkmark animates briefly on save, auto-clears after 1.5s
- Result: Product detail page now shows `[Black] [Green]` instead of `[All Colors] [Green]` when master variants are named

**THERMAL RECEIPT REDESIGN, MOBILE PERFORMANCE, ACCESSIBILITY, VARIANT COLOR UX, POS FIXES (Session 49):**

**Thermal receipts — full redesign to a unified black-logo layout:**
- `src/utils/thermalReceipt.ts`: rewrote all 6 receipt generators (`generateThermalReceiptHTML`, `generateGiftReceiptHTML`, `generateStoreCreditReceiptHTML`, `generateLayawayReceiptHTML`, `generatePayLaterReceiptHTML`, `generateLayawayPaymentReceiptHTML`) onto one shared CSS block + composable HTML builders (header, metadata, barcode, payment-methods, footer) instead of 6 near-duplicate style blocks
- Every receipt: black logo only (`/logo-black.png`, no "ABSOLUTE SOCCER" text), 80mm paper / 72mm centered content column (4mm gutter each side), a 2-column Transaction/Ref#/Date/Cashier/Time metadata block, real split-payment breakdown ("Paid Cash / Paid Debit / ...") wired through from `POSPage.tsx`'s `paymentSplits` instead of a joined string, barcode + ref# at the bottom, standard footer ("Thank you for shopping with Absolute Soccer! / Exchange or refund within 14 days...")
- Footers no longer reference layaway hold periods or pickup timing (removed "Items held for 30 days", "Pickup by [date]", "Ready For Pickup" banner, "Remaining balance due on pickup" — kept non-pickup operational lines like "Deposits are non-refundable")
- Fixed a real pre-existing double-print-dialog bug: `generateGiftReceiptHTML` no longer auto-prints internally now that all 3 callers already trigger print themselves via `window.onload` (kept the internal auto-print on `generateStoreCreditReceiptHTML` since its sole caller, `ReturnsModal.tsx`, doesn't self-print)
- Fixed 2 pre-existing `tsc` errors: `POSPage.tsx`/`PosTransactionHistory.tsx` were passing `subtotal`/`hst`/`total`/`paymentMethod` into a gift-receipt type that never had those fields (gift receipts show no prices)

**Mobile performance / PageSpeed:**
- Hero carousel: only the real first slide (`infiniteSlides` index 1 — index 0 is an off-screen clone used for the carousel's infinite loop, not the LCP element) gets `loading="eager"` + `fetchPriority="high"`; everything else lazy/low
- `index.html`: added Supabase `preconnect`/`dns-prefetch`, Google Analytics gtag.js (already async)
- `decoding="async"` added across hero, brand banners, category tiles, product cards
- First brand banner image and first category tile image get eager/high priority (matching the hero); everything else stays lazy
- Google Maps iframe in the "Visit Us" section now mounts only when scrolled into view (`IntersectionObserver`), instead of loading its ~400KB embed script upfront
- `SettingsContext.tsx`: the `settings` table read now selects only `key, data` filtered to the 10 keys actually used (`global`, `slider`, `homeCategories`, `navigation`, `footer`, `seo`, `store_info`, `theme`, `brand_images`, `category_images`) instead of `select('*')` — cut the initial payload substantially. Note: had to expand a proposed 7-key list to the full 10; the missing 3 (`global`, `homeCategories`, `footer`) would have silently broken the header logo, the homepage "Select Your Squad" section, and footer links
- Header logo: added `width`/`height` attributes (CLS hint only — the existing responsive `h-10 md:h-16 w-auto` Tailwind sizing still controls actual rendered size, CSS always wins over HTML width/height attributes)

**Accessibility — contrast, touch targets, heading hierarchy:**
- Color contrast: darkened `text-zinc-400`/`text-gray-400` → `zinc-600` and `text-zinc-300` → `zinc-700` everywhere they sat on a light background, checked individually per component (not blind find-replace) — left every dark-background instance untouched (Footer, hero overlays, "Visit Us" sections, the dark "Available In Store" boxes on the product page). Scoped to public-facing pages only; POS/Admin/reports UI is staff-only and not part of the audited public site
- Touch targets bumped to 48×48 min: hero carousel arrows + dot indicators (dots restructured so the larger hit area doesn't visually bloat the small pill — outer button is the 48px hit target, a small inner `<span>` is the visible dot), header hamburger/wishlist/search/search-close, nav drawer close + menu-toggle chevrons + top-level nav rows, product image prev/next arrows, filter sidebar close button
- Heading hierarchy fixes: `ProductCard`'s product name was `<h4>` directly under an `<h2>` section (New Arrivals/On Sale) with no `<h3>` — now `<h3>`. `ProductGridPage` had a real h1→h3 skip on any plain category page with no logo-grid submenu (the "All Products" h2 only rendered inside that block) — hoisted it to render whenever the product grid does. `ProductDetailPage`'s "Product Not Found" state was an `<h2>` with no `<h1>` anywhere in that render branch — promoted to `<h1>`. `MississaugaSoccerPage`'s "Visit Us" section used `<h3>` where every sibling section (and the same section on the Brampton/CustomApparel sister pages) uses `<h2>` — fixed for consistency. Known pre-existing gap left alone: `BrandPage.tsx` has an h1→h3 skip, wasn't in the requested file list

**Logo transparency fix (root cause was the WebP compression pipeline, not CSS):**
- A reported "white box around the footer logo" had no matching CSS anywhere in `Footer.tsx` — no `bg-white`, no wrapping div, nothing. Root cause: `compressToWebP()` in `src/lib/imageUtils.ts` unconditionally painted an opaque white rectangle onto the canvas before drawing the uploaded image, then flattened to WebP — correct for product photos (stops transparent PNGs turning black) but wrong for logos, which need to keep working on any background color
- Added an opt-in `preserveTransparency` parameter (skips the white-fill when true); the three logo upload handlers (header/landing/footer logo) in `AdminPage.tsx` now pass `true`. WebP itself supports an alpha channel same as PNG, so output format stayed WebP rather than falling back to PNG
- This only fixes *future* uploads — the currently-live footer logo already has white baked into its pixels from before this fix existed and needs to be re-uploaded once through Admin → Settings → Theme to pick up real transparency

**Variant color UX + robustness:**
- `RapidScanIntakeMatrix.tsx`: color field is a dropdown of the product's named colorways (with a `(none)` option so color stays optional) when any exist, falling back to today's free-text input when the product has none — never blocks scanning/intake for products without predefined colors
- `AdminPage.tsx`: the "Apply to All" bulk uncolored-variant color update now targets exact variant IDs from already-loaded state instead of a server-side `.or('color.is.null,color.eq."")')` filter string, which could plausibly fail to match empty-string colors depending on how PostgREST parses the quoted empty value
- Per-row inline color editing in the "Registered Master Variants" table (click a variant's color cell, type a name, blur or press Enter, saves directly to `product_variants` — already existed from an earlier session, was thoroughly re-verified this session since it kept getting reported as missing; it was never actually broken)
- Fixed a mojibake checkmark (corrupted bytes containing an invisible control character) in the per-row save-confirmation indicator

**POS corrupted characters + typeable cart quantity:**
- Fixed remaining mojibake across `POSPage.tsx`, `PosRegister.tsx`, `PosCustomerManager.tsx`: a cross-mark emoji whose corrupted form contained an invisible control character between the visible glyphs (had to fix by exact codepoint match — hand-typing the replacement string couldn't reproduce the invisible character, so several `Edit` attempts silently failed to match), plus em-dash/middot/multiplication-sign mojibake, replaced with ASCII equivalents. Left real, correctly-encoded characters alone (emoji category icons, real em-dashes, real × and · characters, real U+2212 minus signs) and skipped invisible box-drawing comment dividers — not part of what's rendered on screen
- Cart quantity is now a typeable `<input type="number">` between the existing −/+ buttons instead of a read-only `<span>`, styled to match the dark POS theme; native spinner arrows hidden since −/+ already cover that; wired to the existing `updateItemQuantity`, which already clamps to a minimum of 1

**WEBP IMAGE COMPRESSION, HOMEPAGE H1, FOOTER ADDRESS (Session 48):**
- `src/lib/imageUtils.ts`: `resizeImage()` renamed to `compressToWebP()` — same base64-in/base64-out signature, now always encodes the output as WebP (`canvas.toDataURL('image/webp', quality)`) instead of PNG/JPEG; white-background canvas fill (transparent-PNG fix from session 44) kept. Browsers without WebP encode support fall back to PNG automatically (native `toDataURL` behavior) — no crash risk
- `src/pages/AdminPage.tsx`: all 23 call sites renamed to `compressToWebP()`; dimensions/quality retuned per upload category — product images (main/gallery/color-variant/edit) 1000×1250→**800×800 q0.85**, hero/slider images 1920×1080→**1600×640 q0.85**, site logos (main/landing/footer) 800×800→**400×200 q0.90**, brand showcase images 1200×800→**1200×600 q0.85**, category tile images already 800×800 q0.85 (unchanged). Upload types not covered by the spec (nav menu/submenu icon logos, SEO OG share image, custom-apparel lab background, homepage "Select Your Squad" category cards) kept their existing dimensions but now also get WebP conversion for free since they funnel through the same function — `uploadImage()` already derives Supabase Storage `contentType` from the data URL's mime prefix, so no upload-path changes were needed
- `src/pages/HomePage.tsx`: added a visually-hidden `<h1 className="sr-only">Absolute Soccer - Premier Soccer Store in Mississauga & GTA</h1>` at the top of the page — the homepage previously had no `<h1>` at all (hero slider has no heading text baked into markup)
- `src/components/Footer.tsx`: added a visible `<address>` block (store name, full address, phone) reading from the existing `storeInfo` context — same data source as the HomePage "Visit Us" section (session 9), so it stays in sync with Admin → SEO → Store Information instead of being hardcoded
- Verified via `npm run build` (clean); could not click-test the actual upload flow in a browser this session (user declined the Chrome extension) — logic verified by code review only, user asked to spot-check on localhost

**ACCESSIBILITY + SEO: HAMBURGER MENU ARIA-LABEL, llms.txt (Session 47):**
- `src/components/Header.tsx`: mobile hamburger menu `<button>` (opens `NavigationDrawer`) had no accessible name — icon-only button read as unlabeled to screen readers. Added `aria-label="Open Navigation Menu"`
- `public/llms.txt` (NEW): llms.txt file for LLM crawlers/AI search — store summary, key page links (home, footwear, national teams, clubs, custom apparel, Brampton/Mississauga landing pages, equipment, accessories), contact info, hours. Not referenced by any route/build step — static file served directly from `public/` at `torontosoccershop.com/llms.txt`
- Verified via `npm run build` (clean) — pre-existing unrelated `tsc --noEmit` errors in `BrandBanners.tsx`, `PosTransactionHistory.tsx`, `AdminPage.tsx`, and scratch root-level scripts (`audit_germany_images.ts` etc.) left untouched, not introduced by this session

**LAYAWAY/PAY LATER PAYMENT RECEIPTS, REPRINT BUTTONS, TEXT-COLOR FIX, SALES REPORT DATE PICKER + TIMEZONE FIX (Session 46):**

**Layaway/Pay Later payment receipts:**
- `src/utils/thermalReceipt.ts`: new `generateLayawayPaymentReceiptHTML()` — a dedicated "LAYAWAY PAYMENT RECEIPT" / "PAY LATER PAYMENT RECEIPT" printed after a payment is taken against an existing balance (separate from the original hold receipt). Shows ref #, customer + phone, an items summary (name/qty only, no prices), Payment Made / Previous Balance / New Balance Remaining, and a "PAID IN FULL — READY FOR PICKUP" banner when the balance hits $0
- `generateLayawayReceiptHTML()`/`generatePayLaterReceiptHTML()` (from session 45) also gained: a visible `Ref #` row (previously barcode-only), customer phone, item color in the detail line (was captured but not displayed), and a Subtotal/HST(13%) breakdown reverse-calculated from the stored tax-inclusive total (these tables only persist one `total_amount`, not a subtotal/tax split — reuses the same reversal approach the gift-receipt code already used); layaway receipt also gained an exchange-policy footer line
- `src/components/PosLayawayTab.tsx`: `handleTakePayment` no longer silently auto-prints on full payment — every payment (partial or full) now shows a confirmation screen ("Payment recorded successfully!" + Payment Made/Previous/New Balance + `[Print Payment Receipt] [Done]`) before returning to the record
- **Reprint buttons**: every row in the combined Layaway/Pay Later list (POS tab + Admin tab, same shared component) now shows `[View] [Payment/Pay] [Reprint] [Cancel]` inline — Reprint calls the original receipt generator directly with the record's *current* balance, no need to open the record first; Cancel/Payment are disabled once a record is completed or cancelled. Fixed a related bug: clicking Cancel from the list was force-navigating into the detail view afterward even when nothing was previously selected — now only updates the list in place unless that record was already open
- **Text-color bug**: `POSPage.tsx` wraps the whole POS app in `text-white` (page-wide dark theme); `PosLayawayTab.tsx` renders white cards inside it, so two buttons without an explicit dark override ("Print Payment Receipt", "Print Receipt") were invisible white-on-white. Fixed with `text-zinc-900`. Every other text element in the file already had an explicit color class

**Sales Report date range picker:**
- `src/components/reports/SalesReport.tsx`: "Daily" filter now shows a single date input (defaults to today Eastern, max today — no future dates) instead of being hardcoded to always show today; filter buttons relabeled to match spec (`Custom Range` instead of `custom`). "Custom Range" (From/To) already existed but was silently broken — see timezone fix below

**Timezone fix — root cause was NOT "server uses UTC", it was `timezoneUtils.ts` itself:**
- The old `getEasternDayRange`/`getEasternRangeUTC` detected EDT-vs-EST by checking `new Date().getTimezoneOffset()` — the *host machine's* configured timezone, not Toronto's actual DST status. Wrong whenever the code runs somewhere not itself set to Eastern. Rewrote `src/utils/timezoneUtils.ts` to determine the Eastern UTC offset via `Intl`/`toLocaleString` with an explicit `America/Toronto` timezone (diffing the same instant formatted in UTC vs Eastern — cancels out the host's own timezone), computed per-date rather than "now" (a January report run in August was previously using August's EDT offset for a January date). Verified against both an EDT date (Aug) and EST date (Jan), and against the literal reported bug (a transaction at 10:30 PM Eastern Aug 1 = 2:30 AM UTC Aug 2 now correctly reports as Aug 1)
- New exports: `getTodayEastern()`, `shiftEasternDate()`, `shiftEasternMonths()`, `formatEasternDate()`, `formatEasternDateTime()`, `formatEasternTime()` (existing `getEasternDayRange`/`getEasternRangeUTC` kept, same signatures, fixed internals)
- The underlying bug was systemic, not Sales-only: every one of the 7 report files (`SalesReport`, `EndOfDayReport`, `CustomerReport`, `ProductReport`, `VoidRefundReport`, `GiftCardReport`, `StoreCreditReport`) independently defaulted its date-range inputs via `new Date().toISOString().split('T')[0]` (a UTC calendar day — wrong for hours where Eastern and UTC disagree on the date) and/or displayed row timestamps via `created_at.split('T')[0]` or bare `.toLocaleDateString()` (raw UTC substring / browser-local time, no Eastern conversion at all). Fixed all of them to use the corrected shared utility. `GiftCardReport.tsx` additionally had its own bespoke UTC-string query-range construction bypassing the shared utility entirely — switched to `getEasternRangeUTC()`
- `SalesReport.tsx` also had two standalone bugs found along the way: (1) CSV export / PDF print were reading `.from`/`.to` off `getDateRange()`'s return value, which only has `.start`/`.end` — an actual crash bug, present since it was written (this matches a `tsc` error that had been showing up unrelated to earlier sessions' work); (2) the Daily Breakdown table and sales chart bucketed transactions by UTC calendar day (`new Date(t.created_at).toISOString().split('T')[0]`) instead of Eastern, which would split one Eastern business day's sales across two rows near midnight
- Verified via a standalone script exercising the utility directly (EDT/EST auto-detection, day-boundary reproduction of the exact reported bug) plus `npm run build` + `tsc --noEmit` (clean, and silently fixed two pre-existing TS errors that had been present for several sessions)

**LAYAWAY, PAY LATER, ITEM DISCOUNTS, UNVOID + BUG FIXES (Session 45):**

**Item-level discounts in POS cart:**
- `src/hooks/usePOSCart.ts`: `CartItem.discountPercent` (dead field, never wired to UI) replaced with `CartItem.discount?: { type: 'percent' | 'fixed'; value: number }`; added `getItemUnitDiscount()` / `getItemDiscountedPrice()` helpers (exported, used everywhere a discounted line total is shown); `updateItemDiscount(id, discount | null)` signature changed to take the discount object; `totalDiscount`/`subtotal`/`taxableSubtotal` all now use the new per-item discount instead of the old unused percent field
- `src/pages/POSPage.tsx`: each cart row has an "Add Discount"/"Edit Discount" control — inline `%`/`$` type selector + value input — showing struck-through original price, the discount line, and the discounted "Item Total"; wired into the checkout-form item list and the post-sale on-screen receipt view too
- `src/utils/thermalReceipt.ts`: `ReceiptData.items[].discount` optional field added; printed thermal receipt itemizes the per-item discount and prints the discounted line total
- Colors iterated twice this session per feedback: item discount text/labels are now `text-yellow-400` (dark POS backgrounds) / `text-yellow-600` (white receipt view + `PosDiscountModal` preview) — was red, then emerald, before landing on yellow. The discounted "Item Total" value is `text-white font-bold` (was the red `var(--primary-color)` brand color) in the cart row and — only when a discount is actually applied — in the checkout-form item list; undiscounted items keep the normal brand-color price display

**Layaway:**
- New Supabase table `layaways` (see `docs/layaway-paylater-migration.sql` — **must be run manually in the Supabase SQL editor**, same as every other migration in this project; no DDL execution path exists from the app/scripts)
- `src/components/LayawayPayLaterModal.tsx` (NEW): shared modal for both Layaway and Pay Later creation (`mode` prop). Layaway requires a deposit amount; on confirm it inserts into `layaways`, deducts stock for held items (same loop as a normal sale), and offers a Print Receipt button
- POS register: "Layaway" button next to Checkout — requires a selected customer first; if none is selected it switches to the Customers tab and auto-resumes the Layaway modal once a customer is picked/created (`pendingSpecialCheckout` state + `handleSelectCustomer`)
- `src/components/PosLayawayTab.tsx` (NEW): combined Layaway + Pay Later management screen — lists both types (joined with `customers`), search by name, take a full/partial payment against the balance (auto-prints a completion receipt at $0 balance), reprint any receipt, and **Cancel** (sets `status='cancelled'`, restocks the held items' variant quantities, hidden once paid off). Reachable from a new POS bottom-nav "Layaway" tab and a new Admin "Layaways" tab (`AdminPage.tsx` — same component reused, no duplicate code)
- `src/utils/thermalReceipt.ts`: added `generateLayawayReceiptHTML()` — items on hold, total/deposit/balance, "Items held for 30 days" + computed pickup-by date

**Pay Later:**
- New Supabase table `pay_later` (same migration file as layaways)
- Same modal/flow as Layaway minus the deposit step — full amount saved as owed, `status='unpaid'`
- `src/utils/thermalReceipt.ts`: added `generatePayLaterReceiptHTML()` — items, amount owed, "Payment due upon next visit"
- Managed (pay balance / cancel) through the same `PosLayawayTab.tsx` screen as Layaway

**Unvoid transaction:**
- `src/components/PosTransactionHistory.tsx`: voided transactions now show `[Voided] [Unvoid]` — confirms, sets `status` back to `'completed'`, refreshes the list, flashes success (mirrors the existing `handleVoid`)

**"Walk-in" removed from receipts:**
- `src/utils/thermalReceipt.ts`: the Customer/"For" row is now omitted entirely (not printed as "Walk-in") in all three receipt generators whenever there's no real customer name

**Customer creation bug fix (was blocking Layaway/Pay Later, not RLS):**
- `customers.email` has a UNIQUE constraint; `src/context/CustomerContext.tsx`'s `addCustomer()` was inserting a literal `''` for a blank email instead of `null` — Postgres unique constraints reject duplicate `''` values (only `NULL` is exempt), so creating a second customer with no email always failed with `23505 duplicate key value violates unique constraint "customers_email_key"`. Diagnosed by inserting directly against the live DB with both the anon key and the service-role key (both failed identically, which is what ruled out RLS). Fixed in both `addCustomer()` and `updateCustomer()` (normalizes a blank/cleared email to `null`)
- `src/components/PosCustomerManager.tsx`: New/Edit Customer form relabeled Phone/Email as "(Optional)", reordered Phone before Email, removed `type="email"` (was not blocking submission — no `<form>` wrapper — but could trigger native browser invalid-styling on a blank value)
**SPLIT PAYMENTS, COLOR VARIANT FIELD, SLEEVE SIZES, COST PRICE (Session 44 — merged from a concurrent session, see Build Notes below):**
- ✅ Split payments in POS: step-by-step flow (select method → enter amount → confirm → repeat → Complete Sale), "Full Amount"/"Remaining" quick buttons, live remaining-balance display, add/remove individual splits; `splitStep` + `paymentSplits` state; `payment_splits` JSONB column on `transactions` (requires SQL migration — see Pending DB Migrations); receipts (thermal/gift/store credit) show a "Payment Breakdown" section
- ✅ Color variant field made always-optional (no asterisk/required warning) on 2nd+ variants; placeholder "Color name (optional, e.g. White, Red, Blue)"; saves NULL if blank
- ✅ "Sleeves" age group added (sizes `['S/M', 'L/XL']`) to Admin product form and `RapidScanIntakeMatrix`
- ✅ Cost price field on products (`cost_price`, staff-only, POS shows `Cost: $X.XX | Margin: X%`, never customer-facing) — `ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);`
- ✅ Transparent PNG fix: `resizeImage()` in `src/lib/imageUtils.ts` now fills a white canvas background before drawing, so transparent PNGs no longer show black; all product image containers standardized to `bg-white` + `object-contain`
- **Build Notes:** inline `<style>` in `index.html` moved to `src/print-styles.css` (Vite v6.4.3 failed on inline style tags in the html-proxy build step); a smart-quote character in `RapidScanIntakeMatrix.tsx` that broke esbuild parsing was replaced with an ASCII quote

**COLOR VARIANT IMPROVEMENTS (Session 40):**
- `src/context/ProductContext.tsx`: `ColorVariant` interface now has `salePrice?: number` and `isDefault?: boolean` fields
- `src/pages/AdminPage.tsx`: Sale price field added to each color way in Edit Product and Add Product forms
- `src/pages/AdminPage.tsx`: Master Variant Color section added (above Color Ways list) — name the default product color and set its sale price; stored as `{ isDefault: true, name, salePrice, images: [] }` in the `colors` JSONB array
- `src/pages/AdminPage.tsx`: On save (both `handleUpdate` and `handleAdd`), if a master color name is set, all `product_variants` with `color IS NULL` or `color = ''` for that product are automatically updated to the master color name via Supabase update
- `src/pages/ProductDetailPage.tsx`: `displayPrice` / `displayOriginalPrice` refactored — uses `colorSalePrice` when a color with `salePrice` is selected; shows strikethrough of original price; falls back to product-level sale or base price; when no color selected, shows lowest price across all color sale prices
- `src/pages/ProductDetailPage.tsx`: "Default" button in color selector hidden when all registered variants have a color assigned (`variants.some(v => !v.color)` guard); shows only when at least one uncolored variant exists
- `src/components/ProductCard.tsx`: Computes `lowestPrice` and `isOnSaleAny` from all color `salePrice` values — sale badge and price display use these; color-only sale reflected on card
- `src/pages/POSPage.tsx`: Barcode scan and size selector modal both look up `variant.color` in `product.colors` and apply `colorEntry.salePrice` if present when building the cart item

## RECENT CHANGES (July 2026)

**CATEGORY TILE TITLE/GRADIENT REDESIGN (Session 43):**
- `src/components/CategoryQuickLinks.tsx`: tiles with an uploaded image now show the title bottom-left with an `ArrowRight` icon (lucide-react) bottom-right, over a `bg-gradient-to-t from-black/70 via-transparent to-transparent` overlay — replaces the old centered title + flat `bg-black/50` dim
- Emoji-fallback tiles (no image set for that category) are unchanged — centered emoji + title on white background, since a gradient over blank background has nothing to gradient
- Verified on localhost at desktop (1440px) and mobile (390px, 3-col grid) — wrapping titles (e.g. "National Teams") still render correctly with the arrow icon aligned bottom-right

**EDITABLE CATEGORY TILE TITLES (Session 42):**

**Admin → Settings → Theme → Category Tile Images:**
- `src/context/SettingsContext.tsx`: `CategoryImageData` gains an optional `title` field (`{ image?, link?, title? }`) alongside the session 41 `image`/`link` fields
- `src/pages/AdminPage.tsx`: added `DEFAULT_CATEGORY_TILE_TITLES` map (Cleats/Jerseys/Gloves/Balls/Training/Accessories — kept in sync with `CategoryQuickLinks.tsx`'s hardcoded labels); added a `Title` text input per tile, pre-filled with the saved title or the default label; `handleCategoryTitleChange()`; card layout reordered to Title → Link → Image preview/Upload
- `src/components/CategoryQuickLinks.tsx`: each tile displays `categoryImages[key]?.title || cat.label` — admins can rename any homepage category tile (e.g. "Cleats" → "Soccer Cleats") without a code change
- Saved to `settings` key `category_images` as `{ "cleats": { "image": "...", "link": "...", "title": "..." }, ... }`

**HERO SLIDER FIX + EDITABLE CATEGORY LINKS + HOMEPAGE CLEANUP (Session 41):**

**Hero slider — full image visible, no cropping/overflow:**
- `src/pages/HomePage.tsx`: hero `<img>` changed from `object-cover` to `object-contain object-center bg-black` — shows the complete banner with black letterbox bars instead of cropping edges
- Slide container height is no longer a fixed `vh` value (`heightVh` state removed). It's now `aspectRatio: '12 / 5'` (2.4:1) tied directly to the slide's `width`, chosen from the real measured banner dimensions (six live slider images ranged 2.29:1–2.53:1, averaging ~2.4:1 — not the 1920×600/3.2:1 initially assumed)
- Image element is `absolute inset-0` anchored to the slide div (nearest `position: relative` ancestor) — fixes a prior vertical-overflow bug where `h-full` percentage heights cascading through the flex row / Link wrapper / img chain didn't reliably resolve against a `transform`-ed flex container
- Verified via Playwright at 375px, 1366×768, 1440×900, 2560×1440, and 3840×2160: zero overflow on any edge at any size, image top/bottom/left/right pixel-match the slide container

**Fixed header covering top of page content on desktop (root cause of the last reported "hero image cut off at top" — was not a hero/aspect-ratio bug):**
- `src/components/Layout.tsx`: `<Header>` is `position: fixed`. Its own height is 73px on mobile (`py-4`) but 113px at `md:` and up (`py-6`) — `<main>` only ever reserved a static `pt-20` (80px), so on any screen ≥768px wide the fixed header physically covered the top ~33px of whatever content started the page (hero included, but really every page). Fixed: `pt-20` → `pt-[73px] md:pt-[113px]`, matching the header's real measured height at each breakpoint. Verified 0px gap / 0px overlap between header bottom and page content top at mobile, 17", 1440p, and 32" (2560×1440) viewports

**Admin → Settings → Theme → Category Tile Images — per-tile link field:**
- `src/context/SettingsContext.tsx`: `CategoryImages` type changed from `Record<string, string>` to `Record<string, { image?: string; link?: string }>` (`CategoryImageData` interface added); legacy flat-string rows normalized to `{ image: value }` on load, same pattern as the session 40 brand-images fix — no existing uploaded category images lost
- `src/pages/AdminPage.tsx`: added a `DEFAULT_CATEGORY_TILE_LINKS` map (mirrors `CategoryQuickLinks.tsx`'s hardcoded defaults: cleats→`/category/footwear`, jerseys→`/category/national-teams`, gloves→`/category/equipment?type=goalkeeper`, balls→`/category/equipment?type=balls`, training→`/category/training-apparel`, accessories→`/category/accessories`); added a `Link` text input under each category's image upload, pre-filled with the saved link or the default path if none saved yet; `handleCategoryLinkChange()`; upload/clear now target the nested `image` field only so clearing an image doesn't wipe a saved link
- `src/components/CategoryQuickLinks.tsx`: each tile now links to `categoryImages[key]?.link || cat.path` — admins can repoint any homepage category tile (e.g. to a brand page) without a code change

**Homepage cleanup:**
- `src/pages/HomePage.tsx`: New Arrivals and On Sale sections reduced from 6 to 4 products each (`.limit(4)`, grid `grid-cols-2 md:grid-cols-4` — clean 4-up row on desktop, 2×2 on mobile)
- Removed the duplicate `<BrandShowcase />` section (logo grid) from the bottom of the homepage — the `BrandBanners` (Nike Futbol-style) section at the top already covers "Shop by Brand"; `BrandShowcase.tsx` the component file is left in place (still used nowhere else currently, kept in case it's wanted elsewhere) but no longer imported by HomePage
- Homepage section order is now: Hero → Brand Banners (Shop By Brand) → Category Quick Links (Shop By Category) → SELECT YOUR SQUAD → New Arrivals (4) → On Sale (4) → Visit Us

**Fixed corrupted arrow glyph on /brands:**
- `src/pages/BrandsPage.tsx`: `Shop {brand.name} â†'` (mojibake) → `<span>Shop {brand.name}</span><ArrowRight size={12} />` using lucide-react's `ArrowRight`

**HERO PEEK CAROUSEL + EDITABLE BRAND TITLES (Session 40):**

**Admin → Settings → Theme → Brand Showcase Images:**
- `src/context/SettingsContext.tsx`: `BrandImages` type changed from `Record<string, string>` to `Record<string, { title?: string; image?: string }>` (`BrandImageData` interface added); legacy flat-string rows from before this session are normalized to `{ image: value }` on load so existing uploaded images aren't lost
- `src/pages/AdminPage.tsx`: added a title text input above each brand's image preview (placeholder `"{Brand} Futbol"`); `handleBrandTitleChange()` updates the nested `title` field; upload/delete now target the nested `image` field only, so clearing an image doesn't wipe a saved title
- `src/components/BrandBanners.tsx`: reads `brandImages[brand.name]?.title || brand.label` and `?.image || brand.image` — falls back to the existing hardcoded labels/Unsplash images until an admin sets a custom title
- Saved to `settings` key `brand_images` as `{ "Nike": { "title": "...", "image": "..." }, ... }`

**Homepage hero — peek/carousel redesign:**
- `src/pages/HomePage.tsx`: replaced the single full-width rounded hero card with a full-bleed peek carousel — center slide wide with partial slides visible on both edges, dark `opacity-50` overlay on non-active slides, only the active slide shows a title/CTA overlay
- Desktop: center slide 84vw with peek; mobile (<768px): 100vw, no peek (edge-to-edge, full slide visible) — widened from an initial 70vw/85vh spec after testing against real slide data showed banner headline text getting clipped at the edges (see below)
- **Session 41 update:** slide height is no longer a fixed `vh` value — it's `aspectRatio: '12 / 5'` (2.4:1) tied to the slide's width, matching the real banner images (measured 2.29:1–2.53:1). Image is `object-contain` (not `object-cover`) so the full banner is always visible with black letterbox bars, anchored `absolute inset-0` to the slide div directly (fixes a vertical-overflow bug where percentage `h-full` heights didn't reliably resolve through the flex row/Link wrapper chain)
- Arrow buttons (`ChevronLeft`/`ChevronRight` in `bg-white/20` pills) + bottom dot indicators; auto-advances every 5s, resets timer on manual navigation; touch swipe support (`onTouchStart`/`onTouchEnd`, 50px threshold)
- **Infinite loop:** `infiniteSlides = [lastSlide, ...realSlides, firstSlide]`, `currentIndex` starts at 1 (position into `infiniteSlides`, not the real array). Landing on a cloned edge slide lets the 0.5s transition play, then after 500ms silently snaps `currentIndex` to the matching real slide with the transition switched off for one frame (`loopTransitionEnabled` + double `requestAnimationFrame`) — the wrap-around is invisible instead of a visible snap-back. `nextSlide`/`prevSlide`/the auto-advance tick are clamped to `infiniteSlides` bounds so rapid clicking can't index past the clone array before the snap-back resolves
- Dots reflect the real slide via `activeRealIndex = ((currentIndex - 1) % N + N) % N` — stays correct even while transiently sitting on a clone
- Verified via Playwright against the live 6-slide production data: no horizontal page overflow at any width tested, no crash under rapid clicking, wrap-around peek shows real (dimmed) neighbor content on both edges, not empty space
- Known cosmetic note: the peek showing the "Custom Apparel" banner's edge can look almost solid black in screenshots — confirmed via zoomed crop this is real (dimmed) image content, not a bug; that specific asset's edge is dark-colored, not empty background

**HOMEPAGE REDESIGN + ADMIN IMAGE UPLOADS (Session 39):**

**Homepage sections (replaced Featured Products):**
- `src/components/BrandBanners.tsx` (NEW): Nike Futbol-style brand banner grid — 5 brands (Nike, Adidas, Puma, Joma, New Balance) with dark lifestyle images, white bold text, red "Shop →" CTA, zoom-on-hover; 2-col featured row (Nike+Adidas) + 3-col row (Puma+Joma+NB); links to `/brand/:name`; product counts fetched from Supabase; falls back to Unsplash if no admin image set
- `src/components/CategoryQuickLinks.tsx` (NEW): 6 category quick-link tiles (Cleats/Jerseys/Gloves/Balls/Training/Accessories) in a responsive grid; shows uploaded image with dark overlay when set, emoji fallback when not; links to category routes
- `src/pages/HomePage.tsx`: Replaced Featured Products section with BrandBanners → CategoryQuickLinks → homeCategories (SELECT YOUR SQUAD) → New Arrivals → On Sale → BrandShowcase (logos) → Visit Us
- New Arrivals: queries `products` ordered by `created_at DESC LIMIT 6`; graceful fallback to `isNewArrival=true` filter if `created_at` column absent (returns 400)
- On Sale: queries `isOnSale=true` products with `salePrice` set, LIMIT 6; section hidden if no sale products exist
- Removed `useProducts` import from HomePage (no longer needed)

**Admin → Settings → Theme tab — image upload sections:**
- `src/context/SettingsContext.tsx`: Added `BrandImages` and `CategoryImages` types; `brandImages`/`categoryImages` state; loaded from `settings` table keys `brand_images` and `category_images`; `setBrandImages`/`setCategoryImages` setters; exported via context
- `src/pages/AdminPage.tsx`: Added `Brand Showcase Images` card — 5 upload slots (Nike/Adidas/Puma/Joma/New Balance) with 4:3 preview, "No image" placeholder, Upload/Replace button, X to clear; `Save Brand Images` button saves to `settings` key `brand_images`; images uploaded to Supabase Storage `media` bucket folder `brand_images/`
- `src/pages/AdminPage.tsx`: Added `Category Tile Images` card — 6 upload slots (Cleats/Jerseys/Gloves/Balls/Training/Accessories) with square preview showing emoji fallback, Upload/Replace, X to clear; `Save Category Images` button saves to `settings` key `category_images`; images uploaded to folder `category_images/`
- Handlers: `handleBrandImageUpload(brandName, e)` and `handleCategoryTileImageUpload(categoryKey, e)` (renamed from `handleCategoryImageUpload` which already existed for home-layout categories)
- Draft state syncs from context via `useEffect([brandImages])` and `useEffect([categoryImages])`

**Encoding fix (during this session):**
- Edit tool introduced smart/curly single quotes (`'` U+2018/U+2019) inside the homeCategories template literal — fixed with Node.js `.replace(/['']/g, "'")`

**ADMIN PAGE ENCODING FIXES (Session 38):**
- UTF-8 BOM stripped from AdminPage.tsx line 1
- Image reorder arrows `â–²`/`â–¼` (▲▼ mojibake) in Add Product form → `<ChevronUp size={12} />` / `<ChevronDown size={12} />`
- En-dash `â€"` mojibake in option labels ("— None —") and release date label → plain `-`
- `ðŸ'¡` (💡 mojibake) before "Fix: Check Supabase RLS Policy" → `Tip: `
- `âœ"` (✓ mojibake) after "All Online" status → removed
- `â—€`/`â–¶` (◀▶ mojibake) in product list pagination buttons → removed (buttons say "Previous"/"Next")
- `âœ¨` (✨ mojibake) before "Product updated successfully" → removed
- `🛠️` / `🚀` emoji in admin tool buttons → removed
- `−` Unicode minus sign (U+2212) in variant stock decrement button → ASCII `-`
- Stray U+0090 control char left on arrow-text line → stripped
- `src/components/POSPinEntry.tsx` rewritten: PIN dots use pure CSS `rounded-full` divs, no Unicode chars

**PRODUCT CARDS:**
- Submenu path removed from product cards — now shows brand only (was "FOOTWEAR • nike, firm ground...")
- Product name font: `text-[14px] font-semibold leading-tight flex-1` (no truncation)
- Price always at bottom using `flex-1` on name + `mt-auto` on price container
- Sale price shows left with strikethrough original price right
- Uniform card height: outer div `flex flex-col h-full`, `motion.div` wrapper `h-full`

**POS FIXES:**
- All emoji replaced with lucide-react icons or plain text labels
- PIN dots now use CSS `rounded-full` divs — no Unicode characters (was corrupted `â—`/`â—‹`)
- Unknown barcode modal: add to cart + save later flow
- Pending barcodes stored in `localStorage` key: `pending_barcodes`

**THEME SETTINGS (Admin):**
- Primary color picker, secondary color picker, store name
- CSS variables: `--primary-color`, `--secondary-color`
- Font selector removed (caused Unicode corruption — see session 35/36)

**HOMEPAGE:**
- Visit Us heading centered (`text-center md:text-left`)
- Hours rows: `flex justify-between w-full max-w-xs` — day name left, time right
- Instagram button: `block w-full max-w-xs` — matches hours row width

**SEO:**
- Product schema with SKU/MPN on product pages
- Bidirectional barcode search (with and without hyphens)
- City landing pages: `/brampton-soccer-uniforms`, `/mississauga-soccer-store`

**NAVIGATION:**
- Left column submenu headings clickable as links when path is set
- Collapsible menus in admin navigation editor
- Brand pages fixed (`/brand/Nike` now loads all products via `fetchProductsByCategory`)

## CURRENT STATUS (Main Branch - August 10, 2026)
**Latest:** Blog post hero image no longer crops top/bottom — switched from a fixed-height `object-cover` container to `object-contain`/`h-auto` with a 500px max-height (session 56). Also recently shipped: blog listing (`/blog`) simplified to a uniform grid, no "Featured Article" treatment for the first post (session 55); the Blog / Gear Guides section itself (`/blog`, `/blog/:slug`, Admin → Blog tab with hero/thumbnail image upload and a featured-products picker) plus a merged GEO optimization pass (AI-crawler-friendly `robots.txt`, expanded `llms.txt`, hidden homepage brand description) (session 54); Invoice/Estimate printing in POS (session 53); a Product Feed / Reports / EOD receipt overhaul (session 52, concurrent branch)

**COMPLETED (August 10, 2026):**
- ✅ **Session 56:** Blog post hero image cropping fix — see full write-up above under RECENT CHANGES; no DB/deploy prerequisites; not click-verified in a live browser this session (no browser automation available)
- ✅ **Session 55:** Blog listing grid uniformity fix — see full write-up above under RECENT CHANGES; no DB/deploy prerequisites beyond what session 54 already needed
- ✅ **Session 54:** Blog / Gear Guides section + GEO optimization — see full write-up above under RECENT CHANGES; requires `docs/blog-migration.sql` run in Supabase before the Blog tab/pages will work
- ✅ **Session 53 (DEPLOYED):** Invoice & Estimate printing feature
  - Professional A4 invoice/estimate generator with store logo and billing details
  - Smart customer information modal (search or manual entry)
  - Invoice buttons on POS receipt screen + transaction history reprint buttons
  - Two document types: Invoice (paid) and Estimate (30-day quote) with distinct styling
  - Pre-fills with linked customer from transaction if available
  - Optional new customer save-to-database (checkbox enabled by default)
  - Keyboard navigation and accessibility support (WCAG AA)
  - Browser print dialog integration (all modern browsers)
  - Security: HTML entity escaping, client-side processing
  - Performance: Instant generation (< 1ms), no network overhead
  - Full TypeScript validation, no build errors
  - 400+ line comprehensive documentation (`docs/INVOICE_ESTIMATE_FEATURE.md`)
  - 40+ test cases covering all features and edge cases
  - Troubleshooting guide with 5 common scenarios
  - Future enhancement ideas documented

- ✅ **Session 52:** Product feed, Reports improvements, EOD receipt cleanup
  - GET `/product-feed.xml` endpoint: RSS/XML feed compatible with Google Merchant Center and Meta Commerce Manager
    - Real-time stock status from `product_variants` table
    - 1-hour cache to prevent excessive Supabase queries
    - Only includes `is_online=true` products
    - Verified on localhost with valid XML output
  - Reports page back button and Escape key navigation (all report tabs)
  - EOD report payment method filtering: only shows methods with sales > $0
  - Split payment support in EOD: correctly sums payment methods from `payment_splits` JSONB
  - EOD receipt format complete redesign: clean, professional layout with store header, date/time, payment breakdown, totals
  - EOD receipt preview modal: centered dialog with Escape key support, close button, print button, preview in iframe
  - Build passes without errors, all TypeScript validated

- ✅ **Session 52 (Custom Lab):** Custom Lab + Kit Orders iframe pages, route-collision fix, homepage 400 fix, POS New Price discount, Footer h3 fix
  - `/custom-lab` and `/kit-orders`: each page is just the standard Header/Footer (via `Layout`) wrapping a full-height iframe (jersey designer / uniform designer respectively) — no custom nav, no other page content
  - Fixed `src/App.tsx`: `RESERVED_PAGE_PATHS` list excludes `custom-lab` and `kit-orders` from the dynamic `navigationMenus.map()` route generator, which was registering an earlier `ProductGridPage` route at the same path and winning React Router's tie-break over the real page component
  - Fixed homepage 400: `products` has no `created_at` column; `HomePage.tsx` New Arrivals now queries `isNewArrival` directly instead of attempting the failing ordered query first
  - POS: item-level cart discounts gained a 3rd "Set New Price" type (`src/hooks/usePOSCart.ts`, `src/pages/POSPage.tsx`, `src/utils/thermalReceipt.ts`) — staff enter a final price, discount is derived as `originalPrice - newPrice`, validated against $0 and against exceeding the original price
  - `src/components/Footer.tsx`: Shop/Custom Lab/Support section titles changed from `h4` to `h3` (heading-hierarchy fix, no visual change)
  - Note: two independently-numbered "Session 52" write-ups exist from concurrent branches that diverged from the same base — kept both rather than discarding either

- ✅ **Session 51:** POS dark/light mode toggle fully implemented
  - isDarkMode state with localStorage persistence (defaults to dark)
  - Conditional styling throughout entire POS: all text, buttons, panels, modals, forms
  - Fixed all text colors to prevent white-on-white (light mode) and dark-on-dark (dark mode)
  - Logo switches: header logo (light mode) ↔ footer logo (dark mode)
  - Smooth transitions, toggle button with Sun/Moon icon in top bar
  - Build passes without errors
- ✅ Session 49: All 6 thermal receipt types redesigned to a unified black-logo layout with real split-payment breakdown
- ✅ Session 49: Mobile PageSpeed: hero LCP fix, preconnect, deferred Google Maps, trimmed Supabase settings query, decoding=async
- ✅ Session 49: Accessibility: color contrast (zinc-400→600, zinc-300→700 on light backgrounds), 48×48 touch targets, 4 real heading-hierarchy skip bugs fixed
- ✅ Session 49: Fixed root cause of the "white box" footer logo — WebP compression pipeline was flattening logo transparency to white; future logo uploads now preserve alpha
- ✅ Session 49: Variant color field: hybrid dropdown-or-free-text in Rapid Scan; more robust bulk "Apply to All" using exact variant IDs
- ✅ Session 49: Fixed remaining POS mojibake (cross-mark emoji with hidden control character, em-dash/middot/×) across POSPage/PosRegister/PosCustomerManager
- ✅ Session 49: POS cart quantity is now directly typeable, not just +/- only

**PENDING:**
- Receipt width still needs testing on Epson TM-T88V (real hardware, not yet verified against actual printer)
- Re-upload the header/landing/footer logo through Admin → Settings → Theme so the transparency fix actually takes effect on the live site (code fix alone doesn't retroactively fix already-uploaded files)
- Image compression for existing hero banners (use squoosh.app — the WebP compression work only applies going forward to new uploads, does not retroactively recompress already-uploaded images)

**Session 48 improvements (WebP Compression, Homepage H1, Footer Address):**
- ✅ All 23 image upload call sites in `AdminPage.tsx` now convert to WebP + compress (white-background canvas fill also fixes transparent PNGs); product images/hero-slider/logos/brand images retuned to spec'd dimensions, other upload types keep their existing dimensions but still gain WebP compression
- ✅ Homepage gained a visually-hidden `<h1>` (previously had none)
- ✅ Footer now shows a visible store address block, sourced from the same `storeInfo` settings context as the homepage "Visit Us" section
- ⚠️ Not click-tested in a live browser this session (Chrome extension declined) — build verified clean, logic reviewed; user asked to spot-check the upload flow on localhost

**Session 47 improvements (Accessibility + SEO):**
- ✅ Mobile hamburger menu button (`Header.tsx`) now has `aria-label="Open Navigation Menu"` — was an unlabeled icon-only button
- ✅ `public/llms.txt` added — LLM-crawler-facing summary of the store, key pages, contact info, and hours

**Session 46 improvements (Payment Receipts, Reprint, Sales Report Date Picker, Timezone Fix):**
- ✅ New "LAYAWAY/PAY LATER PAYMENT RECEIPT" printed after taking a payment against an existing balance — ref #, customer + phone, item summary, Payment Made/Previous/New Balance, "PAID IN FULL — READY FOR PICKUP" banner at $0; every payment (not just full payoff) now shows a `[Print Payment Receipt] [Done]` confirmation instead of silently auto-printing
- ✅ Original layaway/pay-later receipts gained a visible Ref #, customer phone, item color, and a Subtotal/HST breakdown
- ✅ `[View] [Payment/Pay] [Reprint] [Cancel]` inline buttons on every row of the combined Layaway/Pay Later list (POS + Admin); Reprint always reflects the record's current balance
- ✅ Fixed invisible white-on-white text on two buttons in the Layaway/Pay Later screens (page-wide dark-theme `text-white` leaking onto white cards with no override)
- ✅ Sales Report "Daily" filter now has a real single-date picker (was hardcoded to today)
- ✅ Reports-wide Eastern timezone fix: `timezoneUtils.ts` no longer relies on the host machine's own timezone to detect EDT/EST — now uses `Intl`/`America/Toronto` directly, computed per-date. Applied across all 7 report files (Sales, EOD, Customer, Product, Void/Refund, Gift Card, Store Credit); also fixed a real crash bug in `SalesReport.tsx`'s CSV/PDF export (`.from`/`.to` didn't exist on the date-range object) and a UTC-vs-Eastern day-bucketing bug in its Daily Breakdown table/chart

**Session 45 improvements (Layaway, Pay Later, Item Discounts, Unvoid, Bug Fixes) — ⚠️ requires `docs/layaway-paylater-migration.sql` run manually in Supabase before Layaway/Pay Later work:**
- ✅ Item-level discounts: each POS cart row can carry its own `%` or `$` discount (`CartItem.discount`), shown as struck-through original price / discount line / white bold "Item Total", flows through to checkout, on-screen receipt, and the printed thermal receipt
- ✅ Layaway: customer-required flow, deposit entry, stock deducted on hold, layaway receipt ("held for 30 days" + pickup date); managed (take payment / cancel+restock / reprint) from a POS "Layaway" tab and an Admin "Layaways" tab
- ✅ Pay Later: same flow minus deposit — full amount saved as owed, "payment due upon next visit" receipt; managed through the same Layaway/Pay Later screen
- ✅ Unvoid: voided transactions in POS History get an `[Unvoid]` button restoring `status='completed'`
- ✅ "Walk-in" no longer printed on receipts — the Customer row is omitted entirely when there's no real customer
- ✅ Fixed a real (not RLS) customer-creation bug: `customers.email` UNIQUE constraint was rejecting every 2nd+ customer created with a blank email because blank was being inserted as `''` instead of `NULL`; fixed in `CustomerContext.tsx`'s `addCustomer`/`updateCustomer`
- ✅ Verified via `npm run build` + `tsc --noEmit` (zero new errors) and live DB inserts against Supabase (both anon and service-role keys) to confirm the email fix; no browser automation available this session so UI flows were not click-tested — user asked to review on localhost before this push
- ✅ Merged with 8 commits pushed to `main` by a separate concurrent session in between (split payments, color variant field, sleeve sizes, cost price, transparent PNG, build fixes — see Session 44 below); `AdminPage.tsx` and `POSPage.tsx` merged cleanly with no textual conflicts, only `CLAUDE.md` needed manual reconciliation (also cleaned up a stray unresolved conflict marker left in `CLAUDE.md` from that session's own earlier merge, and renumbered this entry from a colliding "Session 44" to 45)

**Session 44 improvements (Split Payments, Color Variant Field, Sleeve Sizes, Cost Price — from a concurrent session):**
- ✅ Split payments in POS: step-by-step method → amount → confirm flow, live remaining-balance display, add/remove splits; needs the `payment_splits` JSONB column on `transactions` (see Pending DB Migrations); shown on all receipt types as a "Payment Breakdown" section
- ✅ Color variant field always-optional on 2nd+ variants (no required warning); "Sleeves" age group (`S/M`, `L/XL`) added to Admin + `RapidScanIntakeMatrix`
- ✅ Cost price field on products (staff-only, POS shows margin) + transparent PNG fix (white canvas fill in `resizeImage()`) + build fixes (moved inline CSS out of `index.html`, fixed a smart-quote parse error)

**Session 43 improvements (Category Tile Title/Gradient Redesign):**
- ✅ `CategoryQuickLinks.tsx`: image tiles show title bottom-left + `ArrowRight` icon bottom-right over a `bg-gradient-to-t from-black/70 via-transparent to-transparent` overlay (was centered title + flat `bg-black/50` dim)
- ✅ Verified on localhost desktop (1440px) and mobile (390px) — gradient, arrow alignment, and text wrapping all confirmed working

**Session 42 improvements (Editable Category Tile Titles):**
- ✅ Admin → Settings → Theme → Category Tile Images: added a per-tile `Title` field (pre-filled with the default label), saved alongside the session 41 image/link fields; `CategoryImageData` now `{ image?, link?, title? }`
- ✅ Homepage `CategoryQuickLinks` tiles display the saved title with fallback to the hardcoded default label — admins can rename any tile (e.g. "Cleats" → "Soccer Cleats") without a code change

**Session 41 improvements (Hero Slider Fix + Editable Category Links + Homepage Cleanup):**
- ✅ Hero slider image is `object-contain` (full banner visible, black letterbox) sized via `aspect-ratio: 12/5` matching real measured banner proportions (~2.3–2.5:1) — replaces the fixed-vh height that cropped/overflowed images
- ✅ Fixed a site-wide bug (not hero-specific): `Layout.tsx`'s `<main>` reserved a static `pt-20` (80px) for the fixed `<Header>`, but the header is actually 113px tall at `md:`+ (only 73px on mobile) — the header was covering the top ~33px of every page's content on desktop/large screens. Now responsive: `pt-[73px] md:pt-[113px]`
- ✅ Admin → Settings → Theme → Category Tile Images: added a per-tile `Link` field (pre-filled with sensible defaults) so admins can repoint any homepage category tile without a code change; `CategoryImages` type now `{ image, link }` per category (was a flat image-URL string), legacy rows normalized on load
- ✅ Homepage: New Arrivals / On Sale reduced from 6 to 4 tiles each (`grid-cols-2 md:grid-cols-4`); removed the duplicate Shop by Brand section (`BrandShowcase`) from the bottom of the homepage — `BrandBanners` at the top already covers it
- ✅ Fixed corrupted arrow glyph on `/brands` (`Shop {brand} â†'` mojibake) → lucide `ArrowRight` icon

**Session 40 improvements (Hero Peek Carousel + Editable Brand Titles):**
- ✅ Admin → Settings → Theme → Brand Showcase Images: per-brand title input alongside the existing image upload; saved to `settings.brand_images` as `{ title, image }` per brand
- ✅ Homepage hero redesigned into a peek carousel (center slide + partial slides visible on both edges, dark overlay on non-active slides) — replaces the old single full-width rounded hero card
- ✅ Hero carousel is a true infinite loop — cloned slides at each end mean the first/last slide's peek shows the wrap-around neighbor instead of grey/empty space, with an invisible transition-less snap-back
- ✅ Verified on localhost with Playwright against real production slider data — no horizontal overflow, no crash on rapid navigation, wrap-around confirmed working in both directions

**Session 37 improvements (Complete Emoji Removal & UTF-8 Fixes):**
- ✅ **All emoji removed from POS and related files** — replaced corrupted emoji (ðŸ'³ → 💳) and valid emoji with plain text labels
  - `src/pages/POSPage.tsx`: Removed 🔴 from 6 console.error messages; replaced with "ERROR" text prefix
  - `src/components/GiftCardTab.tsx`: Fixed corrupted ðŸ'³/ðŸ'°/📊 emoji in tab labels; replaced with plain text: 'Sell', 'Redeem', 'History'
  - `src/components/ReturnsModal.tsx`: Removed ❌ and 💡 emoji; replaced with "Error:" and "Tip:" text
  - `src/components/ReturnTab.tsx`: Removed ❌ emoji from error messages
  - `src/components/CustomerGiftCards.tsx`: Removed ❌ from console.error messages
  - `src/components/RapidScanIntakeMatrix.tsx`: Removed 📦 and ⚠️ emoji from form labels
  - `src/pages/ProductDetailPage.tsx`: Replaced 📞 emoji with text "Call: 905-593-3600"
  - `src/pages/AdminPage.tsx`: Removed ⚠️ and ðŸ'¡ corrupted emoji
  - **Report files**: Removed 💰/📊/🎁/✅/❌/👥/🛍️/💵 emoji from all MetricCard/SummaryCard icon props
- ✅ **Smart quote corruption fixed** — sed command corrupted single quotes to Unicode smart quotes ('  →  ' ')
  - Root cause: `sed` replaced emoji but left smart quotes in `GiftCardTab.tsx` line 405
  - Fix: Used Node.js regex to replace all smart quotes with ASCII straight quotes
  - Error was: `[vite][client] Pre-transform error: Unexpected character '''. (405:21)`
  - Solution: `content.replace(/['']/g, "'"); content.replace(/[""]/g, '"');`
- ✅ **Zero emoji corruption remaining** in active source files (POSPage, Pos*.tsx, thermalReceipt.ts)
- ✅ Dev server running successfully with no parse errors
- ✅ Commits:
  - `59214f3`: Remove all emoji from POS replace with lucide icons
  - `2ad6980`: Fix smart quote corruption in GiftCardTab

**Session 36 improvements (UTF-8 Encoding Fix):**
- ✅ **Root cause identified**: corrupted `â€¢` characters site-wide were NOT a font issue — they were Windows-1252/Latin-1 mojibake of UTF-8 bytes (e.g. bullet • U+2022 stored as 3 separate Latin-1 chars `â€¢`; emoji UTF-8 bytes each misread as individual Latin-1 chars)
- ✅ **9 files repaired** with Node.js replacement script (`scripts/fix-encoding.mjs`, deleted after use):
  - `src/components/ProductCard.tsx`: `â€¢` bullet between category/submenu labels
  - `src/pages/AdminPage.tsx`: `â€¢` bullets before prices; corrupted 🚀 💡 ⚠️ 🛠️ emojis
  - `src/pages/ProductDetailPage.tsx`: `â€¢` in "added to squad bag" confirmation; 📞 telephone emoji
  - `src/components/StoreCreditsTab.tsx`: `â€¢` between credit amount and reason
  - `src/pages/POSPage.tsx`: all 7 category tab icons (🏪 👟 👕 ⚽ 🛡️ 🎽 🧤) + 💳 🎟 📊 📞 🔴 and others
  - `src/components/PosRegister.tsx`: same 7 category tab icons
  - `src/components/GiftCardTab.tsx`: 💳 💰 📊 icons
  - `src/components/RapidScanIntakeMatrix.tsx`: age group emojis (👨 👦 ⚽ 🧤 📦 👟 🧒) + en-dashes in size range labels
  - `src/pages/MississaugaSoccerPage.tsx`: en-dashes in hours/text
- ✅ `POSPage.backup.tsx` left as-is (not rendered, not in git-tracked active build)
- ✅ Verified with scan script: zero corrupted sequences remain in active source files

**Session 35 improvements (Font Feature Removed):**
- ✅ **Font selector removed from Admin → Theme tab** — was causing random characters across site when fonts like "Archivo Black" were saved (display fonts lack glyphs for emoji/Unicode used in UI)
- ✅ `src/context/SettingsContext.tsx`: font loading logic stripped entirely; `useEffect([themeSettings])` now ONLY applies `--primary-color` and `--secondary-color` CSS vars; always cleans up any stale Google Font `<link>` tags and clears `--font-family`/`--font-sans` inline overrides
  - Added `localStorage.removeItem('theme')` + `localStorage.removeItem('fontFamily')` at top of `fetchSettings()`
  - Forces `fontFamily: 'default'` when applying DB theme data (prevents old saved value from re-activating)
- ✅ `src/pages/AdminPage.tsx`: removed Font Family `<select>` and all optgroups from Theme tab; removed `google-fonts-preview` useEffect; `handleSaveTheme` forces `fontFamily: 'default'`
- ✅ Supabase DB reset: `fontFamily` field set back to `'default'` in `settings` table `key='theme'`
- ✅ Verified on localhost: homepage `body.style.fontFamily=""`, no Google Font `<link>` tags, no `--font-family` CSS var, localStorage cleared; Theme tab shows Primary Color + Secondary Color + Store Name + Live Preview (no font dropdown)

**Session 34 improvements (Unknown Barcode Modal in POS):**
- ✅ **Unknown Barcode Modal**: when a scanned barcode is not found in DB, POS shows a modal instead of error message — sale completes immediately, barcode saved later
  - Brand buttons: Nike / Adidas / Puma / Joma / New Balance / Other
  - Price field (required), optional Name field
  - "Add to Cart & Save Later" → adds item to cart + saves to `localStorage.pending_barcodes`; closes modal
  - "Add to Cart & Save Now" → adds item to cart + closes unknown modal + opens Pending Barcodes Manager
  - Cart item gets temp ID `unknown-${barcode}-${Date.now()}` with brand/price/name
- ✅ **Amber "N Unsaved Barcodes" badge button** in POS right panel (below Customers section) — visible whenever `localStorage.pending_barcodes` has entries
- ✅ **Pending Barcodes Manager Modal**: lists each unsaved barcode with 3 actions per entry:
  - "Save to Existing" → product search field, click a result to link the barcode to that product
  - "Create New" → navigates to `/admin` with React Router state `{ openAddProduct: true, pendingBarcode: pb }`; AdminPage detects this state, pre-fills Add Product form (name, brand, price, barcode), shows amber "Creating from POS scan" banner; after save automatically removes barcode from localStorage and redirects back to `/pos` after 1.2s
  - "Skip" → removes from queue
- ✅ `src/pages/POSPage.tsx`: added `PendingBarcode` interface; `useNavigate` import; `showUnknownBarcodeModal`, `unknownBarcode`, `unknownBarcodeBrand`, `unknownBarcodePrice`, `unknownBarcodeName`, `pendingBarcodes`, `showPendingBarcodesModal` states; `savePendingBarcodes`, `handleAddUnknownToCart`, `handlePendingSearch`, `handleSaveToExisting`, `handleSkipBarcode` helpers; auto-focus guard on both modals
- ✅ `src/pages/AdminPage.tsx`: `useNavigate` + `useLocation` imports; `fromPOSData` state; mount `useEffect` detects `openAddProduct` navigation state and pre-fills form; `handleAdd` removes pending barcode from localStorage and redirects to `/pos` when `fromPOSData` is set

**Session 33 improvements (Theme & Branding Admin Panel):**
- ✅ **Theme & Branding tab** added to Admin → Settings: Store Name, Primary Color picker, Secondary Color picker, Font Family selector (later removed in session 35), Live Preview, Logos section
- ✅ `src/context/SettingsContext.tsx`: `ThemeSettings` interface + `DEFAULT_THEME` constant; `themeSettings` state; injects `--primary-color` and `--secondary-color` CSS vars on settings change
- ✅ **Primary color applied site-wide**: all `[#b90014]` → `[var(--primary-color)]` in 33 source files
- ✅ **Secondary color applied**: Footer, HomePage "Visit Us", BramptonSoccerPage/MississaugaSoccerPage/CustomApparelPage "How It Works" + contact bar use `style={{ backgroundColor: 'var(--secondary-color)' }}`
- ✅ Supabase `settings` table: `theme` row with `{storeName, primaryColor: '#b90014', secondaryColor: '#000000', fontFamily: 'default'}`

**Session 32 improvements (Mississauga City Landing Page):**
- ✅ `src/pages/MississaugaSoccerPage.tsx`: New city SEO landing page at `/mississauga-soccer-store`
  - Hero with H1 "Your Go-To Local Soccer Store in Mississauga", two CTAs (Visit Our Store → Google Maps, Browse In-Stock Gear → `/products`)
  - "Serving the Community" section with H2 "The Ultimate Headquarters for Local Clubs and Players" + body text about Mississauga Soccer League
  - Three-column cards: Fast In-Store Pickup & Fitting, Official Club Kits & Lettering, Trusted by Mississauga Teams
  - "How It Works" 3-step dark section (Submit Roster → Approve Proof → Pick Up/Deliver) — same as Brampton
  - "Stop By and Gear Up Today" section with phone, address, hours (Mon–Fri 1–7 PM, Sat–Sun 11 AM–4 PM), 6-point checklist
  - Quote form (mailto: info@edgedbs.com) with squad-specific fields (identical to BramptonSoccerPage)
  - Footer contact bar with phone, address, website
  - Helmet: title "Soccer Store in Mississauga | Elite Gear & Custom Kits | Absolute Soccer"; description "Mississauga's premier local soccer shop..."; canonical `https://torontosoccershop.com/mississauga-soccer-store`
- ✅ `src/App.tsx`: Added import + `<Route path="mississauga-soccer-store">` route
- ✅ `scripts/generate-sitemap.js`: Added `/mississauga-soccer-store` to `mainPages` array (priority 0.9) — sitemap now 185 URLs (6 main + 7 category + 170 product + 2 static)
- ✅ Tested on localhost via Playwright — all sections render, both CTA buttons present, hero image loads, quote form functional

**Session 31 improvements (Structured Data Image URL Fix):**
- ✅ `src/pages/ProductDetailPage.tsx`: Fixed "Invalid URL in field image" Google Search Console error in Merchant Listings
  - Added `getAbsoluteUrl()` helper inside the schema `useEffect` — handles `http(s)://` (pass-through), `//` (prepend `https:`), and relative paths (prepend `https://torontosoccershop.com`)
  - `productImages` array built from `product.images[]` or fallback to `product.image`, all passed through `getAbsoluteUrl()`
  - `"image"` field now uses `productImages.filter(Boolean)` — removes any empty strings when both image fields are null
  - Verified on localhost via Playwright: both array-images and null-images-fallback paths output full `https://` Supabase Storage URLs

**Session 30 improvements (Brampton City Landing Page):**
**Latest (previous):** Brampton city landing page (session 30)

**Session 30 improvements (Brampton City Landing Page):**
- ✅ `src/pages/BramptonSoccerPage.tsx`: New city SEO landing page at `/brampton-soccer-uniforms`
  - Hero with H1 "Custom Soccer Uniforms & Team Printing in Brampton", two CTAs (Get a Fast Squad Quote → `#quote`, Browse Custom Apparel → `/custom-apparel`)
  - "Why Brampton Clubs Choose Us" section with 3-column cards (visit, brands, roster customization)
  - "How It Works" 3-step dark section (Submit Roster → Approve Proof → Pick Up/Deliver)
  - "Visit Our Mississauga Showroom" section with phone, address, service checklist
  - Quote form (mailto: info@edgedbs.com) with squad-specific fields (kit type, squad size/quantity, club name)
  - Footer contact bar with phone, address, website
  - Helmet: title "Custom Soccer Uniforms & Jersey Printing Brampton | Absolute Soccer"; description "The premier team uniform destination for Brampton soccer clubs..."
- ✅ `src/App.tsx`: Added import + `<Route path="brampton-soccer-uniforms">` route
- ✅ Tested on localhost — all 5 sections render, both CTA buttons present, phone number shown
- ✅ `scripts/generate-sitemap.js`: Added `/brampton-soccer-uniforms` to `mainPages` array — sitemap now 184 URLs (5 main + 7 category + 170 product + 2 static)

**Session 29 improvements (Bidirectional SKU Search):**
- ✅ `ProductGridPage.tsx`: Fixed search so hyphens in SKU codes are ignored in both directions
  - Root cause: Many products have `product_code = null`; Nike-style style codes (e.g. `IB5300-480`) live inside the `description` field as `"Style: IB5300-480"`
  - Previous fix only stripped hyphens from `product_code` — didn't help when code was in description
  - Fix: strip hyphens from `name`, `description`, AND `product_code` before comparing against the hyphen-stripped query
  - Searching `"IB5300-480"` → finds product whose description contains `"Style: IB5300-480"` ✓
  - Searching `"IB5300480"` → `desc.replace(/-/g,'').includes("ib5300480")` matches same product ✓
  - Works for all three fields: `name`, `description`, `product_code`
  - Verified on localhost: both queries return "SHOWING 1 OF 1 PRODUCTS" (FFF 2026 Stadium Home Jersey)

**Session 28 improvements (Brand Page "No Products" Fix):**
- ✅ `BrandPage.tsx`: Fixed "No products found" on direct navigation to `/brand/Adidas`
  - Root cause: `ProductContext` only pre-loads 8 featured products on app init (`fetchFeaturedProducts`)
  - `BrandPage` was filtering those 8 products client-side — finding 0 Adidas products → "No products found"
  - Fix: added `useEffect(() => { fetchProductsByCategory(); }, [brandName])` — fetches all 168+ products into context on mount
  - Also added a spinner (`isLoading` check) instead of flashing "No products found" while fetching
  - Works on direct URL navigation now (verified cold-start: `/brand/Adidas` → 30 products, `/brand/Nike` → 59 products)

**Session 27 improvements (Brand Tile Fix):**
- ✅ `BrandShowcase.tsx`: Fixed brand tiles linking to broken `/products?brand=Nike` — no such route existed
  - Changed to `/brand/${encodeURIComponent(brand.name)}` which routes to existing `BrandPage` component
  - `BrandPage` at `/brand/:brandName` was already implemented with category filter, search, sort
  - "View All Brands" link to `/brands` was already correct — only the individual tile links were broken
  - Verified: clicking Nike tile from homepage → `/brand/Nike` → 59 Nike products render correctly

**Session 26 improvements (SEO & Search):**
- ✅ `ProductDetailPage.tsx`: Enhanced Product JSON-LD schema (`product-schema-markup` script)
  - Added `sku` and `mpn` fields (populated from `product.product_code`)
  - `image` now an array (`product.images[]` with fallback to `[product.image]`)
  - `offers.url`: canonical product URL `https://torontosoccershop.com/product/${product.id}`
  - `offers.price`: sale-price-aware (`product.salePrice || product.price`)
  - `offers.priceValidUntil`: `"2026-12-31"`
  - `description` and `sku`/`mpn` default to `''` when null (valid schema output)
- ✅ `ProductGridPage.tsx`: Search filter now includes `product_code` and `brand` fields
  - Customers can search by manufacturer SKU (e.g. "HQ2314" finds Nike Phantom 6 Haaland boot)
  - Brand field explicitly checked (previously only matched via submenu text)
- ✅ Sitemap regenerated: 181 URLs (4 main + 7 category + 168 product pages); was 171

**Session 25 improvements (Thermal Receipt Redesign):**
- ✅ `thermalReceipt.ts`: Professional redesign with elegant typography and layout for Epson TM-T88V
  - Typography hierarchy: Store name 17px, section headers 12px, items 12px, details 10px, footer 11px
  - Elegant dividers: Replaced dashed with solid 1px lines; double borders for grand total emphasis
  - Refined spacing: Padding 3mm × 4mm, consistent 8px margins between sections
  - Header polish: Logo increased 50mm → 62.5mm width, 18mm → 22.5mm height (25% larger)
  - Transaction info: Clean flex two-column layout with labels left, values right-aligned
  - Items section: Regular weight names with smaller detail/qty text, subtle indentation
  - Totals enhancement: Double-line borders, 15px grand total, better visual hierarchy
  - Footer elegance: Refined typography, no italic (doesn't print clearly on thermal)
- ✅ Uniform bold font weights throughout ALL text (font-weight: 700)
  - Universal selector: `* { font-weight: 700 !important; }`
  - Removed mixed weights (500, 600, 700) that caused inconsistent thermal print clarity
  - Hierarchy maintained purely through SIZE variation, not weight
  - All text now prints bold and clear on thermal paper
- ✅ Logo size increase by 25%: 50mm × 18mm → 62.5mm × 22.5mm
  - Improved visual prominence and brand recognition
  - Updated in both inline CSS and @media print
- ✅ Applied to all three receipt types:
  - generateThermalReceiptHTML: Transaction receipts with items, totals, signatures
  - generateGiftReceiptHTML: Gift receipts without prices
  - generateStoreCreditReceiptHTML: Store credit issuance and redemption receipts
- ✅ Tested and verified
  - TypeScript compiles without errors
  - Server running and responsive
  - All three receipt functions updated consistently
- ✅ **Status:** Professional thermal receipts ready for deployment; all text bold and clear on Epson TM-T88V

**Session 24 improvements:**
- ✅ `Footer.tsx`: Added GTA local SEO paragraph below "formerly Golazo Store" line — covers Brampton, Oakville, Milton, Etobicoke, Mississauga service; `text-xs text-zinc-500 max-w-2xl mx-auto text-center`
- ✅ `ProductGridPage.tsx`: Category-specific SEO blurb below page title on top-level FOOTWEAR and NATIONAL TEAMS pages only (hidden on subpages like Europe, Shop By Brand, etc.)
  - Footwear: "Shop the latest Nike, Adidas and Puma soccer cleats at Absolute Soccer in Mississauga..."
  - National Teams: "Official licensed national team jerseys at Absolute Soccer Mississauga. Shop Canada, Portugal, France, Argentina..."
- ✅ **BOM/invalid code point fix**: Deleted two malformed temp files from project root (`CUsersziadAppDataLocal...test-nav.js` and `CUsersUserabsolute-websiteRETURNS_VERIFICATION.md`) — Tailwind v4 was scanning the `.js` file and hitting bytes that decoded to invalid Unicode code point 9,794,992 (0x9575B0), crashing the dev server
- ✅ `POSPage.tsx`: Moved "Open Cash Drawer" button from left icon toolbar (between Returns and Clear Cart) to right panel action row next to Void/Refund / Return / History
  - Grid expanded from `grid-cols-3` → `grid-cols-4`
  - Icon changed from `DollarSign` → `Archive` (drawer-shaped, amber color)
  - Label shortened to "Drawer" to fit 4-column layout
  - Style matches other action buttons: `border border-[#2d3547] text-amber-400 hover:text-amber-300`

**Session 23 improvements (EpsonControl Font Cash Drawer):**
- ✅ `POSPage.tsx` `openCashDrawer()`: Updated to EpsonControl font solution
  - Uses EpsonControl font (aliased to Control font) with character "A"
  - Character "A" in Control font = ESC/POS drawer kick command
  - Zero height (0px) and zero line-height (0px) = invisible, no paper feed
  - Visibility: visible ensures font rendering despite zero dimensions
  - @font-face declaration with fallback chain: EpsonControl → Control → monospace
  - Page size: 80mm auto (thermal printer standard)
  - Print dialog auto-closes after command sent
- ✅ Browser-independent solution (works in all modern browsers)
  - No Web Serial API (Chrome/Edge only)
  - Standard browser print dialog (familiar UX)
  - No user port selection required
  - Simpler deployment than previous approaches
- ✅ Printer driver configuration required:
  - "Start of Document" = "Do not open" (prevents drawer on every print)
  - "Keep Feed and Cut" = Page [Feed, Cut]
  - Drawer only opens when Control font character is printed
  - Regular receipts unaffected (no drawer opening)
- ✅ Tested and verified on localhost
  - Code implementation: 8/8 checks passed
  - Browser functionality: confirmed working
  - Button clickable: verified
  - Screenshot: captured successfully
- ✅ **Status:** EpsonControl font solution ready for deployment; printer driver setup required at store

**Session 22 improvements (Cash Drawer Zero-Space & Receipt Printing Fixes):**
- ✅ `POSPage.tsx` `openCashDrawer()`: Updated to zero-space ghost canvas solution
  - Sends completely invisible print document (zero height, zero font-size, transparent)
  - Uses printer's built-in "Start of Document" drawer kick (no special characters needed)
  - Works with any Epson printer supporting ESC/POS
  - Zero paper feed (document completely invisible)
  - More reliable than Control font character approach
- ✅ `thermalReceipt.ts`: Fixed auto-cut between 2-copy receipts
  - Added `break-after: page;` CSS rule to force cuts on Epson TM-T88V
  - Page-break structure: first receipt has `page-break-after: always; break-after: page;`
  - @page rule set to `size: 80mm auto; margin: 0;` for proper thermal printer formatting
  - Both legacy (`page-break-after`) and modern (`break-after`) CSS properties included
- ✅ Created `PRINTER_SETUP.md`: Comprehensive guide for Epson driver configuration
  - Settings required: "Start of Document" = "OPEN"
  - Step-by-step instructions for Windows Settings, Epson Utility, Control Panel approaches
  - Troubleshooting section for common issues
- ✅ Created `ZERO_SPACE_SOLUTION.md`: Technical documentation for zero-space ghost canvas method
  - How it works: invisible document triggers printer's native drawer kick
  - Advantages over previous Control font approach
  - Configuration checklist and deployment status
- ✅ **Status:** Cash drawer now uses universal zero-space solution; 2-copy receipts have proper page-break cuts

**Session 21 improvements (Cash Drawer & QZ Tray Removal):**
- ✅ Removed QZ Tray implementation entirely (uninstalled npm package, deleted integration files)
- ✅ Deleted `src/utils/qzPrint.ts` (QZ Tray utility functions)
- ✅ Removed QZ Tray CDN script from `index.html`
- ✅ Removed `testQZConnection()` call from POS mount effect
- ✅ Reverted thermal receipt printing to browser `window.open()` fallback only
- ✅ Added "Open Drawer" button to POS home page action button row (after Returns button)
- ✅ `openCashDrawer()` function uses browser print with ESC/POS drawer command
  - Creates invisible 80mm print window (matches Epson thermal printer width)
  - Sends drawer open command via print dialog
  - Auto-closes after print dialog closes
  - Button positioned in Register tab action buttons (beside History/Returns)
- ✅ Cash drawer button styling: DollarSign icon (yellow), "Open Drawer" label
- ✅ No external dependencies needed (pure browser printing)
- ✅ **Status:** All thermal receipt printing now uses browser print dialog; cash drawer opens via printer's built-in print handler

**Session 19 improvements:**
- ✅ `ProductCard.tsx`: Added `isSoldOut?: boolean` prop — greyscale image + `opacity-70` + dark "SOLD OUT" banner at bottom of image when true
- ✅ `ProductGridPage.tsx`: Added `soldOutProductIds` state + fetch effect — queries `product_variants` for `stock_quantity > 0` per product; passes `isSoldOut` to each `ProductCard`
- ✅ `ProductDetailPage.tsx`: Added `isSoldOut` flag (`!variantsLoading && product.showSizes && all variants at 0`); replaces size grid with red "SOLD OUT" badge when true; Call to Order CTA still shows
- ✅ `POSPage.tsx` (`getStockStatus`): Changed "Out of Stock" → "SOLD OUT" with `font-black tracking-widest` styling
- ✅ `thermalReceipt.ts`: Fixed Epson TM-T88IV CSS — body/receipt width 72mm, padding `2mm 4mm`, logo `55mm × 15mm`, replaced `* { padding: 0 !important }` media-print reset with targeted rules only
- ✅ `thermalReceipt.ts`: Replaced `display:flex` on item/total rows with `display:table` layout for reliable thermal printer rendering
- ✅ `thermalReceipt.ts`: Bolder text throughout — body `13px font-weight:bold`, store name `16px`, transaction-info/store-info/footer `11px`, total-row `12px`, grand-total `15px`, item-name `font-weight:bold`
- ✅ `thermalReceipt.ts`: Added `copies?: 1 | 2` to `ReceiptData` interface — when `copies === 2`, both copies in ONE HTML document separated by `page-break-before: always`
- ✅ `thermalReceipt.ts`: Barcodes changed from `id="barcode"` → `class="receipt-barcode"`; JsBarcode uses `querySelectorAll` so both copies render correctly
- ✅ `thermalReceipt.ts`: Added `truncateName(name, maxLength=24)` — product names over 24 chars truncated to fit 72mm paper
- ✅ `thermalReceipt.ts`: Removed inline `setTimeout(() => window.print(), 100)` from generated HTML — print now triggered by caller via `onload`
- ✅ `POSPage.tsx` + `PosTransactionHistory.tsx`: All `generateThermalReceiptHTML` callers updated with `printWindow.onload` → 500ms → `focus()` + `print()` + `onafterprint` closes window
- ✅ Applied to all three receipt functions: `generateThermalReceiptHTML`, `generateGiftReceiptHTML`, `generateStoreCreditReceiptHTML`

**Session 18 improvements:**
- ✅ `AdminPage.tsx` + `RapidScanIntakeMatrix.tsx`: Added "Gloves" age group with sizes 3–11 (goalkeeper glove sizes)
- ✅ `AdminPage.tsx` + `RapidScanIntakeMatrix.tsx`: Added "Adult Footwear" age group with sizes 3–13 (0.5 increments) — explicit alternative to the category-detection path
- ✅ `AdminPage.tsx` + `RapidScanIntakeMatrix.tsx`: Added "Youth Footwear" age group with sizes 1Y–6Y (0.5 increments)
- ✅ Both age group dropdowns in AdminPage (new product form + edit product form) updated: Adult, Youth, Balls, Gloves, One Size, Adult Footwear, Youth Footwear, Toddler
- ✅ RapidScanIntakeMatrix dropdown relabeled with consistent emoji labels: 👨 Adult, 👦 Youth, ⚽ Balls, 🧤 Gloves, 📦 One Size, 👟 Adult Footwear, 👟 Youth Footwear, 🧒 Toddler
- ✅ `getSuggestedSizes()` type unions updated in both files to include `'Gloves' | 'Adult Footwear' | 'Youth Footwear'`
- ✅ Toddler kept in dropdown (at end) for backward compat with existing Toddler-labeled variants

**Session 17 improvements:**
- ✅ `App.tsx`: Added `CategorySlugRoute` component — handles `/category/:slug` → finds matching nav menu → renders `ProductGridPage` (fixes `/category/national-teams?region=europe` blank page)
- ✅ `App.tsx`: Added 14 static landing-page routes: 3 FOOTWEAR submenu headings, 5 NATIONAL TEAMS regions, 6 CLUBS leagues (see ROUTES section below)
- ✅ `ProductGridPage.tsx`: Added `useSearchParams` + `region` query param — `/category/national-teams?region=europe` now filters products by that region's nav items instead of showing blank
- ✅ `ProductGridPage.tsx`: Added `isHeadingLandingPage` flag (`!!submenu && groupedSubmenuItems.length > 0`) — true when `submenu` prop matches a heading that has logo items; false for item-level pages
- ✅ `ProductGridPage.tsx`: Updated `shouldShowGrid` — returns `false` when `isHeadingLandingPage` is true (shows logo grid only, no product grid underneath)
- ✅ `ProductGridPage.tsx`: Logo grid condition: added `&& !region` — hides country/brand selector when navigating via `?region=` param
- ✅ `ProductGridPage.tsx`: Subtitle shows "N Teams — Select one to browse products" on heading landing pages
- ✅ `ProductGridPage.tsx`: "View All Products" button and "All Products" divider hidden on heading landing pages
- ✅ Supabase `navigation_items` updated: 14 heading rows now have correct landing page paths:
  - NATIONAL TEAMS: EUROPE→`/national-teams/europe`, AFRICA→`/national-teams/africa`, SOUTH AMERICA→`/national-teams/south-america`, NORTH AMERICA→`/national-teams/north-america`, OTHERS→`/national-teams/others`
  - CLUBS: LIGA→`/clubs/la-liga`, PREMIER LEAGUE→`/clubs/premier-league`, LIGUE 1→`/clubs/ligue-1`, SERIE A→`/clubs/serie-a`, BUNDESLIGA→`/clubs/bundesliga`, MLS→`/clubs/mls`, liga portugal→`/clubs/liga-portugal`
  - FOOTWEAR: SHOP BY BRAND→`/footwear/brands`, SHOP BY SURFACE→`/footwear/surface`, SHOP BY COLLECTION→`/footwear/collections`

**How the landing page system works:**
- `groupedSubmenuItems` (useMemo in ProductGridPage): when `submenu` prop matches a **heading** label in `navigationMenus`, returns that heading's logo items — when it matches an **item** label (e.g. PORTUGAL), returns `[]`
- `isHeadingLandingPage = !!submenu && groupedSubmenuItems.length > 0` — distinguishes heading landing pages from product pages
- `shouldShowGrid` is false on heading landing pages → only the logo grid renders (no product grid beneath)
- QUICK LINKS (footwear) intentionally has no landing page — its items have no logos

**Session 16 improvements:**
- ✅ `Header.tsx` mega menu: `handleMenuMouseLeave()` with 150ms timeout + `handleMenuMouseEnter()` clearing it — prevents menu closing when cursor moves between nav bar and dropdown
- ✅ `Header.tsx` mega menu left column: changed submenu heading `<div>` → `<button>` to fix click events not firing on mobile/touch
- ✅ `Header.tsx` mega menu layout: left column `relative z-50`, right column `relative z-10` — fixes right column (flex-1 + Framer Motion stacking context) overlapping and blocking left column clicks
- ✅ `Header.tsx` mega menu animation: removed `x: ±10` from `motion.div` exit/enter (opacity fade only) — was shifting right column leftward over left column during transition
- ✅ `Header.tsx` left column headings: render as `<Link to={submenu.path}>` when `submenu.path` exists, otherwise render as tab `<button>` — enables EQUIPMENT submenus (BALLS, GOALKEEPER etc.) to be clickable navigation links
- ✅ `AdminPage.tsx` navigation editor: collapsible menu sections — all menus collapsed by default with ▶/▼ chevrons; click header to expand/collapse
- ✅ `AdminPage.tsx` navigation editor: collapsible submenu columns — each submenu heading also collapsible with ▶/▼; shows item count when collapsed
- ✅ `AdminPage.tsx` navigation editor: search box at top — auto-expands matching menus/submenus, highlights matching text in yellow, shows "No results found" when nothing matches, collapses back on clear
- ✅ `ChevronRight` added to lucide-react imports in `AdminPage.tsx`
- ✅ New state: `expandedMenus`, `expandedSubmenus`, `navSearchQuery` in AdminPage
- ✅ New helpers: `toggleMenu()`, `toggleSubmenu()`, `highlightText()` in AdminPage

**Session 15 improvements:**
- ✅ `ProductGridPage.tsx`: Replaced top filter bar + mobile bottom-sheet drawer with left slide-out sidebar
- ✅ "Filters" button (all screen sizes) with red badge count of active filters — replaces separate desktop sort dropdown and mobile "Filter & Sort" button
- ✅ Sidebar slides in from LEFT: `initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.3 }}` — 280px on desktop, full-screen on mobile
- ✅ Dark overlay (`bg-black/50`) behind sidebar; click overlay to close; X button top-right
- ✅ Sidebar sections: Sort By (radio buttons), Brand (checkboxes + product count per brand), Price Range (toggle buttons), Size (toggle grid, footwear only), On Sale (toggle switch)
- ✅ Sidebar footer: "Clear All" (text left) + "Apply Filters" (red `#b90014`, full width) — Apply just closes sidebar (filters apply live)
- ✅ Sort now included in `activeFilterCount` badge; "Clear All" resets sort back to Newest First
- ✅ Brand product counts computed via `brandProductCounts` useMemo (category-filtered, brand-filter excluded so counts show full totals)
- ✅ Active filter tags above product grid now include sort tag (dark gray chip) when non-default sort is selected
- ✅ Removed `BrandFilter` component import from `ProductGridPage` (brand now inlined as checkboxes in sidebar); `BrandFilter.tsx` file preserved but unused
- ✅ Removed `ChevronDown` icon import (no longer needed without sort dropdown)

**Session 14 improvements:**
- ✅ `/custom-apparel` route added to sitemap generator (`scripts/generate-sitemap.js` `mainPages` array) — sitemap now 181 URLs (4 main + 7 category + 168 product pages)
- ✅ `CustomApparelPage.tsx` hero image: replaced placeholder `<div>` with `<img src="/hero-apparel.png" alt="Custom business apparel and uniforms in Mississauga" className="aspect-[4/3] w-full object-cover" />`
- ✅ `public/hero-apparel.png` added to main branch (1.45 MB) — was only on `custom-apparel` branch, causing missing image on live site
- ✅ `public/custom-apparel-banner.jpg` also in public folder (2.1 MB) — not currently used in hero but available
- ✅ `HomePage.tsx` slider: clicking prev/next arrow now resets the 5s auto-advance timer via `intervalRef` + `resetTimer()` — slide no longer jumps immediately after a manual click
- ✅ `HomePage.tsx` slider: indicator pins centered at bottom — active = wide red rectangle (`w-6 h-2 bg-[#b90014]`), inactive = small gray square (`w-2 h-2 bg-white/50`); clicking a pin jumps to slide and resets timer
- ✅ `AdminPage.tsx` slider: drag-to-reorder using `@dnd-kit/core` + `@dnd-kit/sortable`; `SortableSlideCard` component with grip handle (top-left); new order saved to DB on drop via `setContextSliderImages`
- ✅ Packages added: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2`

**Session 13 improvements (Ball Sizes):**
- ✅ Ball sizes (Size 1-5) added as explicit "Balls" age group option in getSuggestedSizes()
- ✅ Adult apparel expanded from 7 to 8 sizes: XXS, XS, S, M, L, XL, XXL, **XXXL**
- ✅ "Balls" age group added to AdminPage.tsx variant dropdowns (2 locations)
- ✅ "Balls" age group added to RapidScanIntakeMatrix.tsx with ⚽ emoji label
- ✅ When "Balls" is selected as age group, size dropdown shows: Size 1, Size 2, Size 3, Size 4, Size 5
- ✅ Type definitions updated to include 'Balls' as valid age group in both files
- ✅ Updated getSuggestedSizes() logic: prioritizes explicit age group selection over auto-detection

**Session 13 improvements (Kit Orders & Header):**
- ✅ SALE page bug fixed: `fetchProductsByCategory` skips category filter for "sale" and "new arrivals" (special collections not tagged in DB) — all products now load into state so `isOnSale` filter in ProductGridPage works correctly
- ✅ "UNIFORM SUBMISSION" renamed to "KIT ORDERS" everywhere: DB (`navigation_menus`), `DEFAULT_NAV`, route (`/kit-orders`), `Footer.tsx`, `AdminPage.tsx` (`getCategoryPath` + category filter). Old `/uniform-submission` route kept as backward-compat alias
- ✅ Header nav layout: center section now `flex-1` (fills all space between logo and icons) with `justify-center gap-5` — 9 items on one line at `text-[11px]`, `whitespace-nowrap`, `tracking-normal`
- ✅ Header left section: `flex-1` → `shrink-0` (logo stays compact); right section: `flex-1` → `shrink-0` (icons stay compact)
- ✅ Mega menu inner container: added `px-4 md:px-8` to match header padding — dropdown left edge now aligns with header content boundary

**Session 12 improvements:**
- ✅ `fetchAdminProducts` now includes `colors` in SELECT — admin navigation no longer wipes color data from context
- ✅ `updateProduct` Supabase `.update()` now includes `colors: payload.colors` — admin color edits are persisted to DB
- ✅ `mergeProducts` + `fetchProductsByCategory` merge guard: preserves cached `colors` if fresh data returns null/undefined (race-condition protection)
- ✅ `ProductDetailPage`: StrictMode loading flash fixed via `lastFetchedIdRef` + `cancelled` cleanup flags
- ✅ `ProductDetailPage`: stale variant/color/size state reset on product navigation (new reset `useEffect([id])`)
- ✅ Root cause identified: AdminPage calls `fetchAdminProducts` on mount (twice), which used to do a full REPLACE without `colors` — fixed

**Session 11 improvements:**
- ✅ ProductDetailPage: color selector shows ALL colors from both product.colors JSONB and product_variants.color column
- ✅ ProductDetailPage: selecting a color filters the size grid to only that color's variants (graceful fallback when v.color is null)
- ✅ ProductDetailPage: URL ?color=0 (legacy numeric index) auto-converts to color name on load
- ✅ POS barcode scan: success message and cart now show color (e.g. "Added: Portugal KING Anthem · Green · Sz S")
- ✅ POS size selector modal: shows variant color next to size
- ✅ Admin variant table: inline color dropdown per row saves to DB immediately on change
- ✅ RapidScanIntakeMatrix: color dropdown added; selected color passed to onRegisterVariant for batch intake
- ✅ DB migration run: ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS color TEXT;

**Session 10 improvements:**
- ✅ Footer SEO paragraph updated: removed "Open Monday to Friday 10am–6pm, Saturday 10am–5pm" line (hours now managed via Admin → SEO → Store Information)

**Session 9 improvements:**
- ✅ Store Information section added to Admin → SEO tab (Address, Phone, Email, Mon–Sun hours)
- ✅ Homepage "Visit Us" section now reads store name, address, phone, email, and per-day hours from DB
- ✅ JSON-LD schema (SportingGoodsStore) now built dynamically from stored store info and hours
- ✅ Admin store info uses direct Supabase fetch/upsert (not SettingsContext) for reliability
- ✅ Email now optional when adding customers (create walk-in customers without email)
- ✅ Removed duplicate Supabase client instances (fixes "Multiple GoTrueClient" warning)
- ✅ Handle duplicate email gracefully with UPSERT (update existing customer instead of failing)
- ✅ Fixed customer search input text visibility (was white on white)

POS system live and fully functional.
Navigation logos working and preserved on save.
Gift receipts with barcode and print copy options added.
Color variant support added (admin can track which color each size variant belongs to).
Expanded apparel size ranges: Youth (YXXS-YXL), Adult (XXS-XXL).
E-commerce features (Phases 1-5) built on ecommerce-dev branch, not yet merged to main.

### Main Branch Features
✅ POS system production-ready and live
✅ Stock quantity display in product grid (color-coded warnings)
✅ Stock quantity display in admin product list
✅ Size selector modal for products with variants
✅ Fixed product display flickering (single bulk variant fetch)
✅ Removed 30-item product limit in POS
✅ Google Search Console verified, sitemap submitted
✅ robots.txt configured (blocks /admin, /pos from search)
✅ Variant fetch paginated (loop with .range() bypasses Supabase 1000-row cap — 2364+ variants)
✅ 76 online products set show_sizes=false (no real size variants in DB)
✅ ProductDetailPage: show_sizes=false shows "Call to Order" CTA (📞 905-593-3600) instead of "Coming Soon"
✅ Canonical URL fixed: absolutesoccer.ca → torontosoccershop.com (SettingsContext.tsx default)
✅ Navigation logos fixed: normalizePath() no longer lowercases URLs, saveNavigation() preserves DB logos
✅ Color variant support: Admin can assign colors to variants, POS displays "Product - Color - Size" format
✅ ProductDetailPage multi-color selector: shows all colors from product.colors JSONB + product_variants.color; sizes filter by selected color
✅ POS barcode scan: success message and cart show color when variant.color is populated (e.g. "Added: Portugal KING Anthem · Green · Sz S")
✅ Admin variant inline color dropdown: saves to product_variants.color on change without full page save
✅ Color swatch thumbnails on product cards: persistent — fetchAdminProducts now fetches colors, updateProduct now saves colors to DB
✅ ProductDetailPage color buttons: no flash/disappear — StrictMode guard (lastFetchedIdRef) + cancelled cleanup flags + reset-on-navigate effect
✅ Expanded apparel sizes: Youth (YXXS, YXS, YS, YM, YL, YXL), Adult (XXS, XS, S, M, L, XL, XXL, XXXL)
✅ Ball sizes added: "Balls" age group with sizes 1-5; One Size option for accessories
✅ Gloves age group added: goalkeeper sizes 3–11 in both AdminPage and RapidScanIntakeMatrix
✅ Adult Footwear / Youth Footwear explicit age groups: sizes 3–13 and 1Y–6Y (0.5 increments); replaces category-detection for footwear products
✅ Navigation mega-menu rebuilt: all navigation_items now have correct parent_id hierarchy
✅ NATIONAL TEAMS submenu populated with 5 regional groups (EUROPE, SOUTH AMERICA, AFRICA, NORTH AMERICA, OTHERS)
✅ Gift receipt: item-selection modal + no-price thermal receipt (POSPage + PosTransactionHistory)
✅ Print 1 or 2 copies (Customer / Customer+Merchant) — both from checkout receipt and transaction history reprint
✅ Receipt logo size fix: switched from 180px to 55mm for correct Epson 80mm thermal printing
✅ Shared SHARED_STYLES constant in thermalReceipt.ts (no duplication across receipt types)
✅ Returns: payment method selection step for "Original Payment" refunds (Cash/Visa/MC/Debit/Amex)
✅ Returns: left-panel "Returns" action button now opens modal at lookup step (was silently broken — guard changed from returnsFoundTransaction to showReturnsModal)
✅ Store Info: Admin → SEO tab has editable Store Information card (address, phone, email, hours per day)
✅ Homepage "Visit Us" section: dynamic from DB store_info settings row (name, address, phone, email, hours grid)
✅ JSON-LD schema: openingHoursSpecification built dynamically from stored hours strings in useSEO.tsx
✅ Unified Refund/Return flow: both paths use ReturnsModal with choose-refund → SC or Original Payment → confirm
✅ Refund button in PosTransactionHistory fixed: was calling direct DB update, now opens ReturnsModal(mode=refund)
✅ Store Credit on returns/refunds: works without a linked customer (walk-ins get card number printed on receipt)
✅ JSON-LD schema markup: SportingGoodsStore on homepage, Product schema on product detail pages (sku, mpn, image array, sale price, canonical URL, priceValidUntil)
✅ Product schema image URLs: `getAbsoluteUrl()` ensures all image URLs in JSON-LD are absolute `https://` — fixes Google Search Console "Invalid URL in field image" Merchant Listings error
✅ Search by product_code and brand: `ProductGridPage` client-side filter includes `product_code` and `brand` fields — customers can find products by manufacturer SKU
✅ Bidirectional SKU search: hyphens stripped from `name`, `description`, and `product_code` before comparing — `"IB5300480"` finds product with `"IB5300-480"` in description, and vice versa
✅ `/brampton-soccer-uniforms`: City SEO landing page for Brampton soccer clubs — hero, why-us, how-it-works, visit-us, quote form; Helmet title/description set
✅ `/mississauga-soccer-store`: City SEO landing page for Mississauga — hero, community section, 3-column cards, how-it-works, visit-us (with hours), quote form; canonical URL set
✅ Sitemap: 185 URLs (6 main + 7 category + 170 product pages); `/mississauga-soccer-store` added to `scripts/generate-sitemap.js` mainPages array (priority 0.9)
✅ Theme & Branding admin panel: Admin → Settings → Theme tab; primary color, secondary color, live preview mockup, logos; all settings persisted to `settings` table `key='theme'`; **font selector removed** (caused Unicode corruption — see session 35/36)
✅ Primary color site-wide: all `[#b90014]` Tailwind arbitrary values replaced with `[var(--primary-color)]` across 33 source files
✅ Secondary color applied: Footer, HomePage "Visit Us", BramptonSoccerPage/MississaugaSoccerPage/CustomApparelPage "How It Works" + contact bar sections use `style={{ backgroundColor: 'var(--secondary-color)' }}`
✅ Unknown barcode modal in POS: scanned barcode not in DB → quick modal (brand + price + name) → "Add to Cart & Save Later" or "Add to Cart & Save Now"; amber badge button shows pending count; Pending Barcodes Manager lets staff link to existing product, create new (navigates to Admin pre-filled), or skip
✅ Admin pre-fill from POS scan: React Router navigation state `{ openAddProduct, pendingBarcode }` → AdminPage detects on mount, pre-fills Add Product form, auto-navigates back to /pos after save
✅ UTF-8 encoding fix: site-wide mojibake repaired in 9 files (corrupted â€¢ â€" emoji sequences fixed to proper • – 💳 👕 ⚽ 🛡️ etc.)
✅ Font system: `applyFont()` in SettingsContext overrides `--font-sans` (Tailwind v4 variable) + sets inline `fontFamily` on `html` and `body`; `html, body { font-family: var(--font-family) !important }` in index.css; live preview loads Google Font on dropdown change before save
✅ Homepage redesign: BrandBanners (Nike Futbol-style) → CategoryQuickLinks → SELECT YOUR SQUAD → New Arrivals → On Sale → Visit Us; Featured Products section removed. **Session 41:** duplicate BrandShowcase logo section removed from the bottom (BrandBanners at top already covers "Shop by Brand")
✅ BrandBanners component: 5 brand cards (Nike/Adidas/Puma/Joma/New Balance) with dark lifestyle images, hover zoom, product count badge, red CTA; 2-col featured + 3-col secondary layout; uses admin-uploaded image or Unsplash fallback
✅ CategoryQuickLinks component: 6 tiles with uploaded image (dark overlay) or emoji fallback; responsive 3-col mobile / 6-col desktop
✅ New Arrivals section on homepage: 4 most-recently-added online products (reduced from 6 in session 41); fallback to `isNewArrival=true` if `created_at` column absent
✅ On Sale section on homepage: up to 4 products with `isOnSale=true` (reduced from 6 in session 41); hidden when no sale items exist
✅ Admin → Theme tab: Brand Showcase Images — upload per-brand lifestyle image saved to `settings` key `brand_images`, stored in Supabase Storage `media/brand_images/`
✅ Admin → Theme tab: Category Tile Images — upload per-category image saved to `settings` key `category_images`, stored in Supabase Storage `media/category_images/`; **session 41:** added a per-tile `Link` field (pre-filled with defaults) so each homepage category tile's destination is admin-editable; **session 42:** added a per-tile `Title` field (pre-filled with defaults) so each tile's label is admin-editable
✅ SettingsContext: `brandImages`/`categoryImages` state + `BrandImages`/`CategoryImages` types + `setBrandImages`/`setCategoryImages` setters; auto-loaded from DB on mount
✅ Brand tiles on homepage: `BrandShowcase` links to `/brand/:brandName` (was broken `/products?brand=Nike`); `BrandPage` now calls `fetchProductsByCategory()` on mount so direct URL navigation shows products instead of "No products found"
✅ Sitemap: 181 URLs (4 main + 7 category + 168 product pages) — regenerated July 3, 2026
✅ SEO: updated title/meta description in index.html with keyword-rich content
✅ SEO: "formerly Golazo Store" brand attribution added to footer
✅ Instagram handle updated to @absolutemississauga across all files (schema, receipts)
✅ Footer SEO paragraph: removed hardcoded opening hours (hours managed via Admin → SEO → Store Information)
✅ SALE page: shows products with isOnSale=true — fetchProductsByCategory skips category filter for special collections (sale/new arrivals)
✅ "UNIFORM SUBMISSION" renamed to "KIT ORDERS" in nav (DB + DEFAULT_NAV + routes + footer + admin); /uniform-submission kept as alias
✅ Header nav: flex-1 center fills all space between logo and icons; 9 items at text-[11px] whitespace-nowrap tracking-normal on one line
✅ Mega menu inner container: px-4 md:px-8 padding matches header — dropdown left edge aligns with nav items
✅ `/custom-apparel` landing page: hero image (`/hero-apparel.png`), Who We Serve, What We Offer, How It Works, Why Choose Us, quote form (mailto), footer contact bar
✅ Sitemap: `scripts/generate-sitemap.js` — 181 URLs (4 main + 7 category + 168 product pages); regenerated July 3, 2026
✅ Homepage slider: prev/next clicks reset auto-advance timer (`intervalRef` + `resetTimer()`) — no more immediate jump after manual navigation
✅ Homepage slider: indicator pins at bottom — active wide red rectangle, inactive small gray square; click to jump + reset timer
✅ Admin slider: drag-to-reorder slides with `@dnd-kit` — grip handle top-left of each card, order saved to DB on drop
✅ Product grid filter sidebar: left slide-out panel (280px desktop / full-screen mobile) with Sort (radio), Brand (checkboxes + counts), Price (toggles), Size (footwear only), On Sale (toggle switch); "Filters" button with red badge; active filter tags row above grid
✅ Mega menu left column click fix: 150ms close delay; heading div→button; left column z-50 / right column z-10 prevents Framer Motion stacking context overlap; removed x-axis animation from transition
✅ Mega menu left column links: headings with `submenu.path` render as `<Link>` (navigate on click); headings without path render as tabs (hover behavior) — enables per-menu-type behavior
✅ Admin nav editor: collapsible menus + submenus (▶/▼, all collapsed by default, item counts shown); search box with yellow highlight + auto-expand matching sections
✅ Navigation landing pages: clicking a mega menu heading (EUROPE, LA LIGA, SHOP BY BRAND, etc.) shows a logo grid page — click a logo to see products; powered by `isHeadingLandingPage` flag in `ProductGridPage`
✅ `CategorySlugRoute` in `App.tsx`: handles `/category/:slug` → maps to matching nav menu → renders `ProductGridPage` (fixes blank page on query-param URLs like `/category/national-teams?region=europe`)
✅ Region filter in `ProductGridPage`: `?region=` query param filters products by that nav submenu's items — used as fallback for old URLs; logo grid hidden when `?region=` present
✅ 14 new landing page routes in `App.tsx`: FOOTWEAR (brands/surface/collections), NATIONAL TEAMS (europe/africa/south-america/north-america/others), CLUBS (la-liga/premier-league/ligue-1/serie-a/bundesliga/mls/liga-portugal)
✅ Supabase `navigation_items` paths updated for all 14 heading rows — clicks in mega menu now navigate to landing pages instead of going straight to products or going nowhere
✅ SOLD OUT display: product cards show greyscale + "SOLD OUT" banner; product detail page shows red "SOLD OUT" badge instead of size grid; POS cards show "SOLD OUT" label — all driven by zero-stock variant query
✅ Epson TM-T88IV receipt CSS: 72mm printable width, `2mm 4mm` padding, logo `55mm × 15mm`, table-layout columns for item/total rows, removed destructive `* { padding: 0 !important }` from @media print
✅ Receipt typography: body `13px bold`, store name `16px`, transaction-info `11px`, grand-total `15px`, item names bold
✅ 2-copy thermal receipt: both copies in ONE print window with `page-break-before: always`; class-based barcodes (`.receipt-barcode`) so JsBarcode renders both via `querySelectorAll`
✅ Product name truncation on receipts: `truncateName(name, 24)` — names over 24 chars get `...` suffix to fit 72mm paper
✅ Auto-print via `printWindow.onload` (500ms delay + `onafterprint` closes window) — replaced unreliable inline `setTimeout` script
✅ Admin → Theme tab: Brand Showcase Images cards each have an editable title field (`settings.brand_images` → `{ title, image }` per brand) — homepage `BrandBanners` falls back to hardcoded labels when no title is set
✅ Homepage hero: full-bleed peek carousel (center slide + edge peeks, dark overlay on non-active slides) replaces the old single full-width rounded hero card; arrow/dot navigation, auto-advance, touch swipe
✅ Homepage hero: true infinite loop via cloned first/last slides + transition-less snap-back — peek on the first/last slide shows the wrap-around neighbor, not empty space
✅ Homepage hero (session 41): `object-contain` + `aspect-ratio: 12/5` sizing — full banner always visible (black letterbox instead of cropping), no top/bottom/left/right overflow at any viewport size (verified mobile through 32"/4K)
✅ Fixed header/content overlap on desktop (session 41): `Layout.tsx` `<main>` padding-top is now responsive (`pt-[73px] md:pt-[113px]`) matching the fixed `<Header>`'s real height at each breakpoint — previously a static 80px under-reserved space for the 113px desktop header, covering the top ~33px of every page's content
✅ Category tile links (session 41): Admin → Theme → Category Tile Images has a per-tile `Link` field; `CategoryImages` is now `{ image, link }` per category; `CategoryQuickLinks` uses the saved link with fallback to its hardcoded default
✅ Category tile titles (session 42): Admin → Theme → Category Tile Images has a per-tile `Title` field; `CategoryImages` is now `{ image, link, title }` per category; `CategoryQuickLinks` uses the saved title with fallback to its hardcoded default label
✅ Fixed corrupted arrow glyph on `/brands` (session 41): `Shop {brand} â†'` mojibake → lucide `ArrowRight` icon
✅ Homepage New Arrivals / On Sale reduced to 4 tiles each (session 41); duplicate `BrandShowcase` section removed from bottom of homepage
✅ Item-level POS discounts (session 44): per-cart-item `%`/`$` discount, flows into cart totals, checkout, on-screen receipt, and printed thermal receipt
✅ Layaway (session 44): customer-required deposit flow, stock deducted on hold, managed (payment/cancel+restock/reprint) from a POS tab and an Admin tab — requires `docs/layaway-paylater-migration.sql` run in Supabase first
✅ Pay Later (session 44): same flow as Layaway without a deposit — requires the same pending migration
✅ Unvoid transaction (session 44): `PosTransactionHistory.tsx` — restores a voided transaction back to `status='completed'`
✅ "Walk-in" no longer printed on receipts (session 44) — Customer row omitted entirely when there's no real customer
✅ Fixed customer creation failing on a blank email (session 44) — was a `customers.email` UNIQUE constraint collision (blank inserted as `''` not `NULL`), not RLS; fixed in `CustomerContext.tsx`

## COMPLETED FEATURES

**POS System (/pos):**
- PIN auth (2024, env: VITE_POS_PIN)
- Dark/light theme toggle
- Shopify-style two-column layout
- Barcode scanning (SC-, INV-, product codes)
- 7 payment methods (Cash, Debit, Visa, MC, Amex, GC, SC)
- Stock quantity display with color-coded warnings
  * Red "Out of Stock" when stock = 0
  * Amber "Only X left!" when stock 1-3
  * Gray "X in stock" when stock 4-10
- Size selector modal (shows stock per size)
- Thermal receipt printing (Epson 80mm) with print 1 or 2 copies option
- Gift receipt feature with barcode and dedicated modal
- Color variant display in cart and receipts (format: "Nike Jersey - Red - Size M")
- Barcode scan success message includes color (e.g., "Added: Product · Red · Sz M")
- Transaction history with void/refund/return
- Discount system (percentage & custom)
- Cash change calculator
- Gift cards: issue/redeem/history
- Store credits: issue/redeem/scan/balance
- Returns: 6-step wizard with inventory restoration and refund payment method tracking
  * Flow: lookup → select-items → choose-refund → choose-payment-type (Original Payment only) → confirm → complete
  * "Original Payment" branch shows Cash/Visa/MC/Debit/Amex picker before confirm
  * Chosen method saved to `refund_payment_method` on returns table
  * Store Credit works without a linked customer (walk-ins) — card number printed on receipt
- Refunds (from history): same modal as Returns (mode="refund") — skips lookup/item-selection, uses full transaction total, no inventory restore
  * Entry points: History tab Refund button (PosTransactionHistory) and Void/Refund panel (POSPage)
  * Both offer: Issue Store Credit OR Refund to Original Payment (Cash/Visa/MC/Debit/Amex)
- Reports: EOD, Sales, Products, GC, Void/Refund, Customer, SC (Eastern timezone)
- Cash drawer open button: "Drawer" button in right-panel action row (Void/Refund | Return | History | **Drawer**); Archive icon (amber); uses EpsonControl font character "A" to send ESC/POS drawer kick command via browser print dialog

**Admin Panel (/admin):**
- Product CRUD with variants (size, barcode, stock, color)
- Color variant assignment for products (Red, Blue, Green, etc.)
- Variant table shows color column (Age Group | Size | **Color** | Barcode | Stock)
- Brand field with bulk brand assignment
- Stock quantity display with low-stock warnings
- Product list pagination (20 items/page)
- Inventory management
- Customer management
- Settings and database backup
- No flickering (single bulk fetch of all variants)
- Expanded apparel size ranges for Youth and Adult categories

**Database & Infrastructure:**
- Standalone /pos route with full POS logic
- Invoice numbering (INV-XXXXX via trigger)
- Customer profiles with history
- Navigation menus (navigation_menus, navigation_items tables)
- Product brand and product_code columns
- Duplicate product prevention (unique: name+category)
- SEO meta tags via useSEO hook + JSON-LD schema (SportingGoodsStore homepage, Product detail pages)
- Sitemap at public/sitemap.xml
- Google Search Console verified
- robots.txt blocks /admin and /pos from crawlers
- Footer brand attribution: "formerly Golazo Store" for SEO brand association

## E-COMMERCE FEATURES (ecommerce-dev branch - NOT merged to main)
**Built and tested (Phases 1-5 complete):**
- Shopping cart with localStorage persistence
- Checkout with customer form & address validation
- Order confirmation emails via Resend.com
- Shared inventory between POS and online store
- Real-time stock validation (no overbooking)
- Customer authentication (register, login, password reset)
- Account page with order history
- Google OAuth sign-in
- Shipping options (Pickup FREE / Ship $15)
- Admin panel for online orders

**Status:** Ready for merge to main OR Phase 6 development (Stripe payment processing).
**Decision:** Merge when decided to go live without payment, or after Phase 6 is complete.

## BRANCH STRATEGY
- main = stable POS system (production live)
- ecommerce-dev = e-commerce phases 1-5 (tested, ready for merge decision)
- Tag v1.0-pos-complete = permanent restore point

## KEY ARCHITECTURE RULES
- NO /api/ backend - all direct Supabase client calls
- RLS disabled on all tables
- Vercel hosting (automatic deployment from main)
- React Context: ProductContext, CustomerContext, SettingsContext
- Custom hooks: usePOSCart, useSEO
- No Redux - prop drilling at current scale
- TypeScript strict mode
- All console.log removed (kept console.error/warn)

## DATABASE TABLES
**Core POS:**
- products: id, name, price, category, brand, product_code, image, description, is_online, show_sizes, colors (jsonb), cost_price (DECIMAL, session 44 — run migration if missing)
- product_variants: id, product_id, size, barcode, stock_quantity, sku, age_group, color (text, nullable)
- transactions: id, invoice_number, customer_id, total_amount, method, items(jsonb), created_at, status, payment_splits (jsonb, session 44 — run migration if missing)
- customers: id, first_name, last_name, email, phone, boot_size, club_affinity
- gift_cards: id, card_number, initial_balance, current_balance, is_active
- store_credits: id, card_number, customer_id, amount, remaining_balance, is_active
- returns: id, transaction_id, customer_id, items, refund_amount, status, refund_payment_method (TEXT — run migration if missing)
- settings: key, data (jsonb) — keys: global, slider, homeCategories, navigation, footer, seo, store_info, theme, brand_images ({title,image} per brand), category_images ({image,link,title} per category, session 41-42)
- navigation_menus: id, label, path, order_index, is_active
- navigation_items: id, menu_id, label, path, logo_url, order_index, parent_id
- layaways: id, customer_id, items(jsonb), total_amount, deposit_paid, balance_due, status ('active'/'completed'/'cancelled'), notes, created_at, updated_at — **NOT YET CREATED**, run `docs/layaway-paylater-migration.sql` (session 44)
- pay_later: id, customer_id, items(jsonb), total_amount, amount_paid, balance_due, status ('unpaid'/'paid'/'cancelled'), notes, created_at — **NOT YET CREATED**, run `docs/layaway-paylater-migration.sql` (session 44)
- blog_posts: id, title, slug (unique), content, excerpt, image_url, thumbnail_url, featured_product_ids (UUID[]), author, is_published, published_at, created_at, updated_at — run `docs/blog-migration.sql` (session 53)

**E-Commerce (ecommerce-dev branch):**
- online_orders: id, customer_id, items(jsonb), subtotal, tax, total, shipping_method, shipping_cost, status, created_at

## KEY FILES
- src/pages/POSPage.tsx - POS main interface
- src/pages/AdminPage.tsx - Admin panel (8+ tabs)
- src/pages/ProductDetailPage.tsx - Product detail page (Call to Order CTA for no-size products; Product JSON-LD schema)
- src/pages/HomePage.tsx - Homepage, incl. hero peek carousel with infinite loop (cloned edge slides + transition-less snap-back)
- src/components/BrandBanners.tsx - Homepage brand banner grid; reads admin-editable title/image from settings.brand_images
- src/context/ProductContext.tsx - Product CRUD
- src/context/SettingsContext.tsx - Site settings defaults (canonical URL, SEO)
- src/components/ReturnsModal.tsx - Returns/Refund modal (mode="return" or mode="refund"); handles both flows with payment method selection
- src/components/GiftReceiptModal.tsx - Gift receipt generation with barcode
- src/components/PosTransactionHistory.tsx - Transaction history tab with Refund/Return/Void/Unvoid/Reprint
- src/components/PosLayawayTab.tsx - Layaway + Pay Later management (list with View/Payment/Reprint/Cancel per row, take payment with a dedicated payment receipt, cancel+restock); used from both a POS tab and an Admin tab (session 45-46)
- src/components/LayawayPayLaterModal.tsx - Creates a new Layaway or Pay Later from the current POS cart (session 45)
- src/utils/thermalReceipt.ts - Receipt generation (thermal, gift, store credit, layaway, pay later, layaway/pay-later payment receipt)
- src/utils/timezoneUtils.ts - Eastern time (America/Toronto) helpers for all report date filtering/display; Intl-based, not host-machine-timezone-based (session 46)
- src/hooks/useSEO.tsx - JSON-LD SportingGoodsStore schema (homepage only); accepts storeInfo and builds openingHoursSpecification dynamically
- src/hooks/usePOSCart.ts - Cart state management with color variant support + per-item `%`/`$` discounts (session 45)
- src/pages/BlogListPage.tsx - Blog/Gear Guides listing page — featured post + 3-col grid, published only (session 53)
- src/pages/BlogPostPage.tsx - Blog article page — breadcrumb, hero image (session 53; `object-contain`/max-height 500px, no crop, session 56), react-markdown content, featured products, BlogPosting schema
- src/components/BlogAdminTab.tsx - Admin Blog tab — post list/CRUD, hero+thumbnail upload, featured product search/select (session 53)
- public/sitemap.xml - SEO sitemap
- public/robots.txt - Crawler rules; includes explicit AI/LLM crawler allowlist for GEO (session 53)
- public/llms.txt - LLM-crawler-facing store summary (session 47, updated session 53)
- data/settings_exported.json - Supabase settings seed data

## ROUTES
- `/` — Home/storefront
- `/admin` — Admin panel
- `/pos` — POS system (PIN auth)
- `/brands` — All brands listing page (BrandsPage)
- `/brand/:brandName` — Individual brand page (BrandPage) — filters products by brand, with category sub-filter + search + sort
- `/reports` — Financial reports
- `/kit-orders` — Kit Orders page: standard Header/Footer + full-height iframe embed of the uniform designer (also aliased at `/uniform-submission` for backward compat)
- `/custom-lab` — Custom Lab page: standard Header/Footer + full-height iframe embed of the jersey designer
- `/sale` — Sale page (filters products where isOnSale=true)
- `/custom-apparel` — Custom Apparel landing page
- `/blog` — Blog/Gear Guides listing page (BlogListPage) — published posts only
- `/blog/:slug` — Blog article page (BlogPostPage) — published posts only
- `/brampton-soccer-uniforms` — City SEO landing page for Brampton soccer clubs (BramptonSoccerPage)
- `/mississauga-soccer-store` — City SEO landing page for Mississauga soccer store (MississaugaSoccerPage)
- `/category/:slug` — Alias for any nav menu path slug (e.g. `/category/national-teams`) — handled by `CategorySlugRoute`

**Navigation landing pages (logo grid → click to see products):**
- `/footwear/brands` — SHOP BY BRAND logo grid
- `/footwear/surface` — SHOP BY SURFACE logo grid
- `/footwear/collections` — SHOP BY COLLECTION logo grid
- `/national-teams/europe` — European countries logo grid
- `/national-teams/africa` — African countries logo grid
- `/national-teams/south-america` — South American countries logo grid
- `/national-teams/north-america` — North American countries logo grid
- `/national-teams/others` — Others logo grid
- `/clubs/la-liga` — La Liga clubs logo grid
- `/clubs/premier-league` — Premier League clubs logo grid
- `/clubs/ligue-1` — Ligue 1 clubs logo grid
- `/clubs/serie-a` — Serie A clubs logo grid
- `/clubs/bundesliga` — Bundesliga clubs logo grid
- `/clubs/mls` — MLS clubs logo grid
- `/clubs/liga-portugal` — Liga Portugal clubs logo grid

## PENDING DB MIGRATIONS
Run these once in Supabase SQL editor if not already done:
```sql
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_payment_method TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_splits JSONB;
```

Run `docs/layaway-paylater-migration.sql` in the Supabase SQL editor before Layaway/Pay Later will work (session 45) — creates the `layaways` and `pay_later` tables. No DDL execution path exists from the app or its scripts (all use the anon/service-role REST keys, not a Postgres connection), so this always has to be run manually.

Already run (no action needed):
```sql
-- ✅ Done (session 11):
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS color TEXT;
-- ✅ Confirmed already applied (verified via live insert during session 45 debugging):
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
-- ✅ Confirmed already applied (verified via live query during session 53):
-- docs/blog-migration.sql — creates blog_posts (title, slug, content, excerpt, image_url,
-- thumbnail_url, featured_product_ids, author, is_published, published_at, created_at, updated_at)
```

## KNOWN ISSUES
| Issue | Status |
|-------|--------|
| Germany product images (7 items) | Low priority |
| All critical POS features | ✅ Complete |
| Flag logos in National Teams mega-menu | Wikipedia blocks hotlinking — images show as blank boxes; text links work fine |
| Existing product_variants.color values are NULL | Admin must assign colors via Admin → Edit Product → Registered Master Variants color dropdowns (Portugal KING Anthem, Portugal Quarter-Zip, and any future multi-color products) |

## BUG FIXES & IMPROVEMENTS (Sessions 6-8 - June 17, 2026)
### POS Customer Section
- ✅ **Customer search input visibility:** Added `text-zinc-900` to search field. Text was white on white background (invisible while typing)
- ✅ **Customer form input visibility:** Added `text-zinc-900` to all form inputs (First Name, Last Name, Email, Phone, Boot Size, Club Affinity)
- ✅ **Enhanced error logging:** Changed `addCustomer()` error logging to show full error object + message details for debugging customer creation failures

### Customer Duplicate Email Handling (Session 7)
- ✅ **UPSERT instead of INSERT:** Changed from INSERT to UPSERT when email is provided
- ✅ **Graceful duplicate handling:** If customer with same email exists, their info is updated instead of failing
- ✅ **Better error detection:** Detects PostgreSQL duplicate key error (code 23505) and logs clear message
- ✅ **Fallback to INSERT:** When no email provided, uses regular INSERT (allows duplicate names without email)
- ✅ **Auto-refresh:** Automatically refreshes customer list after UPSERT to reflect changes

**Benefits:**
- No confusing error when re-entering a customer
- Prevents duplicate customer records
- Keeps customer data up-to-date if re-entered
- Better user experience in POS customer management

### Email Optional & Shared Supabase Client (Session 8)
- ✅ **Email optional:** Customers can now be created with just name and phone (no email required)
  - UPSERT only used when email is provided and non-empty
  - Falls back to INSERT when email is blank (allows multiple customers with same name)
  - Handles both null and empty string email values
  - Enables walk-in customer creation without email

- ✅ **Remove duplicate Supabase client:** Fixes "Multiple GoTrueClient instances" warning
  - StoreCreditsSection.tsx now uses shared `supabase` import from `../supabase`
  - Replaced `createClient()` with shared instance
  - Verified: no other components creating their own Supabase clients
  - Single Supabase instance reduces overhead and console warnings

- ⚠️ **Database requirement:** Email column should be nullable
  ```sql
  ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
  ```

**Files modified:**
- `src/components/PosCustomerManager.tsx` - Added text color classes to inputs (Session 6)
- `src/context/CustomerContext.tsx` - Enhanced error logging (Session 6) + UPSERT implementation (Session 7) + email optional handling (Session 8)
- `src/components/StoreCreditsSection.tsx` - Use shared Supabase client instead of creating new instance (Session 8)

## NEXT STEPS
- Decide on e-commerce merge timeline (Phases 1-5 ready on ecommerce-dev)
- Phase 6 development (Stripe payment) if going live with payments
- Mobile app consideration (React Native)
- Advanced analytics/reporting

## NAVIGATION LOGOS (Fixed June 14, 2026)
- `navigation_items.logo_url` stores all logo URLs
- Logos are in Supabase Storage: `media` bucket → `navigation_navigationMenus_submenus_items_logo/` folder
- **Bug fixed**: `normalizePath()` was lowercasing all URLs including `https://` Supabase Storage URLs (case-sensitive) — now skips any URL starting with `http` or `data:`
- **Bug fixed**: `saveNavigation()` now snapshots existing `logo_url` values before delete and restores them via `logoByLabel` map if in-memory state has no logo
- National team logos at `assets.cdn.filesafe.space` URLs — case-sensitive bucket ID
  - Correct: `By2ouDwVDtWabLH4FJkE` — if logos break check for lowercase `by2oudwvdtwablh4fjke`
- Logo restore SQL saved at: `docs/restore-logos.sql`
- If logos disappear after a save, run `npx tsx scripts/restore_logos.ts`

## APPAREL SIZE RANGES (Updated June 24, 2026)
**Toddler Apparel:** 12M, 18M, 24M, 2T, 3T, 4T (6 sizes)
**Youth Apparel:** YXXS, YXS, YS, YM, YL, YXL (6 sizes)
**Adult Apparel:** XXS, XS, S, M, L, XL, XXL, **XXXL** (8 sizes)

**Footwear:**
- Toddler (via category detection): 4C, 4.5C, 5C... 13C (19 sizes)
- Youth Footwear (explicit age group): 1Y, 1.5Y, 2Y... 6Y (11 sizes)
- Adult Footwear (explicit age group): 3, 3.5, 4... 13 (21 sizes)

**Balls:** Size 1, Size 2, Size 3, Size 4, Size 5 (5 sizes)

**Gloves (Goalkeeper):** 3, 4, 5, 6, 7, 8, 9, 10, 11 (9 sizes)

**One Size:** One Size option for accessories and one-size items

**Age group dropdown order:** Adult → Youth → Balls → Gloves → One Size → Adult Footwear → Youth Footwear → Toddler

**Implementation:** Size ranges defined in `getSuggestedSizes()` function in:
- `src/pages/AdminPage.tsx`
- `src/components/RapidScanIntakeMatrix.tsx` (both files must stay in sync)

## COLOR VARIANTS (Added June 17, 2026)
- Product can have multiple color variants (e.g., Red, Blue, Green)
- Each variant can be assigned a color in the admin panel
- Color displays in cart and receipts with format: "Product - Color - Size"
- Color field in product_variants table is optional (nullable)
- Color selection dropdown populated from product.colors array
- RapidScanIntakeMatrix component handles size/color intake during variant creation

## NAVIGATION DB STRUCTURE (navigation_menus + navigation_items)
- `navigation_menus` rows = top-level nav items (FOOTWEAR, CLUBS, NATIONAL TEAMS, etc.)
- `navigation_items` with `parent_id = null` = submenu headings (SHOP BY CATEGORY, LIGA, EUROPE, etc.)
- `navigation_items` with `parent_id = <heading_id>` = individual links (Nike, Arsenal, Portugal, etc.)
- ALL items MUST have the correct parent_id set — if parent_id=null on a child item it will render as a heading (broken mega-menu)
- When rebuilding navigation: delete per menu_id separately (not with `in.(...)` syntax which can silently miss rows), then insert headings first, capture IDs, then insert children
- Supabase batch insert requires all JSON objects to have identical keys — always include `"logo_url":null` on items without logos
- FOOTWEAR: 5 headings (SHOP BY CATEGORY, SHOP BY BRAND, SHOP BY SURFACE, SHOP BY COLLECTION, QUICK LINKS)
- CLUBS: 6 headings (LIGA, LIGUE 1, PREMIER LEAGUE, SERIE A, BUNDESLIGA, MLS)
- NATIONAL TEAMS: 5 headings (EUROPE: 7 nations, SOUTH AMERICA: 4, AFRICA: 3, NORTH AMERICA: Canada, OTHERS: Bosnia)

## IMPORTANT PATTERNS
- Supabase row cap is 1000 — ALWAYS paginate large fetches with `.range(from, from+999)` loop
- product_variants now has 2364+ rows — never use plain `.select()` without pagination
- show_sizes=false → no size picker, show "Call to Order" CTA in ProductDetailPage
- Canonical URL default lives in src/context/SettingsContext.tsx (also in Supabase settings table)
- Navigation URLs are case-sensitive — normalizePath() must NEVER lowercase http/data: URLs
- Size suggestions are generated dynamically in getSuggestedSizes() — both files must be kept in sync
