-- Run in the Supabase SQL editor before using /inventory-count.
--
-- One row per submitted count session. `adjustments` holds the full discrepancy list
-- that was applied, so a count can be audited later even after stock has moved on:
--   [{ variant_id, barcode, product_name, color, size, system_qty, counted_qty, diff }, ...]

CREATE TABLE IF NOT EXISTS inventory_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  count_date DATE NOT NULL,
  counted_by TEXT,
  total_variants_counted INTEGER,
  total_discrepancies INTEGER,
  adjustments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_counts_count_date ON inventory_counts(count_date);
