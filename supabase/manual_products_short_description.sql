-- Run this in Supabase Dashboard → SQL Editor if you get:
-- "Could not find the 'short_description' column of 'products' in the schema cache"
--
-- Adds the short_description column for the simple paragraph shown at top of product pages.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS short_description TEXT;
