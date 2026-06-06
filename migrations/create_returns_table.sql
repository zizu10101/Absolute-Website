-- Create returns table for tracking item returns
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  refund_method VARCHAR(20) NOT NULL CHECK (refund_method IN ('store_credit', 'original_payment')),
  refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT returns_positive_amounts CHECK (refund_amount >= 0)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS returns_transaction_id_idx ON returns(transaction_id);
CREATE INDEX IF NOT EXISTS returns_customer_id_idx ON returns(customer_id);
CREATE INDEX IF NOT EXISTS returns_created_at_idx ON returns(created_at DESC);
CREATE INDEX IF NOT EXISTS returns_status_idx ON returns(status);

-- Enable RLS (adjust policies as needed for your security requirements)
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role access" ON returns
  FOR ALL USING (true)
  WITH CHECK (true);
