"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function KOTTab({ active }: { active: boolean }) {
  const [kots, setKots] = useState<any[]>([]);

  const supabase = createClient();

  const fetchKots = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (data) setKots(data);
  };

  useEffect(() => {
    if (active) fetchKots();
  }, [active]);

  return (
    <div id="kotTab" className={!active ? "hidden" : ""} style={{ textAlign: "center" }}>
      <div id="kotContent">
        {kots.length === 0 ? (
          <div className="empty-state">👁️ No KOT history. Generate one from the Order tab.</div>
        ) : (
          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {kots.map(order => (
              <div key={order.id} style={{ background: "#f8fafc", color: "#0f172a", padding: "1rem", borderRadius: "0.5rem", textAlign: "left" }}>
                <div style={{ borderBottom: "2px solid black", paddingBottom: "1rem", marginBottom: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>KITCHEN ORDER TICKET</div>
                  <div>─────────────────────────</div>
                </div>
                <div style={{ textAlign: "center", borderBottom: "1px solid black", paddingBottom: "1rem", marginBottom: "1rem" }}>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.1 }}>
                    ORDER #{order.order_no}
                  </div>
                  {order.table_number && <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>Table: {order.table_number}</div>}
                </div>
                <div style={{ paddingBottom: "1rem" }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>ITEMS:</div>
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} style={{ fontSize: "1.1rem", marginTop: "0.25rem" }}>
                      • {item.item_name_at_sale || item.item_name || item.name || 'Item'} x {item.qty || 1}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
                  <button className="btn btn-secondary" style={{ fontSize: "1rem", padding: "0.5rem 1rem", width: "100%", color: "#0f172a", border: "1px solid #94a3b8" }}>
                    🖨️ Print Again
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
