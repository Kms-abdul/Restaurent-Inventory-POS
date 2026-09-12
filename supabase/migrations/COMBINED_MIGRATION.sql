-- Migration: 000_reset_old_schema
-- Description: Drop ALL objects â€” both old single-restaurant schema and any
--              partially-created new multi-tenant tables.
--              Safe to run on a fresh/empty database or after a partial migration.

-- â”€â”€â”€ RPC Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP FUNCTION IF EXISTS public.create_pos_order         CASCADE;
DROP FUNCTION IF EXISTS public.create_pos_order_v2      CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_role             CASCADE;
DROP FUNCTION IF EXISTS public.allocate_invoice_number   CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin            CASCADE;
DROP FUNCTION IF EXISTS public.my_restaurant_ids         CASCADE;
DROP FUNCTION IF EXISTS public.my_branch_ids             CASCADE;
DROP FUNCTION IF EXISTS public.can_access_branch         CASCADE;
DROP FUNCTION IF EXISTS public.can_access_restaurant     CASCADE;
DROP FUNCTION IF EXISTS public.has_permission            CASCADE;
DROP FUNCTION IF EXISTS public.create_default_roles      CASCADE;
DROP FUNCTION IF EXISTS public.create_restaurant_with_admin CASCADE;
DROP FUNCTION IF EXISTS public.setup_branch_user         CASCADE;
DROP FUNCTION IF EXISTS public.next_order_no             CASCADE;
DROP FUNCTION IF EXISTS public.confirm_stock_count       CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user           CASCADE;

-- â”€â”€â”€ Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- â”€â”€â”€ Tables (leaf â†’ root order to satisfy FK constraints) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Printing
DROP TABLE IF EXISTS public.print_jobs     CASCADE;
DROP TABLE IF EXISTS public.printers       CASCADE;

-- QR Ordering
DROP TABLE IF EXISTS public.customer_sessions CASCADE;
DROP TABLE IF EXISTS public.qr_codes          CASCADE;

-- Payments & Orders
DROP TABLE IF EXISTS public.payments          CASCADE;
DROP TABLE IF EXISTS public.order_items       CASCADE;
DROP TABLE IF EXISTS public.orders            CASCADE;
DROP TABLE IF EXISTS public.branch_order_sequences CASCADE;

-- Inventory
DROP TABLE IF EXISTS public.stock_count_items  CASCADE;
DROP TABLE IF EXISTS public.stock_counts       CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.inventory_items    CASCADE;

-- Recipes
DROP TABLE IF EXISTS public.recipe_items  CASCADE;
DROP TABLE IF EXISTS public.recipes       CASCADE;

-- Menu
DROP TABLE IF EXISTS public.branch_menu_items CASCADE;
DROP TABLE IF EXISTS public.menu_items        CASCADE;
DROP TABLE IF EXISTS public.menu_categories   CASCADE;

-- Roles & Permissions
DROP TABLE IF EXISTS public.role_permissions  CASCADE;
DROP TABLE IF EXISTS public.roles             CASCADE;
DROP TABLE IF EXISTS public.permissions       CASCADE;

-- Membership
DROP TABLE IF EXISTS public.branch_members      CASCADE;
DROP TABLE IF EXISTS public.restaurant_members  CASCADE;
DROP TABLE IF EXISTS public.platform_members    CASCADE;

-- Core
DROP TABLE IF EXISTS public.profiles   CASCADE;
DROP TABLE IF EXISTS public.branches   CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;

-- Old tables
DROP TABLE IF EXISTS public.settings   CASCADE;

-- â”€â”€â”€ Sequences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP SEQUENCE IF EXISTS public.order_no_seq CASCADE;

-- â”€â”€â”€ Views â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP VIEW IF EXISTS public.inventory_current_stock CASCADE;

-- â”€â”€â”€ ENUMs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP TYPE IF EXISTS public.user_role            CASCADE;
DROP TYPE IF EXISTS public.order_status         CASCADE;
DROP TYPE IF EXISTS public.payment_mode         CASCADE;
DROP TYPE IF EXISTS public.fulfillment_status   CASCADE;
DROP TYPE IF EXISTS public.inventory_tx_type    CASCADE;
DROP TYPE IF EXISTS public.stock_count_status   CASCADE;
DROP TYPE IF EXISTS public.printer_type         CASCADE;
DROP TYPE IF EXISTS public.print_job_status     CASCADE;
DROP TYPE IF EXISTS public.order_source         CASCADE;
-- Migration: 001_tenancy
-- Description: Core multi-tenant foundation â€” restaurants, branches, profiles,
--              and membership tables. Every business record traces back here.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. RESTAURANTS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.restaurants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,             -- URL-friendly identifier
  logo_url     TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  city         TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. BRANCHES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.branches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,                  -- unique within a restaurant
  address        TEXT,
  city           TEXT,
  phone          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, slug)
);

CREATE INDEX idx_branches_restaurant_id ON public.branches(restaurant_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. PROFILES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Linked 1:1 with auth.users. Role is NOT stored here â€” it lives in membership
-- tables so one person can have different roles in different contexts.
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. PLATFORM MEMBERS (Super Admins)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.platform_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. RESTAURANT MEMBERS (Restaurant Admins)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.restaurant_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id)
);

CREATE INDEX idx_restaurant_members_user_id       ON public.restaurant_members(user_id);
CREATE INDEX idx_restaurant_members_restaurant_id ON public.restaurant_members(restaurant_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. BRANCH MEMBERS (Branch-level staff with a dynamic role)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- role_id references public.roles (defined in 002_roles.sql).
-- We keep the FK deferred so migrations can run in order without circular deps.
CREATE TABLE public.branch_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id     UUID,              -- FK added after roles table is created
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, user_id)
);

CREATE INDEX idx_branch_members_user_id   ON public.branch_members(user_id);
CREATE INDEX idx_branch_members_branch_id ON public.branch_members(branch_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. HELPER FUNCTIONS (SECURITY DEFINER â€” no RLS recursion)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Is the current user a Super Admin?
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_members
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- Get the restaurant_id(s) the current user is a restaurant_admin for.
CREATE OR REPLACE FUNCTION public.my_restaurant_ids()
RETURNS TABLE(restaurant_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rm.restaurant_id
  FROM restaurant_members rm
  WHERE rm.user_id = auth.uid() AND rm.is_active = true;
$$;

-- Get the branch_id(s) the current user is a branch member of.
CREATE OR REPLACE FUNCTION public.my_branch_ids()
RETURNS TABLE(branch_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT bm.branch_id
  FROM branch_members bm
  WHERE bm.user_id = auth.uid() AND bm.is_active = true;
$$;

-- Check if the current user can access a given branch
-- (restaurant_admin of that branch's restaurant, OR direct branch member)
CREATE OR REPLACE FUNCTION public.can_access_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM branch_members
    WHERE user_id = auth.uid() AND branch_id = p_branch_id AND is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM restaurant_members rm
    JOIN branches b ON b.restaurant_id = rm.restaurant_id
    WHERE rm.user_id = auth.uid() AND rm.is_active = true AND b.id = p_branch_id
  )
  OR public.is_super_admin();
$$;

-- Check if the current user can access a given restaurant
CREATE OR REPLACE FUNCTION public.can_access_restaurant(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_members
    WHERE user_id = auth.uid() AND restaurant_id = p_restaurant_id AND is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM branch_members bm
    JOIN branches b ON b.id = bm.branch_id
    WHERE bm.user_id = auth.uid() AND bm.is_active = true AND b.restaurant_id = p_restaurant_id
  )
  OR public.is_super_admin();
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 8. ENABLE RLS (policies added in 009_rls.sql)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_members    ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 9. AUTO-CREATE PROFILE ON SIGN-UP
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Migration: 002_roles
-- Description: Dynamic role and permission system.
--              Instead of a hardcoded ENUM, roles are rows in a table.
--              Restaurant admins can create custom roles and configure
--              exactly which permissions each role gets.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. PERMISSION REGISTRY
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- All possible permission keys in the system.
-- Referenced by role_permissions.permission.
CREATE TABLE public.permissions (
  key          TEXT PRIMARY KEY,
  category     TEXT NOT NULL,    -- 'pos' | 'menu' | 'inventory' | 'reports' | 'users' | 'kitchen' | 'settings'
  label        TEXT NOT NULL,
  description  TEXT
);

INSERT INTO public.permissions (key, category, label, description) VALUES
  -- POS
  ('pos.create_order',    'pos',       'Create Order',         'Place new orders at the POS terminal'),
  ('pos.void_order',      'pos',       'Void Order',           'Cancel/void an existing order'),
  ('pos.apply_discount',  'pos',       'Apply Discount',       'Apply discounts on orders'),
  -- Menu
  ('menu.view',           'menu',      'View Menu',            'View menu categories and items'),
  ('menu.manage',         'menu',      'Manage Menu',          'Create, edit and delete menu items and categories'),
  -- Inventory
  ('inventory.view',      'inventory', 'View Inventory',       'View current stock levels and transactions'),
  ('inventory.manage',    'inventory', 'Manage Inventory',     'Add stock, create ingredients and update items'),
  ('inventory.eod_count', 'inventory', 'EOD Count',           'Perform end-of-day physical stock count'),
  -- Recipes
  ('recipes.view',        'inventory', 'View Recipes',         'View ingredient recipes / bill of materials'),
  ('recipes.manage',      'inventory', 'Manage Recipes',       'Create and edit recipes for menu items'),
  -- Reports
  ('reports.view',        'reports',   'View Reports',         'View sales, inventory and shift reports'),
  ('reports.export',      'reports',   'Export Reports',       'Export reports to CSV/PDF'),
  -- Users
  ('users.view',          'users',     'View Users',           'View branch user list'),
  ('users.manage',        'users',     'Manage Users',         'Create, edit and deactivate users'),
  ('roles.manage',        'users',     'Manage Roles',         'Create and configure branch roles and permissions'),
  -- Kitchen
  ('kitchen.view',        'kitchen',   'View Kitchen Display', 'View kitchen order tickets'),
  ('kitchen.update',      'kitchen',   'Update Order Status',  'Mark orders as cooking / ready / served'),
  -- Settings
  ('settings.view',       'settings',  'View Settings',        'View branch and restaurant settings'),
  ('settings.manage',     'settings',  'Manage Settings',      'Edit branch and restaurant settings, printers');

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. ROLES TABLE
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  is_default     BOOLEAN NOT NULL DEFAULT false,   -- preset roles cannot be deleted
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, name)
);

CREATE INDEX idx_roles_restaurant_id ON public.roles(restaurant_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. ROLE PERMISSIONS (many-to-many)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  UNIQUE(role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. ADD FK FROM branch_members â†’ roles
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.branch_members
  ADD CONSTRAINT fk_branch_members_role
  FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. HELPER FUNCTION â€” check permission for current user in a branch
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.has_permission(p_branch_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Super admins have all permissions
  SELECT public.is_super_admin()
  OR
  -- Restaurant admins have all permissions within their restaurant's branches
  EXISTS (
    SELECT 1 FROM restaurant_members rm
    JOIN branches b ON b.restaurant_id = rm.restaurant_id
    WHERE rm.user_id = auth.uid() AND rm.is_active = true AND b.id = p_branch_id
  )
  OR
  -- Branch members need explicit role permission
  EXISTS (
    SELECT 1 FROM branch_members bm
    JOIN role_permissions rp ON rp.role_id = bm.role_id
    WHERE bm.user_id = auth.uid()
      AND bm.branch_id = p_branch_id
      AND bm.is_active = true
      AND rp.permission = p_permission
  );
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. FUNCTION â€” create default roles for a new restaurant
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.create_default_roles(p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cashier_id UUID;
  v_chef_id    UUID;
  v_maker_id   UUID;
  v_manager_id UUID;
BEGIN
  -- Cashier
  INSERT INTO public.roles (restaurant_id, name, description, is_default)
  VALUES (p_restaurant_id, 'Cashier', 'POS terminal operator', true)
  RETURNING id INTO v_cashier_id;

  INSERT INTO public.role_permissions (role_id, permission)
  VALUES
    (v_cashier_id, 'pos.create_order'),
    (v_cashier_id, 'pos.apply_discount'),
    (v_cashier_id, 'menu.view'),
    (v_cashier_id, 'reports.view');

  -- Chef
  INSERT INTO public.roles (restaurant_id, name, description, is_default)
  VALUES (p_restaurant_id, 'Chef', 'Kitchen staff â€” prepares orders', true)
  RETURNING id INTO v_chef_id;

  INSERT INTO public.role_permissions (role_id, permission)
  VALUES
    (v_chef_id, 'kitchen.view'),
    (v_chef_id, 'kitchen.update'),
    (v_chef_id, 'menu.view');

  -- Maker
  INSERT INTO public.roles (restaurant_id, name, description, is_default)
  VALUES (p_restaurant_id, 'Maker', 'Production staff', true)
  RETURNING id INTO v_maker_id;

  INSERT INTO public.role_permissions (role_id, permission)
  VALUES
    (v_maker_id, 'kitchen.view'),
    (v_maker_id, 'kitchen.update');

  -- Manager
  INSERT INTO public.roles (restaurant_id, name, description, is_default)
  VALUES (p_restaurant_id, 'Manager', 'Branch manager â€” all except system settings', true)
  RETURNING id INTO v_manager_id;

  INSERT INTO public.role_permissions (role_id, permission)
  VALUES
    (v_manager_id, 'pos.create_order'),
    (v_manager_id, 'pos.void_order'),
    (v_manager_id, 'pos.apply_discount'),
    (v_manager_id, 'menu.view'),
    (v_manager_id, 'inventory.view'),
    (v_manager_id, 'inventory.manage'),
    (v_manager_id, 'inventory.eod_count'),
    (v_manager_id, 'recipes.view'),
    (v_manager_id, 'recipes.manage'),
    (v_manager_id, 'reports.view'),
    (v_manager_id, 'reports.export'),
    (v_manager_id, 'users.view'),
    (v_manager_id, 'kitchen.view'),
    (v_manager_id, 'kitchen.update'),
    (v_manager_id, 'settings.view');
END;
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
-- Migration: 003_menu
-- Description: Menu categories and items, scoped per restaurant.
--              Categories are restaurant-wide; items can optionally be
--              limited to specific branches via branch_menu_items overrides.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. MENU CATEGORIES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.menu_categories (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  image_url      TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, name)
);

CREATE INDEX idx_menu_categories_restaurant_id ON public.menu_categories(restaurant_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. MENU ITEMS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.menu_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id    UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT,
  name           TEXT NOT NULL,
  description    TEXT,
  price          INTEGER NOT NULL CHECK (price >= 0),   -- stored in paise/lowest unit
  image_url      TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  is_available   BOOLEAN NOT NULL DEFAULT true,         -- temporarily out of stock
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, name)
);

CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id   ON public.menu_items(category_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. BRANCH MENU OVERRIDES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Allows a branch to hide specific items or override prices.
-- If no override row exists, the restaurant default applies.
CREATE TABLE public.branch_menu_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  price        INTEGER,            -- if NULL, use restaurant default
  is_available BOOLEAN,            -- if NULL, use restaurant default
  UNIQUE(branch_id, menu_item_id)
);

CREATE INDEX idx_branch_menu_items_branch_id ON public.branch_menu_items(branch_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.menu_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_menu_items ENABLE ROW LEVEL SECURITY;
-- Migration: 004_inventory
-- Description: Ledger-based inventory system.
--              Stock is NEVER stored as a field â€” it is always computed as
--              SUM(inventory_transactions.quantity) per item per branch.
--              This gives a full audit trail for every gram of stock.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. INVENTORY ITEMS (Ingredients / raw materials)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. TRANSACTION TYPE ENUM
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. INVENTORY TRANSACTIONS (The Ledger)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. CURRENT STOCK VIEW
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. EOD STOCK COUNTS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. FUNCTION â€” confirm EOD count and insert adjustment transactions
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items      ENABLE ROW LEVEL SECURITY;
-- Migration: 005_recipes
-- Description: Recipes / Bill of Materials (BOM).
--              Links menu items to the inventory ingredients they consume,
--              so the POS can automatically deduct stock on every sale.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. RECIPES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- One menu item may have one recipe. The recipe belongs to the restaurant.
CREATE TABLE public.recipes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id   UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name           TEXT,            -- optional display name (defaults to menu item name)
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(restaurant_id, menu_item_id)
);

CREATE INDEX idx_recipes_restaurant_id ON public.recipes(restaurant_id);
CREATE INDEX idx_recipes_menu_item_id  ON public.recipes(menu_item_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. RECIPE ITEMS (Ingredients per recipe)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.recipe_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity            NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit                TEXT NOT NULL,                -- unit of quantity (g, ml, pcs, etc.)
  notes               TEXT,
  UNIQUE(recipe_id, inventory_item_id)
);

CREATE INDEX idx_recipe_items_recipe_id          ON public.recipe_items(recipe_id);
CREATE INDEX idx_recipe_items_inventory_item_id  ON public.recipe_items(inventory_item_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.recipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items  ENABLE ROW LEVEL SECURITY;
-- Migration: 006_orders
-- Description: Orders, order items, and payments â€” all scoped by restaurant + branch.
--              order_no is allocated per-branch (not global) for clean invoice numbers.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. ENUMS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. PER-BRANCH ORDER NUMBER SEQUENCE
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. ORDERS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. ORDER ITEMS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- item_name_at_sale and unit_price_at_sale are snapshot values â€” they never
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. PAYMENTS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.branch_order_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
-- Migration: 007_qr_ordering
-- Description: QR code and customer session tables â€” provision for future
--              customer-facing ordering. Not yet wired to UI but schema is
--              in place so no migrations need to be rewritten later.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. QR CODES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. CUSTOMER SESSIONS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Anonymous customer sessions created when a QR is scanned.
-- No Supabase Auth user required â€” uses a short-lived token instead.
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.qr_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
-- Migration: 008_printing
-- Description: Printer registry and print job queue.
--              The local Windows Print Agent polls this table and executes
--              the actual print. Vercel cannot reach local USB printers directly.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. PRINTER TYPES
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. PRINTERS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. PRINT JOBS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. ENABLE RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.printers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
-- Migration: 009_rls
-- Description: Row Level Security policies for all tables.
--              Core principle: every row is gated by restaurant_id or branch_id,
--              verified through the SECURITY DEFINER helper functions
--              (is_super_admin, can_access_restaurant, can_access_branch)
--              to avoid RLS recursion.

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RESTAURANTS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Super Admin sees all. Restaurant members and branch members see their own.
CREATE POLICY "restaurants_select"
  ON public.restaurants FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(id)
  );

CREATE POLICY "restaurants_insert"
  ON public.restaurants FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "restaurants_update"
  ON public.restaurants FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.can_access_restaurant(id));

CREATE POLICY "restaurants_delete"
  ON public.restaurants FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- BRANCHES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "branches_select"
  ON public.branches FOR SELECT TO authenticated
  USING (public.can_access_branch(id));

CREATE POLICY "branches_insert"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "branches_update"
  ON public.branches FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "branches_delete"
  ON public.branches FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PROFILES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Users see their own profile. Restaurant admins see profiles of their restaurant users.
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_restaurant"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurant_members rm
      JOIN public.restaurant_members my_rm ON my_rm.restaurant_id = rm.restaurant_id
      WHERE rm.user_id = profiles.id
        AND my_rm.user_id = auth.uid()
        AND my_rm.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.branch_members bm
      JOIN public.branch_members my_bm ON my_bm.branch_id = bm.branch_id
      WHERE bm.user_id = profiles.id
        AND my_bm.user_id = auth.uid()
        AND my_bm.is_active = true
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PLATFORM MEMBERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "platform_members_select"
  ON public.platform_members FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

CREATE POLICY "platform_members_manage"
  ON public.platform_members FOR ALL TO authenticated
  USING (public.is_super_admin());

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RESTAURANT MEMBERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "restaurant_members_select"
  ON public.restaurant_members FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "restaurant_members_manage"
  ON public.restaurant_members FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- BRANCH MEMBERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "branch_members_select"
  ON public.branch_members FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.can_access_branch(branch_id)
  );

CREATE POLICY "branch_members_manage"
  ON public.branch_members FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_branch(branch_id)
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ROLES & PERMISSIONS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- permissions table is read-only for everyone (it's system data)
CREATE POLICY "permissions_select"
  ON public.permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "roles_select"
  ON public.roles FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

CREATE POLICY "roles_manage"
  ON public.roles FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "role_permissions_select"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND public.can_access_restaurant(r.restaurant_id)
    )
  );

CREATE POLICY "role_permissions_manage"
  ON public.role_permissions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND (public.is_super_admin() OR public.can_access_restaurant(r.restaurant_id))
    )
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- MENU
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "menu_categories_select"
  ON public.menu_categories FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

CREATE POLICY "menu_categories_manage"
  ON public.menu_categories FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "menu_items_select"
  ON public.menu_items FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

CREATE POLICY "menu_items_manage"
  ON public.menu_items FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "branch_menu_items_select"
  ON public.branch_menu_items FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "branch_menu_items_manage"
  ON public.branch_menu_items FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id));

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- INVENTORY
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "inventory_items_select"
  ON public.inventory_items FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

CREATE POLICY "inventory_items_manage"
  ON public.inventory_items FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "inventory_transactions_select"
  ON public.inventory_transactions FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "inventory_transactions_insert"
  ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(branch_id));

-- No UPDATE or DELETE â€” the ledger is append-only
CREATE POLICY "stock_counts_select"
  ON public.stock_counts FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "stock_counts_manage"
  ON public.stock_counts FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "stock_count_items_select"
  ON public.stock_count_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_counts sc
      WHERE sc.id = stock_count_items.stock_count_id
        AND public.can_access_branch(sc.branch_id)
    )
  );

CREATE POLICY "stock_count_items_manage"
  ON public.stock_count_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stock_counts sc
      WHERE sc.id = stock_count_items.stock_count_id
        AND public.can_access_branch(sc.branch_id)
    )
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RECIPES
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "recipes_select"
  ON public.recipes FOR SELECT TO authenticated
  USING (public.can_access_restaurant(restaurant_id));

CREATE POLICY "recipes_manage"
  ON public.recipes FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.can_access_restaurant(restaurant_id)
  );

CREATE POLICY "recipe_items_select"
  ON public.recipe_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_items.recipe_id
        AND public.can_access_restaurant(r.restaurant_id)
    )
  );

CREATE POLICY "recipe_items_manage"
  ON public.recipe_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes r
      WHERE r.id = recipe_items.recipe_id
        AND (public.is_super_admin() OR public.can_access_restaurant(r.restaurant_id))
    )
  );

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- ORDERS
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(branch_id));

CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id));

-- No DELETE â€” orders are financial records

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "payments_select"
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "payments_insert"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND public.can_access_branch(o.branch_id)
    )
  );

CREATE POLICY "branch_order_sequences_select"
  ON public.branch_order_sequences FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PRINTING
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "printers_select"
  ON public.printers FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "printers_manage"
  ON public.printers FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "print_jobs_select"
  ON public.print_jobs FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "print_jobs_insert"
  ON public.print_jobs FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(branch_id));

CREATE POLICY "print_jobs_update"
  ON public.print_jobs FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id));

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- QR ORDERING
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CREATE POLICY "qr_codes_select"
  ON public.qr_codes FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "qr_codes_manage"
  ON public.qr_codes FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id));

-- customer_sessions uses anon role for QR customers (future implementation)
CREATE POLICY "customer_sessions_insert"
  ON public.customer_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "customer_sessions_select"
  ON public.customer_sessions FOR SELECT TO anon, authenticated
  USING (true);
-- Migration: 010_rpc
-- Description: Transactional RPCs.
--              create_pos_order_v2: Atomic POS checkout that creates the order,
--              order items, payment record, and auto-deducts inventory via recipes
--              â€” all in a single database transaction. If anything fails, everything
--              rolls back.
--
--              create_restaurant_with_admin: Super Admin helper that creates a
--              restaurant, default roles, first branch, and grants restaurant_admin
--              membership to a given user â€” atomically.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. ATOMIC POS CHECKOUT (v2)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION public.create_pos_order_v2(
  p_client_ref        TEXT,
  p_branch_id         UUID,
  p_restaurant_id     UUID,
  p_table_number      TEXT,
  p_payment_mode      public.payment_mode,
  p_total_amount      INTEGER,
  p_discount_amount   INTEGER DEFAULT 0,
  p_terminal_id       TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_items             JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     UUID;
  v_order_no     BIGINT;
  v_cashier_id   UUID;
  v_item         JSONB;
  v_recipe       RECORD;
  v_recipe_item  RECORD;
  v_menu_item_id UUID;
  v_qty          INTEGER;
BEGIN
  v_cashier_id := auth.uid();

  -- â”€â”€ Idempotency: if this client_ref already exists, return existing order â”€â”€
  SELECT id INTO v_order_id FROM public.orders WHERE client_ref = p_client_ref;
  IF v_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true);
  END IF;

  -- â”€â”€ Allocate per-branch order number â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  v_order_no := public.next_order_no(p_branch_id);

  -- â”€â”€ Insert Order â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.orders (
    order_no, restaurant_id, branch_id, table_number,
    status, payment_mode, total_amount, discount_amount,
    cashier_id, terminal_id, client_ref, fulfillment,
    source, notes, settled_at
  ) VALUES (
    v_order_no,
    p_restaurant_id,
    p_branch_id,
    p_table_number,
    CASE WHEN p_payment_mode = 'none' THEN 'active'::public.order_status
         ELSE 'settled'::public.order_status END,
    p_payment_mode,
    p_total_amount,
    p_discount_amount,
    v_cashier_id,
    p_terminal_id,
    p_client_ref,
    'pending',
    'pos',
    p_notes,
    CASE WHEN p_payment_mode = 'none' THEN NULL ELSE NOW() END
  )
  RETURNING id INTO v_order_id;

  -- â”€â”€ Insert Order Items + Inventory Deduction per item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_qty          := (v_item->>'qty')::INTEGER;

    -- Insert order line
    INSERT INTO public.order_items (
      order_id, menu_item_id, item_name_at_sale,
      category_at_sale, unit_price_at_sale, qty, line_total, notes
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_item->>'item_name',
      v_item->>'category',
      (v_item->>'unit_price')::INTEGER,
      v_qty,
      (v_item->>'line_total')::INTEGER,
      v_item->>'notes'
    );

    -- Look up recipe for this menu item
    SELECT r.id INTO v_recipe
    FROM public.recipes r
    WHERE r.menu_item_id = v_menu_item_id
      AND r.restaurant_id = p_restaurant_id
      AND r.is_active = true
    LIMIT 1;

    -- If recipe exists, deduct ingredients from inventory
    IF FOUND THEN
      FOR v_recipe_item IN
        SELECT ri.inventory_item_id, ri.quantity, ri.unit
        FROM public.recipe_items ri
        WHERE ri.recipe_id = v_recipe.id
      LOOP
        INSERT INTO public.inventory_transactions (
          inventory_item_id, branch_id, transaction_type,
          quantity, unit, reference_id, notes, created_by
        ) VALUES (
          v_recipe_item.inventory_item_id,
          p_branch_id,
          'sale_consumption',
          -(v_recipe_item.quantity * v_qty),   -- negative = consumed
          v_recipe_item.unit,
          v_order_id,
          'Auto-deducted: order #' || v_order_no::TEXT,
          v_cashier_id
        );
      END LOOP;
    END IF;
  END LOOP;

  -- â”€â”€ Insert Payment Record â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  IF p_payment_mode <> 'none' THEN
    INSERT INTO public.payments (order_id, amount, payment_mode)
    VALUES (v_order_id, p_total_amount, p_payment_mode);
  END IF;

  RETURN jsonb_build_object(
    'order_id',   v_order_id,
    'order_no',   v_order_no,
    'idempotent', false
  );
END;
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. SUPER ADMIN: CREATE RESTAURANT
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Creates: restaurant + default roles + first branch + restaurant_admin membership
-- Called from the Super Admin "Create Restaurant" form.
CREATE OR REPLACE FUNCTION public.create_restaurant_with_admin(
  p_restaurant_name  TEXT,
  p_restaurant_slug  TEXT,
  p_admin_user_id    UUID,     -- must be an existing auth.users id
  p_branch_name      TEXT DEFAULT 'Main Branch',
  p_branch_city      TEXT DEFAULT NULL,
  p_branch_address   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id  UUID;
  v_branch_id      UUID;
BEGIN
  -- Only super admins can call this
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Create restaurant
  INSERT INTO public.restaurants (name, slug)
  VALUES (p_restaurant_name, p_restaurant_slug)
  RETURNING id INTO v_restaurant_id;

  -- Create default roles for this restaurant
  PERFORM public.create_default_roles(v_restaurant_id);

  -- Create first branch
  INSERT INTO public.branches (restaurant_id, name, slug, city, address)
  VALUES (
    v_restaurant_id,
    p_branch_name,
    lower(regexp_replace(p_branch_name, '[^a-zA-Z0-9]+', '-', 'g')),
    p_branch_city,
    p_branch_address
  )
  RETURNING id INTO v_branch_id;

  -- Grant restaurant_admin membership to the specified user
  INSERT INTO public.restaurant_members (restaurant_id, user_id)
  VALUES (v_restaurant_id, p_admin_user_id)
  ON CONFLICT DO NOTHING;

  -- Initialize branch order sequence
  INSERT INTO public.branch_order_sequences (branch_id) VALUES (v_branch_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'branch_id',     v_branch_id
  );
END;
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. RESTAURANT ADMIN: CREATE BRANCH USER
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Creates profile + branch_member in one call.
-- Auth user creation is handled by Next.js server action (supabase.auth.admin).
-- This RPC is called AFTER the auth user is created to set up the profile + membership.
CREATE OR REPLACE FUNCTION public.setup_branch_user(
  p_user_id    UUID,
  p_name       TEXT,
  p_branch_id  UUID,
  p_role_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert profile
  INSERT INTO public.profiles (id, name)
  VALUES (p_user_id, p_name)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- Add branch membership
  INSERT INTO public.branch_members (branch_id, user_id, role_id)
  VALUES (p_branch_id, p_user_id, p_role_id)
  ON CONFLICT (branch_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id, is_active = true;
END;
$$;
