"use client";

import { useState } from "react";

export default function TopNavigation({
  user,
  activeTab,
  setActiveTab,
  onLogout
}: {
  user: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}) {
  const role = user?.profile?.role || "staff";
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const tabs = [
    { id: "order",   label: "📋 Order",       requires: ["staff", "cashier", "admin"] },
    { id: "menu",    label: "🍴 Menu",         requires: ["staff", "cashier", "admin", "chef", "maker"] },
    { id: "kot",     label: "🖨️ KOT",         requires: ["staff", "cashier", "admin", "chef"] },
    { id: "kitchen", label: "👨‍🍳 Kitchen KDS", requires: ["staff", "chef", "maker", "admin"] },
    { id: "reports", label: "📊 Reports",      requires: ["staff", "admin"] },
    { id: "staff",   label: "👥 Staff",        requires: ["staff", "admin"] },
    { id: "printer", label: "⚙️ Printer",      requires: ["staff", "admin"] },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === activeTab) return;
    setPendingTab(tabId);
    // Small delay to show spinner before tab content renders
    setTimeout(() => {
      setActiveTab(tabId);
      setPendingTab(null);
    }, 80);
  };

  return (
    <>
      <header className="pos-header">
        <div className="header-content">
          <div className="header-title">
            <h1>🍽️ Chinese Nawab</h1>
            <p>Point of Sale Management System</p>
          </div>
          <div className="header-right">
            <div className="user-chip" id="userChip">
              <strong>{user?.profile?.name || user?.email}</strong><br />
              <span className="capitalize">{role}</span>
            </div>
            <button className="btn btn-secondary" onClick={onLogout} type="button">
              Sign out
            </button>
            <button className="mobile-menu-btn" type="button">☰</button>
          </div>
        </div>
      </header>

      <nav className="nav-tabs">
        {tabs.map((tab) => {
          if (!tab.requires.includes(role)) return null;
          const isPending = pendingTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""} ${isPending ? "nav-tab-pending" : ""}`}
              onClick={() => handleTabClick(tab.id)}
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {isPending && (
                <span style={{
                  display: 'inline-block',
                  width: '0.7rem',
                  height: '0.7rem',
                  border: '1.5px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  opacity: 0.7,
                  flexShrink: 0,
                }} />
              )}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}

