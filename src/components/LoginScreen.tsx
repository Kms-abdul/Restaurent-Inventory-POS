"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Fetch the custom profile role
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
        
      onLogin({ ...data.user, profile });
    }
  };

  return (
    <div className="login-overlay" id="loginOverlay">
      <form className="login-card" onSubmit={handleLogin}>
        <h2>🍽️ Chinese Nawab</h2>
        <div className="sub">Sign in to start taking orders</div>
        
        <div className="form-group">
          <label className="form-label" htmlFor="loginEmail">Email</label>
          <input
            className="form-input"
            id="loginEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label" htmlFor="loginPassword">Password</label>
          <input
            className="form-input"
            id="loginPassword"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        
        {error && <div className="field-error">{error}</div>}
        
        <button 
          className="btn btn-primary" 
          style={{ width: "100%", marginTop: "1rem" }} 
          type="submit" 
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
