-- Migration: 005_recipes
-- Description: Recipes / Bill of Materials (BOM).
--              Links menu items to the inventory ingredients they consume,
--              so the POS can automatically deduct stock on every sale.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RECIPES
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECIPE ITEMS (Ingredients per recipe)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.recipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items  ENABLE ROW LEVEL SECURITY;
