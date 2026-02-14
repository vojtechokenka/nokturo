-- Add priority flag to products (only meaningful when ready_for_sampling is true)
-- Run in Supabase SQL Editor if migration wasn't applied
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS priority BOOLEAN NOT NULL DEFAULT false;
