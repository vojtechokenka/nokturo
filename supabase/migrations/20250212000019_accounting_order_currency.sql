-- Add order_currency to accounting_orders (EUR, CZK, USD; default EUR)
ALTER TABLE public.accounting_orders
ADD COLUMN IF NOT EXISTS order_currency TEXT NOT NULL DEFAULT 'EUR'
  CHECK (order_currency IN ('EUR', 'CZK', 'USD'));
