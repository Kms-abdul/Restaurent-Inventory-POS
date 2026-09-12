"use client";

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

  // Define tab visibility based on role
  const tabs = [
    { id: "order", label: "📋 Order", requires: ["staff", "cashier", "admin"] },
    { id: "menu", label: "🍴 Menu", requires: ["staff", "cashier", "admin", "chef", "maker"] }, 
    { id: "kot", label: "🖨️ KOT", requires: ["staff", "cashier", "admin", "chef"] },
    { id: "kitchen", label: "👨‍🍳 Kitchen KDS", requires: ["staff", "chef", "maker", "admin"] },
    { id: "reports", label: "📊 Reports", requires: ["staff", "admin"] },
    { id: "staff", label: "👥 Staff", requires: ["staff", "admin"] },
    { id: "printer", label: "⚙️ Printer", requires: ["staff", "admin"] },
  ];

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
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
