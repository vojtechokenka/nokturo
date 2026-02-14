-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "new row violates row-level security policy for table suppliers"
-- Adds RLS policies for suppliers (same pattern as ideas, brand_strategy)

DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers" ON public.suppliers;

CREATE POLICY "Users can read suppliers"
  ON public.suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update suppliers"
  ON public.suppliers FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete suppliers"
  ON public.suppliers FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
