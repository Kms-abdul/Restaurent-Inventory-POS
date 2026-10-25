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

      <style jsx>{`
        .pos-header {
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 0.75rem 1.25rem;
        }
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1400px;
          margin: 0 auto;
        }
        .header-title h1 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .header-title p {
          font-size: 0.75rem;
          color: #64748b;
          margin: 0;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .user-chip {
          text-align: right;
          font-size: 0.8rem;
          color: #334155;
        }
        .mobile-menu-btn {
          display: none;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 0.35rem 0.6rem;
          font-size: 1.1rem;
          cursor: pointer;
        }
        .nav-tabs {
          display: flex;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 0 1rem;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .nav-tabs::-webkit-scrollbar {
          display: none;
        }
        .nav-tab {
          padding: 0.65rem 1rem;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 600;
          font-size: 0.85rem;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          flex-shrink: 0;
        }
        .nav-tab.active {
          color: #d97706;
          border-bottom-color: #d97706;
          background: #fffbeb;
        }

        @media (max-width: 768px) {
          .pos-header {
            padding: 0.5rem 0.75rem;
          }
          .header-title h1 {
            font-size: 1.05rem;
          }
          .header-title p {
            display: none;
          }
          .user-chip {
            display: none;
          }
          .mobile-menu-btn {
            display: block;
          }
          .nav-tabs {
            padding: 0 0.5rem;
          }
          .nav-tab {
            padding: 0.55rem 0.75rem;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </>
  );
}

