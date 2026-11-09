-- Due: bill settled now, customer pays later.
-- Swiggy/Zomato: delivery-platform order, settled at the counter like a checkout.
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'due';
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'swiggy_zomato';
