-- ============================================================
-- REBUILD notifications table from scratch
-- Fixes: duplicates, clear-all not working, read state persistence
-- ============================================================

-- 1. Drop old table and all its policies/indexes
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 2. Create clean notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient (who receives the notification)
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sender (who triggered it; NULL for system notifications)
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Notification type
  type TEXT NOT NULL CHECK (type IN (
    'mention', 'comment', 'task_assigned', 'project_update'
  )),

  -- Content
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,

  -- Generic reference to any entity
  reference_type TEXT,   -- 'moodboard', 'gallery', 'text', 'product', 'comment'
  reference_id   UUID,

  -- Extra metadata as JSON
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Status
  read      BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at    TIMESTAMPTZ
);

-- 3. Indexes for performance
CREATE INDEX idx_notifications_recipient
  ON public.notifications(recipient_id);

CREATE INDEX idx_notifications_unread
  ON public.notifications(recipient_id, read)
  WHERE read = false AND dismissed = false;

CREATE INDEX idx_notifications_created
  ON public.notifications(created_at DESC);

CREATE INDEX idx_notifications_dedup
  ON public.notifications(recipient_id, link, dismissed)
  WHERE dismissed = false;

-- 4. Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- Users can update their own notifications (mark read, dismiss)
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_id);

-- Users can delete their own notifications
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = recipient_id);

-- Any authenticated user can create notifications (for mentions, etc.)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
