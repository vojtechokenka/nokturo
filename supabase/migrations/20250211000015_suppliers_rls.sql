-- RLS policies for suppliers (missing – caused "new row violates row-level security policy")
-- Allows both authenticated users AND anon (dev bypass with VITE_DEV_BYPASS_AUTH)

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
