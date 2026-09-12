-- Drop the old policy
DROP POLICY IF EXISTS "Admins can modify menu items" ON menu_items;

-- Create a new policy that allows both admins and cashiers to modify menu items
-- In a small restaurant setting, cashiers often need to add items on the fly.
CREATE POLICY "Admins and Cashiers can modify menu items"
ON menu_items FOR ALL
TO authenticated
USING (public.get_auth_role() IN ('admin', 'cashier'))
WITH CHECK (public.get_auth_role() IN ('admin', 'cashier'));
