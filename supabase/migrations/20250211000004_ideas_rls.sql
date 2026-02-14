-- RLS policies for ideas (missing – caused "new row violates row-level security policy")
-- Allows both authenticated users AND anon (dev bypass with VITE_DEV_BYPASS_AUTH)
DROP POLICY IF EXISTS "Authenticated users can read ideas" ON public.ideas;
DROP POLICY IF EXISTS "Authenticated users can insert ideas" ON public.ideas;
DROP POLICY IF EXISTS "Authenticated users can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Authenticated users can delete ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can read ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can insert ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can delete ideas" ON public.ideas;

CREATE POLICY "Users can read ideas"
  ON public.ideas FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert ideas"
  ON public.ideas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update ideas"
  ON public.ideas FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete ideas"
  ON public.ideas FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
