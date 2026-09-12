"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function OrderTab({ active }: { active: boolean }) {
  const [menu, setMenu] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [isManualNumber, setIsManualNumber] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchMenu = async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("is_active", true);
      if (data) setMenu(data);
    };
    if (active) {
      fetchMenu();
    }
  }, [active]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menu) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return Array.from(counts.keys()).sort((a, b) => a.localeCompare(b)).map(cat => ({
      name: cat,
      count: counts.get(cat)
    }));
  }, [menu]);

  const displayedItems = useMemo(() => {
    if (searchQuery) {
      return menu.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.category.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (activeCategory) {
      return menu.filter(i => i.category === activeCategory);
    }
    return [];
  }, [menu, searchQuery, activeCategory]);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const completeBilling = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    
    // Idempotency key per cart submission attempt
    const clientRef = `till-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    const itemsPayload = cart.map(item => ({
      menu_item_id: item.id,
      item_name: item.name,
      category: item.category,
      unit_price: item.price,
      qty: item.qty,
      line_total: item.price * item.qty
    }));

    const { data, error } = await supabase.rpc('create_pos_order', {
      p_client_ref: clientRef,
      p_table_number: orderNumber || null,
      p_payment_mode: paymentMode,
      p_total_amount: cartTotal,
      p_terminal_id: 'web-pos',
      p_items: itemsPayload
    });

    if (error) {
      console.error("Order failed", error);
      alert("Order failed: " + error.message);
    } else {
      // Clear cart on success
      setCart([]);
      setOrderNumber('');
      setIsManualNumber(false);
      alert("Order created successfully! (ID: " + data + ")");
    }
    setIsSubmitting(false);
  };

  return (
    <div id="orderTab" className={`grid-2col ${!active ? 'hidden' : ''}`}>
      <div>
        <div className="card">
          <div className="card-header" id="browseHeader">
            <button 
              className={`crumb-back ${!activeCategory ? 'hidden' : ''}`} 
              onClick={() => setActiveCategory(null)}
              type="button"
              aria-label="Back to categories">←</button>
            <span id="browseTitle">
              {searchQuery ? `🔍 ${displayedItems.length} results` : (activeCategory || "📋 Categories")}
            </span>
          </div>
          <div className="form-group">
            <input 
              className="form-input" 
              placeholder="Search all items…"
              autoComplete="off" 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveCategory(null); }}
            />
          </div>
          
          {/* Categories Grid */}
          {!searchQuery && !activeCategory && (
            <div className="menu-grid">
              {categories.map(cat => (
                <div key={cat.name} className="category-item" role="button" onClick={() => setActiveCategory(cat.name)}>
                  <div className="category-name">{cat.name}</div>
                  <div className="category-count">{cat.count} item{cat.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
              {categories.length === 0 && <div className="empty-state">No menu items yet.</div>}
            </div>
          )}

          {/* Items Grid */}
          {(searchQuery || activeCategory) && (
            <div className="menu-grid">
              {displayedItems.map(item => (
                <div key={item.id} className="menu-item" role="button" onClick={() => addToCart(item)}>
                  <div className="menu-item-name">{item.name}</div>
                  <div className="menu-item-category">{item.category}</div>
                  <div className="menu-item-footer">
                    <div className="menu-item-price">₹{(item.price / 100).toFixed(2)}</div>
                    <button className="menu-item-btn" type="button">+</button>
                  </div>
                </div>
              ))}
              {displayedItems.length === 0 && <div className="empty-state">No items found.</div>}
            </div>
          )}
        </div>
      </div>
      
      <div>
        <div className="card">
          <div className="card-header">🛒 Current Order</div>
          <div className="form-group">
            <label className="form-label" htmlFor="orderNumber">
              Table / Order No.
              <span className={`onb-badge ${isManualNumber ? 'manual' : ''}`}>
                {isManualNumber ? 'manual' : 'auto'}
              </span>
            </label>
            <div className="order-number-row">
              <input 
                type="text" 
                className="form-input order-number-input"
                placeholder="…" 
                maxLength={16} 
                autoComplete="off" 
                value={orderNumber}
                onChange={e => { setOrderNumber(e.target.value); setIsManualNumber(true); }}
              />
              <button 
                className={`btn btn-secondary onb-reset ${!isManualNumber ? 'hidden' : ''}`}
                onClick={() => { setOrderNumber(''); setIsManualNumber(false); }}
                type="button" title="Back to the automatic number">↺</button>
            </div>
          </div>
          
          <div className="cart-items-list">
            {cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '0.25rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>₹{(item.price / 100).toFixed(2)} × {item.qty}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ color: '#ffd700', fontWeight: 700 }}>₹{((item.price * item.qty) / 100).toFixed(2)}</div>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => removeFromCart(item.id)}>×</button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <div className="empty-state">Cart is empty.</div>}
          </div>
          
          <div className={cart.length === 0 ? "hidden" : ""}>
            <div className="billing-section">
              <div className="billing-total">
                <span>Total:</span>
                <span className="amount">₹{(cartTotal / 100).toFixed(2)}</span>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label">Payment mode</label>
              <div className="payment-modes">
                {['cash', 'card', 'upi'].map(mode => (
                  <button 
                    key={mode}
                    className={`pay-btn ${paymentMode === mode ? 'selected' : ''}`} 
                    onClick={() => setPaymentMode(mode)}
                    type="button"
                  >
                    {mode === 'cash' ? '💵 Cash' : mode === 'card' ? '💳 Card' : '📱 UPI'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="button-group" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button className="btn btn-warning" type="button" disabled={cart.length === 0}>🖨️ Print Receipt</button>
            <button className="btn btn-success" type="button" disabled={cart.length === 0 || isSubmitting} onClick={completeBilling}>
              {isSubmitting ? 'Processing...' : '💰 Complete Billing'}
            </button>
            <button className="btn btn-secondary" type="button" disabled={cart.length === 0} onClick={() => setCart([])}>Clear order</button>
          </div>
        </div>
      </div>
    </div>
  );
}
