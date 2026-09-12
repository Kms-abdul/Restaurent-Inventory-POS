export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Permission Keys ──────────────────────────────────────────────────────────
export type PermissionKey =
  | 'pos.create_order'
  | 'pos.void_order'
  | 'pos.apply_discount'
  | 'menu.view'
  | 'menu.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'inventory.eod_count'
  | 'recipes.view'
  | 'recipes.manage'
  | 'reports.view'
  | 'reports.export'
  | 'users.view'
  | 'users.manage'
  | 'roles.manage'
  | 'kitchen.view'
  | 'kitchen.update'
  | 'settings.view'
  | 'settings.manage'

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  restaurant_id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  name: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface RoleWithPermissions extends Role {
  role_permissions: { permission: PermissionKey }[]
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  is_available: boolean
  created_at: string
  updated_at: string
  menu_categories?: Pick<MenuCategory, 'id' | 'name'>
}

export interface InventoryItem {
  id: string
  restaurant_id: string
  name: string
  unit: string
  low_stock_threshold: number
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type InventoryTxType =
  | 'purchase'
  | 'opening'
  | 'sale_consumption'
  | 'adjustment'
  | 'wastage'
  | 'spoilage'
  | 'transfer_in'
  | 'transfer_out'

export interface InventoryTransaction {
  id: string
  inventory_item_id: string
  branch_id: string
  transaction_type: InventoryTxType
  quantity: number
  unit: string
  supplier: string | null
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface InventoryCurrentStock {
  inventory_item_id: string
  restaurant_id: string
  name: string
  unit: string
  low_stock_threshold: number
  branch_id: string | null
  current_qty: number
  is_low_stock: boolean
}

export interface Recipe {
  id: string
  restaurant_id: string
  menu_item_id: string
  name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RecipeItem {
  id: string
  recipe_id: string
  inventory_item_id: string
  quantity: number
  unit: string
  notes: string | null
  inventory_items?: Pick<InventoryItem, 'id' | 'name' | 'unit'>
}

export type OrderStatus = 'active' | 'settled' | 'voided'
export type PaymentMode = 'cash' | 'card' | 'upi' | 'split' | 'none'
export type FulfillmentStatus = 'pending' | 'cooking' | 'ready' | 'served'
export type OrderSource = 'pos' | 'qr' | 'app'

export interface Order {
  id: string
  order_no: number
  restaurant_id: string
  branch_id: string
  table_number: string | null
  status: OrderStatus
  payment_mode: PaymentMode
  total_amount: number
  discount_amount: number
  cashier_id: string | null
  terminal_id: string | null
  client_ref: string
  fulfillment: FulfillmentStatus
  source: OrderSource
  customer_name: string | null
  customer_phone: string | null
  notes: string | null
  created_at: string
  settled_at: string | null
  voided_at: string | null
  void_reason: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  item_name_at_sale: string
  category_at_sale: string
  unit_price_at_sale: number
  qty: number
  line_total: number
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  order_id: string
  amount: number
  payment_mode: PaymentMode
  reference: string | null
  created_at: string
}

// ─── Session / Auth Context ───────────────────────────────────────────────────

export interface UserContext {
  userId: string
  profile: Profile
  isSuperAdmin: boolean
  // Restaurant Admin context
  restaurantId: string | null
  restaurant: Restaurant | null
  // Branch Staff context
  branchId: string | null
  branch: Branch | null
  roleId: string | null
  permissions: Set<PermissionKey>
}

export type PortalType = 'super_admin' | 'restaurant_admin' | 'branch_staff' | 'none'

export function getPortalType(ctx: UserContext): PortalType {
  if (ctx.isSuperAdmin) return 'super_admin'
  if (ctx.restaurantId && !ctx.branchId) return 'restaurant_admin'
  if (ctx.branchId) return 'branch_staff'
  return 'none'
}

// ─── Cart (POS client-side) ───────────────────────────────────────────────────

export interface CartItem {
  menuItemId: string
  name: string
  category: string
  unitPrice: number
  qty: number
  lineTotal: number
  notes?: string
}
