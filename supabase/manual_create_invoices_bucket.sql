-- Run this in Supabase Dashboard → SQL Editor if you get "Bucket not found" when uploading PDF invoices
-- Creates the invoices bucket for accounting order PDFs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop first in case they exist from partial migration)
DROP POLICY IF EXISTS "Allow authenticated uploads to invoices bucket" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to invoices bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Allow public read for invoices bucket" ON storage.objects;
CREATE POLICY "Allow public read for invoices bucket"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS "Allow authenticated delete from invoices" ON storage.objects;
CREATE POLICY "Allow authenticated delete from invoices"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoices');
