-- SQL Migration: Create product_variants table with Age Tiers
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL CHECK (age_group IN ('Toddler', 'Youth', 'Adult')),
  size TEXT NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Create policy for public readout
CREATE POLICY "Allow public read access to product_variants" 
  ON public.product_variants FOR SELECT 
  TO public 
  USING (true);

-- Create policy for full access by service role / authenticated roles (Admins)
CREATE POLICY "Allow admin full access to product_variants" 
  ON public.product_variants ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);
