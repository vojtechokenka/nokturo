-- Add position column for drag-and-drop ordering of ideas
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows: order by created_at desc (newest first), assign positions 0, 1, 2...
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS pos
  FROM public.ideas
)
UPDATE public.ideas AS i
SET position = n.pos
FROM numbered n
WHERE i.id = n.id;

CREATE INDEX IF NOT EXISTS idx_ideas_position ON public.ideas (position);
