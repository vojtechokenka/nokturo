-- Track when a user last read comments on a moodboard item
CREATE TABLE IF NOT EXISTS moodboard_comment_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moodboard_item_id UUID NOT NULL REFERENCES moodboard_items(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, moodboard_item_id)
);

-- RLS
ALTER TABLE moodboard_comment_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own read status"
ON moodboard_comment_reads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own read status"
ON moodboard_comment_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own read status"
ON moodboard_comment_reads FOR UPDATE
USING (user_id = auth.uid());
