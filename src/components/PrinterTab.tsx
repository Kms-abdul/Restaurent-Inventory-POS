"use client";

import { useState } from "react";

export default function PrinterTab({ active }: { active: boolean }) {
  const [printerStatus, setPrinterStatus] = useState("Local Printer Agent Not Detected. Please run the Print Agent.");

  return (
    <div id="printerTab" className={!active ? "hidden" : ""}>
      <div className="grid-2col">
        <div>
          <div className="card">
            <div className="card-header">⚙️ Printer Configuration</div>

            <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "#1e293b", borderRadius: "0.5rem", borderLeft: "4px solid #ffd700", fontSize: "0.875rem" }} id="printerStatus">
              {printerStatus}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="printerSelect">Receipt Printer</label>
              <select className="form-select" id="printerSelect" disabled>
                <option value="">Searching for agent...</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="printerWidth">Paper Width (characters per line)</label>
              <select className="form-select" id="printerWidth" defaultValue="48">
                <option value="32">32 chars — 58mm narrow roll</option>
                <option value="40">40 chars — 80mm compact</option>
                <option value="48">48 chars — 80mm standard ✓ recommended</option>
                <option value="56">56 chars — 80mm wide</option>
              </select>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                For your QX300 80mm printer, 48 chars is the recommended setting.
              </div>
            </div>

            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label">Print Preferences</label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.5rem" }}>
                <input type="checkbox" id="enableKotPrint" style={{ width: "1.2rem", height: "1.2rem" }} defaultChecked />
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Enable KOT Print</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" id="enableReceiptPrint" style={{ width: "1.2rem", height: "1.2rem" }} defaultChecked />
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Enable Customer Bill Receipt Print</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <button className="btn btn-primary" type="button" style={{ flex: 1 }}>💾 Save Printer</button>
              <button className="btn btn-secondary" type="button">🔄 Refresh</button>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <button className="btn btn-warning" type="button" style={{ width: "100%" }}>🖨️ Send Test Print</button>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header">📋 How to set up</div>
            <div style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: 1.7 }}>
              <p style={{ marginBottom: "0.75rem" }}>1. Make sure your QX300 is connected via USB and powered on.</p>
              <p style={{ marginBottom: "0.75rem" }}>2. Ensure the Node.js Print Agent is running on the POS terminal.</p>
              <p style={{ marginBottom: "0.75rem" }}>3. Click <strong style={{ color: "#ffd700" }}>Refresh</strong> to detect all installed Windows printers.</p>
              <p style={{ marginBottom: "0.75rem" }}>4. Select <strong style={{ color: "#ffd700" }}>QX300 Windows Printer</strong> from the dropdown.</p>
              <p style={{ marginBottom: "0.75rem" }}>5. Set paper width to <strong style={{ color: "#ffd700" }}>48 chars</strong> for standard 80mm roll.</p>
              <p style={{ marginBottom: "0.75rem" }}>6. Click <strong style={{ color: "#ffd700" }}>Save Printer</strong>. This setting is remembered permanently.</p>
              <p style={{ marginBottom: "0.75rem" }}>7. Click <strong style={{ color: "#ffd700" }}>Send Test Print</strong> to confirm the printer is working.</p>
              <hr style={{ borderColor: "#334155", margin: "1rem 0" }} />
              <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                Once saved, every receipt and KOT will print directly to this printer — no browser print dialog.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
