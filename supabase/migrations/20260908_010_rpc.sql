-- Migration: 010_rpc
-- Description: Transactional RPCs.
--              create_pos_order_v2: Atomic POS checkout that creates the order,
--              order items, payment record, and auto-deducts inventory via recipes
--              — all in a single database transaction. If anything fails, everything
--              rolls back.
--
--              create_restaurant_with_admin: Super Admin helper that creates a
--              restaurant, default roles, first branch, and grants restaurant_admin
--              membership to a given user — atomically.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ATOMIC POS CHECKOUT (v2)
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- ── Idempotency: if this client_ref already exists, return existing order ──
  SELECT id INTO v_order_id FROM public.orders WHERE client_ref = p_client_ref;
  IF v_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true);
  END IF;

  -- ── Allocate per-branch order number ──────────────────────────────────────
  v_order_no := public.next_order_no(p_branch_id);

  -- ── Insert Order ──────────────────────────────────────────────────────────
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

  -- ── Insert Order Items + Inventory Deduction per item ────────────────────
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

  -- ── Insert Payment Record ─────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SUPER ADMIN: CREATE RESTAURANT
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RESTAURANT ADMIN: CREATE BRANCH USER
-- ─────────────────────────────────────────────────────────────────────────────
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
