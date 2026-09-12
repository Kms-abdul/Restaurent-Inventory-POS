-- Migration: initial_schema
-- Description: Core POS schema adapted from existing Excel data structure

-- ENUMs
CREATE TYPE user_role AS ENUM ('admin', 'cashier', 'chef', 'maker');
CREATE TYPE order_status AS ENUM ('active', 'settled', 'voided');
CREATE TYPE payment_mode AS ENUM ('cash', 'card', 'upi', 'none');
CREATE TYPE fulfillment_status AS ENUM ('pending', 'cooking', 'ready', 'served');

-- 1. PROFILES (Users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);  

-- 2. SETTINGS
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MENU ITEMS
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. INVOICE SEQUENCE
CREATE SEQUENCE order_no_seq START 1;

CREATE OR REPLACE FUNCTION allocate_invoice_number() 
RETURNS BIGINT AS $$
BEGIN
  RETURN nextval('order_no_seq');
END;
$$ LANGUAGE plpgsql;

-- 5. ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no BIGINT NOT NULL UNIQUE DEFAULT allocate_invoice_number(),
  table_number TEXT,
  status order_status NOT NULL DEFAULT 'active',
  payment_mode payment_mode NOT NULL DEFAULT 'none',
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  cashier_id UUID REFERENCES profiles(id),
  terminal_id TEXT,
  client_ref TEXT UNIQUE NOT NULL, -- Idempotency Key
  fulfillment fulfillment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT
);

-- 6. ORDER ITEMS (Order Lines)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id), -- Intentionally omitting ON DELETE CASCADE for financial records
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  item_name_at_sale TEXT NOT NULL,
  category_at_sale TEXT NOT NULL,
  unit_price_at_sale INTEGER NOT NULL CHECK (unit_price_at_sale >= 0),
  qty INTEGER NOT NULL CHECK (qty > 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INDEXES FOR PERFORMANCE
CREATE INDEX idx_orders_client_ref ON orders(client_ref);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- 8. ENABLE ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be added in a subsequent migration to properly handle authorization.
