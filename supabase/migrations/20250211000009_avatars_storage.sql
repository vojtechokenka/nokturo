-- Avatars in uploads bucket: UPDATE policy for overwrite/upsert
-- Path: avatars/{user_id}/avatar.{ext}
-- INSERT/DELETE already covered by generic uploads bucket policies
-- Upsert (overwrite) requires UPDATE permission

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
