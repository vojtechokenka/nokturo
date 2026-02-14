-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "Could not find the 'categories' column of 'moodboard_items' in the schema cache"
-- Run this if migration 20250212000007 wasn't applied

-- 1. Add categories column (TEXT[] for multiselect)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.moodboard_items
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- 2. Migrate existing category data (only if category column exists)
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'moodboard_items' AND column_name = 'category'
  ) THEN
    UPDATE public.moodboard_items SET categories = ARRAY[category] WHERE category IS NOT NULL AND category != '';
    ALTER TABLE public.moodboard_items DROP COLUMN category;
  END IF;
END $$;
