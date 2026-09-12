"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function KitchenTab({ active }: { active: boolean }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("fulfillment", ["pending", "cooking"])
      .order("created_at", { ascending: true });
    
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (active) {
      fetchOrders();
      
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
          },
          (payload) => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [active]);

  const updateFulfillment = async (id: string, status: string) => {
    await supabase.from("orders").update({ fulfillment: status }).eq("id", id);
  };

  const pendingOrders = orders.filter(o => o.fulfillment === 'pending');
  const cookingOrders = orders.filter(o => o.fulfillment === 'cooking');

  return (
    <div id="kitchenTab" className={`flex flex-col ${!active ? 'hidden' : ''}`} style={{ height: "calc(100vh - 230px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexShrink: "0" }}>
        <h2>👨‍🍳 Kitchen Display System</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#334155", padding: "0.5rem 1rem", borderRadius: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" id="kitchenAutoPrint" style={{ width: "1.2rem", height: "1.2rem" }} />
            <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>Auto-Print KOTs</span>
          </label>
          <button className="btn btn-secondary" onClick={fetchOrders} type="button">🔄 Refresh</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", flex: "1", minHeight: "0" }}>
        {/* Chef View */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "0", overflow: "hidden" }}>
          <div className="card-header" style={{ background: "#b91c1c", margin: "0", padding: "1rem", flexShrink: "0" }}>
            🔥 Chef View: To Cook ({pendingOrders.length})
          </div>
          <div style={{ padding: "1rem", overflowY: "auto", flex: "1" }}>
            {pendingOrders.map(order => (
              <div key={order.id} style={{ background: "#1e293b", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1rem", borderLeft: "4px solid #f87171" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>Order #{order.order_no}</span>
                  <span style={{ color: "#94a3b8" }}>{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                {order.table_number && <div style={{ color: "#fbbf24", marginBottom: "0.5rem" }}>Table: {order.table_number}</div>}
                
                <div style={{ marginTop: "1rem" }}>
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                      • {item.item_name_at_sale || item.item_name || item.name || 'Item'} x {item.qty || 1}
                    </div>
                  ))}
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: "100%", marginTop: "1rem" }}
                  onClick={() => updateFulfillment(order.id, 'cooking')}
                >
                  Cooked (Send to Packer)
                </button>
              </div>
            ))}
            {pendingOrders.length === 0 && <div className="empty-state">No pending orders</div>}
          </div>
        </div>

        {/* Packer View */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "0", overflow: "hidden" }}>
          <div className="card-header" style={{ background: "#2563eb", margin: "0", padding: "1rem", flexShrink: "0" }}>
            📦 Packer View: To Pack ({cookingOrders.length})
          </div>
          <div style={{ padding: "1rem", overflowY: "auto", flex: "1" }}>
            {cookingOrders.map(order => (
              <div key={order.id} style={{ background: "#1e293b", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1rem", borderLeft: "4px solid #60a5fa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>Order #{order.order_no}</span>
                  <span style={{ color: "#94a3b8" }}>{new Date(order.created_at).toLocaleTimeString()}</span>
                </div>
                {order.table_number && <div style={{ color: "#fbbf24", marginBottom: "0.5rem" }}>Table: {order.table_number}</div>}
                
                <div style={{ marginTop: "1rem" }}>
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                      • {item.item_name_at_sale || item.item_name || item.name || 'Item'} x {item.qty || 1}
                    </div>
                  ))}
                </div>
                
                <button 
                  className="btn btn-success" 
                  style={{ width: "100%", marginTop: "1rem" }}
                  onClick={() => updateFulfillment(order.id, 'packed')}
                >
                  Mark Packed / Ready
                </button>
              </div>
            ))}
            {cookingOrders.length === 0 && <div className="empty-state">No orders to pack</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
