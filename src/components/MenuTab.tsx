"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function MenuTab({ active }: { active: boolean }) {
  const [menu, setMenu] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemPrice, setItemPrice] = useState("");

  const supabase = createClient();

  const fetchMenu = async () => {
    const { data } = await supabase.from("menu_items").select("*").order("category").order("name");
    if (data) {
      setMenu(data);
      const uniqueCats = Array.from(new Set(data.map(i => i.category))).sort();
      setCategories(uniqueCats);
    }
  };

  useEffect(() => {
    if (active) {
      fetchMenu();
    }
  }, [active]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!itemName || !itemCategory || !itemPrice) {
      setError("All fields are required");
      setLoading(false);
      return;
    }

    const pricePaise = Math.round(parseFloat(itemPrice) * 100);

    const { error: insertError } = await supabase.from("menu_items").insert({
      name: itemName,
      category: itemCategory,
      price: pricePaise,
      is_active: true
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setItemName("");
      setItemCategory("");
      setItemPrice("");
      fetchMenu();
    }
    setLoading(false);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from("menu_items").update({ is_active: !currentStatus }).eq("id", id);
    fetchMenu();
  };

  return (
    <div id="menuTab" className={`grid-2col ${!active ? 'hidden' : ''}`}>
      <div>
        <div className="card">
          <div className="card-header">➕ Add New Item</div>
          <form id="menuForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="itemName">Item Name</label>
              <input 
                type="text" 
                id="itemName" 
                className="form-input" 
                placeholder="Item Name"
                maxLength={80} 
                value={itemName}
                onChange={e => setItemName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="itemCategory">Category</label>
              <input 
                type="text" 
                id="itemCategory" 
                className="form-input" 
                placeholder="Category"
                list="categoryList" 
                maxLength={40} 
                value={itemCategory}
                onChange={e => setItemCategory(e.target.value)}
              />
              <datalist id="categoryList">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Pricing (₹)</label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <div style={{ flex: "1" }}>
                  <input 
                    type="number" 
                    id="itemPrice" 
                    className="form-input"
                    placeholder="Price" 
                    min="0.01" 
                    step="0.01" 
                    required 
                    value={itemPrice}
                    onChange={e => setItemPrice(e.target.value)}
                  />
                </div>
              </div>
            </div>
            {error && <div className="field-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Item'}
            </button>
          </form>
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-header">📝 Menu Items</div>
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {menu.length === 0 ? (
              <div className="empty-state">No items found</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>Name</th>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>Category</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Price</th>
                    <th style={{ padding: "0.5rem", textAlign: "center" }}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {menu.map(item => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #1e293b", opacity: item.is_active ? 1 : 0.5 }}>
                      <td style={{ padding: "0.5rem" }}>{item.name}</td>
                      <td style={{ padding: "0.5rem" }}>{item.category}</td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>₹{(item.price / 100).toFixed(2)}</td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          checked={item.is_active} 
                          onChange={() => toggleActive(item.id, item.is_active)} 
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
