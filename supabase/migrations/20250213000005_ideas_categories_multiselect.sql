-- Ideas categories: change from single category to multiselect (TEXT[])
-- 1. Add new column
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- 2. Migrate existing category data (only if category column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ideas' AND column_name = 'category'
  ) THEN
    UPDATE public.ideas SET categories = ARRAY[category] WHERE category IS NOT NULL AND category != '';
    ALTER TABLE public.ideas DROP COLUMN category;
  END IF;
END $$;
