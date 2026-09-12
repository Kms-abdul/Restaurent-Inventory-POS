-- Migration: 004_inventory
-- Description: Ledger-based inventory system.
--              Stock is NEVER stored as a field — it is always computed as
--              SUM(inventory_transactions.quantity) per item per branch.
--              This gives a full audit trail for every gram of stock.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INVENTORY ITEMS (Ingredients / raw materials)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.inventory_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  unit                 TEXT NOT NULL DEFAULT 'kg',   -- kg, g, ml, l, pcs, etc.
  low_stock_threshold  NUMERIC(10,3) NOT NULL DEFAULT 0,
  description          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, name)
);

CREATE INDEX idx_inventory_items_restaurant_id ON public.inventory_items(restaurant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TRANSACTION TYPE ENUM
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.inventory_tx_type AS ENUM (
  'purchase',         -- stock bought from supplier (+)
  'opening',          -- opening stock entry (+)
  'sale_consumption', -- auto-deducted when a POS order is placed (-)
  'adjustment',       -- EOD count adjustment (+ or -)
  'wastage',          -- deliberate waste write-off (-)
  'spoilage',         -- spoilage/expiry (-)
  'transfer_in',      -- received from another branch (+)
  'transfer_out'      -- sent to another branch (-)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INVENTORY TRANSACTIONS (The Ledger)
-- ─────────────────────────────────────────────────────────────────────────────
-- quantity: positive = stock IN, negative = stock OUT
-- The current stock level is always: SELECT SUM(quantity) ... WHERE item + branch
CREATE TABLE public.inventory_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  branch_id           UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  transaction_type    public.inventory_tx_type NOT NULL,
  quantity            NUMERIC(10,3) NOT NULL,         -- signed (positive or negative)
  unit                TEXT NOT NULL,                   -- unit at time of transaction
  supplier            TEXT,                            -- for purchase type
  reference_id        UUID,                            -- e.g., order_id for sale_consumption
  notes               TEXT,
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_tx_item_branch  ON public.inventory_transactions(inventory_item_id, branch_id);
CREATE INDEX idx_inv_tx_branch       ON public.inventory_transactions(branch_id);
CREATE INDEX idx_inv_tx_created_at   ON public.inventory_transactions(created_at);
CREATE INDEX idx_inv_tx_reference_id ON public.inventory_transactions(reference_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CURRENT STOCK VIEW
-- ─────────────────────────────────────────────────────────────────────────────
CREATE VIEW public.inventory_current_stock AS
SELECT
  it.id                 AS inventory_item_id,
  it.restaurant_id,
  it.name,
  it.unit,
  it.low_stock_threshold,
  tx.branch_id,
  COALESCE(SUM(tx.quantity), 0) AS current_qty,
  CASE
    WHEN COALESCE(SUM(tx.quantity), 0) <= it.low_stock_threshold THEN true
    ELSE false
  END AS is_low_stock
FROM public.inventory_items it
LEFT JOIN public.inventory_transactions tx ON tx.inventory_item_id = it.id
GROUP BY it.id, it.restaurant_id, it.name, it.unit, it.low_stock_threshold, tx.branch_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. EOD STOCK COUNTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.stock_count_status AS ENUM ('draft', 'confirmed');

CREATE TABLE public.stock_counts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  counted_by  UUID REFERENCES public.profiles(id),
  status      public.stock_count_status NOT NULL DEFAULT 'draft',
  notes       TEXT,
  counted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_stock_counts_branch_id ON public.stock_counts(branch_id);

CREATE TABLE public.stock_count_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id      UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  expected_qty        NUMERIC(10,3) NOT NULL,     -- computed from ledger at count time
  actual_qty          NUMERIC(10,3) NOT NULL,     -- physically counted
  variance_qty        NUMERIC(10,3) GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  adjustment_reason   TEXT,                        -- 'wastage' | 'spoilage' | 'counting_error' | 'other'
  notes               TEXT,
  UNIQUE(stock_count_id, inventory_item_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNCTION — confirm EOD count and insert adjustment transactions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_stock_count(p_stock_count_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count     RECORD;
  v_item      RECORD;
  v_tx_type   public.inventory_tx_type;
BEGIN
  SELECT * INTO v_count FROM public.stock_counts WHERE id = p_stock_count_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock count not found'; END IF;
  IF v_count.status = 'confirmed' THEN RAISE EXCEPTION 'Already confirmed'; END IF;

  FOR v_item IN
    SELECT * FROM public.stock_count_items WHERE stock_count_id = p_stock_count_id
  LOOP
    -- Only insert adjustment if there is a variance
    IF v_item.variance_qty <> 0 THEN
      -- Choose tx type based on reason
      v_tx_type := 'adjustment';
      IF v_item.adjustment_reason = 'wastage' THEN v_tx_type := 'wastage'; END IF;
      IF v_item.adjustment_reason = 'spoilage' THEN v_tx_type := 'spoilage'; END IF;

      INSERT INTO public.inventory_transactions (
        inventory_item_id, branch_id, transaction_type,
        quantity, unit, reference_id, notes, created_by
      )
      SELECT
        v_item.inventory_item_id,
        v_count.branch_id,
        v_tx_type,
        v_item.variance_qty,                 -- negative if short, positive if surplus
        ii.unit,
        p_stock_count_id,
        COALESCE(v_item.notes, v_item.adjustment_reason),
        v_count.counted_by
      FROM public.inventory_items ii WHERE ii.id = v_item.inventory_item_id;
    END IF;
  END LOOP;

  UPDATE public.stock_counts
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = p_stock_count_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items      ENABLE ROW LEVEL SECURITY;
