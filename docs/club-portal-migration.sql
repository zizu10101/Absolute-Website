-- Run in the Supabase SQL editor before using the Club Portal (/portal/:slug and
-- Admin -> Clubs). password_hash is never selectable by the browser in practice
-- (portal/admin pages only ever select specific columns, and mutations go through
-- server.ts's service-role-backed /api/clubs, /api/club-items, /api/club-orders
-- routes) but anon SELECT is still granted here per the original spec so the public
-- landing/login/dashboard pages can read a club's branding directly.

CREATE TABLE IF NOT EXISTS clubs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- e.g. "portugal-fc"
  logo_url TEXT,
  primary_color TEXT DEFAULT '#b90014',
  secondary_color TEXT DEFAULT '#ffffff',
  photos JSONB DEFAULT '[]', -- array of image URLs
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO service_role;
GRANT SELECT ON public.clubs TO anon;

CREATE TABLE IF NOT EXISTS club_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sizes_available JSONB DEFAULT '[]',
  price DECIMAL(10,2),
  is_suggested BOOLEAN DEFAULT false, -- true = upsell item with mockup
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_items TO service_role;
GRANT SELECT ON public.club_items TO anon;

CREATE TABLE IF NOT EXISTS club_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE, -- e.g. CLB-00001
  status TEXT DEFAULT 'pending',
  -- pending, confirmed, in_production, ready, delivered
  items JSONB NOT NULL, -- [{name, size, qty, price}]
  notes TEXT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  deposit_paid DECIMAL(10,2) DEFAULT 0,
  balance_owing DECIMAL(10,2) DEFAULT 0,
  invoice_url TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_orders TO service_role;
GRANT SELECT, INSERT ON public.club_orders TO anon;

CREATE INDEX IF NOT EXISTS idx_club_items_club_id ON club_items(club_id);
CREATE INDEX IF NOT EXISTS idx_club_orders_club_id ON club_orders(club_id);

-- This Supabase project enables RLS by default on newly created tables. Every other table
-- in this app (products, blog_posts, etc.) has RLS off and relies on the GRANTs above plus
-- server.ts's service-role routes for write safety - without this, PostgREST silently
-- returns 0 rows to anon SELECTs (no error) even though SELECT is granted, which is why the
-- portal landing page and Admin -> Clubs list would appear empty after the migration above.
-- User-confirmed: disabling RLS here to match the rest of the app's security model.
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE club_orders DISABLE ROW LEVEL SECURITY;
