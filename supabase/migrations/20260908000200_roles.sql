-- Migration: 002_roles
-- Description: Dynamic role and permission system.
--              Instead of a hardcoded ENUM, roles are rows in a table.
--              Restaurant admins can create custom roles and configure
--              exactly which permissions each role gets.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PERMISSION REGISTRY
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROLES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ROLE PERMISSIONS (many-to-many)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission  TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  UNIQUE(role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADD FK FROM branch_members → roles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.branch_members
  ADD CONSTRAINT fk_branch_members_role
  FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION — check permission for current user in a branch
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FUNCTION — create default roles for a new restaurant
-- ─────────────────────────────────────────────────────────────────────────────
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
  VALUES (p_restaurant_id, 'Chef', 'Kitchen staff — prepares orders', true)
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
  VALUES (p_restaurant_id, 'Manager', 'Branch manager — all except system settings', true)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
