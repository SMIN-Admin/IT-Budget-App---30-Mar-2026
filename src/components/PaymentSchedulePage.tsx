"use client";

import { useMemo, useState } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type PaymentItem = {
  id?: string;
  description?: string;
  planMonth?: string;
  budget?: number | string;
  actual?: number | null;
  status?: string;
  payingBU?: string;
  billingFreq?: string;
  businessUnit?: string;
  itemCategory?: string;
};

const PNL_BREAKUP: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Half Yearly": 6,
  Annual: 12,
  "One Time Cost": 12,
};

function parsePlanMonth(pm: string | null | undefined) {
  if (!pm) return null;
  const [m, y] = String(pm).split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y, 10);
  return { month: mi, year };
}

function getPnLBreakup(billingFreq: string | null | undefined) {
  return PNL_BREAKUP[String(billingFreq || "")] || 12;
}

function calcPnLMonths(item: PaymentItem) {
  const p = parsePlanMonth(item.planMonth);
  if (!p) return {} as Record<string, number>;

  const pnlBreakup = getPnLBreakup(item.billingFreq);
  const actualVal =
    item.actual != null && Number(item.actual) > 0 ? Number(item.actual) : null;
  const costVal =
    actualVal !== null ? actualVal : (parseFloat(String(item.budget || 0)) || 0);

  if (costVal <= 0) return {} as Record<string, number>;

  const monthly = costVal / pnlBreakup;
  const result: Record<string, number> = {};

  for (let i = 0; i < pnlBreakup; i++) {
    let mo = p.month + i;
    let yr = p.year;
    while (mo > 11) {
      mo -= 12;
      yr++;
    }
    const key = `${MONTHS[mo]}-${String(yr).slice(2)}`;
    result[key] = (result[key] || 0) + monthly;
  }

  return result;
}

function exportCSV(
  rows: Array<{
    month: string;
    payingBU: string;
    description: string;
    billingFreq: string;
    amount: number;
    basis: string;
  }>,
  filename: string
) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const headers = ["Month", "Paying BU", "Description", "Billing Frequency", "Amount", "Basis"];
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((row) =>
      [row.month, row.payingBU, row.description, row.billingFreq, row.amount, row.basis]
        .map(esc)
        .join(",")
    ),
  ];

  const csv = "\uFEFF" + lines.join("\r\n");
  const bytes = new TextEncoder().encode(csv);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);

  const a = document.createElement("a");
  a.href = "data:text/csv;base64," + btoa(bin);
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
}

function MonthDetailView({
  selectedMonth,
  schedule,
  onBack,
}: {
  selectedMonth: string;
  schedule: Array<{ mk: string; items: any[]; total: number }>;
  onBack: () => void;
}) {
  const T = { fontFamily: "'Montserrat',sans-serif" };

  const monthData = schedule.find((m) => m.mk === selectedMonth);
  if (!monthData) return null;

  return (
    <div style={T}>
      <div style={{ marginBottom: 18 }}>
        <button
          onClick={onBack}
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#cbd5f5",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 12,
            marginBottom: 10,
            fontWeight: 700,
          }}
        >
          ← Back
        </button>

        <h2 style={{ color: "#E6FFFD", fontSize: 18, fontWeight: 900, margin: "0 0 6px 0" }}>
          📂 {selectedMonth} — Payment Details
        </h2>

        <div style={{ color: "#88A0B8", fontSize: 12 }}>
          {monthData.items.length} items • Total S${monthData.total.toLocaleString()}
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          border: "1px solid rgba(94,234,212,0.12)",
          padding: "16px",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, ...T }}>
          <thead>
            <tr style={{ background: "#09131D" }}>
              {["Description", "Paying BU", "Billing", "Basis", "Amount"].map((h) => (
                <th
                  key={h}
                  style={{ padding: "10px", color: "#5EEAD4", textAlign: "left", whiteSpace: "nowrap" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {monthData.items.map((it, i) => (
              <tr key={`${selectedMonth}_${it.id}_${i}`} style={{ background: i % 2 === 0 ? "#1e293b" : "#1a2744" }}>
                <td style={{ padding: "10px", color: "#E2E8F0", fontWeight: 600 }}>
                  {it.description || "—"}
                </td>
                <td style={{ padding: "10px", color: "#94A3B8" }}>
                  {it.payingBU || "—"}
                </td>
                <td style={{ padding: "10px", color: "#94A3B8" }}>
                  {it.billingFreq || "—"}
                </td>
                <td style={{ padding: "10px" }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: it.basis === "Actual" ? "#052e16" : "#1e1b4b",
                      color: it.basis === "Actual" ? "#4ade80" : "#a5b4fc",
                      fontWeight: 700,
                    }}
                  >
                    {it.basis}
                  </span>
                </td>
                <td style={{ padding: "10px", color: "#5EEAD4", fontWeight: 700 }}>
                  S${Number(it.payAmt || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentSchedulePage({ items }: { items: PaymentItem[] }) {
  const T = { fontFamily:"'Montserrat',sans-serif" };
  const today = new Date();

  const [filterPayingBU, setFilterPayingBU] = useState("all");
  const [paymentType, setPaymentType] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const payingBUs = useMemo(() => {
    return ["all", ...[...new Set(items.map(i => i.payingBU).filter(Boolean) as string[])].sort()];
  }, [items]);

  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      keys.push(`${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`);
    }
    return keys;
  }, [today]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesPayingBU =
        filterPayingBU === "all" || (item.payingBU || "Unknown") === filterPayingBU;

      const isOneTime = item.billingFreq === "One Time Cost";
      const isRecurring = !isOneTime;

      let matchesPaymentType = true;
      if (paymentType === "one_time") matchesPaymentType = isOneTime;
      if (paymentType === "recurring") matchesPaymentType = isRecurring;

      return matchesPayingBU && matchesPaymentType;
    });
  }, [items, filterPayingBU, paymentType]);

  const schedule = useMemo(() => {
    const map: Record<string, { mk: string; items: any[]; total: number }> = {};
    monthKeys.forEach((mk) => {
      map[mk] = { mk, items: [], total: 0 };
    });

    filteredItems.forEach((item) => {
      const p = parsePlanMonth(item.planMonth);
      if (!p) return;

      const costVal =
        item.actual != null && Number(item.actual) > 0
          ? Number(item.actual)
          : (parseFloat(String(item.budget || 0)) || 0);

      if (costVal <= 0) return;

      const basis = item.actual != null && Number(item.actual) > 0 ? "Actual" : "Budget";

      if (item.billingFreq === "One Time Cost") {
        const mk = `${MONTHS[p.month]}-${String(p.year).slice(2)}`;
        if (map[mk]) {
          map[mk].items.push({
            ...item,
            payAmt: Math.round(costVal),
            basis,
          });
          map[mk].total += costVal;
        }
      } else {
        const pnl = calcPnLMonths(item);
        Object.entries(pnl).forEach(([mk, val]) => {
          if (map[mk] && val > 0) {
            map[mk].items.push({
              ...item,
              payAmt: Math.round(val),
              basis,
            });
            map[mk].total += Number(val);
          }
        });
      }
    });

    return monthKeys.map((mk) => ({
      ...map[mk],
      total: Math.round(map[mk].total),
      items: map[mk].items.sort((a, b) => b.payAmt - a.payAmt),
    }));
  }, [filteredItems, monthKeys]);

  const maxTotal = Math.max(...schedule.map((s) => s.total), 1);
  const peakMonth = schedule.reduce(
    (a, b) => (b.total > a.total ? b : a),
    schedule[0] || { total: 0, mk: "—" }
  );
  const grandTotal = schedule.reduce((s, d) => s + d.total, 0);

  const exportRows = useMemo(() => {
    const rows: Array<{
      month: string;
      payingBU: string;
      description: string;
      billingFreq: string;
      amount: number;
      basis: string;
    }> = [];

    schedule.forEach((monthBlock) => {
      monthBlock.items.forEach((item) => {
        rows.push({
          month: monthBlock.mk,
          payingBU: item.payingBU || "Unknown",
          description: item.description || "",
          billingFreq: item.billingFreq || "",
          amount: item.payAmt || 0,
          basis: item.basis || "",
        });
      });
    });

    return rows;
  }, [schedule]);

  const card = {
    background:"linear-gradient(145deg,#0F1B2B,#0C1722)",
    borderRadius:14,
    border:"1px solid rgba(94,234,212,0.12)",
    padding:"20px 22px",
    marginBottom:16
  };

  const selStyle = {
    background:"#09131D",
    border:"1px solid #213547",
    borderRadius:8,
    color:"#f1f5f9",
    padding:"6px 12px",
    fontSize:12,
    ...T
  };

  return (
    <div style={T}>
      {selectedMonth ? (
        <MonthDetailView
          selectedMonth={selectedMonth}
          schedule={schedule}
          onBack={() => setSelectedMonth(null)}
        />
      ) : (
        <>
          <div style={{ marginBottom:18 }}>
            <h2 style={{ color:"#E6FFFD", fontSize:18, fontWeight:900, margin:"0 0 14px 0" }}>
              📅 Payment Schedule — Next 12 Months
            </h2>

            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <span style={{ color:"#9FB3C8", fontSize:12, fontWeight:700 }}>Paying BU:</span>
              <select
                value={filterPayingBU}
                onChange={(e) => setFilterPayingBU(e.target.value)}
                style={selStyle}
              >
                <option value="all">All Paying BUs</option>
                {payingBUs.filter((b) => b !== "all").map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <span style={{ color:"#9FB3C8", fontSize:12, fontWeight:700 }}>Payment Type:</span>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                style={selStyle}
              >
                <option value="all">All</option>
                <option value="one_time">One Time</option>
                <option value="recurring">Recurring</option>
              </select>

              <div
                style={{
                  background:"rgba(245,158,11,0.15)",
                  border:"1px solid rgba(245,158,11,0.4)",
                  borderRadius:8,
                  padding:"5px 14px",
                  color:"#f59e0b",
                  fontSize:12,
                  fontWeight:700
                }}
              >
                Peak: {peakMonth?.mk} · S${peakMonth?.total.toLocaleString()}
              </div>

              <div style={{ color:"#88A0B8", fontSize:12 }}>
                Items: <strong style={{ color:"#5EEAD4" }}>{filteredItems.length}</strong>
              </div>

              <div style={{ marginLeft:"auto", color:"#88A0B8", fontSize:12 }}>
                Total: <strong style={{ color:"#5EEAD4" }}>S${grandTotal.toLocaleString()}</strong>
              </div>

              <button
                onClick={() => {
                  const ts = new Date().toISOString().slice(0,10);
                  exportCSV(exportRows, `Payment_Schedule_${ts}.csv`);
                }}
                style={{
                  background:"linear-gradient(135deg,#1a3a2a,#0f2a1a)",
                  border:"1px solid rgba(94,234,212,0.35)",
                  borderRadius:8,
                  color:"#5EEAD4",
                  padding:"6px 14px",
                  cursor:"pointer",
                  fontWeight:700,
                  fontSize:12,
                  ...T
                }}
              >
                ⬇ Export CSV
              </button>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {schedule.map(({ mk, items: mItems, total }) => {
              const isPeak = mk === peakMonth?.mk;
              const intensity = total / maxTotal;

              return (
                <div
                  key={mk}
                  onClick={() => setSelectedMonth(mk)}
                  style={{
                    ...card,
                    marginBottom:0,
                    border:`1px solid ${isPeak ? "rgba(245,158,11,0.5)" : "rgba(94,234,212,0.12)"}`,
                    padding:"14px 16px",
                    cursor:"pointer",
                    transition:"all 0.2s ease"
                  }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ color:isPeak ? "#f59e0b" : "#5EEAD4", fontWeight:800, fontSize:13 }}>
                      {mk}{isPeak ? " 🔴 Peak" : ""}
                    </span>
                    <span style={{ color:"#f1f5f9", fontWeight:900, fontSize:14 }}>
                      S${total.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ height:4, background:"#1e293b", borderRadius:2, marginBottom:10 }}>
                    <div
                      style={{
                        height:"100%",
                        width:`${Math.round(intensity * 100)}%`,
                        background:intensity > 0.8 ? "#ef4444" : intensity > 0.5 ? "#f59e0b" : "#5EEAD4",
                        borderRadius:2
                      }}
                    />
                  </div>

                  {mItems.slice(0, 6).map((it) => (
                    <div key={`${mk}_${it.id}_${it.description}`} style={{ marginBottom:6 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                        <span
                          style={{
                            color:"#9FB3C8",
                            fontSize:11,
                            overflow:"hidden",
                            textOverflow:"ellipsis",
                            whiteSpace:"nowrap",
                            maxWidth:160
                          }}
                        >
                          {it.description}
                        </span>
                        <span style={{ color:"#5EEAD4", fontSize:11, fontWeight:600 }}>
                          S${it.payAmt.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
                        <span style={{ color:"#475569", fontSize:10 }}>
                          {it.payingBU || "Unknown"} · {it.billingFreq || "N/A"}
                        </span>
                        <span
                          style={{
                            fontSize:10,
                            padding:"1px 6px",
                            borderRadius:999,
                            background: it.basis === "Actual" ? "#052e16" : "#1e1b4b",
                            color: it.basis === "Actual" ? "#4ade80" : "#a5b4fc",
                            fontWeight:700
                          }}
                        >
                          {it.basis}
                        </span>
                      </div>
                    </div>
                  ))}

                  {mItems.length > 6 && (
                    <div style={{ color:"#374151", fontSize:11, marginTop:3 }}>
                      +{mItems.length - 6} more items
                    </div>
                  )}

                  <div style={{ color:"#64748b", fontSize:10, marginTop:8 }}>
                    Click to view line items
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default PaymentSchedulePage;
