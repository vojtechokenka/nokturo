-- Brand compliance content: rich text blocks
CREATE TABLE IF NOT EXISTS public.brand_compliance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content     JSONB NOT NULL DEFAULT '[]',
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read brand_compliance"
  ON public.brand_compliance FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert brand_compliance"
  ON public.brand_compliance FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update brand_compliance"
  ON public.brand_compliance FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete brand_compliance"
  ON public.brand_compliance FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE TRIGGER trg_brand_compliance_updated_at
  BEFORE UPDATE ON public.brand_compliance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
