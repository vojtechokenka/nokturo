-- Change default currency from CZK to EUR for materials and components
ALTER TABLE public.materials
  ALTER COLUMN currency SET DEFAULT 'EUR';

ALTER TABLE public.components
  ALTER COLUMN currency SET DEFAULT 'EUR';
