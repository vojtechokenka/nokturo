-- Add UPDATE policy for moodboard_comments (edit own comments)
-- Run this if you already have the tables and need to enable comment editing.
-- Also fixes DELETE for anon/dev mode.

DROP POLICY IF EXISTS "Users can delete own moodboard_comments" ON public.moodboard_comments;
CREATE POLICY "Users can delete own moodboard_comments"
  ON public.moodboard_comments FOR DELETE
  USING (auth.uid() = author_id OR auth.role() = 'anon');

CREATE POLICY "Users can update own moodboard_comments"
  ON public.moodboard_comments FOR UPDATE
  USING (auth.uid() = author_id OR auth.role() = 'anon');
