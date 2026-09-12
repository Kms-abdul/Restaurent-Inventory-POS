-- Migration: rls_policies
-- Description: Define Row Level Security (RLS) policies for all tables based on user_role

-- Utility function to get the current user's role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- 1. PROFILES
-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Admins can view and manage all profiles
CREATE POLICY "Admins have full access to profiles" 
ON profiles FOR ALL 
TO authenticated 
USING (public.get_auth_role() = 'admin');

-- 2. SETTINGS
-- Everyone can read settings
CREATE POLICY "Anyone can read settings"
ON settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can modify settings"
ON settings FOR ALL
TO authenticated
USING (public.get_auth_role() = 'admin');

-- 3. MENU ITEMS
-- Everyone can read menu items
CREATE POLICY "Anyone can view menu items"
ON menu_items FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify menu items
CREATE POLICY "Admins can modify menu items"
ON menu_items FOR ALL
TO authenticated
USING (public.get_auth_role() = 'admin');

-- 4. ORDERS
-- Everyone can read orders (Cashiers need to see lists, Chefs need to see KOTs)
CREATE POLICY "Anyone can view orders"
ON orders FOR SELECT
TO authenticated
USING (true);

-- Cashiers and Admins can create orders
CREATE POLICY "Cashiers and Admins can insert orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (public.get_auth_role() IN ('cashier', 'admin'));

-- Cashiers, Chefs, and Admins can update orders (e.g., status changes, fulfillment)
CREATE POLICY "Staff can update orders"
ON orders FOR UPDATE
TO authenticated
USING (public.get_auth_role() IN ('cashier', 'chef', 'admin'));

-- No DELETE policy provided intentionally to prevent deleting orders

-- 5. ORDER ITEMS (Order Lines)
-- Everyone can read order lines
CREATE POLICY "Anyone can view order items"
ON order_items FOR SELECT
TO authenticated
USING (true);

-- Cashiers and Admins can insert order lines
CREATE POLICY "Cashiers and Admins can insert order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (public.get_auth_role() IN ('cashier', 'admin'));

-- No UPDATE or DELETE policy provided intentionally to ensure financial immutability
