-- Run this in Supabase Dashboard → SQL Editor
-- Adds RLS policies for brand_strategy (required for Strategy page rich text editor)
-- Fixes: "new row violates row-level security policy for table brand_strategy"
-- Allows both authenticated users AND anon (dev bypass with VITE_DEV_BYPASS_AUTH)

DROP POLICY IF EXISTS "Authenticated users can read brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can read brand_strategy" ON public.brand_strategy;
CREATE POLICY "Users can read brand_strategy"
  ON public.brand_strategy FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can insert brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can insert brand_strategy" ON public.brand_strategy;
CREATE POLICY "Users can insert brand_strategy"
  ON public.brand_strategy FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can update brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can update brand_strategy" ON public.brand_strategy;
CREATE POLICY "Users can update brand_strategy"
  ON public.brand_strategy FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can delete brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can delete brand_strategy" ON public.brand_strategy;
CREATE POLICY "Users can delete brand_strategy"
  ON public.brand_strategy FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
