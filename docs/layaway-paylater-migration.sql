-- Run in Supabase SQL editor before using the Layaway / Pay Later POS features.

CREATE TABLE IF NOT EXISTS layaways (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2),
  deposit_paid DECIMAL(10,2),
  balance_due DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layaways_customer_id ON layaways(customer_id);
CREATE INDEX IF NOT EXISTS idx_layaways_status ON layaways(status);

CREATE TABLE IF NOT EXISTS pay_later (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2),
  status TEXT DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_later_customer_id ON pay_later(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_later_status ON pay_later(status);
