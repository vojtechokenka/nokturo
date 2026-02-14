-- Run this in Supabase Dashboard → SQL Editor
-- Creates idea_categories table and adds category column to ideas

-- Idea categories (Notion-style)
CREATE TABLE IF NOT EXISTS public.idea_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.idea_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read idea_categories" ON public.idea_categories;
CREATE POLICY "Users can read idea_categories"
  ON public.idea_categories FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert idea_categories" ON public.idea_categories;
CREATE POLICY "Users can insert idea_categories"
  ON public.idea_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update idea_categories" ON public.idea_categories;
CREATE POLICY "Users can update idea_categories"
  ON public.idea_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete idea_categories" ON public.idea_categories;
CREATE POLICY "Users can delete idea_categories"
  ON public.idea_categories FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- Add category column to ideas
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS category TEXT;
