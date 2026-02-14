-- Create moodboard_comments and notifications tables + RLS (with dev bypass support)
-- Run this in Supabase SQL Editor. This creates the tables and sets up all policies.

-- Moodboard comments (with optional mentions/tags)
CREATE TABLE IF NOT EXISTS public.moodboard_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moodboard_item_id UUID NOT NULL REFERENCES public.moodboard_items(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.profiles(id),
  content         TEXT NOT NULL,
  tagged_user_ids UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications (when user is tagged in moodboard comment)
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'moodboard_tag' CHECK (type IN ('moodboard_tag', 'comment_reply')),
  title           TEXT NOT NULL,
  body            TEXT,
  link            TEXT,
  moodboard_item_id UUID REFERENCES public.moodboard_items(id) ON DELETE SET NULL,
  comment_id      UUID REFERENCES public.moodboard_comments(id) ON DELETE SET NULL,
  from_user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_moodboard_comments_item_id ON public.moodboard_comments(moodboard_item_id);

ALTER TABLE public.moodboard_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (in case of re-run)
DROP POLICY IF EXISTS "Authenticated users can read moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Authenticated users can insert moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Authenticated users can delete own moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Users can read moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Users can insert moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Users can delete own moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Users can update own moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- RLS policies (with dev bypass: auth.role() = 'anon')
CREATE POLICY "Users can read moodboard_comments"
  ON public.moodboard_comments FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert moodboard_comments"
  ON public.moodboard_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete own moodboard_comments"
  ON public.moodboard_comments FOR DELETE
  USING (auth.uid() = author_id OR auth.role() = 'anon');

CREATE POLICY "Users can update own moodboard_comments"
  ON public.moodboard_comments FOR UPDATE
  USING (auth.uid() = author_id OR auth.role() = 'anon');

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update own notifications (mark read)"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
