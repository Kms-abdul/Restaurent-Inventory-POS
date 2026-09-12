-- Migration: 003_menu
-- Description: Menu categories and items, scoped per restaurant.
--              Categories are restaurant-wide; items can optionally be
--              limited to specific branches via branch_menu_items overrides.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MENU CATEGORIES
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. MENU ITEMS
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BRANCH MENU OVERRIDES
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.menu_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_menu_items ENABLE ROW LEVEL SECURITY;
