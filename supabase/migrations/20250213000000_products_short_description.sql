-- Add short_description for the simple paragraph shown at top of product pages
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description TEXT;
