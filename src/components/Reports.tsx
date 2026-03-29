"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#5EEAD4","#7C8CFF","#F4B860","#34D399","#60A5FA","#C084FC",
  "#F472B6","#22D3EE","#A3E635","#FB7185","#FDBA74","#38BDF8","#2DD4BF"
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PNL_BREAKUP: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Half Yearly": 6,
  Annual: 12,
  "One Time Cost": 12,
};

function parsePlanMonth(pm?: string | null) {
  if (!pm) return null;
  const [m, y] = String(pm).split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y, 10);
  return { month: mi, year };
}

function getFY(planMonth?: string | null) {
  const p = parsePlanMonth(planMonth);
  if (!p) return "";
  const { month, year } = p;

  if (month >= 3 && month <= 8) return `${year + 1}-H1`;
  if (month >= 9) return `${year + 1}-H2`;
  return `${year}-H2`;
}

function getPnLBreakup(billingFreq?: string | null) {
  return PNL_BREAKUP[String(billingFreq || "")] || 12;
}

function calcPnLMonths(item: any) {
  const p = parsePlanMonth(item.planMonth);
  if (!p) return {};

  const pnlBreakup = getPnLBreakup(item.billingFreq);
  const actualVal = item.actual != null && Number(item.actual) > 0 ? Number(item.actual) : null;
  const costVal = actualVal !== null ? actualVal : (parseFloat(String(item.budget || 0)) || 0);
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

function exportGroupedCSV(rows: any[], filename: string) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r"))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const headers = ["Group", "Items", "Budget (SGD)", "Actual (SGD)", "Savings (SGD)", "Utilisation %"];
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) =>
      [
        r.label,
        r.items,
        Math.round(r.budget || 0),
        Math.round(r.actual || 0),
        Math.round((r.budget || 0) - (r.actual || 0)),
        `${r.budget > 0 ? Math.round((r.actual / r.budget) * 100) : 0}%`,
      ].map(esc).join(",")
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

function ReportRow({
  row,
  onClick,
}: {
  row: any;
  onClick?: () => void;
}) {
  const savings = (row.budget || 0) - (row.actual || 0);
  const pct = row.budget > 0 ? Math.round((row.actual / row.budget) * 100) : 0;

  return (
    <>
      <td
        style={{
          padding: "10px 16px",
          color: "#f1f5f9",
          fontWeight: 600,
          borderLeft: "3px solid transparent",
          cursor: onClick ? "pointer" : "default",
        }}
        onClick={onClick}
      >
        {row.label}
      </td>
      <td style={{ padding: "10px 16px", color: "#9fb3c8", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {row.items}
      </td>
      <td style={{ padding: "10px 16px", color: "#818cf8", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        S${Math.round(row.budget || 0).toLocaleString()}
      </td>
      <td style={{ padding: "10px 16px", color: "#10b981", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        S${Math.round(row.actual || 0).toLocaleString()}
      </td>
      <td
        style={{
          padding: "10px 16px",
          color: savings >= 0 ? "#4ade80" : "#f87171",
          textAlign: "right",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {savings >= 0 ? "" : "-"}S${Math.abs(Math.round(savings)).toLocaleString()}
      </td>
      <td style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, background: "#213547", borderRadius: 4, height: 8, minWidth: 80 }}>
            <div
              style={{
                width: `${Math.min(pct, 100)}%`,
                background: pct > 100 ? "#ef4444" : pct > 75 ? "#10b981" : pct > 40 ? "#f59e0b" : "#5EEAD4",
                height: "100%",
                borderRadius: 4,
              }}
            />
          </div>
          <span style={{ color: "#9fb3c8", fontSize: 12, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {pct}%
          </span>
        </div>
      </td>
    </>
  );
}

export default function Reports({
  items,
  fyOptions,
  initGroupBy,
  initFilterFY,
  onGroupByChange,
  onFilterFYChange,
  onDrillDown,
  summary,
  summaryLoading,
}: {
  items: any[];
  fyOptions?: string[];
  initGroupBy?: string;
  initFilterFY?: string;
  onGroupByChange?: (v: string) => void;
  onFilterFYChange?: (v: string) => void;
  onDrillDown?: (payload: any) => void;
  summary?: any;
  summaryLoading?: boolean;
}) {
  const [groupBy, setGroupByState] = useState(initGroupBy || "businessUnit");
  const [filterFY, setFilterFYState] = useState(initFilterFY || "all");
  const [filterBU, setFilterBU] = useState("all");
  const [reportType, setReportType] = useState("cashflow");

  const setGroupBy = (v: string) => {
    setGroupByState(v);
    onGroupByChange && onGroupByChange(v);
  };

  const setFilterFY = (v: string) => {
    setFilterFYState(v);
    onFilterFYChange && onFilterFYChange(v);
  };

  useEffect(() => {
    if (initGroupBy) setGroupByState(initGroupBy);
  }, [initGroupBy]);

  useEffect(() => {
    if (initFilterFY) setFilterFYState(initFilterFY);
  }, [initFilterFY]);

  const fyList = Array.isArray(fyOptions) ? fyOptions : [];

  const buList = useMemo(() => {
    return [...new Set((items || []).map((i) => i.businessUnit).filter(Boolean))].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return (items || []).filter((i) => {
      const fyMatch = filterFY === "all" || (i.fy || getFY(i.planMonth)) === filterFY;
      const buMatch = filterBU === "all" || i.businessUnit === filterBU;
      return fyMatch && buMatch;
    });
  }, [items, filterFY, filterBU]);

  const grouped = useMemo(() => {
    const canUseCashflowSummary = false;

    if (canUseCashflowSummary) {
  return summary.home.buData.map((row: any) => ({
    label: row.bu || "Unknown",
    items: Number(row.count) || 0,
    budget: Number(row.budget) || 0,
    actual: Number(row.actual) || 0,
    savings: (Number(row.budget) || 0) - (Number(row.actual) || 0),
    utilization:
      Number(row.budget) > 0
        ? Math.round(((Number(row.actual) || 0) / Number(row.budget)) * 100)
        : 0,
  }));
}

    const map: Record<string, { label: string; items: number; budget: number; actual: number }> = {};

    filteredItems.forEach((item: any) => {
      const key = item[groupBy] || "Unknown";

      if (!map[key]) {
        map[key] = { label: key, items: 0, budget: 0, actual: 0 };
      }

      map[key].items += 1;

      const isActual = item.actual != null && Number(item.actual) > 0;

      if (reportType === "cashflow") {
        map[key].budget += parseFloat(String(item.budget || 0)) || 0;
        if (isActual) map[key].actual += Number(item.actual) || 0;
      } else {
        const pnl = calcPnLMonths(item);
        const budgetTotal = Object.values(pnl).reduce((s: number, v: any) => s + Number(v || 0), 0);
        map[key].budget += budgetTotal;

        if (isActual) {
          const actualPnl = calcPnLMonths({ ...item, budget: item.actual, actual: null });
          const actualTotal = Object.values(actualPnl).reduce((s: number, v: any) => s + Number(v || 0), 0);
          map[key].actual += actualTotal;
        }
      }
    });

    return Object.values(map)
      .map((r) => ({
        ...r,
        budget: Math.round(r.budget),
        actual: Math.round(r.actual),
      }))
      .sort((a, b) => b.budget - a.budget);
  }, [filteredItems, groupBy, reportType, filterFY, filterBU, summary]);

  const topDrivers = useMemo(() => {
    return [...filteredItems]
      .sort((a, b) => (parseFloat(String(b.budget || 0)) || 0) - (parseFloat(String(a.budget || 0)) || 0))
      .slice(0, 10);
  }, [filteredItems]);

  const totalBudget = grouped.reduce((s, d) => s + (d.budget || 0), 0);
  const totalActual = grouped.reduce((s, d) => s + (d.actual || 0), 0);
  const totalSavings = totalBudget - totalActual;
  const totalItems = grouped.reduce((s, d) => s + (d.items || 0), 0);
  const utilisation = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const reportLabel =
    groupBy === "businessUnit" ? "Business Unit" :
    groupBy === "payingBU" ? "Paying BU" :
    groupBy === "expenseType" ? "Expense Type" :
    groupBy === "itemType" ? "Item Type" :
    groupBy === "itemCategory" ? "Item Category" :
    groupBy === "status" ? "Status" :
    groupBy === "country" ? "Country" :
    groupBy === "billingFreq" ? "Billing Freq" :
    "Group";

  const drill = (payload: any) => {
    if (onDrillDown) onDrillDown(payload);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#88A0B8", textTransform: "uppercase", fontWeight: 700 }}>
            Group By
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            style={{ background: "#09131D", border: "1px solid #213547", borderRadius: 8, color: "#f1f5f9", padding: "6px 12px", fontSize: 13 }}
          >
            <option value="businessUnit">Business Unit</option>
            <option value="payingBU">Paying BU</option>
            <option value="expenseType">Expense Type</option>
            <option value="itemType">Item Type</option>
            <option value="itemCategory">Item Category</option>
            <option value="status">Status</option>
            <option value="country">Country</option>
            <option value="billingFreq">Billing Frequency</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#88A0B8", textTransform: "uppercase", fontWeight: 700 }}>
            Financial Year
          </label>
          <select
            value={filterFY}
            onChange={(e) => setFilterFY(e.target.value)}
            style={{ background: "#09131D", border: "1px solid #213547", borderRadius: 8, color: "#f1f5f9", padding: "6px 12px", fontSize: 13 }}
          >
            <option value="all">All Years</option>
            {fyList.map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#88A0B8", textTransform: "uppercase", fontWeight: 700 }}>
            Business Unit
          </label>
          <select
            value={filterBU}
            onChange={(e) => setFilterBU(e.target.value)}
            style={{ background: "#09131D", border: "1px solid #213547", borderRadius: 8, color: "#f1f5f9", padding: "6px 12px", fontSize: 13 }}
          >
            <option value="all">All BU</option>
            {buList.map((bu) => (
              <option key={bu} value={bu}>{bu}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "#88A0B8", textTransform: "uppercase", fontWeight: 700 }}>
            Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{ background: "#09131D", border: "1px solid #213547", borderRadius: 8, color: "#f1f5f9", padding: "6px 12px", fontSize: 13 }}
          >
            <option value="cashflow">Cash Flow</option>
            <option value="pnl">P&L Basis</option>
          </select>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#88A0B8", fontSize: 11 }}>TOTAL BUDGET</div>
            <div style={{ color: "#5EEAD4", fontWeight: 800, fontSize: 16 }}>S${totalBudget.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#88A0B8", fontSize: 11 }}>TOTAL ACTUAL</div>
            <div style={{ color: "#10b981", fontWeight: 800, fontSize: 16 }}>S${totalActual.toLocaleString()}</div>
          </div>
          <button
            onClick={() =>
              exportGroupedCSV(
                grouped,
                `Reports_${groupBy}_${filterFY}_${filterBU}_${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
            style={{
              background: "linear-gradient(135deg,#1a3a2a,#0f2a1a)",
              border: "1px solid rgba(94,234,212,0.35)",
              borderRadius: 8,
              color: "#5EEAD4",
              padding: "6px 14px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {[
          { label: "Total Budget", value: `S$${totalBudget.toLocaleString()}`, color: "#818cf8", icon: "💰" },
          { label: "Total Actual", value: `S$${totalActual.toLocaleString()}`, color: "#10b981", icon: "✅" },
          { label: "Variance / Savings", value: `${totalSavings >= 0 ? "" : "-"}S$${Math.abs(totalSavings).toLocaleString()}`, color: totalSavings >= 0 ? "#4ade80" : "#f87171", icon: "📉" },
          { label: "Items", value: totalItems, color: "#c4b5fd", icon: "📦" },
          { label: "Utilisation", value: `${utilisation}%`, color: utilisation > 100 ? "#ef4444" : utilisation > 75 ? "#f59e0b" : "#5EEAD4", icon: "📊" },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
              borderRadius: 12,
              padding: "14px 16px",
              border: `1px solid ${k.color}22`,
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ color: "#88A0B8", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ color: k.color, fontSize: 20, fontWeight: 900, fontFamily: "monospace" }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius: 14, padding: 20 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
  data={grouped.slice(0, 12)}
  margin={{ bottom: 40 }}
>
            <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
            <XAxis dataKey="label" tick={{ fill: "#9fb3c8", fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fill: "#9fb3c8", fontSize: 10 }} tickFormatter={(v) => `S$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "#09131D", border: "1px solid #213547", borderRadius: 8 }}
              formatter={(v: any) => [`S$${Number(v || 0).toLocaleString()}`, ""]}
            />
            <Legend />
            <Bar
  dataKey="budget"
  name={`Budget (${reportType === "pnl" ? "P&L" : "Cash Flow"})`}
  fill="#5EEAD4"
  radius={[4, 4, 0, 0]}
  cursor="pointer"
  onClick={(data: any) => {
  const label =
    data?.payload?.label ||
    data?.activePayload?.[0]?.payload?.label ||
    data?.label ||
    "";

  if (!label) return;

  drill({
    tab: "budget",
    bu: label,
    fy: filterFY !== "all" ? filterFY : undefined,
    fromTab: "reports",
  });
}}
/>

<Bar
  dataKey="actual"
  name="Actual"
  fill="#10b981"
  radius={[4, 4, 0, 0]}
  cursor="pointer"
  onClick={(data: any) => {
  const label =
    data?.payload?.label ||
    data?.activePayload?.[0]?.payload?.label ||
    data?.label ||
    "";

  if (!label) return;

  drill({
    tab: "budget",
    bu: label,
    fy: filterFY !== "all" ? filterFY : undefined,
    fromTab: "reports",
  });
}}
/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: "linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#09131D" }}>
              {[
                { label: reportLabel, align: "left" },
                { label: "Items", align: "right" },
                { label: "Budget (SGD)", align: "right" },
                { label: "Actual (SGD)", align: "right" },
                { label: "Savings (SGD)", align: "right" },
                { label: "Utilization", align: "right" },
              ].map((h) => (
                <th
                  key={h.label}
                  style={{
                    padding: "12px 16px",
                    color: "#5EEAD4",
                    textAlign: h.align as any,
                    fontSize: 11,
                    textTransform: "uppercase",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((row, i) => (
              <tr
                key={i}
                style={{ borderTop: "1px solid #1e293b", background: i % 2 === 0 ? "#1e293b" : "#1a2744" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#243450")}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#1e293b" : "#1a2744")}
              >
                <ReportRow
                  row={row}
                  onClick={() =>
                    drill({
                      tab: "budget",
                      fy: filterFY !== "all" ? filterFY : undefined,
                      businessUnit: filterBU !== "all" ? filterBU : undefined,
                      [groupBy]: row.label,
                      fromTab: "reports",
                    })
                  }
                />
              </tr>
            ))}

            <tr style={{ borderTop: "2px solid #5EEAD4", background: "#09131D" }}>
              <td style={{ padding: "10px 16px", color: "#a5b4fc", fontWeight: 800 }}>TOTAL</td>
              <td style={{ padding: "10px 16px", color: "#9fb3c8", textAlign: "right", fontWeight: 700 }}>
                {totalItems}
              </td>
              <td style={{ padding: "10px 16px", color: "#818cf8", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                S${totalBudget.toLocaleString()}
              </td>
              <td style={{ padding: "10px 16px", color: "#10b981", textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                S${totalActual.toLocaleString()}
              </td>
              <td
                style={{
                  padding: "10px 16px",
                  color: totalSavings >= 0 ? "#4ade80" : "#f87171",
                  textAlign: "right",
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {totalSavings >= 0 ? "" : "−"}S${Math.abs(totalSavings).toLocaleString()}
              </td>
              <td style={{ padding: "10px 16px", color: "#9fb3c8", textAlign: "right", fontWeight: 700 }}>
                {utilisation}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ background: "linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: "#f1f5f9", margin: 0, fontSize: 15, fontWeight: 700 }}>
            🏆 Top 10 Budget Drivers
          </h3>
          <div style={{ color: "#6B7280", fontSize: 12 }}>
            Click an item row later from Budget page for full detail
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {topDrivers.map((item, i) => {
            const pct = totalBudget > 0 ? (parseFloat(String(item.budget || 0)) / totalBudget) * 100 : 0;
            return (
              <div
                key={item.id || i}
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                onClick={() =>
                  drill({
                    tab: "budget",
                    fy: filterFY !== "all" ? filterFY : undefined,
                    businessUnit: filterBU !== "all" ? filterBU : undefined,
                    search: item.description,
                    fromTab: "reports",
                  })
                }
              >
                <span style={{ color: "#475569", fontWeight: 700, minWidth: 20, fontSize: 12 }}>
                  #{i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.description}
                    </span>
                    <span style={{ color: "#5EEAD4", fontWeight: 700, fontSize: 13, marginLeft: 8 }}>
                      S${(parseFloat(String(item.budget || 0)) || 0).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ background: "#213547", borderRadius: 4, height: 6 }}>
                    <div
                      style={{
                        width: `${Math.min(pct * 5, 100)}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                        height: "100%",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>

                <span style={{ color: "#88A0B8", fontSize: 11, minWidth: 40 }}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
