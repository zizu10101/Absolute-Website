-- Run in Supabase SQL editor before using the Reports -> Cash Report tab.
--
-- Note: pos_cash/pos_debit/pos_visa/pos_mc/pos_amex/pos_cheque hold the amounts for the
-- POS's actual payment method names (Cash, Debit, Visa, Mastercard, Amex - "Cheque" is not
-- a real POS payment method today, the column just stays $0 unless one is added later).
-- pos_other + pos_breakdown catch any other method (Gift Card, Store Credit, etc.) so no
-- sales data is silently dropped from the saved record even though it doesn't have its own
-- fixed column.

CREATE TABLE IF NOT EXISTS cash_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  opening_counts JSONB,
  closing_counts JSONB,
  opening_total DECIMAL(10,2),
  closing_total DECIMAL(10,2),
  pos_cash DECIMAL(10,2),
  pos_debit DECIMAL(10,2),
  pos_visa DECIMAL(10,2),
  pos_mc DECIMAL(10,2),
  pos_amex DECIMAL(10,2),
  pos_cheque DECIMAL(10,2),
  pos_other DECIMAL(10,2),
  pos_total DECIMAL(10,2),
  pos_breakdown JSONB,
  actual_cash DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  over_short DECIMAL(10,2),
  deposit DECIMAL(10,2),
  other DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_reports_report_date ON cash_reports(report_date);

-- Safe to re-run: if you already created cash_reports before the "Other" field was added,
-- this picks up the new column without needing to drop/recreate the table.
ALTER TABLE cash_reports ADD COLUMN IF NOT EXISTS other DECIMAL(10,2) DEFAULT 0;
