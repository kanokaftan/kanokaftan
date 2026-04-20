-- Add sizes and colors array columns to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS colors TEXT[] DEFAULT '{}';
