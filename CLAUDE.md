# Absolute Website - Development Context

## Project Overview
React + TypeScript e-commerce app (Absolute Soccer) with Point of Sale (POS) system, product catalog, and admin panel. Uses Supabase for data storage, Vite for bundling, and Tailwind CSS for styling.

**Stack:** React 19, TypeScript, Supabase, Vite, Tailwind CSS, Google Gemini AI integration

**Current Branch:** main  
**Server:** Running on `http://localhost:3000`

---

## Session June 2, 2026 - Summary

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
