# Navigation Tables Setup Guide

## Overview

The Admin panel has a **Navigation tab** that allows dynamic management of the site's navigation menus. This requires two database tables in Supabase.

## Current Status

**Issue:** The app gets 404 errors trying to fetch from `navigation_menus` and `navigation_items` tables that don't exist.

**Why?** The SettingsContext tries to fetch navigation from relational tables, but they're missing. The app gracefully falls back to storing navigation as JSON in the settings table, so the app still works.

**Solution:** Create the tables in Supabase to enable full functionality.

## Tables to Create

### navigation_menus
Stores the top-level navigation menus (e.g., "FOOTWEAR", "APPAREL", "EQUIPMENT")

```sql
CREATE TABLE navigation_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  label TEXT NOT NULL,               -- Display label (e.g., "FOOTWEAR")
  slug TEXT UNIQUE,                  -- URL-friendly name
  path TEXT,                         -- Root path (e.g., "/footwear")
  order_index INTEGER DEFAULT 0,     -- Display order
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### navigation_items
Stores submenu categories and individual menu items (hierarchical)

```sql
CREATE TABLE navigation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID REFERENCES navigation_menus(id) ON DELETE CASCADE,
  label TEXT NOT NULL,               -- Item label (e.g., "Men's Footwear")
  heading TEXT,                      -- Submenu heading (column title)
  url TEXT,                          -- Legacy field
  path TEXT,                         -- Route path
  logo_url TEXT,                     -- Logo image URL
  order_index INTEGER DEFAULT 0,     -- Display order
  parent_id UUID REFERENCES navigation_items(id) ON DELETE CASCADE, -- For nested items
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## How to Set Up

### Option 1: Use the Migration File (Recommended)

1. Open Supabase SQL Editor: https://app.supabase.com/project/_/sql
2. Copy the contents of `migrations/create_navigation_tables.sql`
3. Run the SQL
4. Tables are created with proper RLS disabled and indexes

### Option 2: Manual SQL

Copy and paste each CREATE TABLE statement into Supabase SQL Editor.

## Navigation Structure (Hierarchy)

The navigation is stored as a 3-level hierarchy:

```
navigation_menus (Level 1)
└── FOOTWEAR
    └── navigation_items (Level 2) - Submenu categories
        ├── SHOP BY CATEGORY (parent_id = NULL)
        │   └── navigation_items (Level 3) - Individual items
        │       ├── Men's Footwear (parent_id = SHOP BY CATEGORY)
        │       ├── Women's Footwear
        │       └── Kids' Footwear
        │
        ├── SHOP BY BRAND (parent_id = NULL)
        │   └── navigation_items (Level 3)
        │       ├── Nike
        │       ├── adidas
        │       └── ...
        │
        └── SHOP BY SURFACE
            └── Individual items
```

**Database Representation:**
- `navigation_menus`: Top-level (FOOTWEAR, APPAREL, etc.)
- `navigation_items` where `parent_id IS NULL`: Submenu headings (SHOP BY CATEGORY)
- `navigation_items` where `parent_id IS NOT NULL`: Individual items under headings

## Admin Navigation Tab

The Admin panel has a full UI for managing navigation:

**File:** `src/pages/AdminPage.tsx` (Navigation tab)

**Features:**
- Add/remove menus
- Add/remove submenu categories
- Add/remove individual menu items
- Edit labels, paths, and logos
- Drag to reorder items
- Upload custom logos for menu items

**Functions Used:**
- `saveNavigation(menus)` - Saves entire menu structure to database
- `updateNavigationItem(id, updates)` - Updates a single item
- `forceManualNavigationMigration()` - Migrates legacy navigation from settings table

## Fallback Behavior

If the `navigation_menus` and `navigation_items` tables don't exist:

1. SettingsContext catches the error on fetch (line 122-123)
2. Falls back to storing navigation as JSON in `settings` table with key='navigation'
3. App still works, but tables are unused

**This is why the app doesn't crash even though tables are missing.**

## Next Steps

1. Create the tables using the migration file
2. (Optional) Run `forceManualNavigationMigration()` to migrate any existing navigation from the settings table to the relational tables
3. Test the Navigation tab in Admin panel
4. Verify navigation renders correctly on the site

## Testing

After creating tables:

1. Go to Admin panel → Navigation tab
2. Edit a menu item (e.g., change Nike → Nike Soccer)
3. Click "Save Navigation"
4. Verify changes appear on the site homepage
5. Check browser console - should see no 404 errors for navigation_menus/items

## Architecture Notes

**Why relational tables?**
- Better performance for large navigation structures
- Easier to manage relationships (parent-child items)
- Supports reordering and dynamic additions
- Allows future API endpoints for navigation management

**Why the fallback?**
- Legacy support if tables don't exist
- Graceful degradation
- Navigation still works even without tables (stores as JSON in settings)

## Related Files

- `src/context/SettingsContext.tsx` - Fetches/saves navigation
- `src/pages/AdminPage.tsx` - Navigation tab UI
- `src/constants/navigation.ts` - Default navigation structure
- `migrations/create_navigation_tables.sql` - Table creation SQL
