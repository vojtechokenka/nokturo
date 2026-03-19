-- Add hidden flag to products for draft/published separation
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
