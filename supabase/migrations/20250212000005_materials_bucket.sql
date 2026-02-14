-- Create materials bucket for material images (fabric swatches, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials',
  'materials',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to materials bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to materials bucket" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to materials bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'materials');

-- Allow anon to upload (dev bypass with VITE_DEV_BYPASS_AUTH)
DROP POLICY IF EXISTS "Allow anon uploads to materials bucket" ON storage.objects;
CREATE POLICY "Allow anon uploads to materials bucket"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'materials');

-- Allow public read (bucket is public)
DROP POLICY IF EXISTS "Allow public read for materials bucket" ON storage.objects;
CREATE POLICY "Allow public read for materials bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'materials');

-- Allow authenticated users to delete from materials bucket
DROP POLICY IF EXISTS "Allow authenticated delete from materials" ON storage.objects;
CREATE POLICY "Allow authenticated delete from materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'materials');

-- Allow anon to delete (dev bypass)
DROP POLICY IF EXISTS "Allow anon delete from materials" ON storage.objects;
CREATE POLICY "Allow anon delete from materials"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'materials');
