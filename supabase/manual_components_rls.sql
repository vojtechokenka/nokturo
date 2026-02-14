-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "new row violates row-level security policy for table components"
-- Adds RLS policies for components (same pattern as suppliers)

DROP POLICY IF EXISTS "Users can read components" ON public.components;
DROP POLICY IF EXISTS "Users can insert components" ON public.components;
DROP POLICY IF EXISTS "Users can update components" ON public.components;
DROP POLICY IF EXISTS "Users can delete components" ON public.components;

CREATE POLICY "Users can read components"
  ON public.components FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert components"
  ON public.components FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update components"
  ON public.components FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete components"
  ON public.components FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
