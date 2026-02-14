-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "new row violates row-level security policy" when adding materials
-- Run this if migrations weren't applied or you still get RLS errors

-- 1. MATERIALS BUCKET (storage for images)
-- ───────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Allow authenticated uploads to materials bucket" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to materials bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'materials');

DROP POLICY IF EXISTS "Allow anon uploads to materials bucket" ON storage.objects;
CREATE POLICY "Allow anon uploads to materials bucket"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'materials');

DROP POLICY IF EXISTS "Allow public read for materials bucket" ON storage.objects;
CREATE POLICY "Allow public read for materials bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Allow authenticated delete from materials" ON storage.objects;
CREATE POLICY "Allow authenticated delete from materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Allow anon delete from materials" ON storage.objects;
CREATE POLICY "Allow anon delete from materials"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'materials');

-- 2. MATERIALS TABLE RLS (insert/update/delete)
-- ───────────────────────────────────────────────────────────────
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
