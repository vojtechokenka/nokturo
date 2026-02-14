-- RLS policies for brand_strategy (required for Strategy page editor)
-- Allows both authenticated users AND anon (dev bypass with VITE_DEV_BYPASS_AUTH)
CREATE POLICY "Users can read brand_strategy"
  ON public.brand_strategy FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert brand_strategy"
  ON public.brand_strategy FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update brand_strategy"
  ON public.brand_strategy FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete brand_strategy"
  ON public.brand_strategy FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
