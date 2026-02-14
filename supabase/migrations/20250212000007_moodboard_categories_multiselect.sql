-- Moodboard categories: change from single category to multiselect (TEXT[])
-- 1. Add new column
ALTER TABLE public.moodboard_items
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- 2. Migrate existing category data (only if category column exists)
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
