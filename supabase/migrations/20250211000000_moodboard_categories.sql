-- Moodboard categories: user-defined options (Notion-style Select)
CREATE TABLE public.moodboard_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moodboard_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read moodboard_categories"
  ON public.moodboard_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert moodboard_categories"
  ON public.moodboard_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update moodboard_categories"
  ON public.moodboard_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete moodboard_categories"
  ON public.moodboard_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Seed default categories (matching previous hardcoded values)
INSERT INTO public.moodboard_categories (name, color, sort_order) VALUES
  ('fabric', 'orange', 0),
  ('mood', 'blue', 1),
  ('construction', 'green', 2),
  ('color', 'purple', 3),
  ('detail', 'pink', 4),
  ('other', 'gray', 5)
ON CONFLICT (name) DO NOTHING;
