-- Add user_id column to online_orders table for Phase 5 Customer Accounts
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_online_orders_user_id ON online_orders(user_id);
