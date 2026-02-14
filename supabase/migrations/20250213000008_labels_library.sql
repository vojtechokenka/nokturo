-- Labels library: labels table, label_types, label_placement_options, product_labels
-- Similar to components + product_components, with editable Typ and Umístění (placement)

-- Editable options for label "Typ" (type)
CREATE TABLE IF NOT EXISTS public.label_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Editable options for "Umístění" (placement) - multi-select when linking label to product
CREATE TABLE IF NOT EXISTS public.label_placement_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Labels table
CREATE TABLE IF NOT EXISTS public.labels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  typ           TEXT NOT NULL,
  height_mm      NUMERIC(10,2),
  width_mm       NUMERIC(10,2),
  design_url     TEXT,
  material_id    UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: products <-> labels (with placement multi-select)
CREATE TABLE IF NOT EXISTS public.product_labels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label_id      UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  placement     TEXT[] DEFAULT '{}',
  notes         TEXT,
  UNIQUE(product_id, label_id)
);

-- Labels bucket for design images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'labels',
  'labels',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for labels bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to labels bucket" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to labels bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'labels');

DROP POLICY IF EXISTS "Allow public read for labels bucket" ON storage.objects;
CREATE POLICY "Allow public read for labels bucket"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'labels');

DROP POLICY IF EXISTS "Allow authenticated delete from labels" ON storage.objects;
CREATE POLICY "Allow authenticated delete from labels"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'labels');

-- RLS for label_types
ALTER TABLE public.label_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read label_types" ON public.label_types;
CREATE POLICY "Users can read label_types"
  ON public.label_types FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert label_types" ON public.label_types;
CREATE POLICY "Users can insert label_types"
  ON public.label_types FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update label_types" ON public.label_types;
CREATE POLICY "Users can update label_types"
  ON public.label_types FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete label_types" ON public.label_types;
CREATE POLICY "Users can delete label_types"
  ON public.label_types FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- RLS for label_placement_options
ALTER TABLE public.label_placement_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can read label_placement_options"
  ON public.label_placement_options FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can insert label_placement_options"
  ON public.label_placement_options FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can update label_placement_options"
  ON public.label_placement_options FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can delete label_placement_options"
  ON public.label_placement_options FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- RLS for labels
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read labels" ON public.labels;
CREATE POLICY "Users can read labels"
  ON public.labels FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert labels" ON public.labels;
CREATE POLICY "Users can insert labels"
  ON public.labels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update labels" ON public.labels;
CREATE POLICY "Users can update labels"
  ON public.labels FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete labels" ON public.labels;
CREATE POLICY "Users can delete labels"
  ON public.labels FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- RLS for product_labels
ALTER TABLE public.product_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read product_labels" ON public.product_labels;
CREATE POLICY "Users can read product_labels"
  ON public.product_labels FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert product_labels" ON public.product_labels;
CREATE POLICY "Users can insert product_labels"
  ON public.product_labels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update product_labels" ON public.product_labels;
CREATE POLICY "Users can update product_labels"
  ON public.product_labels FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete product_labels" ON public.product_labels;
CREATE POLICY "Users can delete product_labels"
  ON public.product_labels FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- Updated_at trigger for labels
CREATE TRIGGER trg_labels_updated_at BEFORE UPDATE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default label types
INSERT INTO public.label_types (name, color, sort_order) VALUES
  ('care', 'blue', 0),
  ('size', 'green', 1),
  ('brand', 'purple', 2),
  ('other', 'gray', 3)
ON CONFLICT (name) DO NOTHING;

-- Seed default placement options (umístění na produktu)
INSERT INTO public.label_placement_options (name, color, sort_order) VALUES
  ('neck', 'blue', 0),
  ('inside', 'green', 1),
  ('back', 'purple', 2),
  ('sleeve', 'pink', 3),
  ('other', 'gray', 4)
ON CONFLICT (name) DO NOTHING;
