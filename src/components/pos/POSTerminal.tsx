'use client'

import { useState, useCallback, useTransition, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CartItem } from '@/types/database'
import { createPOSOrder, listOrders, updateFulfillmentStatus, voidOrder } from '@/app/actions/orders'

interface Category {
  id: string
  name: string
  sort_order: number
}

interface MenuItemData {
  id: string
  name: string
  price: number
  category_id: string
  image_url: string | null
  is_available: boolean
}

interface Branch {
  id: string
  name: string
}

interface POSOrderItem {
  id?: string
  menu_item_id?: string
  item_name_at_sale?: string | null
  item_name?: string | null
  category_at_sale?: string | null
  category?: string | null
  unit_price_at_sale?: number | null
  unit_price?: number | null
  qty?: number | null
  line_total?: number | null
}

interface RecentOrder {
  id: string
  order_no: number
  created_at: string
  total_amount?: number | null
  discount_amount?: number | null
  payment_mode?: string | null
  notes?: string | null
  status?: string | null
  fulfillment?: string | null
  order_items?: POSOrderItem[] | null
  profiles?: { name?: string | null } | null
}

interface Props {
  branchId: string
  restaurantId: string
  cashierName: string
  roleName: string
  branchName: string
  restaurantName: string
  branches: Branch[]
  categories: Category[]
  menuItems: MenuItemData[]
  canVoid: boolean
  canDiscount: boolean
  isAdmin: boolean
}

type PaymentMode = 'cash' | 'card' | 'upi'
type ActiveTab = 'order' | 'menu' | 'kot' | 'kds' | 'reports' | 'staff' | 'printer'

const POS_TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'order', label: 'Order', icon: '📋' },
  { id: 'menu', label: 'Menu', icon: '🍴' },
  { id: 'kot', label: 'KOT', icon: '🖨️' },
  { id: 'kds', label: 'Kitchen KDS', icon: '👨‍🍳' },
  { id: 'reports', label: 'Reports', icon: '📊' },
  { id: 'staff', label: 'Staff', icon: '👥' },
  { id: 'printer', label: 'Printer', icon: '⚙️' },
]

const DISCOUNT_PRESETS = [10, 20, 50]
const DISCOUNT_REASONS = ['Relative / Owner', 'VIP Guest', 'Staff Meal', 'Promo']

export default function POSTerminal({
  branchId,
  restaurantId,
  cashierName,
  roleName,
  branchName,
  restaurantName,
  branches,
  categories,
  menuItems,
  canVoid,
  canDiscount,
  isAdmin,
}: Props) {
  const router = useRouter()

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<ActiveTab>('order')

  // Order Screen state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [isPending, startTransition] = useTransition()
  const [nextOrderNo, setNextOrderNo] = useState(1)
  const [lastOrder, setLastOrder] = useState<{
    order_no: number
    invoice?: string
    subtotal?: number
    discount?: number
    discount_reason?: string
    total: number
    items: CartItem[]
    time: string
    payment_mode: string
    notes?: string
  } | null>(null)

  // Orders list for KDS, KOT, and Reports
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [reportsDate, setReportsDate] = useState(new Date().toISOString().split('T')[0])
  const [autoPrintKOT, setAutoPrintKOT] = useState(true)

  // Tracks which individual order action is in-flight (for per-button loading states)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  // Discount & Special Order State
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountReason, setDiscountReason] = useState<string>('')
  const [showCustomDiscount, setShowCustomDiscount] = useState<boolean>(false)
  const [orderNotes, setOrderNotes] = useState<string>('')

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach(category => map.set(category.id, category))
    return map
  }, [categories])

  const categoryItemCounts = useMemo(() => {
    const counts = new Map<string, number>()
    menuItems.forEach(item => {
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1)
    })
    return counts
  }, [menuItems])

  const selectedCategoryName = selectedCategory
    ? categoryById.get(selectedCategory)?.name ?? 'Category'
    : 'Category'

  // Load recent orders on mount and after submission
  const loadOrders = useCallback(async () => {
    try {
      const orders = (await listOrders(branchId, { limit: 50 })) as RecentOrder[]
      setRecentOrders(orders || [])
      if (orders && orders.length > 0) {
        const highestNo = Math.max(...orders.map(o => o.order_no || 0))
        setNextOrderNo(highestNo + 1)
        const latest = orders[0]
        setLastOrder(prev => prev ?? {
            order_no: latest.order_no,
            invoice: `INV-${new Date(latest.created_at).toISOString().slice(0, 10).replace(/-/g, '')}-${String(latest.order_no).padStart(4, '0')}`,
            subtotal: ((latest.total_amount || 0) + (latest.discount_amount || 0)) / 100,
            discount: (latest.discount_amount || 0) / 100,
            discount_reason: latest.notes || '',
            total: (latest.total_amount || 0) / 100,
            items: (latest.order_items || []).map(oi => ({
              menuItemId: oi.menu_item_id ?? '',
              name: oi.item_name_at_sale || oi.item_name || 'Item',
              category: oi.category_at_sale || oi.category || '',
              unitPrice: oi.unit_price_at_sale ?? oi.unit_price ?? 0,
              qty: oi.qty ?? 1,
              lineTotal: oi.line_total ?? 0,
            })),
            time: new Date(latest.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            payment_mode: latest.payment_mode || 'cash',
            notes: latest.notes || '',
          })
      }
    } catch (e) {
      console.error('Failed to load orders:', e)
    }
  }, [branchId])

  useEffect(() => {
    queueMicrotask(() => {
      void loadOrders()
    })
  }, [loadOrders])

  // Branch Switcher Handler
  const handleBranchChange = (newBranchId: string) => {
    router.push(`/staff/pos?branch=${newBranchId}&restaurant=${restaurantId}`)
  }

  // Cart operations
  const addToCart = useCallback((item: MenuItemData) => {
    if (!item.is_available) return
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      if (existing) {
        return prev.map(c =>
          c.menuItemId === item.id
            ? { ...c, qty: c.qty + 1, lineTotal: (c.qty + 1) * c.unitPrice }
            : c
        )
      }
      const cat = categoryById.get(item.category_id)
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          category: cat?.name ?? '',
          unitPrice: item.price,
          qty: 1,
          lineTotal: item.price,
        },
      ]
    })
  }, [categoryById])

  const updateQty = useCallback((menuItemId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(c =>
          c.menuItemId === menuItemId
            ? { ...c, qty: c.qty + delta, lineTotal: (c.qty + delta) * c.unitPrice }
            : c
        )
        .filter(c => c.qty > 0)
    )
  }, [])

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart(prev => prev.filter(c => c.menuItemId !== menuItemId))
  }, [])

  const clearDiscount = () => {
    setDiscountType('percent')
    setDiscountValue(0)
    setDiscountReason('')
    setShowCustomDiscount(false)
  }

  const clearCart = () => {
    setCart([])
    clearDiscount()
    setOrderNotes('')
  }

  const subtotalPaise = useMemo(
    () => cart.reduce((sum, item) => sum + item.lineTotal, 0),
    [cart]
  )
  const subtotalRupees = subtotalPaise / 100

  const discountPaise = useMemo(() => {
    if (discountType === 'percent') {
      const clampedPercent = Math.min(100, Math.max(0, discountValue))
      return Math.round(subtotalPaise * (clampedPercent / 100))
    }

    const fixedPaise = Math.round(Math.max(0, discountValue) * 100)
    return Math.min(subtotalPaise, fixedPaise)
  }, [discountType, discountValue, subtotalPaise])

  const discountRupees = discountPaise / 100
  const finalTotalPaise = Math.max(0, subtotalPaise - discountPaise)
  const finalTotalRupees = finalTotalPaise / 100

  const isRelativeOrFree = (discountType === 'percent' && discountValue === 100) || (subtotalPaise > 0 && finalTotalPaise === 0)

  // Toggle Relative / Free (100% discount)
  const toggleRelativeOrder = () => {
    if (isRelativeOrFree) {
      clearDiscount()
    } else {
      setDiscountType('percent')
      setDiscountValue(100)
      setDiscountReason('Relative of Restaurant (Free)')
    }
  }

  const applyPercentPreset = (pct: number) => {
    if (discountType === 'percent' && discountValue === pct) {
      clearDiscount()
    } else {
      setDiscountType('percent')
      setDiscountValue(pct)
      if (pct === 100) {
        setDiscountReason('100% Complimentary')
      } else if (!discountReason || discountReason.includes('%')) {
        setDiscountReason(`${pct}% Off`)
      }
    }
  }

  // Checkout submission
  const handleCompleteBilling = () => {
    if (cart.length === 0) return

    startTransition(async () => {
      try {
        const orderTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const invoiceStr = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(nextOrderNo).padStart(4, '0')}`

        let combinedNotes = orderNotes.trim()
        if (discountPaise > 0) {
          const discTag = discountReason.trim() || (isRelativeOrFree ? 'Relative (Free)' : `${discountValue}% Off`)
          combinedNotes = combinedNotes ? `${combinedNotes} [${discTag}]` : `[${discTag}]`
        }

        const result = await createPOSOrder({
          branchId,
          restaurantId,
          paymentMode,
          totalAmount: finalTotalPaise,
          discountAmount: discountPaise,
          notes: combinedNotes || undefined,
          items: cart,
        })

        const createdOrder = {
          order_no: result.order_no,
          invoice: invoiceStr,
          subtotal: subtotalRupees,
          discount: discountRupees,
          discount_reason: discountReason || (isRelativeOrFree ? 'Relative / Free' : ''),
          total: finalTotalRupees,
          items: [...cart],
          time: orderTime,
          payment_mode: finalTotalRupees === 0 ? 'Complimentary' : paymentMode,
          notes: combinedNotes,
        }

        // Update UI immediately — don't block on loadOrders()
        setLastOrder(createdOrder)
        setNextOrderNo(result.order_no + 1)
        setCart([])
        clearDiscount()
        setOrderNotes('')

        // Refresh order list in background — UI already updated above
        void loadOrders()
      } catch (err: unknown) {
        alert('Order failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
    })
  }

  // Filter items for display
  const searchFilteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (normalizedQuery) {
      return menuItems.filter(item => item.name.toLowerCase().includes(normalizedQuery))
    }

    if (selectedCategory) {
      return menuItems.filter(item => item.category_id === selectedCategory)
    }

    return menuItems
  }, [menuItems, searchQuery, selectedCategory])

  // KDS Aggregated Chef Items (To Cook & To Pack)
  // Only include orders that are waiting to be cooked / packed (exclude ready/packed and served)
  const activeKDSOrders = useMemo(
    () => recentOrders.filter(
      o => o.fulfillment !== 'ready' && o.fulfillment !== 'served' && o.status !== 'voided'
    ),
    [recentOrders]
  )

  const chefAggregatedEntries = useMemo(() => {
    const aggregatedItems = new Map<string, { qty: number; category: string }>()
    activeKDSOrders.forEach(o => {
      (o.order_items ?? []).forEach(oi => {
        const itemName = oi.item_name_at_sale || oi.item_name || 'Item'
        const itemCat = oi.category_at_sale || oi.category || 'General'
        const current = aggregatedItems.get(itemName) ?? { qty: 0, category: itemCat }
        current.qty += oi.qty || 1
        aggregatedItems.set(itemName, current)
      })
    })
    return Array.from(aggregatedItems.entries())
  }, [activeKDSOrders])

  // Mark packed action: immediately drop from KDS screen and reduce item counts
  const handleMarkPacked = async (orderId: string) => {
    if (pendingAction === orderId) return // prevent double-clicks
    setPendingAction(orderId)
    // Optimistic UI update: instantly mark ready/packed so it removes from Packer view
    // and chef count dynamically drops
    setRecentOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, fulfillment: 'ready' } : o))
    )
    try {
      await updateFulfillmentStatus(orderId, 'ready')
    } catch (err) {
      console.error('Failed to update fulfillment status:', err)
    } finally {
      setPendingAction(null)
    }
    // Refresh in background — optimistic update already handled the visible state
    void loadOrders()
  }

  // Reports calculations
  const reportTotals = useMemo(() => {
    let settledTotalPaise = 0
    let cashTotalPaise = 0

    recentOrders.forEach(o => {
      if (o.status !== 'settled') return
      const total = o.total_amount || 0
      settledTotalPaise += total
      if (o.payment_mode === 'cash') cashTotalPaise += total
    })

    const totalReportsRev = settledTotalPaise / 100
    return {
      totalReportsRev,
      avgOrderRev: recentOrders.length > 0 ? totalReportsRev / recentOrders.length : 0,
      cashTotal: cashTotalPaise / 100,
    }
  }, [recentOrders])

  return (
    <div className="pos-shell">
      {/* ─── Top Header (Screenshots 2, 3, 4, 5) ───────────────────────── */}
      <header className="pos-top-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-logo">🍽️</div>
            <div>
              <h1 className="header-title">{restaurantName}</h1>
              <p className="header-subtitle">Point of Sale Management System</p>
            </div>
          </div>

          <div className="header-right">
            {/* Branch Selector */}
            {branches.length > 1 && (
              <div className="branch-selector-wrapper">
                <span className="branch-label">🏪 Branch:</span>
                <select
                  value={branchId}
                  onChange={e => handleBranchChange(e.target.value)}
                  className="branch-select"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* User Chip */}
            <div className="user-chip">
              <div className="user-name">{cashierName}</div>
              <div className="user-role">{roleName}</div>
            </div>

            {isAdmin && (
              <Link
                href={roleName === 'Super Admin' ? '/super-admin/dashboard' : '/restaurant/dashboard'}
                className="header-admin-link"
              >
                Admin Portal
              </Link>
            )}

            <button
              onClick={async () => {
                const { createClient } = await import('@/utils/supabase/client')
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="signout-btn"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ─── Yellow Nav Tabs (Screenshots 2, 3, 4, 5) ──────────────────── */}
        <div className="nav-tabs-bar">
          {POS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ─── Main Content Container ────────────────────────────────────── */}
      <main className="pos-body">
        {/* TAB 1: ORDER SCREEN (Screenshots 1 & 5) */}
        {activeTab === 'order' && (
          <div className="order-layout">
            {/* Left Area: Categories & Items Grid */}
            <div className="order-left-panel">
              <div className="panel-header-row">
                {selectedCategory && !searchQuery ? (
                  <div className="cat-crumb-row">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="crumb-back-btn"
                    >
                      ←
                    </button>
                    <h2 className="panel-title">
                      {selectedCategoryName}
                    </h2>
                  </div>
                ) : (
                  <h2 className="panel-title">
                    📋 {searchQuery ? 'Search Results' : 'Categories'}
                  </h2>
                )}
              </div>

              {/* Search Bar */}
              <div className="search-bar-row">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search all items..."
                  className="search-input"
                />
              </div>

              {/* View 1: Root Categories Grid (Screenshot 1) */}
              {!selectedCategory && !searchQuery.trim() ? (
                <div className="categories-grid">
                  {categories.map(cat => (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="category-tile"
                    >
                      <div className="cat-name">{cat.name}</div>
                      <div className="cat-count">{categoryItemCounts.get(cat.id) ?? 0} items</div>
                    </div>
                  ))}
                </div>
              ) : (
                /* View 2: Items Grid in Category or Search (Screenshot 5) */
                <div className="items-grid">
                  {searchFilteredItems.length === 0 ? (
                    <div className="empty-items-msg">No items found for this branch.</div>
                  ) : (
                    searchFilteredItems.map(item => {
                      const cat = categoryById.get(item.category_id)
                      return (
                        <div key={item.id} className="item-tile">
                          <div className="item-tile-name">{item.name}</div>
                          <div className="item-tile-cat">{cat?.name ?? ''}</div>
                          <div className="item-tile-footer">
                            <span className="item-tile-price">
                              ₹{(item.price / 100).toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              className="item-tile-add-btn"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Right Area: Current Order Cart (Screenshots 1 & 5) */}
            <div className="order-right-panel">
              <h2 className="cart-title">🛒 Current Order</h2>

              {/* Order Number Box (AUTO) */}
              <div className="order-no-box">
                <div className="order-no-header">
                  <span>Order Number</span>
                  <span className="auto-tag">AUTO</span>
                </div>
                <div className="order-no-value">
                  {nextOrderNo}
                </div>
              </div>

              {/* Cart Items List */}
              <div className="cart-items-container">
                {cart.length === 0 ? (
                  <div className="empty-cart-msg">Add items to order</div>
                ) : (
                  cart.map(item => (
                    <div key={item.menuItemId} className="cart-item-card">
                      <div className="cart-item-row-top">
                        <span className="cart-item-name">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.menuItemId)}
                          className="cart-item-delete"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="cart-item-calc">
                        ₹{(item.unitPrice / 100).toFixed(2)} × {item.qty} = ₹{(item.lineTotal / 100).toFixed(2)}
                      </div>

                      <div className="cart-stepper-row">
                        <button
                          type="button"
                          onClick={() => updateQty(item.menuItemId, -1)}
                          className="stepper-btn"
                        >
                          -
                        </button>
                        <span className="stepper-val">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.menuItemId, 1)}
                          className="stepper-btn"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Discount & Special Order Section */}
              {canDiscount && (
              <div className="cart-discount-box">
                <div className="discount-header-row">
                  <span className="discount-title">🏷️ Discount &amp; Special</span>
                  {discountPaise > 0 && (
                    <button type="button" onClick={clearDiscount} className="btn-clear-discount">
                      ✕ Reset
                    </button>
                  )}
                </div>

                {/* Quick Presets Grid */}
                <div className="discount-presets-grid">
                  {/* Big Prominent Relative / Free Meal Button */}
                  <button
                    type="button"
                    onClick={toggleRelativeOrder}
                    className={`btn-discount-relative ${isRelativeOrFree ? 'active' : ''}`}
                    title="100% Free meal for owner's relatives / VIPs"
                  >
                    👑 Relative (₹0)
                  </button>

                  {/* Standard percentage buttons */}
                  {DISCOUNT_PRESETS.map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyPercentPreset(pct)}
                      className={`btn-discount-preset ${discountType === 'percent' && discountValue === pct ? 'active' : ''}`}
                    >
                      {pct}%
                    </button>
                  ))}

                  {/* Custom expander */}
                  <button
                    type="button"
                    onClick={() => setShowCustomDiscount(!showCustomDiscount)}
                    className={`btn-discount-preset ${showCustomDiscount ? 'active-custom' : ''}`}
                  >
                    {showCustomDiscount ? '▲' : '✏️ Other'}
                  </button>
                </div>

                {/* Custom discount panel if expanded */}
                {showCustomDiscount && (
                  <div className="custom-discount-panel">
                    <div className="custom-type-switch">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`type-switch-btn ${discountType === 'percent' ? 'active' : ''}`}
                      >
                        % Percent
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`type-switch-btn ${discountType === 'fixed' ? 'active' : ''}`}
                      >
                        ₹ Flat Off
                      </button>
                    </div>

                    <div className="custom-inputs-row">
                      <div className="custom-val-wrapper">
                        <span className="val-prefix">{discountType === 'percent' ? '%' : '₹'}</span>
                        <input
                          type="number"
                          min="0"
                          max={discountType === 'percent' ? 100 : subtotalRupees}
                          step={discountType === 'percent' ? '1' : '0.5'}
                          value={discountValue === 0 ? '' : discountValue}
                          onChange={e => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0"
                          className="custom-val-input"
                        />
                      </div>

                      <input
                        type="text"
                        value={discountReason}
                        onChange={e => setDiscountReason(e.target.value)}
                        placeholder="Reason (e.g. Relative, Owner, Staff)"
                        className="custom-reason-input"
                      />
                    </div>

                    <div className="reason-chips-row">
                      {DISCOUNT_REASONS.map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setDiscountReason(chip)
                            if (chip === 'Relative / Owner' && discountValue === 0) {
                              setDiscountType('percent')
                              setDiscountValue(100)
                            }
                          }}
                          className={`reason-chip ${discountReason === chip ? 'active' : ''}`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Total & Checkout */}
              <div className="cart-footer">
                {/* Subtotal & Discount Breakdown Lines */}
                {discountPaise > 0 && (
                  <div className="cart-breakdown">
                    <div className="breakdown-row">
                      <span>Subtotal:</span>
                      <span>₹{subtotalRupees.toFixed(2)}</span>
                    </div>
                    <div className="breakdown-row discount-row">
                      <span>
                        Discount {discountReason ? `(${discountReason})` : discountType === 'percent' ? `(${discountValue}%)` : `(-₹${discountValue})`}:
                      </span>
                      <span className="discount-amount-text">-₹{discountRupees.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="cart-total-row">
                  <span>Total:</span>
                  <span className={`cart-total-value ${finalTotalRupees === 0 && cart.length > 0 ? 'zero-total-val' : ''}`}>
                    ₹{finalTotalRupees.toFixed(2)}
                  </span>
                </div>

                {/* Relative / Free Meal Alert Banner */}
                {cart.length > 0 && finalTotalRupees === 0 && (
                  <div className="relative-order-banner">
                    <span className="banner-icon">👑</span>
                    <div className="banner-text">
                      <strong>Relative / 100% Free Order</strong>
                      <p>Total is ₹0.00. No payment collected.</p>
                    </div>
                  </div>
                )}

                {/* Payment Mode Selector */}
                <div className="payment-mode-section">
                  <div className="payment-label">
                    {finalTotalRupees === 0 && cart.length > 0 ? 'Payment mode (Zero balance)' : 'Payment mode'}
                  </div>
                  <div className="payment-buttons-grid">
                    {finalTotalRupees === 0 && cart.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setPaymentMode('cash')}
                        className="payment-btn active-zero"
                        style={{ gridColumn: 'span 3', background: '#ecfdf5', borderColor: '#10b981', color: '#047857', fontWeight: 800 }}
                      >
                        🎁 Complimentary / Free (₹0.00)
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPaymentMode('cash')}
                          className={`payment-btn ${paymentMode === 'cash' ? 'active' : ''}`}
                        >
                          💵 Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMode('card')}
                          className={`payment-btn ${paymentMode === 'card' ? 'active' : ''}`}
                        >
                          💳 Card
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMode('upi')}
                          className={`payment-btn ${paymentMode === 'upi' ? 'active' : ''}`}
                        >
                          📱 UPI
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="action-buttons-column">
                  <button
                    type="button"
                    onClick={() => {
                      if (lastOrder) window.print()
                      else alert('No previous settled order to print.')
                    }}
                    className="btn-print-receipt"
                  >
                    🖨️ Print Receipt
                  </button>

                  <button
                    type="button"
                    disabled={cart.length === 0 || isPending}
                    onClick={handleCompleteBilling}
                    className={`btn-complete-billing ${finalTotalRupees === 0 && cart.length > 0 ? 'btn-complete-zero' : ''}`}
                  >
                    {isPending
                      ? 'Processing...'
                      : finalTotalRupees === 0 && cart.length > 0
                        ? '👑 Settle Free Order (₹0.00)'
                        : '💰 Complete Billing'}
                  </button>

                  <button
                    type="button"
                    onClick={clearCart}
                    className="btn-clear-order"
                  >
                    Clear order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KOT SCREEN (Screenshot 2) */}
        {activeTab === 'kot' && (
          <div className="kot-tab-layout">
            <div className="kot-ticket-card">
              <div className="kot-ticket-header">
                <h3>KITCHEN ORDER TICKET</h3>
                <div className="kot-divider" />
                <h1>ORDER #{lastOrder?.order_no ?? nextOrderNo - 1}</h1>
                <div className="kot-divider" />
              </div>

              <div className="kot-ticket-body">
                {lastOrder?.notes && (
                  <div className="kot-order-tag">
                    🏷️ {lastOrder.notes}
                  </div>
                )}
                {lastOrder?.total === 0 && (
                  <div className="kot-complimentary-badge">
                    ★ COMPLIMENTARY / RELATIVE (₹0.00) ★
                  </div>
                )}
                <div className="kot-items-heading">ITEMS:</div>
                <div className="kot-items-list">
                  {(!lastOrder || lastOrder.items.length === 0) ? (
                    <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>No recent items to display</p>
                  ) : (
                    lastOrder.items.map((item, idx) => (
                      <div key={idx} className="kot-item-line">
                        • {item.name || 'Item'} × {item.qty}
                      </div>
                    ))
                  )}
                </div>
                {lastOrder && lastOrder.discount && lastOrder.discount > 0 ? (
                  <>
                    <div className="kot-divider" />
                    <div className="kot-summary-row">
                      <span>Subtotal:</span>
                      <span>₹{(lastOrder.subtotal ?? (lastOrder.total + lastOrder.discount)).toFixed(2)}</span>
                    </div>
                    <div className="kot-summary-row kot-disc-row">
                      <span>Discount:</span>
                      <span>-₹{lastOrder.discount.toFixed(2)}</span>
                    </div>
                    <div className="kot-summary-row kot-total-row">
                      <span>Total:</span>
                      <span>₹{lastOrder.total.toFixed(2)}</span>
                    </div>
                  </>
                ) : null}
                <div className="kot-divider" />
              </div>

              <div className="kot-ticket-footer">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="kot-print-again-btn"
                >
                  🖨️ Print Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KITCHEN KDS (Screenshot 3) */}
        {activeTab === 'kds' && (
          <div className="kds-tab-layout">
            <div className="kds-top-bar">
              <div className="kds-heading">
                <span>👨‍🍳</span>
                <h2>Kitchen Display System</h2>
              </div>
              <div className="kds-controls">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={autoPrintKOT}
                    onChange={e => setAutoPrintKOT(e.target.checked)}
                  />
                  <span>Auto-Print KOTs</span>
                </label>
                <button
                  type="button"
                  onClick={loadOrders}
                  className="kds-refresh-btn"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="kds-columns-grid">
              {/* Column 1: Chef View: To Cook (Red) */}
              <div className="kds-chef-column">
                <div className="kds-chef-header">
                  🔥 Chef View: To Cook
                </div>
                <div className="kds-chef-list">
                  {chefAggregatedEntries.length === 0 ? (
                    <div className="kds-empty-msg">No pending orders to cook.</div>
                  ) : (
                    chefAggregatedEntries.map(([name, data]) => (
                      <div key={name} className="chef-item-row">
                        <div>
                          <span className="chef-item-name">{name}</span>
                          <span className="chef-item-cat">({data.category || 'General'})</span>
                        </div>
                        <span className="chef-item-qty">{data.qty}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Packer View: To Pack (Blue) */}
              <div className="kds-packer-column">
                <div className="kds-packer-header">
                  📦 Packer View: To Pack
                </div>
                <div className="kds-packer-list">
                  {activeKDSOrders.length === 0 ? (
                    <div className="kds-empty-msg">All orders packed and served.</div>
                  ) : (
                    activeKDSOrders.map(o => (
                      <div key={o.id} className="packer-order-card">
                        <div className="packer-order-top">
                          <span className="packer-order-title">ORDER #{o.order_no}</span>
                          <span className="packer-order-time">
                            {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <div className="packer-order-items">
                          {(o.order_items ?? []).map(oi => {
                            const itemName = oi.item_name_at_sale || oi.item_name || 'Item'
                            const itemCat = oi.category_at_sale || oi.category || ''
                            return (
                              <div key={oi.id} className="packer-item-row">
                                <span>• {itemName} {itemCat ? <small>({itemCat})</small> : null}</span>
                                <strong>{oi.qty || 1}</strong>
                              </div>
                            )
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkPacked(o.id)}
                          disabled={pendingAction === o.id}
                          className="btn-mark-packed"
                        >
                          {pendingAction === o.id ? '⏳ Packing...' : '✓ Mark Packed'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS (Screenshot 4) */}
        {activeTab === 'reports' && (
          <div className="reports-tab-layout">
            <div className="reports-top-bar">
              <div className="date-picker-group">
                <label>Business date</label>
                <input
                  type="date"
                  value={reportsDate}
                  onChange={e => setReportsDate(e.target.value)}
                  className="reports-date-input"
                />
                <button type="button" onClick={loadOrders} className="reports-refresh-btn">
                  Refresh
                </button>
              </div>

              <div className="reports-action-buttons">
                <button
                  type="button"
                  onClick={() => alert('Exporting orders to Excel...')}
                  className="btn-export-excel"
                >
                  ⬇️ Export to Excel
                </button>
                <button
                  type="button"
                  onClick={() => alert('Saved workbook successfully.')}
                  className="btn-save-workbook"
                >
                  💾 Save workbook now
                </button>
              </div>
            </div>

            {/* 4 Colored KPI Cards */}
            <div className="reports-kpi-grid">
              <div className="report-kpi-card card-blue">
                <div className="kpi-icon">📋</div>
                <div className="kpi-num">{recentOrders.length}</div>
                <div className="kpi-title">Orders</div>
              </div>

              <div className="report-kpi-card card-green">
                <div className="kpi-icon">💰</div>
                <div className="kpi-num">₹{reportTotals.totalReportsRev.toFixed(2)}</div>
                <div className="kpi-title">Revenue</div>
              </div>

              <div className="report-kpi-card card-purple">
                <div className="kpi-icon">📈</div>
                <div className="kpi-num">₹{reportTotals.avgOrderRev.toFixed(2)}</div>
                <div className="kpi-title">Average order</div>
              </div>

              <div className="report-kpi-card card-orange">
                <div className="kpi-icon">💳</div>
                <div className="kpi-num">cash: ₹{reportTotals.cashTotal.toFixed(2)}</div>
                <div className="kpi-title">Payment Breakdown</div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="reports-orders-panel">
              <h3 className="orders-table-title">📊 Orders</h3>
              <div className="table-responsive">
                <table className="pos-data-table">
                  <thead>
                    <tr>
                      <th>Order No</th>
                      <th>Invoice</th>
                      <th>Time</th>
                      <th>Payment</th>
                      <th>Cashier</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-table-td">No orders found for this date.</td>
                      </tr>
                    ) : (
                      recentOrders.map(o => {
                        const inv = `INV-${new Date(o.created_at).toISOString().slice(0, 10).replace(/-/g, '')}-${String(o.order_no).padStart(4, '0')}`
                        return (
                          <tr key={o.id}>
                            <td className="td-bold">#{o.order_no}</td>
                            <td className="td-mono">{inv}</td>
                            <td className="td-muted">
                              {new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="td-badge">
                              {o.total_amount === 0 ? '🎁 Free' : o.payment_mode || 'cash'}
                            </td>
                            <td>{o.profiles?.name || cashierName}</td>
                            <td>{(o.order_items ?? []).reduce((s, i) => s + (i.qty || 1), 0)}</td>
                            <td className="td-total">
                              {o.total_amount === 0 ? (
                                <span style={{ color: '#16a34a', fontWeight: 800 }}>₹0.00 (Free)</span>
                              ) : (
                                <span>₹{((o.total_amount || 0) / 100).toFixed(2)}</span>
                              )}
                              {(o.discount_amount ?? 0) > 0 && (
                                <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                                  Disc: ₹{((o.discount_amount ?? 0) / 100).toFixed(2)}
                                </div>
                              )}
                            </td>
                            <td className="td-actions">
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="action-btn-print"
                              >
                                Print
                              </button>
                              {canVoid && o.status !== 'voided' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Void order #${o.order_no}?`)) {
                                      // Optimistic UI: mark voided immediately
                                      setRecentOrders(prev =>
                                        prev.map(ord => ord.id === o.id ? { ...ord, status: 'voided' } : ord)
                                      )
                                      try {
                                        await voidOrder(o.id, 'Cashier request')
                                      } catch (err) {
                                        console.error('Void failed:', err)
                                      }
                                      // Refresh in background
                                      void loadOrders()
                                    }
                                  }}
                                  className="action-btn-void"
                                >
                                  Void
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MENU SHORTCUT */}
        {activeTab === 'menu' && (
          <div className="shortcut-tab-layout">
            <div className="shortcut-card">
              <h2>🍴 Menu Management</h2>
              <p>View and manage categories, menu items, prices, and branch availability.</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Link href="/restaurant/menu" className="btn-primary">Go to Full Menu Admin →</Link>
                <Link href="/restaurant/menu/items/new" className="btn-ghost">+ Add New Menu Item</Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: STAFF SHORTCUT */}
        {activeTab === 'staff' && (
          <div className="shortcut-tab-layout">
            <div className="shortcut-card">
              <h2>👥 Staff Management</h2>
              <p>Manage branch cashiers, operators, chef accounts, and permissions.</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Link href="/restaurant/users" className="btn-primary">View Staff List →</Link>
                <Link href="/restaurant/users/invite" className="btn-ghost">+ Add Staff Member</Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: PRINTER SHORTCUT */}
        {activeTab === 'printer' && (
          <div className="shortcut-tab-layout">
            <div className="shortcut-card">
              <h2>⚙️ Printer Configuration</h2>
              <p>Configure local Windows thermal receipt printers and kitchen KOT printers for {branchName}.</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Link href={`/restaurant/branches/${branchId}/printers`} className="btn-primary">Configure Printers →</Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Modern Light Theme Styles ────────────── */}
      <style jsx>{`
        .pos-shell {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f1f5f9;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
        }

        /* Top Header */
        .pos-top-header {
          background: #ffffff;
          border-bottom: 2px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
          z-index: 50;
        }
        .header-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-logo {
          font-size: 1.8rem;
        }
        .header-title {
          font-size: 1.4rem;
          font-weight: 800;
          color: #b45309;
          margin: 0;
          line-height: 1.1;
          font-family: 'Outfit', sans-serif;
        }
        .header-subtitle {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
          margin-top: 0.15rem;
          font-weight: 500;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .branch-selector-wrapper {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: #f8fafc;
          padding: 0.35rem 0.7rem;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
        }
        .branch-label {
          font-size: 0.78rem;
          color: #d97706;
          font-weight: 700;
        }
        .branch-select {
          background: transparent;
          border: none;
          color: #0f172a;
          font-size: 0.85rem;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }
        .branch-select option {
          background: #ffffff;
          color: #0f172a;
        }
        .user-chip {
          text-align: right;
          line-height: 1.2;
        }
        .user-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: #b45309;
        }
        .user-role {
          font-size: 0.72rem;
          color: #64748b;
          text-transform: capitalize;
          font-weight: 500;
        }
        .header-admin-link {
          padding: 0.4rem 0.8rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          color: #334155;
          font-size: 0.78rem;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.15s;
        }
        .header-admin-link:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }
        .signout-btn {
          padding: 0.4rem 0.85rem;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          color: #475569;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .signout-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        /* Nav Tabs Bar */
        .nav-tabs-bar {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .nav-tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.65rem 1rem;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: #64748b;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-tab-btn:hover:not(.active) {
          background: #e2e8f0;
          color: #0f172a;
        }
        .nav-tab-btn.active {
          background: #f59e0b;
          color: #ffffff;
          border-bottom-color: #d97706;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
        }
        .tab-icon {
          font-size: 1rem;
        }

        /* POS Body */
        .pos-body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        /* Order Screen Layout */
        .order-layout {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.25rem;
          height: 100%;
        }
        .order-left-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .panel-header-row {
          margin-bottom: 1rem;
        }
        .panel-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
          font-family: 'Outfit', sans-serif;
        }
        .cat-crumb-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .crumb-back-btn {
          width: 32px;
          height: 32px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 0.4rem;
          color: #0f172a;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .crumb-back-btn:hover { background: #e2e8f0; }

        .search-bar-row {
          margin-bottom: 1.25rem;
        }
        .search-input {
          width: 100%;
          padding: 0.65rem 1rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          color: #0f172a;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .search-input:focus {
          border-color: #f59e0b;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }
        .search-input::placeholder {
          color: #94a3b8;
        }

        /* Categories Grid */
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 1rem;
        }
        .category-tile {
          background: #ffffff;
          border: 1.5px solid #fde68a;
          border-radius: 0.65rem;
          padding: 1.5rem 1rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 108px;
          box-shadow: 0 2px 5px rgba(245, 158, 11, 0.08);
        }
        .category-tile:hover {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #f59e0b;
          color: #92400e;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.2);
        }
        .cat-name {
          font-weight: 700;
          font-size: 1rem;
          margin-bottom: 0.3rem;
          color: #0f172a;
        }
        .category-tile:hover .cat-name {
          color: #92400e;
        }
        .cat-count {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }
        .category-tile:hover .cat-count {
          color: #b45309;
        }

        /* Items Grid */
        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
        }
        .empty-items-msg {
          grid-column: 1 / -1;
          text-align: center;
          color: #94a3b8;
          padding: 3rem;
        }
        .item-tile {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.65rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .item-tile:hover {
          border-color: #f59e0b;
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15);
          transform: translateY(-2px);
        }
        .item-tile-name {
          font-weight: 700;
          font-size: 0.95rem;
          margin-bottom: 0.25rem;
          color: #0f172a;
        }
        .item-tile-cat {
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 1rem;
        }
        .item-tile-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
        }
        .item-tile-price {
          color: #b45309;
          font-weight: 800;
          font-size: 1.15rem;
          font-family: 'Outfit', sans-serif;
        }
        .item-tile-add-btn {
          background: #f59e0b;
          color: #ffffff;
          border: none;
          border-radius: 0.4rem;
          width: 32px;
          height: 32px;
          font-size: 1.2rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
        }
        .item-tile-add-btn:hover {
          background: #d97706;
          transform: scale(1.05);
        }

        /* Right Panel: Current Order Cart */
        .order-right-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .cart-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.85rem;
          font-family: 'Outfit', sans-serif;
        }
        .order-no-box {
          background: #fefce8;
          border: 1.5px solid #fef08a;
          border-radius: 0.5rem;
          padding: 0.6rem 0.85rem;
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .order-no-header {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 0.75rem;
          color: #854d0e;
          font-weight: 600;
          margin-bottom: 0.2rem;
        }
        .auto-tag {
          background: #fef08a;
          color: #854d0e;
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          font-size: 0.65rem;
          font-weight: 700;
        }
        .order-no-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #b45309;
          line-height: 1;
          font-family: 'Outfit', sans-serif;
        }

        .cart-items-container {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          margin-bottom: 1rem;
          padding-right: 0.25rem;
        }
        .empty-cart-msg {
          text-align: center;
          color: #94a3b8;
          font-size: 0.9rem;
          padding: 3rem 1rem;
        }
        .cart-item-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.75rem;
        }
        .cart-item-row-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }
        .cart-item-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: #0f172a;
        }
        .cart-item-delete {
          background: none;
          border: none;
          color: #ef4444;
          font-size: 1rem;
          cursor: pointer;
          padding: 0.2rem;
          transition: color 0.15s;
        }
        .cart-item-delete:hover { color: #dc2626; }
        .cart-item-calc {
          font-size: 0.78rem;
          color: #64748b;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }
        .cart-stepper-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .stepper-btn {
          width: 26px;
          height: 26px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.35rem;
          color: #0f172a;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s;
        }
        .stepper-btn:hover { background: #f1f5f9; }
        .stepper-val {
          font-size: 0.9rem;
          font-weight: 700;
          min-width: 20px;
          text-align: center;
          color: #0f172a;
        }

        /* Discount Box */
        .cart-discount-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.65rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .discount-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .discount-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: #334155;
        }
        .btn-clear-discount {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
        }
        .btn-clear-discount:hover {
          background: #fee2e2;
        }
        .discount-presets-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
          gap: 0.35rem;
        }
        .btn-discount-relative {
          padding: 0.35rem 0.4rem;
          background: #fefce8;
          border: 1.5px solid #fde047;
          border-radius: 0.35rem;
          color: #854d0e;
          font-size: 0.72rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          text-align: center;
        }
        .btn-discount-relative:hover {
          background: #fef08a;
          border-color: #eab308;
          transform: translateY(-1px);
        }
        .btn-discount-relative.active {
          background: #16a34a;
          border-color: #15803d;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);
        }
        .btn-discount-preset {
          padding: 0.35rem 0.25rem;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.35rem;
          color: #334155;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          text-align: center;
        }
        .btn-discount-preset:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }
        .btn-discount-preset.active {
          background: #f59e0b;
          border-color: #d97706;
          color: #ffffff;
        }
        .btn-discount-preset.active-custom {
          background: #e2e8f0;
          color: #0f172a;
          font-weight: 800;
        }

        /* Custom Discount Panel */
        .custom-discount-panel {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.45rem;
          padding: 0.6rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-top: 0.25rem;
        }
        .custom-type-switch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.3rem;
        }
        .type-switch-btn {
          padding: 0.25rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 0.3rem;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
        }
        .type-switch-btn.active {
          background: #7c3aed;
          border-color: #6d28d9;
          color: #ffffff;
          font-weight: 700;
        }
        .custom-inputs-row {
          display: flex;
          gap: 0.4rem;
        }
        .custom-val-wrapper {
          position: relative;
          width: 85px;
          flex-shrink: 0;
        }
        .val-prefix {
          position: absolute;
          left: 0.45rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 700;
          pointer-events: none;
        }
        .custom-val-input {
          width: 100%;
          padding: 0.35rem 0.4rem 0.35rem 1.25rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.3rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }
        .custom-val-input:focus {
          border-color: #7c3aed;
        }
        .custom-reason-input {
          flex: 1;
          padding: 0.35rem 0.5rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.3rem;
          font-size: 0.78rem;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }
        .custom-reason-input:focus {
          border-color: #7c3aed;
        }
        .reason-chips-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .reason-chip {
          padding: 0.15rem 0.45rem;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 0.25rem;
          font-size: 0.68rem;
          color: #475569;
          font-weight: 600;
          cursor: pointer;
        }
        .reason-chip:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .reason-chip.active {
          background: #fef3c7;
          border-color: #fde68a;
          color: #92400e;
          font-weight: 700;
        }

        /* Cart Breakdown & Banners */
        .cart-breakdown {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          font-size: 0.85rem;
          color: #64748b;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 0.5rem;
        }
        .breakdown-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .discount-row {
          color: #16a34a;
          font-weight: 600;
        }
        .discount-amount-text {
          color: #16a34a;
          font-weight: 700;
        }
        .zero-total-val {
          color: #16a34a !important;
          background: #ecfdf5;
          padding: 0.1rem 0.5rem;
          border-radius: 0.35rem;
          border: 1.5px solid #a7f3d0;
        }
        .relative-order-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f0fdf4;
          border: 1.5px solid #bbf7d0;
          border-radius: 0.45rem;
          padding: 0.5rem 0.65rem;
          color: #15803d;
        }
        .banner-icon {
          font-size: 1.25rem;
        }
        .banner-text strong {
          display: block;
          font-size: 0.82rem;
          font-weight: 800;
          color: #166534;
        }
        .banner-text p {
          font-size: 0.72rem;
          color: #15803d;
          margin: 0;
        }
        .btn-complete-zero {
          background: linear-gradient(135deg, #16a34a, #059669) !important;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35) !important;
        }

        .cart-footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .cart-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
        }
        .cart-total-value {
          color: #b45309;
          font-size: 1.4rem;
          font-weight: 800;
          font-family: 'Outfit', sans-serif;
        }

        .payment-mode-section {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .payment-label {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
        }
        .payment-buttons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.4rem;
        }
        .payment-btn {
          padding: 0.5rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 0.4rem;
          color: #334155;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .payment-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .payment-btn.active {
          background: #f59e0b;
          color: #ffffff;
          border-color: #d97706;
          font-weight: 700;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.25);
        }

        .action-buttons-column {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .btn-print-receipt {
          padding: 0.6rem;
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          border-radius: 0.4rem;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-print-receipt:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .btn-complete-billing {
          padding: 0.75rem;
          background: #16a34a;
          color: #ffffff;
          border: none;
          border-radius: 0.4rem;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3);
        }
        .btn-complete-billing:hover { background: #15803d; transform: translateY(-1px); }
        .btn-complete-billing:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-clear-order {
          background: none;
          border: none;
          color: #64748b;
          font-size: 0.8rem;
          cursor: pointer;
          padding: 0.25rem;
          font-weight: 500;
        }
        .btn-clear-order:hover { color: #ef4444; }

        /* KOT Tab Styles */
        .kot-tab-layout {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem 0;
          min-height: 70vh;
        }
        .kot-ticket-card {
          background: #ffffff;
          color: #000000;
          width: 360px;
          padding: 2rem 1.5rem;
          border: 2px solid #000;
          border-radius: 0.25rem;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          font-family: 'Courier New', Courier, monospace;
        }
        .kot-ticket-header {
          text-align: center;
        }
        .kot-ticket-header h3 {
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }
        .kot-ticket-header h1 {
          font-size: 1.8rem;
          font-weight: 900;
          margin: 0.75rem 0;
        }
        .kot-divider {
          border-bottom: 1px dashed #000;
          margin: 0.75rem 0;
        }
        .kot-items-heading {
          font-weight: 800;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }
        .kot-items-list {
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.6;
        }
        .kot-order-tag {
          background: #fef3c7;
          border: 1px solid #fde68a;
          color: #92400e;
          padding: 0.3rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.8rem;
          font-weight: 800;
          text-align: center;
          margin-bottom: 0.6rem;
        }
        .kot-complimentary-badge {
          background: #000000;
          color: #ffffff;
          padding: 0.35rem;
          font-size: 0.85rem;
          font-weight: 900;
          text-align: center;
          letter-spacing: 0.05em;
          margin-bottom: 0.6rem;
        }
        .kot-summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          font-weight: 700;
          margin-top: 0.2rem;
        }
        .kot-disc-row {
          color: #047857;
        }
        .kot-total-row {
          font-size: 1.1rem;
          font-weight: 900;
          margin-top: 0.35rem;
        }
        .kot-ticket-footer {
          margin-top: 1.5rem;
          text-align: center;
        }
        .kot-print-again-btn {
          background: #0f172a;
          color: #ffffff;
          border: none;
          padding: 0.6rem 1.5rem;
          border-radius: 0.4rem;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
        }

        /* Kitchen KDS Tab Styles */
        .kds-tab-layout {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 100%;
        }
        .kds-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .kds-heading {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .kds-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: #475569;
          font-weight: 500;
        }
        .kds-refresh-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 0.4rem 0.8rem;
          border-radius: 0.4rem;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .kds-columns-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 1.5rem;
          flex: 1;
          overflow-y: auto;
        }
        .kds-chef-column {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .kds-chef-header {
          background: #dc2626;
          color: #ffffff;
          padding: 0.75rem 1rem;
          font-weight: 700;
          font-size: 1rem;
        }
        .kds-chef-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
          overflow-y: auto;
        }
        .chef-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 0.85rem 1rem;
          border-radius: 0.5rem;
        }
        .chef-item-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 0.95rem;
        }
        .chef-item-cat {
          font-size: 0.78rem;
          color: #64748b;
          margin-left: 0.4rem;
        }
        .chef-item-qty {
          color: #b45309;
          font-size: 1.3rem;
          font-weight: 800;
        }

        .kds-packer-column {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .kds-packer-header {
          background: #2563eb;
          color: #ffffff;
          padding: 0.75rem 1rem;
          font-weight: 700;
          font-size: 1rem;
        }
        .kds-packer-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          flex: 1;
          overflow-y: auto;
        }
        .packer-order-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 1rem;
        }
        .packer-order-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.6rem;
        }
        .packer-order-title {
          font-weight: 800;
          color: #1d4ed8;
          font-size: 1rem;
        }
        .packer-order-time {
          font-size: 0.75rem;
          color: #64748b;
        }
        .packer-order-items {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.9rem;
          margin-bottom: 0.85rem;
        }
        .packer-item-row {
          display: flex;
          justify-content: space-between;
          color: #334155;
          font-weight: 500;
        }
        .btn-mark-packed {
          width: 100%;
          padding: 0.5rem;
          background: #16a34a;
          border: none;
          border-radius: 0.35rem;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .btn-mark-packed:hover { background: #15803d; }

        /* Reports Tab Styles */
        .reports-tab-layout {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .reports-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .date-picker-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #334155;
          font-weight: 500;
        }
        .reports-date-input {
          padding: 0.4rem 0.6rem;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.4rem;
          color: #0f172a;
        }
        .reports-refresh-btn {
          padding: 0.4rem 0.8rem;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 0.4rem;
          color: #334155;
          cursor: pointer;
          font-weight: 600;
        }
        .reports-action-buttons {
          display: flex;
          gap: 0.5rem;
        }
        .btn-export-excel {
          padding: 0.45rem 0.9rem;
          background: #f59e0b;
          color: #ffffff;
          border: none;
          border-radius: 0.4rem;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .btn-save-workbook {
          padding: 0.45rem 0.9rem;
          background: #7c3aed;
          color: #ffffff;
          border: none;
          border-radius: 0.4rem;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }

        .reports-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }
        .report-kpi-card {
          border-radius: 0.65rem;
          padding: 1.25rem;
          color: #ffffff;
        }
        .card-blue { background: #2563eb; }
        .card-green { background: #16a34a; }
        .card-purple { background: #7c3aed; }
        .card-orange { background: #ea580c; }
        .kpi-icon { font-size: 1.4rem; margin-bottom: 0.25rem; }
        .kpi-num { font-size: 1.6rem; font-weight: 800; }
        .kpi-title { font-size: 0.8rem; opacity: 0.9; font-weight: 500; }

        .reports-orders-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .orders-table-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: #0f172a;
        }
        .table-responsive {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
        }
        .pos-data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .pos-data-table th {
          text-align: left;
          padding: 0.75rem 0.85rem;
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 0.72rem;
          text-transform: uppercase;
          border-bottom: 1px solid #e2e8f0;
        }
        .pos-data-table td {
          padding: 0.75rem 0.85rem;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
        }
        .td-bold { font-weight: 700; color: #0f172a; }
        .td-mono { font-family: monospace; color: #334155; }
        .td-muted { color: #64748b; font-size: 0.8rem; }
        .td-badge { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #b45309; }
        .td-total { font-weight: 800; color: #b45309; font-size: 0.95rem; }
        .td-actions { display: flex; gap: 0.4rem; }
        .action-btn-print {
          background: #f59e0b;
          color: #ffffff;
          border: none;
          padding: 0.25rem 0.6rem;
          border-radius: 0.35rem;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }
        .action-btn-void {
          background: #ef4444;
          color: #ffffff;
          border: none;
          padding: 0.25rem 0.6rem;
          border-radius: 0.35rem;
          font-size: 0.75rem;
          cursor: pointer;
        }

        /* Shortcut Tab */
        .shortcut-tab-layout {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 60vh;
        }
        .shortcut-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 2.5rem;
          text-align: center;
          max-width: 500px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .shortcut-card h2 {
          color: #0f172a;
          margin-bottom: 0.5rem;
          font-family: 'Outfit', sans-serif;
        }
        .shortcut-card p {
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
