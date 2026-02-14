-- Add ready_for_sampling flag to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ready_for_sampling BOOLEAN NOT NULL DEFAULT false;
