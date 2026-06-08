-- Add brand column to products table
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/[your-project]/sql

ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN products.brand IS 'Product brand/manufacturer (e.g., Nike, Adidas)';
