"use client";

export default function ReceiptTab({ active }: { active: boolean }) {
  return (
    <div id="receiptTab" className={!active ? "hidden" : ""} style={{ textAlign: "center" }}>
      <div id="receiptContent">
        <div className="empty-state">No receipt selected.</div>
      </div>
      <div id="receiptButtons" className="hidden" style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
        <button className="btn btn-primary" id="printReceiptBtn" type="button">🖨️ Print Receipt</button>
        <button className="btn btn-secondary" id="closeReceiptBtn" type="button">Close</button>
      </div>
    </div>
  );
}
