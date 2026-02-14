-- Run this in Supabase Dashboard → SQL Editor
-- Creates the "uploads" bucket needed for moodboard/ideas image uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
DROP POLICY IF EXISTS "Allow authenticated uploads to uploads bucket" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to uploads bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Allow public read (bucket is public)
DROP POLICY IF EXISTS "Allow public read for uploads bucket" ON storage.objects;
CREATE POLICY "Allow public read for uploads bucket"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'uploads');

-- Allow authenticated users to delete
DROP POLICY IF EXISTS "Allow authenticated delete from uploads" ON storage.objects;
CREATE POLICY "Allow authenticated delete from uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'uploads');
