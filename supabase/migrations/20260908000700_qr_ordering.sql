-- Migration: 007_qr_ordering
-- Description: QR code and customer session tables — provision for future
--              customer-facing ordering. Not yet wired to UI but schema is
--              in place so no migrations need to be rewritten later.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. QR CODES
-- ─────────────────────────────────────────────────────────────────────────────
-- One QR code per table (or per zone/counter).
-- Scanning the QR takes the customer to:
--   /{restaurant_slug}/{branch_slug}?table={table_ref}
CREATE TABLE public.qr_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_ref      TEXT NOT NULL,          -- e.g., "T1", "Counter", "Delivery"
  label          TEXT,                   -- display label e.g. "Table 1"
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, table_ref)
);

CREATE INDEX idx_qr_codes_branch_id ON public.qr_codes(branch_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CUSTOMER SESSIONS
-- ─────────────────────────────────────────────────────────────────────────────
-- Anonymous customer sessions created when a QR is scanned.
-- No Supabase Auth user required — uses a short-lived token instead.
CREATE TABLE public.customer_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id     UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  branch_id      UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_ref      TEXT NOT NULL,
  customer_name  TEXT,
  customer_phone TEXT,
  token          TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_sessions_token ON public.customer_sessions(token);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.qr_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
