"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function StaffTab({ active }: { active: boolean }) {
  const [staffList, setStaffList] = useState<any[]>([]);
  
  const [name, setName] = useState("");
  const [role, setRole] = useState("cashier");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const fetchStaff = async () => {
    const { data } = await supabase.from("profiles").select("*").order("name");
    if (data) setStaffList(data);
  };

  useEffect(() => {
    if (active) {
      fetchStaff();
    }
  }, [active]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // In a real application, you'd use a Supabase Edge Function with the service role
    // key to create users so that a manager can create a cashier.
    // For this demonstration, we'll try to sign them up directly.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").update({ name, role }).eq("id", data.user.id);
      setName("");
      setEmail("");
      setPassword("");
      alert("Staff added successfully!");
      fetchStaff();
    }
    
    setLoading(false);
  };

  return (
    <div id="staffTab" className={`grid-2col ${!active ? 'hidden' : ''}`}>
      <div>
        <div className="card">
          <div className="card-header">👤 Add Staff</div>
          <form id="staffForm" onSubmit={handleAddStaff}>
            <div className="form-group">
              <label className="form-label" htmlFor="staffName">Name</label>
              <input className="form-input" id="staffName" maxLength={40} value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="staffEmail">Email</label>
              <input className="form-input" id="staffEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="staffRole">Role</label>
              <select className="form-select" id="staffRole" value={role} onChange={e => setRole(e.target.value)}>
                <option value="cashier">Cashier — take orders</option>
                <option value="admin">Admin — full access</option>
                <option value="chef">Chef — Kitchen Dashboard (Cook)</option>
                <option value="maker">Maker — Kitchen Dashboard (Pack)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="staffPassword">Temporary Password</label>
              <input className="form-input" id="staffPassword" type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div className="field-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add staff member"}
            </button>
          </form>
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-header">👥 Staff</div>
          <div id="staffList">
            {staffList.map(staff => (
              <div key={staff.id} style={{ background: "#1e293b", border: "1px solid #475569", borderRadius: "0.375rem", padding: "0.75rem", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{staff.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "capitalize" }}>{staff.role}</div>
                </div>
              </div>
            ))}
            {staffList.length === 0 && <div className="empty-state">No staff members found.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
