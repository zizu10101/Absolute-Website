-- Add shipping method and cost columns to online_orders table
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS shipping_method TEXT DEFAULT 'pickup' CHECK (shipping_method IN ('pickup', 'ship'));
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;
