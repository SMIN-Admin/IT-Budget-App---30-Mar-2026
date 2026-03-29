"use client";

import { useMemo, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parsePlanMonth(pm: string | null | undefined) {
  if (!pm) return null;
  const [m, y] = String(pm).split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y, 10);
  return { month: mi, year };
}

function exportCSV(
  rows: Array<{
    month: string;
    payingBU: string;
    committed: number;
    pending: number;
    total: number;
    cumulative: number;
  }>,
  filename: string
) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const headers = ["Month", "Paying BU", "Committed", "Pending", "Total", "Cumulative"];
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((row) =>
      [row.month, row.payingBU, row.committed, row.pending, row.total, row.cumulative]
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

type CashItem = {
  id?: string;
  planMonth?: string;
  budget?: number | string;
  actual?: number | null;
  status?: string;
  payingBU?: string;
};

function CashFlowForecast({ items }: { items: CashItem[] }) {
  const T = { fontFamily: "'Montserrat',sans-serif" };

  const [months, setMonths] = useState(12);
  const [cashType, setCashType] = useState("all");
  const [selectedPayingBU, setSelectedPayingBU] = useState("all");

  const payingBUOptions = useMemo(() => {
    return [
      "all",
      ...[...new Set(items.map((i) => i.payingBU).filter(Boolean) as string[])].sort(),
    ];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesPayingBU =
        selectedPayingBU === "all" || (item.payingBU || "Unknown") === selectedPayingBU;

      const hasActual = item.actual != null && Number(item.actual) > 0;
      const isBlankStatus = !item.status || item.status === "";
      const isCancelled = item.status === "Cancel" || item.status === "Cancelled";

      let matchesCashType = true;
      if (cashType === "committed") {
        matchesCashType = hasActual;
      } else if (cashType === "pending") {
        matchesCashType = !hasActual && !isCancelled && isBlankStatus;
      }

      return matchesPayingBU && matchesCashType;
    });
  }, [items, selectedPayingBU, cashType]);

  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      keys.push(`${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`);
    }
    return keys;
  }, [months, today]);

  const data = useMemo(() => {
    return monthKeys.map((mk) => {
      let committed = 0;
      let pending = 0;

      filteredItems.forEach((item) => {
        const hasActual = item.actual != null && Number(item.actual) > 0;
        const isBlankStatus = !item.status || item.status === "";
        const isCancelled = item.status === "Cancel" || item.status === "Cancelled";

        const p = parsePlanMonth(item.planMonth);
        if (!p) return;

        const itemDate = new Date(p.year, p.month, 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
        if (itemDate < startDate || itemDate >= endDate) return;

        const itemMk = `${MONTHS[p.month]}-${String(p.year).slice(2)}`;
        if (itemMk !== mk) return;

        const budgetAmt = parseFloat(String(item.budget || 0)) || 0;
        const actualAmt = Number(item.actual) || 0;

        if (hasActual) {
          if (cashType === "all" || cashType === "committed") {
            committed += actualAmt;
          }
        } else if (!isCancelled && isBlankStatus) {
          if (cashType === "all" || cashType === "pending") {
            pending += budgetAmt;
          }
        }
      });

      return {
        mk,
        committed: Math.round(committed),
        pending: Math.round(pending),
        total: Math.round(committed + pending),
      };
    });
  }, [filteredItems, monthKeys, months, today, startDate, cashType]);

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  let cumulativeRunning = 0;
  const dataWithCum = data.map((d) => {
    cumulativeRunning += d.total;
    return { ...d, cumulative: cumulativeRunning };
  });

  const summaryByPayingBU = useMemo(() => {
    const map: Record<
      string,
      { name: string; committed: number; pending: number; total: number }
    > = {};

    filteredItems.forEach((item) => {
      const key = item.payingBU || "Unknown";
      if (!map[key]) {
        map[key] = { name: key, committed: 0, pending: 0, total: 0 };
      }

      const hasActual = item.actual != null && Number(item.actual) > 0;
      const isBlankStatus = !item.status || item.status === "";
      const isCancelled = item.status === "Cancel" || item.status === "Cancelled";

      const p = parsePlanMonth(item.planMonth);
      if (!p) return;

      const itemDate = new Date(p.year, p.month, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + months, 1);
      if (itemDate < startDate || itemDate >= endDate) return;

      const budgetAmt = parseFloat(String(item.budget || 0)) || 0;
      const actualAmt = Number(item.actual) || 0;

      if (hasActual) {
        if (cashType === "all" || cashType === "committed") {
          map[key].committed += actualAmt;
        }
      } else if (!isCancelled && isBlankStatus) {
        if (cashType === "all" || cashType === "pending") {
          map[key].pending += budgetAmt;
        }
      }
    });

    return Object.values(map)
      .map((row) => ({
        ...row,
        committed: Math.round(row.committed),
        pending: Math.round(row.pending),
        total: Math.round(row.committed + row.pending),
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredItems, cashType, months, today, startDate]);

  const totalCommitted = data.reduce((s, d) => s + d.committed, 0);
  const totalPending = data.reduce((s, d) => s + d.pending, 0);
  const totalForecast = data.reduce((s, d) => s + d.total, 0);
  const peakMonth = data.reduce(
    (a, b) => (b.total > a.total ? b : a),
    data[0] || { total: 0, mk: "—" }
  );

  const card = {
    background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
    borderRadius: 14,
    border: "1px solid rgba(94,234,212,0.12)",
    padding: "20px 22px",
    marginBottom: 16,
  };

  const cashTypeLabel =
    cashType === "all"
      ? "All Cash Flow"
      : cashType === "committed"
        ? "Committed Only"
        : "Pending Only";

  return (
    <div style={T}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ color: "#E6FFFD", fontSize: 18, fontWeight: 900, margin: "0 0 14px 0" }}>
          💸 12-Month Rolling Cash Flow Forecast
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={cashType}
            onChange={(e) => setCashType(e.target.value)}
            style={{
              background: "#09131D",
              border: "1px solid #5EEAD4",
              borderRadius: 8,
              color: "#f1f5f9",
              padding: "6px 12px",
              fontSize: 12,
              ...T,
            }}
          >
            <option value="all">All Cash Flow</option>
            <option value="committed">Committed Only</option>
            <option value="pending">Pending Only</option>
          </select>

          <select
            value={selectedPayingBU}
            onChange={(e) => setSelectedPayingBU(e.target.value)}
            style={{
              background: "#09131D",
              border: "1px solid #5EEAD4",
              borderRadius: 8,
              color: "#f1f5f9",
              padding: "6px 12px",
              fontSize: 12,
              ...T,
            }}
          >
            {payingBUOptions.map((bu) => (
              <option key={bu} value={bu}>
                {bu === "all" ? "All Paying BU" : bu}
              </option>
            ))}
          </select>

          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            style={{
              background: "#09131D",
              border: "1px solid #5EEAD4",
              borderRadius: 8,
              color: "#f1f5f9",
              padding: "6px 12px",
              fontSize: 12,
              ...T,
            }}
          >
            {[6, 12, 18, 24].map((n) => (
              <option key={n} value={n}>
                {n} months
              </option>
            ))}
          </select>

          <div style={{ color: "#88A0B8", fontSize: 12 }}>
            {filteredItems.length} items • {cashTypeLabel}
          </div>

          <button
            onClick={() => {
              const ts = new Date().toISOString().slice(0, 10);
              const exportRows = dataWithCum.map((d) => ({
                month: d.mk,
                payingBU: selectedPayingBU === "all" ? "All Paying BU" : selectedPayingBU,
                committed: d.committed,
                pending: d.pending,
                total: d.total,
                cumulative: d.cumulative,
              }));
              exportCSV(exportRows, `CashFlow_${ts}.csv`);
            }}
            style={{
              marginLeft: "auto",
              background: "linear-gradient(135deg,#1a3a2a,#0f2a1a)",
              border: "1px solid rgba(94,234,212,0.35)",
              borderRadius: 8,
              color: "#5EEAD4",
              padding: "6px 14px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              ...T,
            }}
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["💰", "Total Committed", totalCommitted, "#10b981"],
          ["⏳", "Total Pending", totalPending, "#f59e0b"],
          ["📊", "Total Forecast", totalForecast, "#5EEAD4"],
          ["📈", "Peak Month", peakMonth.mk || "—", "#a78bfa"],
        ].map(([icon, lbl, val, color]) => (
          <div
            key={String(lbl)}
            style={{
              background: "rgba(0,0,0,0.3)",
              borderRadius: 10,
              padding: "14px 16px",
              border: `1px solid ${color}22`,
              flex: 1,
              minWidth: 140,
            }}
          >
            <div style={{ color: String(color), fontWeight: 900, fontSize: 18, ...T }}>
              {typeof val === "number" ? `S$${val.toLocaleString()}` : val}
            </div>
            <div style={{ color: "#9FB3C8", fontSize: 12, ...T }}>
              {icon} {lbl}
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div
          style={{
            color: "#5EEAD4",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 16,
          }}
        >
          Monthly Cash Outflow (SGD)
        </div>

        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 180, overflowX: "auto" }}>
          {dataWithCum.map(({ mk, committed, pending, total }) => {
            const h = Math.round((total / maxVal) * 160);
            const committedPct = total > 0 ? (committed / total) * 100 : 0;
            const pendingPct = total > 0 ? (pending / total) * 100 : 0;

            return (
              <div
                key={mk}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  minWidth: 52,
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 9, color: "#374151", ...T }}>
                  {total > 0 ? `${(total / 1000).toFixed(0)}K` : ""}
                </div>

                <div
                  style={{
                    width: "100%",
                    height: h,
                    background: "#1e293b",
                    borderRadius: "4px 4px 0 0",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 4,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${committedPct}%`,
                      background: "#10b981",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: `${committedPct}%`,
                      left: 0,
                      right: 0,
                      height: `${pendingPct}%`,
                      background: "#f59e0b",
                    }}
                  />
                </div>

                <div style={{ fontSize: 10, color: "#6B7280", ...T, textAlign: "center" }}>{mk}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#10b981" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981", display: "inline-block" }} />
            Committed (Actual recorded)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f59e0b" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b", display: "inline-block" }} />
            Pending (Budget estimate)
          </span>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            color: "#5EEAD4",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 14,
          }}
        >
          Paying BU Summary
        </div>

        {summaryByPayingBU.length === 0 ? (
          <div style={{ color: "#6B7280", fontSize: 12 }}>
            No cash flow items found for the selected filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, ...T }}>
              <thead>
                <tr style={{ background: "#09131D" }}>
                  {["Paying BU", "Committed (SGD)", "Pending (SGD)", "Total (SGD)"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", color: "#5EEAD4", fontWeight: 700, textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryByPayingBU.map((row, i) => (
                  <tr key={row.name} style={{ background: i % 2 === 0 ? "#1e293b" : "#1a2744" }}>
                    <td style={{ padding: "7px 12px", color: "#CBD5E1", fontWeight: 600 }}>{row.name}</td>
                    <td style={{ padding: "7px 12px", color: "#10b981" }}>
                      {row.committed > 0 ? `S$${row.committed.toLocaleString()}` : "—"}
                    </td>
                    <td style={{ padding: "7px 12px", color: "#f59e0b" }}>
                      {row.pending > 0 ? `S$${row.pending.toLocaleString()}` : "—"}
                    </td>
                    <td style={{ padding: "7px 12px", color: "#5EEAD4", fontWeight: 700 }}>
                      {row.total > 0 ? `S$${row.total.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ ...card, overflowX: "auto" }}>
        <div
          style={{
            color: "#5EEAD4",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 14,
          }}
        >
          Month-by-Month Detail
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, ...T }}>
          <thead>
            <tr style={{ background: "#09131D" }}>
              {["Month", "Committed (SGD)", "Pending (SGD)", "Total (SGD)", "Cumulative (SGD)"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", color: "#5EEAD4", fontWeight: 700, textAlign: "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataWithCum.map(({ mk, committed, pending, total, cumulative }, i) => (
              <tr key={mk} style={{ background: i % 2 === 0 ? "#1e293b" : "#1a2744" }}>
                <td style={{ padding: "7px 12px", color: "#CBD5E1", fontWeight: 600 }}>{mk}</td>
                <td style={{ padding: "7px 12px", color: "#10b981" }}>
                  {committed > 0 ? `S$${committed.toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: "7px 12px", color: "#f59e0b" }}>
                  {pending > 0 ? `S$${pending.toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: "7px 12px", color: "#5EEAD4", fontWeight: 700 }}>
                  {total > 0 ? `S$${total.toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: "7px 12px", color: "#a78bfa" }}>
                  S${cumulative.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CashFlowForecast;