-- Migration: 009_rls
-- Description: Row Level Security policies for all tables.
--              Core principle: every row is gated by restaurant_id or branch_id,
--              verified through the SECURITY DEFINER helper functions
--              (is_super_admin, can_access_restaurant, can_access_branch)
--              to avoid RLS recursion.

-- ═════════════════════════════════════════════════════════════════════════════
-- RESTAURANTS
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- BRANCHES
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- PROFILES
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- PLATFORM MEMBERS
-- ═════════════════════════════════════════════════════════════════════════════
CREATE POLICY "platform_members_select"
  ON public.platform_members FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

CREATE POLICY "platform_members_manage"
  ON public.platform_members FOR ALL TO authenticated
  USING (public.is_super_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- RESTAURANT MEMBERS
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- BRANCH MEMBERS
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- ROLES & PERMISSIONS
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- MENU
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- INVENTORY
-- ═════════════════════════════════════════════════════════════════════════════
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

-- No UPDATE or DELETE — the ledger is append-only
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

-- ═════════════════════════════════════════════════════════════════════════════
-- RECIPES
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- ORDERS
-- ═════════════════════════════════════════════════════════════════════════════
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));

CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(branch_id));

CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id));

-- No DELETE — orders are financial records

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

-- ═════════════════════════════════════════════════════════════════════════════
-- PRINTING
-- ═════════════════════════════════════════════════════════════════════════════
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

-- ═════════════════════════════════════════════════════════════════════════════
-- QR ORDERING
-- ═════════════════════════════════════════════════════════════════════════════
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
