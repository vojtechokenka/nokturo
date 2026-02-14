-- Labels library – run in Supabase SQL Editor if migration was not applied
-- Creates labels, label_types, label_placement_options, product_labels, labels bucket

-- 1. label_types (editable Typ options)
CREATE TABLE IF NOT EXISTS public.label_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. label_placement_options (editable Umístění options)
CREATE TABLE IF NOT EXISTS public.label_placement_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. labels table
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

-- 4. product_labels junction
CREATE TABLE IF NOT EXISTS public.product_labels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label_id      UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  placement     TEXT[] DEFAULT '{}',
  notes         TEXT,
  UNIQUE(product_id, label_id)
);

-- 5. labels bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('labels', 'labels', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 6. RLS (simplified – adjust as needed for your auth)
ALTER TABLE public.label_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_placement_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read label_types" ON public.label_types;
CREATE POLICY "Users can read label_types" ON public.label_types FOR SELECT USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can insert label_types" ON public.label_types;
CREATE POLICY "Users can insert label_types" ON public.label_types FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can update label_types" ON public.label_types;
CREATE POLICY "Users can update label_types" ON public.label_types FOR UPDATE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can delete label_types" ON public.label_types;
CREATE POLICY "Users can delete label_types" ON public.label_types FOR DELETE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can read label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can read label_placement_options" ON public.label_placement_options FOR SELECT USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can insert label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can insert label_placement_options" ON public.label_placement_options FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can update label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can update label_placement_options" ON public.label_placement_options FOR UPDATE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can delete label_placement_options" ON public.label_placement_options;
CREATE POLICY "Users can delete label_placement_options" ON public.label_placement_options FOR DELETE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can read labels" ON public.labels;
CREATE POLICY "Users can read labels" ON public.labels FOR SELECT USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can insert labels" ON public.labels;
CREATE POLICY "Users can insert labels" ON public.labels FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can update labels" ON public.labels;
CREATE POLICY "Users can update labels" ON public.labels FOR UPDATE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can delete labels" ON public.labels;
CREATE POLICY "Users can delete labels" ON public.labels FOR DELETE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can read product_labels" ON public.product_labels;
CREATE POLICY "Users can read product_labels" ON public.product_labels FOR SELECT USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can insert product_labels" ON public.product_labels;
CREATE POLICY "Users can insert product_labels" ON public.product_labels FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can update product_labels" ON public.product_labels;
CREATE POLICY "Users can update product_labels" ON public.product_labels FOR UPDATE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Users can delete product_labels" ON public.product_labels;
CREATE POLICY "Users can delete product_labels" ON public.product_labels FOR DELETE USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- 7. Seed placement options (důležité pro Select placement)
INSERT INTO public.label_placement_options (name, color, sort_order) VALUES
  ('neck', 'blue', 0),
  ('inside', 'green', 1),
  ('back', 'purple', 2),
  ('sleeve', 'pink', 3),
  ('other', 'gray', 4)
ON CONFLICT (name) DO NOTHING;

-- 8. Seed label types
INSERT INTO public.label_types (name, color, sort_order) VALUES
  ('care', 'blue', 0),
  ('size', 'green', 1),
  ('brand', 'purple', 2),
  ('other', 'gray', 3)
ON CONFLICT (name) DO NOTHING;

-- 9. updated_at trigger
CREATE TRIGGER trg_labels_updated_at BEFORE UPDATE ON public.labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
