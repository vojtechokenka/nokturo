-- RLS policies for components (missing – caused "new row violates row-level security policy")
-- Same pattern as suppliers, materials

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
