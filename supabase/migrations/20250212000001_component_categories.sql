-- Component categories (Notion-style, like supplier_categories)
CREATE TABLE public.component_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.component_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read component_categories"
  ON public.component_categories FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert component_categories"
  ON public.component_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update component_categories"
  ON public.component_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete component_categories"
  ON public.component_categories FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- Drop CHECK constraint on components.type to allow user-defined categories
ALTER TABLE public.components
  DROP CONSTRAINT IF EXISTS components_type_check;

-- Seed default categories (Zip, Knoflík, Kování, ...)
INSERT INTO public.component_categories (name, color, sort_order) VALUES
  ('zipper', 'blue', 0),
  ('button', 'purple', 1),
  ('hardware', 'orange', 2),
  ('label', 'green', 3),
  ('thread', 'pink', 4),
  ('other', 'gray', 5)
ON CONFLICT (name) DO NOTHING;
