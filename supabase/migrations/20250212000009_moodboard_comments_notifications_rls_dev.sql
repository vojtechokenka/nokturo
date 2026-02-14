-- Allow anon for moodboard_comments and notifications (dev bypass with VITE_DEV_BYPASS_AUTH)
DROP POLICY IF EXISTS "Authenticated users can read moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Authenticated users can insert moodboard_comments" ON public.moodboard_comments;

CREATE POLICY "Users can read moodboard_comments"
  ON public.moodboard_comments FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert moodboard_comments"
  ON public.moodboard_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');
