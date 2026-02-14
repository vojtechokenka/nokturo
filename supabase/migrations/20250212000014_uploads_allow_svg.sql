-- Add SVG support to uploads bucket (for gallery, Rich Text, moodboard, etc.)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']::text[]
WHERE id = 'uploads';
