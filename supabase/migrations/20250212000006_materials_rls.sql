-- RLS policies for materials (missing – caused "new row violates row-level security policy")
-- Same pattern as suppliers, components

DROP POLICY IF EXISTS "Users can read materials" ON public.materials;
DROP POLICY IF EXISTS "Users can insert materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update materials" ON public.materials;
DROP POLICY IF EXISTS "Users can delete materials" ON public.materials;

CREATE POLICY "Users can read materials"
  ON public.materials FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert materials"
  ON public.materials FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update materials"
  ON public.materials FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete materials"
  ON public.materials FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
