-- Create navigation menu structure tables for dynamic navigation management
-- The Admin panel Navigation tab manages these tables

CREATE TABLE IF NOT EXISTS navigation_menus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  label TEXT NOT NULL,
  slug TEXT UNIQUE,
  path TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS navigation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id UUID REFERENCES navigation_menus(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  heading TEXT,
  url TEXT,
  path TEXT,
  logo_url TEXT,
  order_index INTEGER DEFAULT 0,
  parent_id UUID REFERENCES navigation_items(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS to allow public read/write for now (can be added back later)
ALTER TABLE navigation_menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_items DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_navigation_items_menu_id ON navigation_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_navigation_items_parent_id ON navigation_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_navigation_items_order ON navigation_items(menu_id, order_index);
CREATE INDEX IF NOT EXISTS idx_navigation_menus_order ON navigation_menus(order_index);
