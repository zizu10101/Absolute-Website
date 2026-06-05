-- Cash Change Calculator Feature - Database Migration
-- This adds support for tracking cash tendered and change given for cash payments

-- Add columns to transactions table for cash tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tendered_amount NUMERIC(10, 2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS change_given NUMERIC(10, 2);

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('tendered_amount', 'change_given')
ORDER BY column_name;

-- The result should show:
-- column_name    | data_type
-- change_given   | numeric
-- tendered_amount | numeric
