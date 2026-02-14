-- Run this in Supabase Dashboard → SQL Editor
-- Creates moodboard_categories table (if not exists)

-- Moodboard categories (Notion-style)
CREATE TABLE IF NOT EXISTS public.moodboard_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moodboard_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read moodboard_categories" ON public.moodboard_categories;
DROP POLICY IF EXISTS "Authenticated users can read moodboard_categories" ON public.moodboard_categories;
CREATE POLICY "Users can read moodboard_categories"
  ON public.moodboard_categories FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert moodboard_categories" ON public.moodboard_categories;
DROP POLICY IF EXISTS "Authenticated users can insert moodboard_categories" ON public.moodboard_categories;
CREATE POLICY "Users can insert moodboard_categories"
  ON public.moodboard_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update moodboard_categories" ON public.moodboard_categories;
DROP POLICY IF EXISTS "Authenticated users can update moodboard_categories" ON public.moodboard_categories;
CREATE POLICY "Users can update moodboard_categories"
  ON public.moodboard_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete moodboard_categories" ON public.moodboard_categories;
DROP POLICY IF EXISTS "Authenticated users can delete moodboard_categories" ON public.moodboard_categories;
CREATE POLICY "Users can delete moodboard_categories"
  ON public.moodboard_categories FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
