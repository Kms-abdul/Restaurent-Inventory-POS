"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ReportsTab({ active }: { active: boolean }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchReports = async () => {
    setLoading(true);
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*), profiles(name)")
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString())
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (active) {
      fetchReports();
    }
  }, [active, date]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    let totalRevenue = 0;
    let cash = 0;
    let card = 0;
    let upi = 0;

    orders.forEach(o => {
      totalRevenue += o.total_amount;
      if (o.payment_mode === 'cash') cash += o.total_amount;
      if (o.payment_mode === 'card') card += o.total_amount;
      if (o.payment_mode === 'upi') upi += o.total_amount;
    });

    return { totalOrders, totalRevenue, cash, card, upi };
  }, [orders]);

  return (
    <div id="reportsTab" className={!active ? "hidden" : ""}>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: "0" }}>
            <label className="form-label" htmlFor="reportDate">Business date</label>
            <input 
              type="date" 
              id="reportDate" 
              className="form-input" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
            />
          </div>
          <button className="btn btn-secondary" onClick={fetchReports} type="button">Refresh</button>
        </div>
      </div>
      
      <div className="grid-4col" id="statsCards" style={{ marginBottom: "1.5rem" }}>
        <div className="card" style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Revenue</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#ffd700" }}>₹{(stats.totalRevenue / 100).toFixed(2)}</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Orders</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>{stats.totalOrders}</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Cash Sales</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#10b981" }}>₹{(stats.cash / 100).toFixed(2)}</div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "1rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Digital (UPI/Card)</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#3b82f6" }}>₹{((stats.upi + stats.card) / 100).toFixed(2)}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">📊 Orders</div>
        <div className="table-container">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155" }}>
                <th style={{ padding: "0.5rem", textAlign: "left" }}>Order No</th>
                <th style={{ padding: "0.5rem", textAlign: "left" }}>Time</th>
                <th style={{ padding: "0.5rem", textAlign: "left" }}>Payment</th>
                <th style={{ padding: "0.5rem", textAlign: "left" }}>Cashier</th>
                <th style={{ padding: "0.5rem", textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">No orders found for this date.</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: "1px solid #1e293b" }}>
                    <td style={{ padding: "0.5rem" }}>{order.order_no}</td>
                    <td style={{ padding: "0.5rem" }}>{new Date(order.created_at).toLocaleTimeString()}</td>
                    <td style={{ padding: "0.5rem", textTransform: "capitalize" }}>{order.payment_mode}</td>
                    <td style={{ padding: "0.5rem" }}>{order.profiles?.name || 'Cashier'}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600" }}>₹{(order.total_amount / 100).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
