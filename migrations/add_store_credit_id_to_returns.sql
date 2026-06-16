-- Add store_credit_id column to returns table to link created store credits
ALTER TABLE returns
ADD COLUMN IF NOT EXISTS store_credit_id UUID REFERENCES store_credits(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS returns_store_credit_id_idx ON returns(store_credit_id);
