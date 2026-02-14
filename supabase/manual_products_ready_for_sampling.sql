-- Add ready_for_sampling flag to products (run in Supabase SQL Editor if migration wasn't applied)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ready_for_sampling BOOLEAN NOT NULL DEFAULT false;
