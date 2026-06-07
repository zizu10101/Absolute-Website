-- Generate SC card numbers for existing store credits without card_number
-- Run this in Supabase SQL Editor

UPDATE store_credits
SET card_number = 'SC-' || SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 12)
WHERE card_number IS NULL;

-- Verify the update
SELECT id, card_number, remaining_balance, customers(first_name, last_name)
FROM store_credits
ORDER BY created_at DESC
LIMIT 10;
