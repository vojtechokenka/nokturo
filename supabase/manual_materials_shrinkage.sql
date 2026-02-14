-- Run this in Supabase Dashboard → SQL Editor
-- Adds shrinkage column to materials table (text, e.g. "3%", "3-5%", "low")
-- If column already exists as NUMERIC, run: ALTER COLUMN shrinkage TYPE TEXT USING shrinkage::TEXT;

ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS shrinkage TEXT;
