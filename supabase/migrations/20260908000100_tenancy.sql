-- Migration: 001_tenancy
-- Description: Core multi-tenant foundation — restaurants, branches, profiles,
--              and membership tables. Every business record traces back here.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RESTAURANTS
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BRANCHES
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
-- Linked 1:1 with auth.users. Role is NOT stored here — it lives in membership
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PLATFORM MEMBERS (Super Admins)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.platform_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RESTAURANT MEMBERS (Restaurant Admins)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BRANCH MEMBERS (Branch-level staff with a dynamic role)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTIONS (SECURITY DEFINER — no RLS recursion)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ENABLE RLS (policies added in 009_rls.sql)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_members    ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AUTO-CREATE PROFILE ON SIGN-UP
-- ─────────────────────────────────────────────────────────────────────────────
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
