"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

const PNL_BREAKUP = { Monthly:1, Quarterly:3, "Half Yearly":6, Annual:12, "One Time Cost":12 };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CHART_COLORS = ["#5EEAD4","#7C8CFF","#F4B860","#34D399","#60A5FA","#C084FC","#F472B6","#22D3EE","#A3E635"];

function parsePlanMonth(pm) {
  if (!pm) return null;
  const [m, y] = pm.split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y);
  return { month: mi, year };
}

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

function getPnLBreakup(billingFreq) {
  return PNL_BREAKUP[billingFreq] || 12;
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



function PnLTrendChart({ monthlyChartData }) {
  const total = monthlyChartData.length;
  const WINDOW = 12;
  const [start, setStart] = useState(Math.max(0, total - WINDOW));
  // Keep slider at end when new data arrives
  useEffect(() => { setStart(Math.max(0, total - WINDOW)); }, [total]);
  const visibleData = monthlyChartData.slice(start, start + WINDOW);
  return (
    <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, padding:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>📈 Monthly P&L — Budget vs Actual (Amortised)</h3>
        <span style={{ color:"#475569", fontSize:11 }}>{total} months total</span>
      </div>
      {total > WINDOW && (
        <div style={{ marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", color:"#9fb3c8", fontSize:11, marginBottom:4 }}>
            <span>◀ {monthlyChartData[0]?.month}</span>
            <span style={{ color:"#5EEAD4", fontWeight:700 }}>
              Showing: {monthlyChartData[start]?.month} – {monthlyChartData[Math.min(start+WINDOW-1, total-1)]?.month}
            </span>
            <span>{monthlyChartData[total-1]?.month} ▶</span>
          </div>
          <input type="range" min={0} max={Math.max(0, total - WINDOW)} value={start}
            onChange={e => setStart(Number(e.target.value))}
            style={{ width:"100%", accentColor:"#5EEAD4", cursor:"pointer", height:4 }} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={visibleData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
          <XAxis dataKey="month" tick={{ fill:"#9fb3c8", fontSize:9 }} interval={0} />
          <YAxis tick={{ fill:"#9fb3c8", fontSize:9 }} tickFormatter={v=>`S$${(v/1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ background:"#09131D", border:"1px solid #213547", borderRadius:8 }} formatter={v=>[`S$${v.toLocaleString()}`,""]} />
          <Legend wrapperStyle={{fontSize:11}} />
          <Area type="monotone" dataKey="budget" fill="#5EEAD433" stroke="#5EEAD4" strokeWidth={2} name="Budget P&L" />
          <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} dot={false} name="Actual P&L" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function exportPnLCSV(itemsWithPnL, showMonths, colTotals, filename) {
  const esc = v => {
    const s = v === null || v === undefined ? "" : String(v);
    return (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r"))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Header row: fixed cols + one per month + Grand Total
  const fixedHeaders = ["Description","BU","Category","FY","Billing Freq","Budget SGD","Actual SGD","Basis","P&L Total SGD"];
  const headers = [...fixedHeaders, ...showMonths, "Grand Total"].map(esc).join(",");

  // Data rows
  const dataRows = itemsWithPnL.map(item => {
    const rowTotal = Math.round(Object.values(item.pnlMonths).reduce((s,v)=>s+v,0));
    const fixed = [
      item.description,
      item.businessUnit,
      item.itemCategory,
      item.fy || getFY(item.planMonth),
      item.billingFreq,
      Math.round(parseFloat(item.budget)||0),
      item.actual != null ? Math.round(item.actual) : "",
      item.isActual ? "Actual" : "Budget",
      rowTotal,
    ].map(esc);
    const monthCols = showMonths.map(m => esc(item.pnlMonths[m] ? Math.round(item.pnlMonths[m]) : ""));
    const grandTotal = esc(rowTotal);
    return [...fixed, ...monthCols, grandTotal].join(",");
  });

  // Total row
  const totalFixed = ["TOTAL","","","","","","","",""].map((v,i) => {
    if (i === 5) return esc(Math.round(itemsWithPnL.reduce((s,it)=>s+(parseFloat(it.budget)||0),0)));
    if (i === 6) return esc(Math.round(itemsWithPnL.filter(it=>it.actual!=null&&it.actual>0).reduce((s,it)=>s+it.actual,0)));
    if (i === 8) return esc(Math.round(Object.values(colTotals).reduce((s,v)=>s+v,0)));
    return esc(v);
  });
  const totalMonths = showMonths.map(m => esc(Math.round(colTotals[m]||0)));
  const grandTotalSum = esc(Math.round(Object.values(colTotals).reduce((s,v)=>s+v,0)));
  const totalRow = [...totalFixed, ...totalMonths, grandTotalSum].join(",");

  const csv = "\uFEFF" + [headers, ...dataRows, totalRow].join("\r\n");
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


function PnlView({ items, fyOptions }) {
  const [selectedBUs,  setSelectedBUs]  = useState(["all"]);
  const [selectedFYs,  setSelectedFYs]  = useState(["all"]);
  const [filterCategory, setFilterCategory] = useState("all");

  const buList  = useMemo(() => [...new Set(items.map(i => i.businessUnit).filter(Boolean))].sort(), [items]);
  const catList = useMemo(() => [...new Set(items.map(i => i.itemCategory).filter(Boolean))].sort(), [items]);
  const fyList = Array.isArray(fyOptions) ? fyOptions : [];

  const toggleBU = (v) => {
    if (v === "all") { setSelectedBUs(["all"]); return; }
    const without = selectedBUs.filter(s => s !== "all");
    if (without.includes(v)) { const n = without.filter(s => s !== v); setSelectedBUs(n.length ? n : ["all"]); }
    else setSelectedBUs([...without, v]);
  };
  const toggleFY = (v) => {
    if (v === "all") { setSelectedFYs(["all"]); return; }
    const without = selectedFYs.filter(s => s !== "all");
    if (without.includes(v)) { const n = without.filter(s => s !== v); setSelectedFYs(n.length ? n : ["all"]); }
    else setSelectedFYs([...without, v]);
  };

  const [buOpen, setBuOpen] = useState(false);
  const [fyOpen, setFyOpen] = useState(false);

  const filtered = useMemo(() => {
    return items.filter(i =>
      (selectedBUs.includes("all") || selectedBUs.includes(i.businessUnit)) &&
      (selectedFYs.includes("all") || selectedFYs.includes(i.fy || getFY(i.planMonth))) &&
      (filterCategory === "all" || i.itemCategory === filterCategory)
    );
  }, [items, selectedBUs, selectedFYs, filterCategory]);

  // Build month range from data (all months present in filtered items)
  // ── Pre-compute P&L per item (memoised) — avoids O(n×m) in render ──────────
  const pnlMatrix = useMemo(() => {
    const result = {};
    filtered.forEach(item => {
      result[item.id] = calcPnLMonths(item);
    });
    return result;
  }, [filtered]);

  const showMonths = useMemo(() => {
    const monthSet = new Set();
    filtered.forEach(item => {
      const pnl = pnlMatrix[item.id] || {};
      Object.keys(pnl).forEach(k => monthSet.add(k));
    });
    return Array.from(monthSet).sort((a, b) => {
      const [ma, ya] = a.split("-"); const [mb, yb] = b.split("-");
      return (parseInt("20"+ya)*12 + MONTHS.indexOf(ma)) - (parseInt("20"+yb)*12 + MONTHS.indexOf(mb));
    });
  }, [filtered, pnlMatrix]);

  // For each item: if actual has a value → use actual-based P&L, else use budget-based P&L
  const itemsWithPnL = useMemo(() => {
    return filtered.map(item => {
      const hasActual = item.actual != null && item.actual > 0;
      // actual-based pnl: re-run calcPnLMonths with budget=actual
      const pnlMonths = hasActual
        ? calcPnLMonths({ ...item, budget: item.actual, actual: null })
        : (pnlMatrix[item.id] || {});
      return { ...item, pnlMonths, isActual: hasActual };
    });
  }, [filtered, pnlMatrix]);

  const colTotals = useMemo(() => {
    const totals = {};
    showMonths.forEach(m => { totals[m] = itemsWithPnL.reduce((s, i) => s + (i.pnlMonths[m] || 0), 0); });
    return totals;
  }, [itemsWithPnL, showMonths]);

  // ── KPIs ──
  const totalBudget = filtered.reduce((s,i) => s+(parseFloat(i.budget)||0), 0);
  const totalActual = filtered.filter(i => i.actual != null && i.actual > 0).reduce((s,i) => s+i.actual, 0);
  const totalPnL    = Object.values(colTotals).reduce((s,v) => s+v, 0);
  const itemsWithActual = filtered.filter(i => i.actual != null && i.actual > 0).length;
  const itemsPending    = filtered.filter(i => i.actual == null || i.actual <= 0).length;
  const utilPct = totalBudget > 0 ? Math.round((totalActual/totalBudget)*100) : 0;

  // Monthly totals for mini chart — use pnlMatrix (memoised, no recalc)
  const monthlyChartData = useMemo(() => {
    return showMonths.map(m => {
      let budget = 0, actual = 0;
      filtered.forEach(item => {
        budget += (pnlMatrix[item.id]?.[m] || 0);
        if (item.actual != null && item.actual > 0) {
          // actual pnl: compute from actual value spread across billing freq
          const ap = calcPnLMonths({ ...item, budget: item.actual, actual: null });
          actual += ap[m] || 0;
        }
      });
      return { month: m, budget: Math.round(budget), actual: Math.round(actual) };
    });
  }, [filtered, showMonths, pnlMatrix]);

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = {};
    itemsWithPnL.forEach(i => {
      const k = i.itemCategory || "Unknown";
      if (!map[k]) map[k] = { name:k, value:0 };
      const total = Object.values(i.pnlMonths).reduce((s,v)=>s+v,0);
      map[k].value += total;
    });
    return Object.values(map).sort((a,b)=>b.value-a.value).slice(0,8).map(d=>({...d,value:Math.round(d.value)}));
  }, [itemsWithPnL]);

  // BU breakdown for P&L
  const buBreakdown = useMemo(() => {
    const map = {};
    itemsWithPnL.forEach(i => {
      const k = i.businessUnit || "Unknown";
      if (!map[k]) map[k] = { name:k, budget:0, actual:0 };
      const total = Object.values(i.pnlMonths).reduce((s,v)=>s+v,0);
      if (i.isActual) map[k].actual += total;
      else map[k].budget += total;
    });
    return Object.values(map).map(d=>({...d,budget:Math.round(d.budget),actual:Math.round(d.actual)})).sort((a,b)=>(b.budget+b.actual)-(a.budget+a.actual));
  }, [itemsWithPnL]);

  const buLabel  = selectedBUs.includes("all")  ? "All BUs"  : selectedBUs.length === 1 ? selectedBUs[0] : `${selectedBUs.length} BUs`;
  const fyLabel  = selectedFYs.includes("all")  ? "All FY"   : selectedFYs.length === 1 ? selectedFYs[0] : `${selectedFYs.length} periods`;
  const dropStyle = { background:"#09131D", border:"2px solid #5EEAD4", borderRadius:10, color:"#f1f5f9", padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8, minWidth:160 };
  const menuStyle = { position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:50, background:"#0F1B2B", border:"1px solid #213547", borderRadius:12, padding:8, minWidth:220, maxHeight:280, overflowY:"auto", boxShadow:"0 8px 32px #00000066" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Filter Bar ── */}
      <div style={{ background:"linear-gradient(135deg,#0C1722,#0F1B2B)", borderRadius:14, padding:"14px 20px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", border:"1px solid rgba(94,234,212,0.22)" }}>
        <span style={{ color:"#a5b4fc", fontWeight:800, fontSize:13, letterSpacing:"0.04em" }}>🎛️ FILTERS</span>

        {/* BU Multi-select */}
        <div style={{ position:"relative" }}>
          <button onClick={()=>setBuOpen(o=>!o)} style={dropStyle}>
            <span>🏢</span><span style={{flex:1,textAlign:"left"}}>{buLabel}</span>
            <span style={{color:"#5EEAD4",fontSize:10}}>{buOpen?"▲":"▼"}</span>
          </button>
          {buOpen && (
            <div style={menuStyle} onMouseLeave={()=>setBuOpen(false)}>
              {[{val:"all",display:"All BUs"},...buList.map(b=>({val:b,display:b}))].map(({val,display})=>{
                const active = val==="all" ? selectedBUs.includes("all") : selectedBUs.includes(val);
                return (
                  <div key={val} onClick={()=>toggleBU(val)} style={{ padding:"7px 12px", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", gap:10, background:active?"#1e1b4b":"transparent", color:active?"#a5b4fc":"#9fb3c8", fontWeight:active?700:500, fontSize:13, borderBottom:val==="all"?"1px solid #213547":"none", marginBottom:val==="all"?4:0 }}>
                    <span style={{ fontSize:11, width:16, height:16, borderRadius:4, background:active?"#5EEAD4":"#213547", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 }}>{active?"✓":""}</span>
                    {display}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FY Multi-select */}
        <div style={{ position:"relative" }}>
          <button onClick={()=>setFyOpen(o=>!o)} style={{...dropStyle, border:"2px solid #f59e0b"}}>
            <span>📅</span><span style={{flex:1,textAlign:"left"}}>{fyLabel}</span>
            <span style={{color:"#f59e0b",fontSize:10}}>{fyOpen?"▲":"▼"}</span>
          </button>
          {fyOpen && (
            <div style={menuStyle} onMouseLeave={()=>setFyOpen(false)}>
              {[{val:"all",display:"All FY"},...fyList.map(f=>({val:f,display:f}))].map(({val,display})=>{
                const active = val==="all" ? selectedFYs.includes("all") : selectedFYs.includes(val);
                return (
                  <div key={val} onClick={()=>toggleFY(val)} style={{ padding:"7px 12px", borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", gap:10, background:active?"#1c1505":"transparent", color:active?"#fbbf24":"#9fb3c8", fontWeight:active?700:500, fontSize:13, borderBottom:val==="all"?"1px solid #213547":"none", marginBottom:val==="all"?4:0 }}>
                    <span style={{ fontSize:11, width:16, height:16, borderRadius:4, background:active?"#f59e0b":"#213547", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 }}>{active?"✓":""}</span>
                    {display}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category */}
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}
          style={{ background:"#09131D", border:"2px solid #10b981", borderRadius:10, color:"#f1f5f9", padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer", outline:"none" }}>
          <option value="all">All Categories</option>
          {catList.map(c=><option key={c} value={c}>{c}</option>)}
        </select>

        {/* Reset */}
        {(!selectedBUs.includes("all") || !selectedFYs.includes("all") || filterCategory !== "all") && (
          <button onClick={()=>{setSelectedBUs(["all"]);setSelectedFYs(["all"]);setFilterCategory("all");}}
            style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, color:"#f87171", padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
            ✕ Reset
          </button>
        )}

        <div style={{ marginLeft:"auto", fontSize:12, color:"#88A0B8" }}>{filtered.length} items</div>
      </div>

      {/* ── Active filter pills ── */}
      {(!selectedBUs.includes("all") || !selectedFYs.includes("all")) && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
          <span style={{ color:"#475569", fontSize:11, fontWeight:700 }}>Active:</span>
          {!selectedBUs.includes("all") && selectedBUs.map(bu => (
            <span key={bu} style={{ background:"#0F1535", border:"1px solid #5EEAD4", borderRadius:999, padding:"3px 10px", fontSize:11, color:"#a5b4fc", fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
              🏢 {bu}
              <span onClick={()=>toggleBU(bu)} style={{cursor:"pointer", color:"#5EEAD4", marginLeft:2}}>×</span>
            </span>
          ))}
          {!selectedFYs.includes("all") && selectedFYs.map(fy => (
            <span key={fy} style={{ background:"#1c1505", border:"1px solid #f59e0b", borderRadius:999, padding:"3px 10px", fontSize:11, color:"#fbbf24", fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
              📅 {fy}
              <span onClick={()=>toggleFY(fy)} style={{cursor:"pointer", color:"#f59e0b", marginLeft:2}}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
        {[
          { label:"Total P&L Budget", value:`S$${Math.round(totalBudget).toLocaleString()}`, color:"#818cf8", icon:"💰" },
          { label:"Total P&L Actual", value:`S$${Math.round(totalActual).toLocaleString()}`, color:"#10b981", icon:"✅" },
          { label:"Utilisation", value:`${utilPct}%`, color:utilPct>100?"#f87171":utilPct>75?"#f59e0b":"#4ade80", icon:"📊" },
          { label:"Items w/ Actual", value:`${itemsWithActual} / ${filtered.length}`, color:"#06b6d4", icon:"📋" },
          { label:"Pending Actual", value:itemsPending, color:"#f59e0b", icon:"⏳" },
        ].map(k => (
          <div key={k.label} style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:12, padding:"14px 16px", border:`1px solid ${k.color}22` }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{k.icon}</div>
            <div style={{ color:"#88A0B8", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{k.label}</div>
            <div style={{ color:k.color, fontSize:20, fontWeight:900, fontFamily:"monospace" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        {/* Monthly P&L trend with slider */}
        <PnLTrendChart monthlyChartData={monthlyChartData} />

        {/* Category donut */}
        <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, padding:18 }}>
          <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🥧 P&L by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                {catBreakdown.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background:"#09131D", border:"1px solid #213547", borderRadius:8 }} formatter={v=>[`S$${v.toLocaleString()}`,""]} />
              <Legend wrapperStyle={{ fontSize:10, color:"#9fb3c8" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── BU P&L breakdown bars ── */}
      <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, padding:18 }}>
        <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:"0 0 14px" }}>🏢 P&L by Business Unit — Budget (pending) vs Actual (completed)</h3>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {buBreakdown.map((bu, i) => {
            const total = bu.budget + bu.actual;
            const maxTotal = Math.max(...buBreakdown.map(b=>b.budget+b.actual), 1);
            return (
              <div key={bu.name} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ color:"#f1f5f9", fontWeight:600, fontSize:12, minWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bu.name}</span>
                <div style={{ flex:1, display:"flex", height:10, borderRadius:5, overflow:"hidden", background:"#213547" }}>
                  <div style={{ width:`${(bu.actual/(maxTotal||1))*100}%`, background:"#10b981", transition:"width .4s" }} />
                  <div style={{ width:`${(bu.budget/(maxTotal||1))*100}%`, background:"#5EEAD4", transition:"width .4s" }} />
                </div>
                <span style={{ color:"#10b981", fontSize:11, minWidth:72, textAlign:"right" }}>S${bu.actual.toLocaleString()}</span>
                <span style={{ color:"#5EEAD4", fontSize:11, minWidth:72, textAlign:"right" }}>S${bu.budget.toLocaleString()}</span>
              </div>
            );
          })}
          <div style={{ display:"flex", gap:16, marginTop:4 }}>
            <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#10b981" }}><span style={{ width:10, height:10, borderRadius:2, background:"#10b981", display:"inline-block" }} /> Actual</span>
            <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#5EEAD4" }}><span style={{ width:10, height:10, borderRadius:2, background:"#5EEAD4", display:"inline-block" }} /> Budget (pending)</span>
          </div>
        </div>
      </div>

      {/* ── P&L Table ── */}
      <div style={{ background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, overflow:"hidden" }}>
        <div style={{ padding:"14px 16px", borderBottom:"1px solid #213547", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <h3 style={{ color:"#f1f5f9", fontSize:14, fontWeight:700, margin:0 }}>📊 P&L Spread — Month by Month</h3>
          <span style={{ background:"#052e16", border:"1px solid #10b981", borderRadius:999, padding:"2px 10px", fontSize:11, color:"#4ade80", fontWeight:700 }}>● Actual</span>
          <span style={{ background:"#0F1535", border:"1px solid #5EEAD4", borderRadius:999, padding:"2px 10px", fontSize:11, color:"#a5b4fc", fontWeight:700 }}>● Budget</span>
          <span style={{ color:"#475569", fontSize:11 }}>Values in SGD · Actual used where available, else Budget</span>
          <button
            onClick={() => {
              const ts = new Date().toISOString().slice(0,10);
              exportPnLCSV(itemsWithPnL, showMonths, colTotals, `PnL_Spread_${ts}.csv`);
            }}
            style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, background:"linear-gradient(135deg,#1a3a2a,#0f2a1a)", border:"1px solid rgba(94,234,212,0.4)", borderRadius:8, color:"#5EEAD4", padding:"6px 14px", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"'Montserrat',sans-serif" }}>
            ⬇ Export CSV
          </button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ background:"#09131D" }}>
                <th style={{ padding:"8px 12px", color:"#5EEAD4", fontWeight:700, textAlign:"left", minWidth:180, position:"sticky", left:0, background:"#09131D", zIndex:2 }}>Description</th>
                <th style={{ padding:"8px 10px", color:"#5EEAD4", fontWeight:700, textAlign:"left", minWidth:80 }}>BU</th>
                <th style={{ padding:"8px 10px", color:"#5EEAD4", fontWeight:700, textAlign:"right", minWidth:75 }}>Total</th>
                <th style={{ padding:"8px 10px", color:"#5EEAD4", fontWeight:700, textAlign:"left", minWidth:60 }}>Basis</th>
                {showMonths.map(m => <th key={m} style={{ padding:"6px 8px", color:"#9fb3c8", fontWeight:700, textAlign:"right", minWidth:58, whiteSpace:"nowrap" }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {itemsWithPnL.map((item, idx) => {
                const rowTotal = Object.values(item.pnlMonths).reduce((s,v)=>s+v,0);
                return (
                  <tr key={item.id} style={{ borderTop:"1px solid #1e293b", background: idx%2===0?"#1e293b":"#1a2744" }}>
                    <td style={{ padding:"6px 12px", color:"#f1f5f9", fontWeight:600, position:"sticky", left:0, background:idx%2===0?"#1e293b":"#1a2744", zIndex:1, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.description}</td>
                    <td style={{ padding:"6px 10px", color:"#9fb3c8", whiteSpace:"nowrap" }}>{item.businessUnit}</td>
                    <td style={{ padding:"6px 10px", color: item.isActual?"#10b981":"#818cf8", textAlign:"right", fontWeight:700 }}>{Math.round(rowTotal).toLocaleString()}</td>
                    <td style={{ padding:"6px 10px" }}>
                      <span style={{ fontSize:9, padding:"2px 6px", borderRadius:999, fontWeight:700, background:item.isActual?"#052e16":"#1e1b4b", color:item.isActual?"#4ade80":"#a5b4fc" }}>
                        {item.isActual?"ACT":"BDG"}
                      </span>
                    </td>
                    {showMonths.map(m => (
                      <td key={m} style={{ padding:"6px 8px", textAlign:"right", color: item.pnlMonths[m] ? (item.isActual?"#10b981":"#818cf8") : "#213547" }}>
                        {item.pnlMonths[m] ? Math.round(item.pnlMonths[m]).toLocaleString() : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr style={{ borderTop:"2px solid #5EEAD4", background:"#09131D" }}>
                <td colSpan={2} style={{ padding:"8px 12px", color:"#a5b4fc", fontWeight:800, position:"sticky", left:0, background:"#09131D", zIndex:1 }}>TOTAL</td>
                <td style={{ padding:"8px 10px", color:"#f59e0b", textAlign:"right", fontWeight:800 }}>{Math.round(Object.values(colTotals).reduce((s,v)=>s+v,0)).toLocaleString()}</td>
                <td></td>
                {showMonths.map(m => (
                  <td key={m} style={{ padding:"8px 8px", textAlign:"right", color:"#f59e0b", fontWeight:800 }}>
                    {Math.round(colTotals[m]||0).toLocaleString() || "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default PnlView;