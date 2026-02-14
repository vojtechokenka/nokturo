-- Add supplier reference to accounting orders (links to suppliers from Dodavatelé)
ALTER TABLE public.accounting_orders
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
