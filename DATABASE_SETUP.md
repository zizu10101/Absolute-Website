# Database Setup for Phase 2 - Online Orders

## Create online_orders Table

Run this SQL in Supabase SQL Editor:

```sql
-- Create online_orders table for storing online customer orders
CREATE TABLE IF NOT EXISTS public.online_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_first_name VARCHAR(255) NOT NULL,
  customer_last_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  shipping_address VARCHAR(500) NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(50) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  notes TEXT,
  items JSONB NOT NULL, -- Array of {productId, name, price, image, quantity, size?}
  subtotal NUMERIC(10, 2) NOT NULL,
  tax NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies (disabled for now since app uses anon key)
-- ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
```

## Steps to Create Table:

1. Go to https://supabase.com and login to your project
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Paste the SQL above
5. Click "Run"
6. The table will be created successfully

## Admin Dashboard Access

Once the table is created:
- The admin panel will automatically detect it
- A new "Online Orders" tab will appear
- Admins can view, filter, and manage orders
