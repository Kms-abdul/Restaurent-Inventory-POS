'use client'

import { useState, useCallback, useTransition, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CartItem } from '@/types/database'
import { createPOSOrder, createKOTOrder, holdOrder, addItemsToHeldOrder, checkoutHeldOrder, checkoutMultipleOrders, listOrders, updateFulfillmentStatus, voidOrder } from '@/app/actions/orders'
import { printJobAction, getDiscoveredPrintersAction, printDirectToThermalPrinter } from '@/app/actions/print-direct'
import type { ThermalOrderData } from '@/utils/thermal-printer'
import { formatTicketText, type PrintTicketPayload } from '@/utils/receipt-formatter'

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

// A pending order (sent to kitchen, not yet paid)
interface PendingOrder {
  id: string
  order_no: number
  created_at: string
  type: 'takeaway' | 'dine-in'
  table_label?: string  // only for dine-in
  notes?: string
  total_amount: number  // in paise
  items: CartItem[]
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
type ActiveTab = 'order' | 'kot' | 'kds' | 'printer'

const POS_TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'order', label: 'Order', icon: '📋' },
  { id: 'kot', label: 'KOT', icon: '🖨️' },
  { id: 'kds', label: 'Kitchen KDS', icon: '👨‍🍳' },
  { id: 'printer', label: 'Printer', icon: '⚙️' },
]

const DISCOUNT_PRESETS = [10, 20, 50]
const DISCOUNT_REASONS = ['Relative / Owner', 'VIP Guest', 'Staff Meal', 'Promo']

function getFoodEmoji(name: string, categoryName: string = ''): string {
  const text = (name + ' ' + categoryName).toLowerCase()
  if (text.includes('biryani')) return '🍛'
  if (text.includes('noodle') || text.includes('chowmein') || text.includes('pasta') || text.includes('maggi')) return '🍜'
  if (text.includes('rice') || text.includes('fried rice') || text.includes('pulao')) return '🍚'
  if (text.includes('chicken') || text.includes('tandoori') || text.includes('tikka') || text.includes('wings')) return '🍗'
  if (text.includes('mutton') || text.includes('meat') || text.includes('kebab')) return '🍖'
  if (text.includes('fish') || text.includes('prawn') || text.includes('seafood')) return '🐟'
  if (text.includes('soup') || text.includes('manchow')) return '🥣'
  if (text.includes('roll') || text.includes('spring roll') || text.includes('shawarma')) return '🌯'
  if (text.includes('burger')) return '🍔'
  if (text.includes('pizza')) return '🍕'
  if (text.includes('momo') || text.includes('dimsum')) return '🥟'
  if (text.includes('dosa') || text.includes('idli') || text.includes('vada')) return '🥞'
  if (text.includes('paneer') || text.includes('curry') || text.includes('dal') || text.includes('gravy')) return '🥘'
  if (text.includes('roti') || text.includes('naan') || text.includes('paratha') || text.includes('bread') || text.includes('pao')) return '🫓'
  if (text.includes('tea') || text.includes('chai') || text.includes('coffee')) return '☕'
  if (text.includes('juice') || text.includes('shake') || text.includes('lassi') || text.includes('drink') || text.includes('coke') || text.includes('beverage')) return '🥤'
  if (text.includes('ice cream') || text.includes('dessert') || text.includes('sweet') || text.includes('kulfi') || text.includes('cake')) return '🍨'
  if (text.includes('salad')) return '🥗'
  return '🍽️'
}

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
  const [mobileOrderView, setMobileOrderView] = useState<'menu' | 'cart'>('menu')
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

  // Orders list for KDS and KOT
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [autoPrintKOT, setAutoPrintKOT] = useState(true)

  // Tracks which individual order action is in-flight (for per-button loading states)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [isDirectPrinting, setIsDirectPrinting] = useState<boolean>(false)
  const [directPrintStatus, setDirectPrintStatus] = useState<string | null>(null)
  const [kotPrintStatus, setKotPrintStatus] = useState<string | null>(null)
  const [billPrintStatus, setBillPrintStatus] = useState<string | null>(null)
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null)
  const [availablePrinters, setAvailablePrinters] = useState<string[]>(['POSIO QX300'])
  const [isLoadingPrinters, setIsLoadingPrinters] = useState<boolean>(false)
  const [printerSaveSuccess, setPrinterSaveSuccess] = useState<boolean>(false)
  const [billingStatus, setBillingStatus] = useState<string | null>(null)

  // ─── KOT / Dine-In / CHECKOUT state ──────────────────────────────────────
  // Table label used for both KOT (takeaway ref) and Dine-In (table number)
  const [tableLabel, setTableLabel] = useState<string>('')
  // All pending (kitchen-sent, not yet billed) orders
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  // Whether the pending orders panel is expanded
  const [showPendingPanel, setShowPendingPanel] = useState<boolean>(false)
  // Status feedback for the 3 action buttons
  const [kotStatus, setKotStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [dineInStatus, setDineInStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  // Checkout confirmation dialog: single takeaway order or a full dine-in table
  const [checkoutTarget, setCheckoutTarget] = useState<{
    type: 'single' | 'table'
    orders: PendingOrder[]
    tableLabel?: string
    totalAmount: number  // paise
  } | null>(null)

  // Printer Configuration Settings (Saved in LocalStorage)
  const [printerSettings, setPrinterSettings] = useState({
    printerName: 'POSIO QX300',
    paperWidth: 48,
    enableKotPrint: true,
    enableReceiptPrint: true,
    enableLocalBrowserPrint: false,
    ticketType: 'receipt' as 'receipt' | 'kot',
    showPrices: true,
    headerText: restaurantName || 'CHINESE NAWAB',
    tagline: branchName,
    footerText: '** THANK YOU VISIT AGAIN **',
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_printer_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        setPrinterSettings(prev => ({
          ...prev,
          ...parsed,
          printerName: parsed.printerName || 'POSIO QX300',
          paperWidth: Number(parsed.paperWidth) || 48,
          enableKotPrint: parsed.enableKotPrint !== false,
          enableReceiptPrint: parsed.enableReceiptPrint !== false,
          enableLocalBrowserPrint: parsed.enableLocalBrowserPrint === true,
        }))
      }
    } catch { }
  }, [])

  const refreshPrinters = useCallback(async () => {
    setIsLoadingPrinters(true)
    try {
      const res = await getDiscoveredPrintersAction()
      if (res.success && res.printers && res.printers.length > 0) {
        setAvailablePrinters(res.printers)
      }
    } catch (err) {
      console.warn('Failed to discover printers:', err)
    } finally {
      setIsLoadingPrinters(false)
    }
  }, [])

  useEffect(() => {
    refreshPrinters()
  }, [refreshPrinters])

  const handleSavePrinterSettings = () => {
    try {
      localStorage.setItem('pos_printer_settings', JSON.stringify(printerSettings))
      setPrinterSaveSuccess(true)
      setTimeout(() => setPrinterSaveSuccess(false), 2500)
    } catch (e) {
      console.error('Failed to save printer settings:', e)
    }
  }

  const updatePrinterSettings = (updates: Partial<typeof printerSettings>) => {
    setPrinterSettings(prev => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem('pos_printer_settings', JSON.stringify(next))
      } catch { }
      return next
    })
  }

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

  const cartItemMap = useMemo(() => {
    const map = new Map<string, number>()
    cart.forEach(ci => {
      map.set(ci.menuItemId, ci.qty)
    })
    return map
  }, [cart])

  const selectedCategoryName = selectedCategory
    ? categoryById.get(selectedCategory)?.name ?? 'Category'
    : 'Category'

  // Load recent orders on mount and after submission
  const loadOrders = useCallback(async () => {
    try {
      const orders = (await listOrders(branchId, { limit: 50 })) as RecentOrder[]
      setRecentOrders(orders || [])
      if (orders && orders.length > 0) {
        // Track order number day-by-day: only check today's orders so yesterday's count doesn't inflate today
        const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
        const todayOrders = orders.filter(o => new Date(o.created_at).toLocaleDateString('en-CA') === todayStr)
        if (todayOrders.length > 0) {
          const highestNo = Math.max(...todayOrders.map(o => o.order_no || 0))
          setNextOrderNo(highestNo + 1)
        } else {
          setNextOrderNo(1)
        }

        // Sync pending active orders from database so reload/refresh keeps them
        const activeOrders = orders.filter(o => o.status === 'active')
        const activePending: PendingOrder[] = activeOrders.map(o => {
          let tbl = ''
          if (o.notes) {
            const match = o.notes.match(/\[([^\]]+)\]/) || o.notes.match(/^([^—|]+)—/)
            if (match) tbl = match[1].trim()
          }
          const isDine = Boolean(tbl || o.notes?.includes('Round') || o.notes?.toLowerCase().includes('table'))
          return {
            id: o.id,
            order_no: o.order_no,
            created_at: o.created_at,
            type: isDine ? 'dine-in' : 'takeaway',
            table_label: tbl || undefined,
            notes: o.notes || undefined,
            total_amount: o.total_amount || 0,
            items: (o.order_items || []).map(oi => ({
              menuItemId: oi.menu_item_id ?? '',
              name: oi.item_name_at_sale || oi.item_name || 'Item',
              category: oi.category_at_sale || oi.category || '',
              unitPrice: oi.unit_price_at_sale ?? oi.unit_price ?? 0,
              qty: oi.qty ?? 1,
              lineTotal: oi.line_total ?? 0,
            })),
          }
        })
        setPendingOrders(activePending)

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
      } else {
        setNextOrderNo(1)
        setPendingOrders([])
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
  const totalCartQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart])

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

  // ─── Shared print helper ──────────────────────────────────────────────────
  const triggerPrints = (printData: ThermalOrderData, type: 'KOT' | 'RECEIPT' | 'BOTH') => {
    if ((type === 'KOT' || type === 'BOTH') && printerSettings.enableKotPrint) {
      void printJobAction({
        type: 'KOT',
        data: printData,
        printerName: printerSettings.printerName || 'POSIO QX300',
        paperWidth: printerSettings.paperWidth || 48,
      }).then(res => {
        if (!res?.success && printerSettings.enableLocalBrowserPrint && typeof window !== 'undefined' && window.innerWidth > 900) {
          window.print()
        }
      })
    }
    if ((type === 'RECEIPT' || type === 'BOTH') && printerSettings.enableReceiptPrint) {
      const delayMs = (type === 'BOTH' && printerSettings.enableKotPrint) ? 500 : 0
      setTimeout(() => {
        void printJobAction({
          type: 'RECEIPT',
          data: printData,
          printerName: printerSettings.printerName || 'POSIO QX300',
          paperWidth: printerSettings.paperWidth || 48,
        })
      }, delayMs)
    }
  }

  // ─── KOT handler (Takeaway) ───────────────────────────────────────────────
  // Creates order, prints KOT to kitchen, and adds it to Pending Orders panel
  // so the cashier can checkout later when the customer pays.
  const handleKOT = () => {
    if (cart.length === 0) return
    setKotStatus('pending')
    startTransition(async () => {
      try {
        const orderTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        let combinedNotes = orderNotes.trim()
        if (discountPaise > 0) {
          const discTag = discountReason.trim() || (isRelativeOrFree ? 'Relative (Free)' : `${discountValue}% Off`)
          combinedNotes = combinedNotes ? `${combinedNotes} [${discTag}]` : `[${discTag}]`
        }

        const result = await createKOTOrder({
          branchId,
          restaurantId,
          tableLabel: tableLabel.trim() || undefined,
          notes: combinedNotes || undefined,
          items: cart,
          restaurantName: printerSettings.headerText || restaurantName,
          branchName: printerSettings.tagline || branchName,
          cashierName,
        })

        const printData: ThermalOrderData = {
          orderNumber: result.order_no,
          createdAt: new Date().toISOString(),
          restaurantName: printerSettings.headerText || restaurantName || 'RESTAURANT',
          branchName: printerSettings.tagline || branchName,
          cashierName,
          subtotal: subtotalRupees,
          discount: 0,
          total: subtotalRupees,
          paymentMode: 'none',
          items: cart.map(i => ({ name: i.name, quantity: i.qty, price: i.unitPrice / 100, lineTotal: i.lineTotal / 100 })),
        }
        triggerPrints(printData, 'KOT')

        // Add to Pending Orders panel (takeaway — single checkout)
        const newPending: PendingOrder = {
          id: result.order_id,
          order_no: result.order_no,
          created_at: new Date().toISOString(),
          type: 'takeaway',
          table_label: tableLabel.trim() || undefined,
          notes: combinedNotes || undefined,
          total_amount: subtotalPaise,
          items: [...cart],
        }
        setPendingOrders(prev => [newPending, ...prev])
        setShowPendingPanel(true)

        setLastOrder({
          order_no: result.order_no,
          invoice: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(result.order_no).padStart(4, '0')}`,
          subtotal: subtotalRupees,
          discount: 0,
          total: subtotalRupees,
          items: [...cart],
          time: orderTime,
          payment_mode: 'none',
          notes: combinedNotes,
        })
        setNextOrderNo(result.order_no + 1)
        setCart([])
        clearDiscount()
        setOrderNotes('')
        setTableLabel('')
        setKotStatus('success')
        setMobileOrderView('menu')
        setTimeout(() => setKotStatus('idle'), 3000)
        void loadOrders()
      } catch (err: unknown) {
        setKotStatus('error')
        alert('KOT failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
        setTimeout(() => setKotStatus('idle'), 3000)
      }
    })
  }

  // ─── Dine-In handler ─────────────────────────────────────────────────────
  // Creates an order for a table, prints KOT (chef cooks now), and adds it to
  // the Pending Orders panel grouped by table. Same table can have multiple
  // rounds; all are collected in one payment at checkout.
  const handleDineIn = () => {
    if (cart.length === 0) return
    const label = tableLabel.trim()
    if (!label) {
      alert('Please enter a table number for Dine-In orders (e.g. Table 1 or T1).')
      return
    }
    setDineInStatus('pending')
    startTransition(async () => {
      try {
        // Count existing rounds for this table
        const existingRounds = pendingOrders.filter(
          o => o.type === 'dine-in' && o.table_label === label
        ).length
        const roundNo = existingRounds + 1

        let combinedNotes = orderNotes.trim()
        if (discountPaise > 0) {
          const discTag = discountReason.trim() || (isRelativeOrFree ? 'Relative (Free)' : `${discountValue}% Off`)
          combinedNotes = combinedNotes ? `${combinedNotes} [${discTag}]` : `[${discTag}]`
        }
        const roundNote = `${label} — Round ${roundNo}${combinedNotes ? ` | ${combinedNotes}` : ''}`

        const result = await holdOrder({
          branchId,
          restaurantId,
          tableLabel: label,
          notes: roundNote,
          items: cart,
          restaurantName: printerSettings.headerText || restaurantName,
          branchName: printerSettings.tagline || branchName,
          cashierName,
        })

        // KOT print shows table + round number so chef knows which table
        const printData: ThermalOrderData = {
          orderNumber: result.order_no,
          createdAt: new Date().toISOString(),
          restaurantName: printerSettings.headerText || restaurantName || 'RESTAURANT',
          branchName: `${printerSettings.tagline || branchName} | ${label} — Round ${roundNo}`,
          cashierName,
          subtotal: subtotalRupees,
          discount: 0,
          total: subtotalRupees,
          paymentMode: 'none',
          items: cart.map(i => ({ name: i.name, quantity: i.qty, price: i.unitPrice / 100, lineTotal: i.lineTotal / 100 })),
        }
        triggerPrints(printData, 'KOT')

        // Add to Pending Orders panel under the table group
        const newPending: PendingOrder = {
          id: result.order_id,
          order_no: result.order_no,
          created_at: new Date().toISOString(),
          type: 'dine-in',
          table_label: label,
          notes: roundNote,
          total_amount: subtotalPaise,
          items: [...cart],
        }
        setPendingOrders(prev => [newPending, ...prev])
        setShowPendingPanel(true)

        setNextOrderNo(result.order_no + 1)
        setCart([])
        clearDiscount()
        setOrderNotes('')
        // Keep tableLabel so next round is for the same table by default
        setDineInStatus('success')
        setMobileOrderView('menu')
        setTimeout(() => setDineInStatus('idle'), 3000)
        void loadOrders()
      } catch (err: unknown) {
        setDineInStatus('error')
        alert('Dine-In failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
        setTimeout(() => setDineInStatus('idle'), 3000)
      }
    })
  }

  // ─── CHECKOUT from current cart (no prior KOT/HOLD) ──────────────────────
  // Directly creates + settles an order in one step (like old Complete Billing).
  const handleCheckoutFromCart = () => {
    if (cart.length === 0) return
    setCheckoutStatus('pending')
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

        setLastOrder(createdOrder)
        setNextOrderNo(result.order_no + 1)
        setCart([])
        clearDiscount()
        setOrderNotes('')
        setTableLabel('')

        const printData: ThermalOrderData = {
          orderNumber: result.order_no,
          createdAt: new Date().toISOString(),
          restaurantName: printerSettings.headerText || restaurantName || 'CHINESE NAWAB',
          branchName: printerSettings.tagline || branchName,
          cashierName,
          subtotal: subtotalRupees,
          discount: discountRupees,
          total: finalTotalRupees,
          paymentMode: finalTotalRupees === 0 ? 'Complimentary' : paymentMode,
          items: createdOrder.items.map(i => ({
            name: i.name,
            quantity: i.qty,
            price: i.unitPrice ? i.unitPrice / 100 : undefined,
            lineTotal: i.lineTotal ? i.lineTotal / 100 : undefined,
          })),
        }
        triggerPrints(printData, 'BOTH')

        setCheckoutStatus('success')
        setBillingStatus('success')
        setMobileOrderView('menu')
        setTimeout(() => { setCheckoutStatus('idle'); setBillingStatus(null) }, 3000)
        void loadOrders()
      } catch (err: unknown) {
        setCheckoutStatus('error')
        alert('Checkout failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
        setTimeout(() => setCheckoutStatus('idle'), 3000)
      }
    })
  }

  // ─── CHECKOUT pending orders (single takeaway OR full dine-in table) ───────
  const handleCheckoutPending = () => {
    if (!checkoutTarget) return
    setCheckoutStatus('pending')
    startTransition(async () => {
      try {
        const { orders, totalAmount } = checkoutTarget
        const isZero = totalAmount === 0
        const mode = isZero ? 'cash' : paymentMode

        if (checkoutTarget.type === 'single') {
          // Single takeaway order
          await checkoutHeldOrder({
            orderId: orders[0].id,
            paymentMode: mode,
            totalAmount,
          })
          setPendingOrders(prev => prev.filter(o => o.id !== orders[0].id))
        } else {
          // All rounds for a dine-in table
          await checkoutMultipleOrders({
            orderIds: orders.map(o => o.id),
            paymentMode: mode,
            totalAmount,
          })
          // Remove all orders that belonged to this table
          setPendingOrders(prev =>
            prev.filter(o => !(o.type === 'dine-in' && o.table_label === checkoutTarget.tableLabel))
          )
        }

        // Build all items for the receipt (merged across rounds)
        const allItems = orders.flatMap(o => o.items)
        const printData: ThermalOrderData = {
          orderNumber: orders[0].order_no,
          createdAt: new Date().toISOString(),
          restaurantName: printerSettings.headerText || restaurantName || 'RESTAURANT',
          branchName: checkoutTarget.tableLabel
            ? `${printerSettings.tagline || branchName} | ${checkoutTarget.tableLabel}`
            : printerSettings.tagline || branchName,
          cashierName,
          subtotal: totalAmount / 100,
          discount: 0,
          total: totalAmount / 100,
          paymentMode: isZero ? 'Complimentary' : paymentMode,
          items: allItems.map(i => ({ name: i.name, quantity: i.qty, price: i.unitPrice / 100, lineTotal: i.lineTotal / 100 })),
        }
        triggerPrints(printData, 'RECEIPT')

        setCheckoutTarget(null)
        setCheckoutStatus('success')
        setTimeout(() => setCheckoutStatus('idle'), 3000)
        void loadOrders()
      } catch (err: unknown) {
        setCheckoutStatus('error')
        alert('Checkout failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
        setTimeout(() => setCheckoutStatus('idle'), 3000)
      }
    })
  }

  // Legacy alias
  const handleCompleteBilling = handleCheckoutFromCart

  // ─── Derived: group pending orders for the panel ──────────────────────────
  const takeawayPending = useMemo(
    () => pendingOrders.filter(o => o.type === 'takeaway'),
    [pendingOrders]
  )

  const dineInByTable = useMemo(() => {
    const groups: Record<string, PendingOrder[]> = {}
    pendingOrders
      .filter(o => o.type === 'dine-in')
      .forEach(o => {
        const key = o.table_label || 'Unknown Table'
        if (!groups[key]) groups[key] = []
        groups[key].push(o)
      })
    return groups
  }, [pendingOrders])

  const hasPending = pendingOrders.length > 0

  // Print ticket target state for thermal printer
  const [ticketToPrint, setTicketToPrint] = useState<{
    order_no: number
    time: string
    cashier: string
    tableNumber?: string
    notes?: string
    items: { name: string; qty: number }[]
  } | null>(null)

  // Active ticket data: selected override > active cart > last settled order
  const activePrintTicket = useMemo(() => {
    if (ticketToPrint) return ticketToPrint

    if (cart.length > 0) {
      let combinedNotes = orderNotes.trim()
      if (discountPaise > 0) {
        const discTag = discountReason.trim() || (isRelativeOrFree ? 'Relative (Free)' : `${discountValue}% Off`)
        combinedNotes = combinedNotes ? `${combinedNotes} [${discTag}]` : `[${discTag}]`
      }
      return {
        order_no: nextOrderNo,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
        cashier: cashierName,
        notes: combinedNotes || undefined,
        items: cart.map(i => ({ name: i.name, qty: i.qty })),
      }
    }

    if (lastOrder && lastOrder.items && lastOrder.items.length > 0) {
      return {
        order_no: lastOrder.order_no,
        time: lastOrder.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
        cashier: cashierName,
        notes: lastOrder.notes || undefined,
        items: lastOrder.items.map(i => ({ name: i.name, qty: i.qty })),
      }
    }

    return null
  }, [ticketToPrint, cart, nextOrderNo, cashierName, orderNotes, discountPaise, discountReason, isRelativeOrFree, discountValue, lastOrder])

  const getThermalDataFromOrder = (override?: any): ThermalOrderData | null => {
    if (override && override.items && override.items.length > 0) {
      return {
        orderNumber: override.order_no,
        createdAt: new Date().toISOString(),
        restaurantName: printerSettings.headerText || restaurantName || 'CHINESE NAWAB',
        branchName: printerSettings.tagline || branchName,
        cashierName: override.cashier || cashierName,
        subtotal: subtotalRupees,
        discount: discountRupees,
        total: finalTotalRupees,
        paymentMode: paymentMode,
        items: override.items.map((i: any) => ({
          name: i.name,
          quantity: i.qty || i.quantity || 1,
          price: i.unitPrice ? i.unitPrice / 100 : undefined,
          lineTotal: i.lineTotal ? i.lineTotal / 100 : undefined,
        })),
      }
    }

    if (cart.length > 0) {
      return {
        orderNumber: nextOrderNo,
        createdAt: new Date().toISOString(),
        restaurantName: printerSettings.headerText || restaurantName || 'CHINESE NAWAB',
        branchName: printerSettings.tagline || branchName,
        cashierName,
        subtotal: subtotalRupees,
        discount: discountRupees,
        total: finalTotalRupees,
        paymentMode: paymentMode,
        items: cart.map(i => ({
          name: i.name,
          quantity: i.qty,
          price: i.unitPrice ? i.unitPrice / 100 : undefined,
          lineTotal: i.lineTotal ? i.lineTotal / 100 : undefined,
        })),
      }
    }

    if (lastOrder && lastOrder.items && lastOrder.items.length > 0) {
      return {
        orderNumber: lastOrder.order_no,
        createdAt: new Date().toISOString(),
        restaurantName: printerSettings.headerText || restaurantName || 'CHINESE NAWAB',
        branchName: printerSettings.tagline || branchName,
        cashierName,
        subtotal: lastOrder.subtotal,
        discount: lastOrder.discount,
        total: lastOrder.total,
        paymentMode: lastOrder.payment_mode,
        items: lastOrder.items.map(i => ({
          name: i.name,
          quantity: i.qty,
          price: i.unitPrice ? i.unitPrice / 100 : undefined,
          lineTotal: i.lineTotal ? i.lineTotal / 100 : undefined,
        })),
      }
    }

    return null
  }

  const handlePrintKOT = async (override?: any) => {
    const data = getThermalDataFromOrder(override)
    if (!data || data.items.length === 0) {
      alert('No items to print KOT. Please add items to the order first.')
      return
    }

    setKotPrintStatus('printing')
    try {
      const res = await printJobAction({
        type: 'KOT',
        data,
        printerName: printerSettings.printerName || 'POSIO QX300',
        paperWidth: printerSettings.paperWidth || 48,
      })
      if (res.success) {
        setKotPrintStatus('printed')
        setTimeout(() => setKotPrintStatus(null), 2500)
      } else {
        alert('KOT print failed: ' + (res.error || 'Unknown error'))
        setKotPrintStatus(null)
      }
    } catch (e: any) {
      alert('KOT print failed: ' + e.message)
      setKotPrintStatus(null)
    }
  }

  const handlePrintBill = async (override?: any) => {
    const data = getThermalDataFromOrder(override)
    if (!data || data.items.length === 0) {
      alert('No items to print Bill. Please add items to the order first.')
      return
    }

    setBillPrintStatus('printing')
    try {
      const res = await printJobAction({
        type: 'RECEIPT',
        data,
        printerName: printerSettings.printerName || 'POSIO QX300',
        paperWidth: printerSettings.paperWidth || 48,
      })
      if (res.success) {
        setBillPrintStatus('printed')
        setTimeout(() => setBillPrintStatus(null), 2500)
      } else {
        alert('Bill print failed: ' + (res.error || 'Unknown error'))
        setBillPrintStatus(null)
      }
    } catch (e: any) {
      alert('Bill print failed: ' + e.message)
      setBillPrintStatus(null)
    }
  }

  const handlePrintReceipt = (override?: any) => handlePrintBill(override)

  const handleSendTestPrint = async () => {
    setTestPrintStatus('printing')
    try {
      const res = await printJobAction({
        type: 'TEST',
        printerName: printerSettings.printerName || 'POSIO QX300',
        paperWidth: printerSettings.paperWidth || 48,
      })
      if (res.success) {
        setTestPrintStatus('printed')
        setTimeout(() => setTestPrintStatus(null), 2500)
      } else {
        alert('Test print failed: ' + (res.error || 'Unknown error'))
        setTestPrintStatus(null)
      }
    } catch (e: any) {
      alert('Test print failed: ' + e.message)
      setTestPrintStatus(null)
    }
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
        {/* TAB 1: ORDER SCREEN */}
        {activeTab === 'order' && (
          <div className="order-tab-wrapper">
            {/* ─── DESKTOP ORDER VIEW (> 900px) ─────────────────────────── */}
            <div className="desktop-pos-layout">
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

                  {/* Scrollable Container for Categories and Items */}
                  <div className="order-content-scroll">
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
                </div>

                {/* Right Area: Current Order Cart */}
                <div className="order-right-panel">
                  <div className="cart-top-bar">
                    <div className="cart-top-left">
                      <h2 className="cart-title">🛒 Current Order</h2>
                      <div className="order-no-pill">
                        <span className="order-no-label">Order #</span>
                        <span className="order-no-num">{nextOrderNo}</span>
                        <span className="auto-tag">AUTO</span>
                      </div>
                    </div>

                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="btn-top-clear"
                        title="Clear current cart"
                      >
                        Clear
                      </button>
                    )}
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
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="cart-item-row-bottom">
                            <div className="cart-item-calc">
                              ₹{(item.unitPrice / 100).toFixed(2)} × {item.qty} = <strong className="cart-item-subtotal">₹{(item.lineTotal / 100).toFixed(2)}</strong>
                            </div>

                            <div className="cart-stepper-row">
                              <button
                                type="button"
                                onClick={() => updateQty(item.menuItemId, -1)}
                                className="stepper-btn"
                                title="Decrease quantity"
                              >
                                -
                              </button>
                              <span className="stepper-val">{item.qty}</span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.menuItemId, 1)}
                                className="stepper-btn"
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pinned Bottom Footer */}
                  <div className="cart-footer">
                    {canDiscount && (
                      <div className="cart-discount-section">
                        <div className="discount-header-row">
                          <span className="discount-title">🏷️ Discount &amp; Special</span>
                          {discountPaise > 0 && (
                            <button type="button" onClick={clearDiscount} className="btn-clear-discount">
                              ✕ Reset
                            </button>
                          )}
                        </div>

                        <div className="discount-presets-grid">
                          <button
                            type="button"
                            onClick={toggleRelativeOrder}
                            className={`btn-discount-relative ${isRelativeOrFree ? 'active' : ''}`}
                            title="Mark 100% Free for Owner / Relative"
                          >
                            👑 Relative (₹0)
                          </button>

                          <button
                            type="button"
                            onClick={() => applyPercentPreset(10)}
                            className={`btn-discount-preset ${!isRelativeOrFree && discountType === 'percent' && discountValue === 10 ? 'active' : ''}`}
                          >
                            10%
                          </button>

                          <button
                            type="button"
                            onClick={() => applyPercentPreset(20)}
                            className={`btn-discount-preset ${!isRelativeOrFree && discountType === 'percent' && discountValue === 20 ? 'active' : ''}`}
                          >
                            20%
                          </button>

                          <button
                            type="button"
                            onClick={() => applyPercentPreset(50)}
                            className={`btn-discount-preset ${!isRelativeOrFree && discountType === 'percent' && discountValue === 50 ? 'active' : ''}`}
                          >
                            50%
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowCustomDiscount(!showCustomDiscount)}
                            className={`btn-discount-preset ${showCustomDiscount ? 'active-custom' : ''}`}
                            title="Custom discount or notes"
                          >
                            ✏️ Other
                          </button>
                        </div>

                        {showCustomDiscount && (
                          <div className="custom-discount-panel">
                            <div className="custom-type-switch">
                              <button
                                type="button"
                                onClick={() => { setDiscountType('percent'); setDiscountValue(0); }}
                                className={`type-switch-btn ${discountType === 'percent' ? 'active' : ''}`}
                              >
                                % Percent
                              </button>
                              <button
                                type="button"
                                onClick={() => { setDiscountType('fixed'); setDiscountValue(0); }}
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
                                  value={discountValue || ''}
                                  onChange={e => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                                  placeholder="0"
                                  className="custom-val-input"
                                />
                              </div>
                              <input
                                type="text"
                                value={discountReason}
                                onChange={e => setDiscountReason(e.target.value)}
                                placeholder="Reason (VIP, Staff, Promo...)"
                                className="custom-reason-input"
                              />
                            </div>

                            <div className="reason-chips-row">
                              {DISCOUNT_REASONS.map(chip => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => setDiscountReason(chip)}
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
                          <span className="discount-amount-text">
                            -₹{discountRupees.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="cart-total-row">
                      <span>Total:</span>
                      <span className={`cart-total-value ${finalTotalRupees === 0 && cart.length > 0 ? 'zero-total-val' : ''}`}>
                        ₹{finalTotalRupees.toFixed(2)}
                      </span>
                    </div>

                    {cart.length > 0 && finalTotalRupees === 0 && (
                      <div className="relative-order-banner">
                        <span className="banner-icon">👑</span>
                        <div className="banner-text">
                          <strong>Relative / 100% Free Order</strong>
                          <p>Total is ₹0.00. No payment collected.</p>
                        </div>
                      </div>
                    )}

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

                    {/* ── Table picker + Order-type label ──────── */}
                    <div className="table-label-row">
                      <div className="table-quick-picker">
                        {['T1','T2','T3','T4','T5','T6','T7','T8'].map(t => (
                          <button
                            key={t}
                            type="button"
                            className={`table-quick-btn ${tableLabel === t ? 'active' : ''}`}
                            onClick={() => setTableLabel(prev => prev === t ? '' : t)}
                          >{t}</button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={tableLabel}
                        onChange={e => setTableLabel(e.target.value)}
                        placeholder="Table / Name (for Dine-In, optional for Takeaway)"
                        className="table-label-input"
                        maxLength={40}
                      />
                    </div>

                    {/* ── 3-Action Button Row ───────────────────── */}
                    <div className="action-3btn-row">
                      {/* KOT — Takeaway */}
                      <button
                        type="button"
                        disabled={cart.length === 0 || isPending}
                        onClick={handleKOT}
                        className={`btn-action-kot ${kotStatus === 'success' ? 'btn-action-success' : ''}`}
                        title="Takeaway: send to kitchen & add to pending list for checkout later."
                      >
                        {kotStatus === 'pending' ? '⏳' : kotStatus === 'success' ? '✅' : '🖨️'}
                        <span>{kotStatus === 'success' ? 'Sent!' : 'KOT'}</span>
                      </button>

                      {/* Dine-In */}
                      <button
                        type="button"
                        disabled={cart.length === 0 || isPending}
                        onClick={handleDineIn}
                        className={`btn-action-hold ${dineInStatus === 'success' ? 'btn-action-success' : ''}`}
                        title="Dine-In: send to kitchen under table, pay at end."
                      >
                        {dineInStatus === 'pending' ? '⏳' : dineInStatus === 'success' ? '✅' : '🍽️'}
                        <span>{dineInStatus === 'success' ? 'Added!' : 'Dine-In'}</span>
                      </button>

                      {/* Checkout (direct from cart) */}
                      <button
                        type="button"
                        disabled={cart.length === 0 || isPending}
                        onClick={handleCheckoutFromCart}
                        className={`btn-action-checkout ${checkoutStatus === 'success' ? 'btn-action-success' : ''} ${finalTotalRupees === 0 && cart.length > 0 ? 'btn-action-checkout-zero' : ''}`}
                        title="Collect payment and finalise immediately."
                      >
                        {checkoutStatus === 'pending' ? '⏳' : checkoutStatus === 'success' ? '✅' : finalTotalRupees === 0 && cart.length > 0 ? '👑' : '✅'}
                        <span>{checkoutStatus === 'success' ? 'Done!' : finalTotalRupees === 0 && cart.length > 0 ? 'Free' : 'Checkout'}</span>
                      </button>
                    </div>

                    <button type="button" onClick={clearCart} className="btn-clear-order">Clear order</button>

                    {/* ── Pending Orders Panel ──────────────────── */}
                    {hasPending && (
                      <div className="hold-tray-section">
                        <button
                          type="button"
                          className="hold-tray-toggle"
                          onClick={() => setShowPendingPanel(p => !p)}
                        >
                          <span>📋 Pending Orders</span>
                          <span className="hold-tray-count">{pendingOrders.length}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{showPendingPanel ? '▲' : '▼'}</span>
                        </button>

                        {showPendingPanel && (
                          <div className="hold-tray-list">

                            {/* Takeaway orders — each can be checked out individually */}
                            {takeawayPending.length > 0 && (
                              <>
                                <div className="pending-section-label">🏃 Takeaway</div>
                                {takeawayPending.map(order => (
                                  <div key={order.id} className="held-order-card">
                                    <div className="held-order-header">
                                      <span className="held-order-num">#{order.order_no}</span>
                                      {order.table_label && <span className="held-order-table">📝 {order.table_label}</span>}
                                      <span className="held-order-time">
                                        {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <div className="held-order-items-preview">
                                      {order.items.slice(0, 3).map((it, i) => (
                                        <span key={i} className="held-item-chip">{it.name} ×{it.qty}</span>
                                      ))}
                                      {order.items.length > 3 && <span className="held-item-chip">+{order.items.length - 3} more</span>}
                                    </div>
                                    <div className="held-order-total">₹{(order.total_amount / 100).toFixed(2)}</div>
                                    <div className="held-order-actions">
                                      <button
                                        type="button"
                                        className="btn-held-checkout"
                                        onClick={() => setCheckoutTarget({ type: 'single', orders: [order], totalAmount: order.total_amount })}
                                        disabled={isPending}
                                      >
                                        💳 Checkout
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}

                            {/* Dine-In tables — all rounds grouped, paid together */}
                            {Object.keys(dineInByTable).length > 0 && (
                              <>
                                <div className="pending-section-label">🍽️ Dine-In Tables</div>
                                {Object.entries(dineInByTable).map(([table, orders]) => {
                                  const tableTotal = orders.reduce((s, o) => s + o.total_amount, 0)
                                  return (
                                    <div key={table} className="held-order-card held-order-card-table">
                                      <div className="held-order-header">
                                        <span className="held-order-num">🪑 {table}</span>
                                        <span className="held-order-table">{orders.length} round{orders.length > 1 ? 's' : ''}</span>
                                        <span className="held-order-time">
                                          {new Date(orders[0].created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      {/* Show each round */}
                                      {orders.map((o, ri) => (
                                        <div key={o.id} className="dine-round-row">
                                          <span className="dine-round-label">Round {ri + 1} #{o.order_no}</span>
                                          <div className="held-order-items-preview" style={{ flex: 1 }}>
                                            {o.items.slice(0, 2).map((it, i) => (
                                              <span key={i} className="held-item-chip">{it.name} ×{it.qty}</span>
                                            ))}
                                            {o.items.length > 2 && <span className="held-item-chip">+{o.items.length - 2}</span>}
                                          </div>
                                          <span className="dine-round-amt">₹{(o.total_amount / 100).toFixed(0)}</span>
                                        </div>
                                      ))}
                                      <div className="held-order-total" style={{ borderTop: '1px dashed #c7d2fe', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
                                        Grand Total: ₹{(tableTotal / 100).toFixed(2)}
                                      </div>
                                      <div className="held-order-actions">
                                        <button
                                          type="button"
                                          className="btn-held-checkout"
                                          style={{ width: '100%' }}
                                          onClick={() => setCheckoutTarget({ type: 'table', orders, tableLabel: table, totalAmount: tableTotal })}
                                          disabled={isPending}
                                        >
                                          💳 Checkout {table}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </>
                            )}

                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── MOBILE EZO BILLING VIEW (<= 900px) ───────────────────── */}
            <div className="mobile-pos-layout">
              {mobileOrderView === 'menu' ? (
                <div className="mobile-menu-view">
                  {/* Search Bar */}
                  <div className="ezo-search-bar">
                    <span style={{ fontSize: '1rem', color: '#94a3b8' }}>🔍</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search menu items..."
                      className="ezo-search-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="ezo-search-clear"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Horizontal Category Filter Pills */}
                  <div className="ezo-category-pills">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(null)
                        setSearchQuery('')
                      }}
                      className={`ezo-pill ${!selectedCategory && !searchQuery ? 'active' : ''}`}
                    >
                      All Items ({menuItems.length})
                    </button>
                    {categories.map(cat => {
                      const count = categoryItemCounts.get(cat.id) ?? 0
                      const isActive = selectedCategory === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(isActive ? null : cat.id)
                            setSearchQuery('')
                          }}
                          className={`ezo-pill ${isActive ? 'active' : ''}`}
                        >
                          {cat.name} ({count})
                        </button>
                      )
                    })}
                  </div>

                  {/* Section Title */}
                  <div className="ezo-section-heading">
                    <h2 className="ezo-section-title">
                      {selectedCategory
                        ? selectedCategoryName
                        : searchQuery.trim()
                          ? `Results for "${searchQuery.trim()}"`
                          : 'Best Seller Items'}
                    </h2>
                    <span className="ezo-section-count">
                      {searchFilteredItems.length} {searchFilteredItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* EZO 3-Column Food Items Grid */}
                  <div className="ezo-food-grid">
                    {searchFilteredItems.length === 0 ? (
                      <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                        No items found in this section.
                      </div>
                    ) : (
                      searchFilteredItems.map(item => {
                        const inCartQty = cartItemMap.get(item.id) || 0
                        const cat = categoryById.get(item.category_id)
                        return (
                          <div
                            key={item.id}
                            className={`ezo-card ${inCartQty > 0 ? 'in-cart' : ''}`}
                          >
                            <div className="ezo-img-wrapper">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="ezo-food-img"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="ezo-food-emoji">
                                  {getFoodEmoji(item.name, cat?.name)}
                                </span>
                              )}
                            </div>

                            <div className="ezo-item-name" title={item.name}>
                              {item.name}
                            </div>

                            <div className="ezo-card-footer">
                              <span className="ezo-card-price">
                                ₹{(item.price / 100).toFixed(0)}
                              </span>

                              {inCartQty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="ezo-btn-add"
                                  title="Add to order"
                                >
                                  +
                                </button>
                              ) : (
                                <div className="ezo-stepper-mini">
                                  <button
                                    type="button"
                                    onClick={() => updateQty(item.id, -1)}
                                    className="ezo-btn-minus"
                                    title="Decrease"
                                  >
                                    -
                                  </button>
                                  <span className="ezo-qty-badge">{inCartQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => addToCart(item)}
                                    className="ezo-btn-plus-mini"
                                    title="Increase"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Fixed Floating Bottom Cart Bar */}
                  {cart.length > 0 && (
                    <div
                      className="ezo-floating-cart-bar"
                      onClick={() => setMobileOrderView('cart')}
                    >
                      <div className="ezo-cart-bar-left">
                        <span className="ezo-cart-bar-badge">{totalCartQty} Items</span>
                        <span className="ezo-cart-bar-total">₹{finalTotalRupees.toFixed(2)}</span>
                      </div>
                      <div className="ezo-cart-bar-right">
                        <span>Review &amp; Pay</span>
                        <span style={{ fontSize: '1.1rem' }}>➔</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mobile Cart & Settle Screen */
                <div className="mobile-cart-view">
                  {/* Top Return Button */}
                  <button
                    type="button"
                    onClick={() => setMobileOrderView('menu')}
                    className="mobile-cart-back-btn"
                  >
                    <span>← Back to Menu (+ Add Items)</span>
                  </button>

                  <div className="cart-top-bar" style={{ padding: '0 0 0.5rem 0' }}>
                    <div className="cart-top-left">
                      <h2 className="cart-title" style={{ fontSize: '1.05rem' }}>🛒 Order Cart</h2>
                      <div className="order-no-pill">
                        <span className="order-no-label">Order #</span>
                        <span className="order-no-num">{nextOrderNo}</span>
                        <span className="auto-tag">AUTO</span>
                      </div>
                    </div>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="btn-top-clear"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Scrollable Cart Items */}
                  <div className="mobile-cart-items-scroll">
                    {cart.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                        Cart is empty. Tap Back to Menu to add items.
                      </div>
                    ) : (
                      cart.map(ci => (
                        <div key={ci.menuItemId} className="cart-item-card" style={{ margin: 0 }}>
                          <div className="cart-item-row-top">
                            <span className="cart-item-name">{ci.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFromCart(ci.menuItemId)}
                              className="cart-item-delete"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="cart-item-row-bottom">
                            <div className="cart-item-calc">
                              ₹{(ci.unitPrice / 100).toFixed(2)} × {ci.qty} = <strong>₹{(ci.lineTotal / 100).toFixed(2)}</strong>
                            </div>
                            <div className="cart-stepper-row">
                              <button
                                type="button"
                                onClick={() => updateQty(ci.menuItemId, -1)}
                                className="stepper-btn"
                              >
                                -
                              </button>
                              <span className="stepper-val">{ci.qty}</span>
                              <button
                                type="button"
                                onClick={() => updateQty(ci.menuItemId, 1)}
                                className="stepper-btn"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pinned Mobile Cart Footer */}
                  {cart.length > 0 && (
                    <div className="mobile-cart-footer">
                      {/* Discount Quick Row */}
                      {canDiscount && (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <div className="discount-presets-grid">
                            <button
                              type="button"
                              onClick={toggleRelativeOrder}
                              className={`btn-discount-relative ${isRelativeOrFree ? 'active' : ''}`}
                            >
                              👑 Relative (₹0)
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPercentPreset(10)}
                              className={`btn-discount-preset ${!isRelativeOrFree && discountType === 'percent' && discountValue === 10 ? 'active' : ''}`}
                            >
                              10%
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPercentPreset(20)}
                              className={`btn-discount-preset ${!isRelativeOrFree && discountType === 'percent' && discountValue === 20 ? 'active' : ''}`}
                            >
                              20%
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCustomDiscount(!showCustomDiscount)}
                              className={`btn-discount-preset ${showCustomDiscount ? 'active-custom' : ''}`}
                            >
                              ✏️ Other
                            </button>
                          </div>
                          {showCustomDiscount && (
                            <div className="custom-discount-panel" style={{ marginTop: '0.4rem' }}>
                              <div className="custom-inputs-row">
                                <div className="custom-val-wrapper">
                                  <span className="val-prefix">{discountType === 'percent' ? '%' : '₹'}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={discountType === 'percent' ? 100 : subtotalRupees}
                                    value={discountValue || ''}
                                    onChange={e => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                                    placeholder="0"
                                    className="custom-val-input"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={discountReason}
                                  onChange={e => setDiscountReason(e.target.value)}
                                  placeholder="Reason"
                                  className="custom-reason-input"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Total Line */}
                      <div className="cart-total-row" style={{ padding: '0.35rem 0' }}>
                        <span>Grand Total:</span>
                        <span className={`cart-total-value ${finalTotalRupees === 0 ? 'zero-total-val' : ''}`}>
                          ₹{finalTotalRupees.toFixed(2)}
                        </span>
                      </div>

                      {/* Payment Mode */}
                      <div className="payment-buttons-grid" style={{ margin: '0.4rem 0' }}>
                        {finalTotalRupees === 0 ? (
                          <div style={{ gridColumn: 'span 3', textAlign: 'center', background: '#ecfdf5', color: '#047857', padding: '0.4rem', borderRadius: '0.4rem', fontWeight: 700, fontSize: '0.85rem' }}>
                            🎁 Complimentary (₹0.00)
                          </div>
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
                              onClick={() => setPaymentMode('upi')}
                              className={`payment-btn ${paymentMode === 'upi' ? 'active' : ''}`}
                            >
                              📱 UPI
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentMode('card')}
                              className={`payment-btn ${paymentMode === 'card' ? 'active' : ''}`}
                            >
                              💳 Card
                            </button>
                          </>
                        )}
                      </div>

                      {/* Table / Customer Label */}
                      <div className="table-quick-chips" style={{ marginBottom: '0.35rem' }}>
                        {['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map(t => (
                          <button
                            key={t}
                            type="button"
                            className={`table-quick-btn ${tableLabel === t ? 'active' : ''}`}
                            onClick={() => setTableLabel(prev => prev === t ? '' : t)}
                          >{t}</button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={tableLabel}
                        onChange={e => setTableLabel(e.target.value)}
                        placeholder="Table / Name (for Dine-In, optional for Takeaway)"
                        className="table-label-input"
                        style={{ width: '100%', marginBottom: '0.4rem' }}
                        maxLength={40}
                      />

                      {/* ── 3-Action Button Row (Mobile) ────────────── */}
                      <div className="action-3btn-row">
                        <button
                          type="button"
                          disabled={cart.length === 0 || isPending}
                          onClick={handleKOT}
                          className={`btn-action-kot ${kotStatus === 'success' ? 'btn-action-success' : ''}`}
                        >
                          {kotStatus === 'pending' ? '⏳' : kotStatus === 'success' ? '✅' : '🖨️'}
                          <span>{kotStatus === 'success' ? 'Sent!' : 'KOT'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={cart.length === 0 || isPending}
                          onClick={handleDineIn}
                          className={`btn-action-hold ${dineInStatus === 'success' ? 'btn-action-success' : ''}`}
                        >
                          {dineInStatus === 'pending' ? '⏳' : dineInStatus === 'success' ? '✅' : '🍽️'}
                          <span>{dineInStatus === 'success' ? 'Added!' : 'Dine-In'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={cart.length === 0 || isPending}
                          onClick={handleCheckoutFromCart}
                          className={`btn-action-checkout ${checkoutStatus === 'success' ? 'btn-action-success' : ''} ${finalTotalRupees === 0 && cart.length > 0 ? 'btn-action-checkout-zero' : ''}`}
                        >
                          {checkoutStatus === 'pending' ? '⏳' : checkoutStatus === 'success' ? '✅' : finalTotalRupees === 0 && cart.length > 0 ? '👑' : '✅'}
                          <span>{checkoutStatus === 'success' ? 'Done!' : finalTotalRupees === 0 && cart.length > 0 ? 'Free' : 'Checkout'}</span>
                        </button>
                      </div>

                      {/* Pending Orders (mobile) */}
                      {hasPending && (
                        <div className="hold-tray-section" style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            className="hold-tray-toggle"
                            onClick={() => setShowPendingPanel(p => !p)}
                          >
                            <span>📋 Pending Orders</span>
                            <span className="hold-tray-count">{pendingOrders.length}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{showPendingPanel ? '▲' : '▼'}</span>
                          </button>

                          {showPendingPanel && (
                            <div className="hold-tray-list">
                              {/* Takeaway */}
                              {takeawayPending.length > 0 && (
                                <>
                                  <div className="pending-section-label">🏃 Takeaway</div>
                                  {takeawayPending.map(order => (
                                    <div key={order.id} className="held-order-card">
                                      <div className="held-order-header">
                                        <span className="held-order-num">#{order.order_no}</span>
                                        {order.table_label && <span className="held-order-table">📝 {order.table_label}</span>}
                                        <span className="held-order-time">
                                          {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <div className="held-order-items-preview">
                                        {order.items.slice(0, 3).map((it, i) => (
                                          <span key={i} className="held-item-chip">{it.name} ×{it.qty}</span>
                                        ))}
                                        {order.items.length > 3 && <span className="held-item-chip">+{order.items.length - 3}</span>}
                                      </div>
                                      <div className="held-order-total">₹{(order.total_amount / 100).toFixed(2)}</div>
                                      <div className="held-order-actions">
                                        <button
                                          type="button"
                                          className="btn-held-checkout"
                                          onClick={() => setCheckoutTarget({ type: 'single', orders: [order], totalAmount: order.total_amount })}
                                          disabled={isPending}
                                        >
                                          💳 Checkout
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}

                              {/* Dine-In Tables */}
                              {Object.keys(dineInByTable).length > 0 && (
                                <>
                                  <div className="pending-section-label">🍽️ Dine-In Tables</div>
                                  {Object.entries(dineInByTable).map(([table, orders]) => {
                                    const tableTotal = orders.reduce((s, o) => s + o.total_amount, 0)
                                    return (
                                      <div key={table} className="held-order-card held-order-card-table">
                                        <div className="held-order-header">
                                          <span className="held-order-num">🪑 {table}</span>
                                          <span className="held-order-table">{orders.length} round{orders.length > 1 ? 's' : ''}</span>
                                          <span className="held-order-time">
                                            {new Date(orders[0].created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        {orders.map((o, ri) => (
                                          <div key={o.id} className="dine-round-row">
                                            <span className="dine-round-label">R{ri + 1} #{o.order_no}</span>
                                            <div className="held-order-items-preview" style={{ flex: 1 }}>
                                              {o.items.slice(0, 2).map((it, i) => (
                                                <span key={i} className="held-item-chip">{it.name} ×{it.qty}</span>
                                              ))}
                                              {o.items.length > 2 && <span className="held-item-chip">+{o.items.length - 2}</span>}
                                            </div>
                                            <span className="dine-round-amt">₹{(o.total_amount / 100).toFixed(0)}</span>
                                          </div>
                                        ))}
                                        <div className="held-order-total" style={{ borderTop: '1px dashed #c7d2fe', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
                                          Grand Total: ₹{(tableTotal / 100).toFixed(2)}
                                        </div>
                                        <div className="held-order-actions">
                                          <button
                                            type="button"
                                            className="btn-held-checkout"
                                            style={{ width: '100%' }}
                                            onClick={() => setCheckoutTarget({ type: 'table', orders, tableLabel: table, totalAmount: tableTotal })}
                                            disabled={isPending}
                                          >
                                            💳 Checkout {table}
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Shared Checkout Confirmation Dialog (Desktop & Mobile) ──────────── */}
            {checkoutTarget && (
              <div className="checkout-overlay">
                <div className="checkout-dialog">
                  <div className="checkout-dialog-title">
                    {checkoutTarget.type === 'table'
                      ? `💳 Checkout — ${checkoutTarget.tableLabel}`
                      : `💳 Checkout — Order #${checkoutTarget.orders[0]?.order_no}`}
                  </div>
                  {checkoutTarget.type === 'table' && (
                    <div className="checkout-dialog-table">
                      {checkoutTarget.orders.length} round{checkoutTarget.orders.length > 1 ? 's' : ''} combined
                    </div>
                  )}
                  <div className="checkout-dialog-total">
                    Total: <strong>₹{(checkoutTarget.totalAmount / 100).toFixed(2)}</strong>
                  </div>
                  <div className="checkout-dialog-items">
                    {checkoutTarget.orders.flatMap((o, ri) =>
                      o.items.map((it, i) => (
                        <div key={`${ri}-${i}`}>
                          {checkoutTarget.type === 'table' && <span style={{ color: '#6366f1', fontSize: '0.75rem', marginRight: '0.3rem' }}>R{ri+1}</span>}
                          {it.name} ×{it.qty} — ₹{(it.lineTotal / 100).toFixed(2)}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="payment-buttons-grid" style={{ margin: '0.75rem 0' }}>
                    <button type="button" onClick={() => setPaymentMode('cash')} className={`payment-btn ${paymentMode === 'cash' ? 'active' : ''}`}>💵 Cash</button>
                    <button type="button" onClick={() => setPaymentMode('card')} className={`payment-btn ${paymentMode === 'card' ? 'active' : ''}`}>💳 Card</button>
                    <button type="button" onClick={() => setPaymentMode('upi')} className={`payment-btn ${paymentMode === 'upi' ? 'active' : ''}`}>📱 UPI</button>
                  </div>
                  <div className="checkout-dialog-btns">
                    <button type="button" className="btn-dialog-cancel" onClick={() => setCheckoutTarget(null)}>Cancel</button>
                    <button
                      type="button"
                      className="btn-dialog-confirm"
                      disabled={checkoutStatus === 'pending'}
                      onClick={handleCheckoutPending}
                    >
                      {checkoutStatus === 'pending' ? '⏳ Processing...' : '✅ Confirm & Print Receipt'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KOT SCREEN */}
        {activeTab === 'kot' && (
          <div className="kot-tab-layout">



            {/* ── Visible on-screen KOT card ── */}
            <div className="kot-ticket-card">
              <div className="kot-ticket-header">
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{restaurantName}</div>
                <h3>KITCHEN ORDER TICKET</h3>
                <div className="kot-divider" />
                <h1>ORDER #{lastOrder?.order_no ?? nextOrderNo - 1}</h1>
                <div className="kot-divider" />
              </div>

              <div className="kot-ticket-body">
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  🕐 {lastOrder?.time ?? '—'} &nbsp;·&nbsp; 👤 {cashierName}
                </div>
                {lastOrder?.notes && (
                  <div className="kot-order-tag">🏷️ {lastOrder.notes}</div>
                )}
                {lastOrder?.total === 0 && (
                  <div className="kot-complimentary-badge">★ COMPLIMENTARY / RELATIVE (₹0.00) ★</div>
                )}
                <div className="kot-items-heading">ITEMS:</div>
                <div className="kot-items-list">
                  {(!lastOrder || lastOrder.items.length === 0) ? (
                    <p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>No recent items to display</p>
                  ) : (
                    lastOrder.items.map((item, idx) => (
                      <div key={idx} className="kot-item-line">
                        <span>{item.name || 'Item'}</span>
                        <span style={{ fontWeight: 700 }}>× {item.qty}</span>
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

              <div className="kot-ticket-footer no-print">
                <button
                  type="button"
                  onClick={() => handlePrintReceipt()}
                  className="kot-print-again-btn"
                >
                  🖨️ Print KOT
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



        {/* TAB 7: PRINTER CONFIGURATION */}
        {activeTab === 'printer' && (
          <div className="printer-config-screen">
            <div className="printer-config-layout">
              {/* Left Column: Printer Configuration Form */}
              <div className="config-card-dark">
                <div className="config-card-header">
                  <span className="card-header-icon">⚙️</span>
                  <h2>Printer Configuration</h2>
                </div>

                <div className="configured-badge">
                  <span>✅</span>
                  <span>Configured: {printerSettings.printerName || 'POSIO QX300'}</span>
                </div>

                <div className="config-group">
                  <label className="config-label">Receipt Printer</label>
                  <select
                    value={printerSettings.printerName}
                    onChange={e => updatePrinterSettings({ printerName: e.target.value })}
                    className="config-select"
                  >
                    {availablePrinters.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="config-group">
                  <label className="config-label">Paper Width (characters per line)</label>
                  <select
                    value={printerSettings.paperWidth}
                    onChange={e => updatePrinterSettings({ paperWidth: Number(e.target.value) })}
                    className="config-select"
                  >
                    <option value={48}>48 chars — 80mm standard ✓ recommended</option>
                    <option value={42}>42 chars</option>
                    <option value={32}>32 chars</option>
                  </select>
                  <span className="config-hint">
                    For your {printerSettings.printerName || 'QX300'} 80mm printer, 48 chars is the recommended setting.
                  </span>
                </div>

                <div className="config-group">
                  <div className="preferences-title">Print Preferences</div>
                  <div className="preference-checkbox-row">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={printerSettings.enableKotPrint}
                        onChange={e => updatePrinterSettings({ enableKotPrint: e.target.checked })}
                      />
                      <span>Enable KOT Print</span>
                    </label>

                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={printerSettings.enableReceiptPrint}
                        onChange={e => updatePrinterSettings({ enableReceiptPrint: e.target.checked })}
                      />
                      <span>Enable Customer Bill Receipt Print</span>
                    </label>
                  </div>
                </div>

                <div className="config-buttons-row">
                  <button
                    type="button"
                    onClick={handleSavePrinterSettings}
                    className="btn-save-printer"
                  >
                    {printerSaveSuccess ? '✅ Saved!' : '💾 Save Printer'}
                  </button>

                  <button
                    type="button"
                    disabled={isLoadingPrinters}
                    onClick={refreshPrinters}
                    className="btn-refresh-printers"
                  >
                    🔄 {isLoadingPrinters ? 'Detecting...' : 'Refresh'}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={testPrintStatus === 'printing'}
                  onClick={handleSendTestPrint}
                  className="btn-send-test"
                >
                  {testPrintStatus === 'printing'
                    ? '⏳ Sending Test Print...'
                    : testPrintStatus === 'printed'
                      ? '✅ Test Print Sent to QX300!'
                      : '🖨️ Send Test Print'}
                </button>
              </div>

              {/* Right Column: Setup Guide and Test Print Preview */}
              <div className="config-sidebar-column">
                <div className="setup-guide-card">
                  <div className="config-card-header">
                    <span className="card-header-icon">📜</span>
                    <h2>How to set up</h2>
                  </div>
                  <ol className="setup-ol">
                    <li>Make sure your QX300 is connected via USB and powered on.</li>
                    <li>Click <strong>Refresh</strong> to detect all installed Windows printers.</li>
                    <li>Select <strong>{printerSettings.printerName || 'POSIO QX300'}</strong> from the dropdown.</li>
                    <li>Set paper width to <strong>48 chars</strong> for standard 80mm roll.</li>
                    <li>Click <strong>Save Printer</strong>. This setting is remembered permanently.</li>
                    <li>Click <strong>Send Test Print</strong> to confirm the printer is working.</li>
                  </ol>
                  <p className="setup-footer-note">
                    Once saved, every receipt and KOT will print directly to this printer — no browser print dialog.
                  </p>
                </div>

                <div className="test-preview-card">
                  <div className="config-card-header">
                    <span className="card-header-icon">🖨️</span>
                    <h2>Test Print Preview</h2>
                  </div>
                  <pre className="test-preview-box">{`        ** PRINT TEST **
       Chinese Nawab POS

Printer: ${printerSettings.printerName || 'POSIO QX300'}
Width: ${printerSettings.paperWidth} chars
Time: ${new Date().toLocaleTimeString('en-IN')}

------------------------------------------------
           Printer working correctly!`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Hidden Thermal Print Ticket (POSIO QX300 / 80mm ESC/POS compatible) ── */}
      <div className="print-area">
        <div className="print-ticket-wrapper">
          <div className="print-title">** KITCHEN ORDER TICKET **</div>
          <div className="print-divider">===============================</div>
          <div className="print-order-no">ORDER #{activePrintTicket?.order_no ?? nextOrderNo}</div>
          <div className="print-divider">===============================</div>
          <div className="print-meta-line">Time: {activePrintTicket?.time ?? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}</div>
          <div className="print-meta-line">By: {activePrintTicket?.cashier ?? cashierName}</div>
          {activePrintTicket?.notes && (
            <div className="print-meta-line">Note: {activePrintTicket.notes}</div>
          )}
          <div className="print-divider">-------------------------------</div>
          <div className="print-items-title">ITEMS:</div>
          <div className="print-items-list">
            {(activePrintTicket?.items && activePrintTicket.items.length > 0) ? (
              activePrintTicket.items.map((item, idx) => (
                <div key={idx} className="print-item-row">
                  <span className="print-item-name">&nbsp;&nbsp;{item.name || 'Item'}</span>
                  <span className="print-item-qty">x{item.qty}</span>
                </div>
              ))
            ) : (
              <div className="print-item-row">
                <span className="print-item-name">&nbsp;&nbsp;No items</span>
                <span className="print-item-qty">x0</span>
              </div>
            )}
          </div>
          <div className="print-divider">===============================</div>
          <div className="print-footer">** PLEASE PREPARE **</div>
        </div>
      </div>

      {/* ─── Modern Light Theme Styles ────────────── */}
      <style jsx>{`\
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
          flex: 1 1 0;
          min-height: 0;
          height: calc(100vh - 105px);
          overflow: hidden;
          padding: 0.75rem 1.25rem;
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
        }

        /* Order Screen Layout */
        .order-tab-wrapper {
          height: 100%;
          max-height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          flex: 1 1 0;
        }
        .desktop-pos-layout {
          height: 100%;
          max-height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          flex: 1 1 0;
        }
        .order-layout {
          display: grid;
          grid-template-columns: 1fr 390px;
          grid-template-rows: minmax(0, 1fr);
          gap: 1rem;
          height: 100%;
          max-height: 100%;
          min-height: 0;
          flex: 1 1 0;
          overflow: hidden;
        }
        .order-left-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1.15rem 1.15rem 0.5rem 1.15rem;
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100%;
          min-height: 0;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .panel-header-row {
          margin-bottom: 0.75rem;
          flex-shrink: 0;
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
          margin-bottom: 1rem;
          flex-shrink: 0;
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

        /* Dedicated Scroll Area for Categories and Food Items */
        .order-content-scroll {
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 0.35rem;
          -webkit-overflow-scrolling: touch;
        }
        .order-content-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .order-content-scroll::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 4px;
        }
        .order-content-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .order-content-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Categories Grid */
        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 0.85rem;
          padding-bottom: 0.75rem;
        }
        .category-tile {
          background: #ffffff;
          border: 1.5px solid #fde68a;
          border-radius: 0.65rem;
          padding: 1.15rem 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 96px;
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
          padding-bottom: 2rem;
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
          padding: 0.9rem;
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100%;
          min-height: 0;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .cart-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1.5px solid #f1f5f9;
          flex-shrink: 0;
        }
        .cart-top-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .cart-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          font-family: 'Outfit', sans-serif;
        }
        .order-no-pill {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: #fefce8;
          border: 1.5px solid #fef08a;
          padding: 0.15rem 0.5rem;
          border-radius: 0.4rem;
        }
        .order-no-label {
          font-size: 0.7rem;
          color: #854d0e;
          font-weight: 600;
        }
        .order-no-num {
          font-size: 1rem;
          font-weight: 800;
          color: #b45309;
          font-family: 'Outfit', sans-serif;
        }
        .auto-tag {
          background: #fde047;
          color: #713f12;
          padding: 0.05rem 0.3rem;
          border-radius: 0.25rem;
          font-size: 0.6rem;
          font-weight: 800;
        }
        .btn-top-clear {
          background: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fca5a5;
          border-radius: 0.35rem;
          padding: 0.2rem 0.5rem;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-top-clear:hover {
          background: #fecaca;
        }

        /* Cart Items List: Takes all vertical space, scrolls smoothly for 10-20+ items */
        .cart-items-container {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-bottom: 0.5rem;
          flex: 1 1 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 0.25rem;
        }
        .cart-items-container::-webkit-scrollbar {
          width: 5px;
        }
        .cart-items-container::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 4px;
        }
        .cart-items-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .cart-items-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .empty-cart-msg {
          text-align: center;
          color: #94a3b8;
          font-size: 0.85rem;
          padding: 2.5rem 1rem;
          background: #f8fafc;
          border: 1.5px dashed #cbd5e1;
          border-radius: 0.5rem;
          margin: auto 0;
        }
        .cart-item-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.5rem 0.65rem;
          transition: border-color 0.15s;
          flex-shrink: 0;
        }
        .cart-item-card:hover {
          border-color: #cbd5e1;
        }
        .cart-item-row-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.25rem;
          gap: 0.4rem;
        }
        .cart-item-name {
          font-weight: 700;
          font-size: 0.85rem;
          color: #0f172a;
          line-height: 1.25;
        }
        .cart-item-delete {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 0.9rem;
          cursor: pointer;
          padding: 0.1rem 0.2rem;
          border-radius: 0.25rem;
          line-height: 1;
          transition: all 0.15s;
        }
        .cart-item-delete:hover {
          color: #dc2626;
          background: #fee2e2;
        }
        .cart-item-row-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cart-item-calc {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }
        .cart-item-subtotal {
          color: #0f172a;
          font-weight: 700;
        }
        .cart-stepper-row {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .stepper-btn {
          width: 22px;
          height: 22px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.3rem;
          color: #0f172a;
          font-weight: 800;
          font-size: 0.8rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .stepper-btn:hover { background: #f1f5f9; }
        .stepper-val {
          font-size: 0.85rem;
          font-weight: 700;
          min-width: 16px;
          text-align: center;
          color: #0f172a;
        }
        .btn-complete-success {
          background: #059669 !important;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4) !important;
        }

        /* Pinned Footer at Bottom — Never overlaps items */
        .cart-footer {
          border-top: 1.5px solid #f1f5f9;
          padding-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          flex-shrink: 0;
          background: #ffffff;
        }

        /* Discount & Special Section */
        .cart-discount-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.45rem;
          padding: 0.4rem 0.55rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .discount-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .discount-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: #475569;
        }
        .btn-clear-discount {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0.05rem 0.25rem;
          border-radius: 0.2rem;
        }
        .btn-clear-discount:hover {
          background: #fee2e2;
        }
        .discount-presets-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr 1fr 1fr 1fr;
          gap: 0.25rem;
        }
        .btn-discount-relative {
          padding: 0.3rem 0.25rem;
          background: #fefce8;
          border: 1.5px solid #fde047;
          border-radius: 0.35rem;
          color: #854d0e;
          font-size: 0.68rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          text-align: center;
        }
        .btn-discount-relative:hover {
          background: #fef08a;
          border-color: #eab308;
        }
        .btn-discount-relative.active {
          background: #16a34a;
          border-color: #15803d;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);
        }
        .btn-discount-preset {
          padding: 0.3rem 0.2rem;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.35rem;
          color: #334155;
          font-size: 0.72rem;
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
          border-radius: 0.4rem;
          padding: 0.45rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-top: 0.2rem;
        }
        .custom-type-switch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.25rem;
        }
        .type-switch-btn {
          padding: 0.2rem;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 0.25rem;
          color: #475569;
          font-size: 0.7rem;
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
          gap: 0.35rem;
        }
        .custom-val-wrapper {
          position: relative;
          width: 80px;
          flex-shrink: 0;
        }
        .val-prefix {
          position: absolute;
          left: 0.4rem;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 700;
          pointer-events: none;
        }
        .custom-val-input {
          width: 100%;
          padding: 0.3rem 0.35rem 0.3rem 1.15rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.3rem;
          font-size: 0.78rem;
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
          padding: 0.3rem 0.45rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.3rem;
          font-size: 0.75rem;
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
          gap: 0.2rem;
        }
        .reason-chip {
          padding: 0.12rem 0.4rem;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 0.25rem;
          font-size: 0.65rem;
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
          gap: 0.15rem;
          font-size: 0.8rem;
          color: #64748b;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 0.35rem;
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
          gap: 0.4rem;
          background: #f0fdf4;
          border: 1.5px solid #bbf7d0;
          border-radius: 0.4rem;
          padding: 0.4rem 0.55rem;
          color: #15803d;
        }
        .banner-icon {
          font-size: 1.15rem;
        }
        .banner-text strong {
          display: block;
          font-size: 0.78rem;
          font-weight: 800;
          color: #166534;
        }
        .banner-text p {
          font-size: 0.7rem;
          color: #15803d;
          margin: 0;
        }
        .btn-complete-zero {
          background: linear-gradient(135deg, #16a34a, #059669) !important;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35) !important;
        }

        .cart-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .cart-total-value {
          color: #b45309;
          font-size: 1.35rem;
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
        .cart-print-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.45rem;
        }
        .btn-print-kot {
          padding: 0.65rem 0.5rem;
          background: #e0f2fe;
          color: #0369a1;
          border: 1.5px solid #7dd3fc;
          border-radius: 0.4rem;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
        }
        .btn-print-kot:hover {
          background: #bae6fd;
          border-color: #38bdf8;
        }
        .btn-print-kot:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-print-bill {
          padding: 0.65rem 0.5rem;
          background: #fef3c7;
          color: #92400e;
          border: 1.5px solid #fcd34d;
          border-radius: 0.4rem;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
        }
        .btn-print-bill:hover {
          background: #fde68a;
          border-color: #f59e0b;
        }
        .btn-print-bill:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
        /* Printer Designer Tab Styles */
        .printer-designer-layout {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          height: calc(100vh - 120px);
          overflow-y: auto;
          box-sizing: border-box;
        }
        .printer-preview-column {
          width: 380px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .preview-top-bar {
          display: flex;
        /* Printer Configuration Tab — Sleek Dark Theme (Matching Reference) */
        .printer-config-screen {
          padding: 2rem 1.5rem;
          width: 100%;
          min-height: calc(100vh - 120px);
          background: #0b1120;
          box-sizing: border-box;
          overflow-y: auto;
        }
        .printer-config-layout {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 1.75rem;
          max-width: 1350px;
          margin: 0 auto;
        }
        .config-card-dark {
          background: #111c30;
          border: 1px solid #1e293b;
          border-radius: 0.85rem;
          padding: 1.75rem;
          color: #f8fafc;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
        }
        .config-card-header {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-bottom: 1.25rem;
        }
        .card-header-icon {
          font-size: 1.3rem;
        }
        .config-card-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
          font-family: 'Outfit', sans-serif;
        }
        .configured-badge {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          background: #152238;
          border: 1.5px solid #eab308;
          border-left: 5px solid #eab308;
          border-radius: 0.5rem;
          padding: 0.85rem 1rem;
          font-size: 0.95rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 1.5rem;
        }
        .config-group {
          margin-bottom: 1.25rem;
        }
        .config-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 0.45rem;
        }
        .config-select {
          width: 100%;
          background: #0b1120;
          border: 1.5px solid #eab308;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 600;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .config-select:focus {
          border-color: #facc15;
          box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.2);
        }
        .config-hint {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.35rem;
        }
        .preferences-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #94a3b8;
          margin-bottom: 0.75rem;
        }
        .preference-checkbox-row {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          background: #0b1120;
          padding: 0.85rem 1rem;
          border-radius: 0.5rem;
          border: 1px solid #1e293b;
        }
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          cursor: pointer;
          font-size: 0.92rem;
          font-weight: 600;
          color: #f1f5f9;
        }
        .checkbox-item input[type="checkbox"] {
          width: 1.15rem;
          height: 1.15rem;
          accent-color: #3b82f6;
          cursor: pointer;
        }
        .config-buttons-row {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }
        .btn-save-printer {
          flex: 1;
          background: #facc15;
          color: #0f172a;
          border: none;
          padding: 0.85rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 4px 12px rgba(250, 204, 21, 0.3);
        }
        .btn-save-printer:hover {
          background: #eab308;
          transform: translateY(-1px);
        }
        .btn-refresh-printers {
          background: #334155;
          color: #ffffff;
          border: 1px solid #475569;
          padding: 0.85rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-refresh-printers:hover {
          background: #475569;
        }
        .btn-send-test {
          width: 100%;
          background: #1e293b;
          color: #ffffff;
          border: 1px solid #475569;
          padding: 0.9rem;
          border-radius: 0.5rem;
          font-weight: 800;
          font-size: 0.95rem;
          cursor: pointer;
          margin-top: 1rem;
          transition: all 0.15s;
        }
        .btn-send-test:hover {
          background: #334155;
          border-color: #64748b;
        }
        .btn-send-test:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .config-sidebar-column {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .setup-guide-card {
          background: #111c30;
          border: 1px solid #1e293b;
          border-radius: 0.85rem;
          padding: 1.5rem;
          color: #cbd5e1;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        .setup-ol {
          padding-left: 1.25rem;
          margin: 0 0 1.25rem 0;
          line-height: 1.85;
          font-size: 0.9rem;
          color: #94a3b8;
        }
        .setup-ol strong {
          color: #facc15;
        }
        .setup-footer-note {
          font-size: 0.82rem;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
          padding-top: 0.75rem;
          border-top: 1px solid #1e293b;
        }
        .test-preview-card {
          background: #111c30;
          border: 1px solid #1e293b;
          border-radius: 0.85rem;
          padding: 1.5rem;
          color: #f8fafc;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        .test-preview-box {
          background: #0b1120;
          border: 1px solid #1e293b;
          border-radius: 0.5rem;
          padding: 1rem;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.85rem;
          font-weight: 700;
          line-height: 1.4;
          color: #38bdf8;
          white-space: pre;
          margin: 0;
          overflow-x: auto;
        }

                /* ─── Desktop Order Tab Layout (Default) ─────────────────────────── */
        .order-tab-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
}
