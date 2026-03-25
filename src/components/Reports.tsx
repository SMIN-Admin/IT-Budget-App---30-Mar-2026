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

const CHART_COLORS = ["#5EEAD4","#7C8CFF","#F4B860","#34D399","#60A5FA","#C084FC","#F472B6","#22D3EE","#A3E635","#FB7185","#FDBA74","#38BDF8","#2DD4BF"];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parsePlanMonth(pm) {
  if (!pm) return null;
  const [m, y] = pm.split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y);
  return { month: mi, year };
}

function getPnLBreakup(billingFreq) {
  return PNL_BREAKUP[billingFreq] || 12;
}


// ── Export helpers ────────────────────────────────────────────────────────────
const EXPORT_COLS = [
  { key:"description",  label:"Description",     type:"text"   },
  { key:"expenseType",  label:"Expense Type",     type:"text"   },
  { key:"itemType",     label:"Item Type",        type:"text"   },
  { key:"itemCategory", label:"Item Category",    type:"text"   },
  { key:"subCategory",  label:"Sub Category",     type:"text"   },
  { key:"businessUnit", label:"Business Unit",    type:"text"   },
  { key:"location",     label:"Location",         type:"text"   },
  { key:"country",      label:"Country",          type:"text"   },
  { key:"payingBU",     label:"Paying BU",        type:"text"   },
  { key:"planMonth",    label:"Plan Month",       type:"text"   },
  { key:"fy",           label:"FY",               type:"text",  derive: i => i.fy || getFY(i.planMonth) },
  { key:"quantity",     label:"Quantity",         type:"number" },
  { key:"rate",         label:"Rate",             type:"number" },
  { key:"currency",     label:"Currency",         type:"text"   },
  { key:"convRate",     label:"Conv Rate (SGD)",  type:"number" },
  { key:"total",        label:"Total (Local)",    type:"number" },
  { key:"budget",       label:"Budget (SGD)",     type:"number" },
  { key:"actual",       label:"Actual (SGD)",     type:"number" },
  { key:"savings",      label:"Savings (SGD)",    type:"number" },
  { key:"billingFreq",  label:"Billing Freq",     type:"text"   },
  { key:"vendor",       label:"Vendor",           type:"text"   },
  { key:"status",       label:"Status",           type:"text"   },
  { key:"outsideBudget",label:"Outside Budget",   type:"text",  derive: i => i.outsideBudget ? "Yes" : "No" },
  { key:"remarks",      label:"Remarks",          type:"text"   },
];

function getFY(planMonth) {
  const p = parsePlanMonth(planMonth);
  if (!p) return "";
  const { month, year } = p;
  // Indian FY: Apr–Mar
  // Apr(3)–Sep(8)  → H1 of (year+1)   e.g. Apr-25 = 2026-H1
  // Oct(9)–Dec(11) → H2 of (year+1)   e.g. Oct-25 = 2026-H2
  // Jan(0)–Mar(2)  → H2 of same year  e.g. Mar-26 = 2026-H2
  if (month >= 3 && month <= 8) return `${year + 1}-H1`;
  if (month >= 9)               return `${year + 1}-H2`;
  return `${year}-H2`;
}

function calcPnLMonths(item) {
  const p = parsePlanMonth(item.planMonth);
  if (!p) return {};
  const pnlBreakup = getPnLBreakup(item.billingFreq);
  // actual is now number|null — no parseFloat needed
  const actualVal = (item.actual != null && item.actual > 0) ? item.actual : null;
  const costVal = actualVal !== null ? actualVal : (parseFloat(item.budget) || 0);
  const monthly = costVal / pnlBreakup;
  const result = {};
  for (let i = 0; i < pnlBreakup; i++) {
    let mo = p.month + i;
    let yr = p.year;
    while (mo > 11) { mo -= 12; yr++; }
    const key = `${MONTHS[mo]}-${String(yr).slice(2)}`;
    result[key] = (result[key] || 0) + monthly;
  }
  return result;
}

function exportCSV(rows, filename) {
  const esc = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r"))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    EXPORT_COLS.map(c => esc(c.label)).join(","),
    ...rows.map(item =>
      EXPORT_COLS.map(c => {
        const val = c.derive ? c.derive(item) : item[c.key];
        return esc(val === null || val === undefined ? "" : val);
      }).join(",")
    )
  ];
  const csv = "\uFEFF" + lines.join("\r\n");
  // Encode as base64 to avoid data URI length/encoding issues with large files
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


function ReportRow({ label, budget, actual, savings, items }) {
  const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
  return (
    <>
      <td style={{ padding:"10px 16px", color:"#f1f5f9", fontWeight:600, borderLeft:"3px solid transparent" }}>{label}</td>
      <td style={{ padding:"10px 16px", color:"#9fb3c8", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{items}</td>
      <td style={{ padding:"10px 16px", color:"#818cf8", textAlign:"right", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>S${budget.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
      <td style={{ padding:"10px 16px", color:"#10b981", textAlign:"right", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>S${actual.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
      <td style={{ padding:"10px 16px", color: savings >= 0 ? "#4ade80" : "#f87171", textAlign:"right", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>
        {savings >= 0 ? "" : "-"}S${Math.abs(savings).toLocaleString(undefined,{maximumFractionDigits:0})}
      </td>
      <td style={{ padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ flex:1, background:"#213547", borderRadius:4, height:8, minWidth:80 }}>
            <div style={{ width:`${Math.min(pct,100)}%`, background: pct > 100 ? "#ef4444" : pct > 75 ? "#10b981" : pct > 40 ? "#f59e0b" : "#5EEAD4", height:"100%", borderRadius:4 }} />
          </div>
          <span style={{ color:"#9fb3c8", fontSize:12, minWidth:40, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{pct}%</span>
        </div>
      </td>
    </>
  );
}


function Reports({ items, initGroupBy, initFilterFY, onGroupByChange, onFilterFYChange }) {
  const [groupBy,  setGroupByState]  = useState(initGroupBy  || "businessUnit");
  const [filterFY, setFilterFYState] = useState(initFilterFY || "all");
  const setGroupBy  = (v) => { setGroupByState(v);  onGroupByChange  && onGroupByChange(v); };
  const setFilterFY = (v) => { setFilterFYState(v); onFilterFYChange && onFilterFYChange(v); };
  // Re-sync when parent drills into this page with new values
  useEffect(() => { if (initGroupBy)  setGroupByState(initGroupBy); },  [initGroupBy]);
  useEffect(() => { if (initFilterFY) setFilterFYState(initFilterFY); }, [initFilterFY]);
  const [reportType, setReportType] = useState("cashflow");

  const fyList = useMemo(() => [...new Set(items.map(i => i.fy || getFY(i.planMonth)).filter(Boolean))].sort(), [items]);

  const filteredItems = useMemo(() => {
    if (filterFY === "all") return items;
    return items.filter(i => (i.fy || getFY(i.planMonth)) === filterFY);
  }, [items, filterFY]);

  const grouped = useMemo(() => {
    const map = {};
    filteredItems.forEach(item => {
      const key = item[groupBy] || "Unknown";
      if (!map[key]) map[key] = { label: key, items: 0, budget: 0, actual: 0 };
      map[key].items++;
      const isActual = item.actual != null && item.actual > 0;
      if (reportType === "cashflow") {
        map[key].budget += parseFloat(item.budget) || 0;
        if (isActual) map[key].actual += item.actual;
      } else {
        // P&L mode: sum monthly P&L
        const pnl = calcPnLMonths(item);
        const pnlTotal = Object.values(pnl).reduce((a, b) => a + b, 0);
        map[key].budget += pnlTotal;
        if (isActual) {
          const actualItem = { ...item, budget: item.actual };
          const actualPnl = calcPnLMonths(actualItem);
          map[key].actual += Object.values(actualPnl).reduce((a, b) => a + b, 0);
        }
      }
    });
    return Object.values(map).map(d => ({ ...d, budget: Math.round(d.budget), actual: Math.round(d.actual), savings: Math.round(d.budget - d.actual) })).sort((a, b) => b.budget - a.budget);
  }, [filteredItems, groupBy, reportType]);

  // Top drivers
  const topDrivers = useMemo(() => {
    return [...filteredItems].sort((a, b) => (parseFloat(b.budget)||0) - (parseFloat(a.budget)||0)).slice(0, 10);
  }, [filteredItems]);

  const totalBudget = grouped.reduce((s, d) => s + d.budget, 0);
  const totalActual = grouped.reduce((s, d) => s + d.actual, 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Controls */}
      <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:12, padding:16, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, color:"#88A0B8", textTransform:"uppercase", fontWeight:700 }}>Group By</label>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
            style={{ background:"#09131D", border:"1px solid #213547", borderRadius:8, color:"#f1f5f9", padding:"6px 12px", fontSize:13 }}>
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
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, color:"#88A0B8", textTransform:"uppercase", fontWeight:700 }}>Financial Year</label>
          <select value={filterFY} onChange={e => setFilterFY(e.target.value)}
            style={{ background:"#09131D", border:"1px solid #213547", borderRadius:8, color:"#f1f5f9", padding:"6px 12px", fontSize:13 }}>
            <option value="all">All Years</option>
            {fyList.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:11, color:"#88A0B8", textTransform:"uppercase", fontWeight:700 }}>Report Type</label>
          <select value={reportType} onChange={e => setReportType(e.target.value)}
            style={{ background:"#09131D", border:"1px solid #213547", borderRadius:8, color:"#f1f5f9", padding:"6px 12px", fontSize:13 }}>
            <option value="cashflow">Cash Flow</option>
            <option value="pnl">P&L Basis</option>
          </select>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"#88A0B8", fontSize:11 }}>TOTAL BUDGET</div>
            <div style={{ color:"#5EEAD4", fontWeight:800, fontSize:16 }}>S${totalBudget.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"#88A0B8", fontSize:11 }}>TOTAL ACTUAL</div>
            <div style={{ color:"#10b981", fontWeight:800, fontSize:16 }}>S${totalActual.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          </div>
          <button onClick={() => {
            const groupLabel = groupBy === "businessUnit" ? "Business Unit" : groupBy === "payingBU" ? "Paying BU" : groupBy === "expenseType" ? "Expense Type" : groupBy === "itemType" ? "Item Type" : groupBy === "itemCategory" ? "Item Category" : groupBy === "status" ? "Status" : groupBy === "country" ? "Country" : "Billing Freq";
            exportCSV(grouped.map(r => ({ [groupLabel]: r.label, Items: r.items, "Budget (SGD)": r.budget, "Actual (SGD)": r.actual, "Savings (SGD)": r.savings, "Utilisation %": r.budget > 0 ? Math.round((r.actual / r.budget) * 100) + "%" : "0%" })), `Reports_${groupBy}_${filterFY}_${new Date().toISOString().slice(0,10)}.csv`);
          }}
            style={{ background:"linear-gradient(135deg,#1a3a2a,#0f2a1a)", border:"1px solid rgba(94,234,212,0.35)", borderRadius:8, color:"#5EEAD4", padding:"6px 14px", cursor:"pointer", fontWeight:700, fontSize:12, whiteSpace:"nowrap" }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, padding:20 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={grouped.slice(0, 12)} margin={{ bottom:40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
            <XAxis dataKey="label" tick={{ fill:"#9fb3c8", fontSize:10 }} angle={-30} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fill:"#9fb3c8", fontSize:10 }} tickFormatter={v => `S$${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background:"#09131D", border:"1px solid #213547", borderRadius:8 }} formatter={(v) => [`S$${v.toLocaleString()}`, ""]} />
            <Legend />
            <Bar dataKey="budget" name={`Budget (${reportType === "pnl" ? "P&L" : "Cash Flow"})`} fill="#5EEAD4" radius={[4,4,0,0]} />
            <Bar dataKey="actual" name="Actual" fill="#10b981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, tableLayout:"fixed" }}>
          <colgroup>
            <col style={{ width:"30%" }} />
            <col style={{ width:"8%" }} />
            <col style={{ width:"17%" }} />
            <col style={{ width:"17%" }} />
            <col style={{ width:"14%" }} />
            <col style={{ width:"14%" }} />
          </colgroup>
          <thead>
            <tr style={{ background:"#09131D" }}>
              {[
                { label: groupBy === "businessUnit" ? "Business Unit" : groupBy === "payingBU" ? "Paying BU" : groupBy === "expenseType" ? "Expense Type" : groupBy === "itemType" ? "Item Type" : groupBy === "itemCategory" ? "Item Category" : groupBy === "status" ? "Status" : groupBy === "country" ? "Country" : groupBy === "billingFreq" ? "Billing Freq" : "Group", align:"left" },
                { label:"Items", align:"right" },
                { label:"Budget (SGD)", align:"right" },
                { label:"Actual (SGD)", align:"right" },
                { label:"Savings (SGD)", align:"right" },
                { label:"Utilization", align:"right" },
              ].map(h => (
                <th key={h.label} style={{ padding:"12px 16px", color:"#5EEAD4", textAlign:h.align, fontSize:11, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((row, i) => (
              <tr key={i} style={{ borderTop:"1px solid #1e293b", background: i % 2 === 0 ? "#1e293b" : "#1a2744" }}
                onMouseEnter={e=>e.currentTarget.style.background="#243450"}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#1e293b":"#1a2744"}>
                <ReportRow {...row} />
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ borderTop:"2px solid #5EEAD4", background:"#09131D" }}>
              <td style={{ padding:"10px 16px", color:"#a5b4fc", fontWeight:800 }}>TOTAL</td>
              <td style={{ padding:"10px 16px", color:"#9fb3c8", textAlign:"right", fontWeight:700 }}>{grouped.reduce((s,d)=>s+d.items,0)}</td>
              <td style={{ padding:"10px 16px", color:"#818cf8", textAlign:"right", fontWeight:800, fontVariantNumeric:"tabular-nums" }}>S${totalBudget.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
              <td style={{ padding:"10px 16px", color:"#10b981", textAlign:"right", fontWeight:800, fontVariantNumeric:"tabular-nums" }}>S${totalActual.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
              <td style={{ padding:"10px 16px", color: (totalBudget-totalActual)>=0?"#4ade80":"#f87171", textAlign:"right", fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                {(totalBudget-totalActual)>=0?"":"−"}S${Math.abs(totalBudget-totalActual).toLocaleString(undefined,{maximumFractionDigits:0})}
              </td>
              <td style={{ padding:"10px 16px", color:"#9fb3c8", textAlign:"right", fontWeight:700 }}>
                {totalBudget>0?Math.round((totalActual/totalBudget)*100):0}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Top Drivers */}
      <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, padding:20 }}>
        <h3 style={{ color:"#f1f5f9", marginBottom:16, fontSize:15, fontWeight:700 }}>🏆 Top 10 Budget Drivers</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {topDrivers.map((item, i) => {
            const pct = totalBudget > 0 ? ((parseFloat(item.budget) || 0) / totalBudget * 100) : 0;
            return (
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ color:"#475569", fontWeight:700, minWidth:20, fontSize:12 }}>#{i + 1}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ color:"#f1f5f9", fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.description}</span>
                    <span style={{ color:"#5EEAD4", fontWeight:700, fontSize:13, marginLeft:8 }}>S${(parseFloat(item.budget)||0).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
                  </div>
                  <div style={{ background:"#213547", borderRadius:4, height:6 }}>
                    <div style={{ width:`${Math.min(pct * 5, 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length], height:"100%", borderRadius:4 }} />
                  </div>
                </div>
                <span style={{ color:"#88A0B8", fontSize:11, minWidth:40 }}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}












export default Reports;