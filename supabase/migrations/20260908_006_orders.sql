-- Migration: 006_orders
-- Description: Orders, order items, and payments — all scoped by restaurant + branch.
--              order_no is allocated per-branch (not global) for clean invoice numbers.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.order_status AS ENUM (
  'active',     -- open tab (pay later)
  'settled',    -- paid
  'voided'      -- cancelled
);

CREATE TYPE public.payment_mode AS ENUM (
  'cash',
  'card',
  'upi',
  'split',      -- multiple payment methods
  'none'        -- unpaid / tab
);

CREATE TYPE public.fulfillment_status AS ENUM (
  'pending',
  'cooking',
  'ready',
  'served'
);

CREATE TYPE public.order_source AS ENUM (
  'pos',        -- cashier placed order at terminal
  'qr',         -- customer placed order via QR scan
  'app'         -- future mobile app
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PER-BRANCH ORDER NUMBER SEQUENCE
-- ─────────────────────────────────────────────────────────────────────────────
-- Each branch gets its own incrementing invoice number, reset-able per day.
CREATE TABLE public.branch_order_sequences (
  branch_id    UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  last_no      BIGINT NOT NULL DEFAULT 0,
  reset_date   DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE OR REPLACE FUNCTION public.next_order_no(p_branch_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_no BIGINT;
BEGIN
  INSERT INTO public.branch_order_sequences (branch_id, last_no, reset_date)
  VALUES (p_branch_id, 1, CURRENT_DATE)
  ON CONFLICT (branch_id) DO UPDATE
    SET last_no    = CASE
                       WHEN branch_order_sequences.reset_date < CURRENT_DATE THEN 1
                       ELSE branch_order_sequences.last_no + 1
                     END,
        reset_date = CURRENT_DATE
  RETURNING last_no INTO v_no;
  RETURN v_no;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ORDERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no          BIGINT NOT NULL,                  -- per-branch daily invoice number
  restaurant_id     UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  branch_id         UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  table_number      TEXT,
  status            public.order_status NOT NULL DEFAULT 'active',
  payment_mode      public.payment_mode NOT NULL DEFAULT 'none',
  total_amount      INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),  -- paise
  discount_amount   INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  cashier_id        UUID REFERENCES public.profiles(id),
  terminal_id       TEXT,
  client_ref        TEXT UNIQUE NOT NULL,              -- idempotency key from client
  fulfillment       public.fulfillment_status NOT NULL DEFAULT 'pending',
  source            public.order_source NOT NULL DEFAULT 'pos',
  customer_name     TEXT,                              -- for QR / app orders
  customer_phone    TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at        TIMESTAMPTZ,
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT
);

CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_branch_id     ON public.orders(branch_id);
CREATE INDEX idx_orders_client_ref    ON public.orders(client_ref);
CREATE INDEX idx_orders_created_at    ON public.orders(created_at);
CREATE INDEX idx_orders_status        ON public.orders(status);
CREATE INDEX idx_orders_fulfillment   ON public.orders(fulfillment);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ORDER ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
-- item_name_at_sale and unit_price_at_sale are snapshot values — they never
-- change even if the menu item is later edited/deleted.
CREATE TABLE public.order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.orders(id),
  menu_item_id        UUID REFERENCES public.menu_items(id),
  item_name_at_sale   TEXT NOT NULL,
  category_at_sale    TEXT NOT NULL,
  unit_price_at_sale  INTEGER NOT NULL CHECK (unit_price_at_sale >= 0),
  qty                 INTEGER NOT NULL CHECK (qty > 0),
  line_total          INTEGER NOT NULL CHECK (line_total >= 0),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
-- Supports split payments (multiple rows per order).
CREATE TABLE public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id),
  amount        INTEGER NOT NULL CHECK (amount > 0),
  payment_mode  public.payment_mode NOT NULL,
  reference     TEXT,     -- UPI ref, card last 4, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON public.payments(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.branch_order_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
