-- Fix: "new row violates row-level security policy" when uploading avatar
-- Add explicit INSERT policy for avatars path (avatars/{user_id}/...)
-- The generic uploads policy may not cover all cases; this ensures avatar uploads work

DROP POLICY IF EXISTS "Users can insert own avatar" ON storage.objects;
CREATE POLICY "Users can insert own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
