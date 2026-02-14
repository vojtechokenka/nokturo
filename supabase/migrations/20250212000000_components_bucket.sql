-- Create components bucket for component images (zippers, buttons, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'components',
  'components',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to components bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to components bucket" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to components bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'components');

-- Allow public read (bucket is public)
DROP POLICY IF EXISTS "Allow public read for components bucket" ON storage.objects;
CREATE POLICY "Allow public read for components bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'components');

-- Allow authenticated users to delete from components bucket
DROP POLICY IF EXISTS "Allow authenticated delete from components" ON storage.objects;
CREATE POLICY "Allow authenticated delete from components"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'components');
