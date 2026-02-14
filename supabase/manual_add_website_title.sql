-- Run in Supabase Dashboard → SQL Editor
-- Add website_title for SEO/display name (e.g. "YKK Czech výrobce textilních spojovacích prvků")
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS website_title TEXT;
