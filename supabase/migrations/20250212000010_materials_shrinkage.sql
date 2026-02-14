-- Add shrinkage column to materials (text, e.g. "3%", "3-5%", "low")
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS shrinkage TEXT;
