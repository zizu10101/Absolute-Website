-- NAVIGATION LOGO RESTORE
-- Run this if navigation logos disappear after a saveNavigation() call.
-- Source of truth: data/backup-2026-05-02.json (navigation.navigationMenus)
-- Script equivalent: npx tsx scripts/restore_logos.ts

-- ============================================================
-- 1. Remove duplicate navigation_menus (keep newest per label)
-- ============================================================
DELETE FROM navigation_menus
WHERE id NOT IN (
  SELECT DISTINCT ON (label) id
  FROM navigation_menus
  ORDER BY label, created_at DESC
);

-- ============================================================
-- 2. Spot-check: confirm 8 menus remain
-- ============================================================
-- SELECT label, id, created_at FROM navigation_menus ORDER BY order_index;

-- ============================================================
-- 3. Fix filesafe CDN URLs that got lowercased
--    Correct bucket ID: By2ouDwVDtWabLH4FJkE (mixed case)
--    Broken bucket ID:  by2oudwvdtwablh4fjke (all lowercase)
-- ============================================================
UPDATE navigation_items
SET logo_url = REPLACE(logo_url, 'by2oudwvdtwablh4fjke', 'By2ouDwVDtWabLH4FJkE')
WHERE logo_url ILIKE '%by2oudwvdtwablh4fjke%';

-- ============================================================
-- 4. Verify logos present after restore
-- ============================================================
-- SELECT label, logo_url FROM navigation_items WHERE logo_url IS NOT NULL ORDER BY label;

-- ============================================================
-- NOTES
-- ============================================================
-- Logos are stored in Supabase Storage:
--   Bucket: media
--   Folder: navigation_navigationMenus_submenus_items_logo/
--   Files:  auto_<timestamp>_<hash>.svg+xml  (40 files)
--
-- normalizePath() in SettingsContext.tsx MUST NOT lowercase http/data: URLs.
-- The fix (June 14 2026): skip normalization for URLs starting with 'http' or 'data:'.
--
-- To restore from backup JS script:
--   npx tsx scripts/restore_logos.ts
