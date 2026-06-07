-- Add card_number column to store_credits table for barcode scanning
ALTER TABLE store_credits ADD COLUMN IF NOT EXISTS card_number TEXT UNIQUE;

-- Create index on card_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_store_credits_card_number ON store_credits(card_number);

-- Create index on customer_id and is_active for quick lookups during checkout
CREATE INDEX IF NOT EXISTS idx_store_credits_customer_active ON store_credits(customer_id, is_active);

COMMENT ON COLUMN store_credits.card_number IS 'Unique barcode in format SC-XXXXXXXXXXXX for scanning at checkout';
