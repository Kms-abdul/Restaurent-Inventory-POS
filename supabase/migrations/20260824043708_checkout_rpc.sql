-- Migration: checkout_rpc
-- Description: Transactional RPC for POS order creation with idempotency

CREATE OR REPLACE FUNCTION create_pos_order(
  p_client_ref TEXT,
  p_table_number TEXT,
  p_payment_mode payment_mode,
  p_total_amount INTEGER,
  p_terminal_id TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_cashier_id UUID;
  v_item JSONB;
BEGIN
  -- 1. Identify Cashier
  v_cashier_id := auth.uid();
  
  -- 2. Insert Order (Transaction starts)
  -- 'order_no' is automatically allocated via the default sequence function
  INSERT INTO orders (
    client_ref,
    table_number,
    payment_mode,
    total_amount,
    terminal_id,
    cashier_id,
    status,
    fulfillment
  ) VALUES (
    p_client_ref,
    p_table_number,
    p_payment_mode,
    p_total_amount,
    p_terminal_id,
    v_cashier_id,
    CASE WHEN p_payment_mode = 'none' THEN 'active'::order_status ELSE 'settled'::order_status END,
    'pending'
  )
  ON CONFLICT (client_ref) DO NOTHING
  RETURNING id INTO v_order_id;
  
  -- 3. Idempotency Check
  -- If v_order_id is NULL, an order with this client_ref already exists (e.g., double-tap or network retry).
  -- We just return the existing ID and skip creating duplicate lines.
  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id FROM orders WHERE client_ref = p_client_ref;
    RETURN v_order_id;
  END IF;

  -- 4. Insert Order Lines
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      menu_item_id,
      item_name_at_sale,
      category_at_sale,
      unit_price_at_sale,
      qty,
      line_total
    ) VALUES (
      v_order_id,
      (v_item->>'menu_item_id')::UUID,
      v_item->>'item_name',
      v_item->>'category',
      (v_item->>'unit_price')::INTEGER,
      (v_item->>'qty')::INTEGER,
      (v_item->>'line_total')::INTEGER
    );
  END LOOP;
  
  -- 5. Transaction Commits implicitly when function returns
  RETURN v_order_id;
END;
$$;
