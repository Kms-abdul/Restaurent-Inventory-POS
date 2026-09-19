-- Migration: 008_printing
-- Description: Printer registry and print job queue.
--              The local Windows Print Agent polls this table and executes
--              the actual print. Vercel cannot reach local USB printers directly.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PRINTER TYPES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.printer_type AS ENUM (
  'receipt',     -- customer receipt printer
  'kitchen',     -- kitchen order ticket printer
  'label'        -- label printer (future)
);

CREATE TYPE public.print_job_status AS ENUM (
  'pending',     -- waiting for print agent to pick up
  'printing',    -- agent is printing
  'done',        -- successfully printed
  'failed'       -- print agent reported an error
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PRINTERS
-- ─────────────────────────────────────────────────────────────────────────────
-- Registered by the Print Agent when it detects installed Windows printers.
-- Restaurant Admin selects which printer handles which job type.
CREATE TABLE public.printers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  windows_name    TEXT NOT NULL,        -- exact Windows printer name (e.g. "POS-80")
  label           TEXT NOT NULL,        -- display name (e.g. "Receipt Printer")
  printer_type    public.printer_type NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_seen_at    TIMESTAMPTZ,          -- updated by print agent heartbeat
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, windows_name, printer_type)
);

CREATE INDEX idx_printers_branch_id ON public.printers(branch_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRINT JOBS
-- ─────────────────────────────────────────────────────────────────────────────
-- Created by the Next.js server action after a POS checkout.
-- The local Print Agent polls this table every 2 seconds.
CREATE TABLE public.print_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  printer_id      UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  printer_type    public.printer_type NOT NULL,
  order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL,       -- pre-formatted receipt/KOT data
  status          public.print_job_status NOT NULL DEFAULT 'pending',
  copies          INTEGER NOT NULL DEFAULT 1,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_print_jobs_branch_pending ON public.print_jobs(branch_id, status)
  WHERE status = 'pending';
CREATE INDEX idx_print_jobs_order_id ON public.print_jobs(order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.printers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
