-- Add nationality (country of origin) to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS nationality TEXT;
