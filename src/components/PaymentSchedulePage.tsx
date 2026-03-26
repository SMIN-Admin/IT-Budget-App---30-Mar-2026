"use client";

import { useMemo, useState } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parsePlanMonth(pm) {
  if (!pm) return null;
  const [m, y] = pm.split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y);
  return { month: mi, year };
}

const PNL_BREAKUP = { Monthly:1, Quarterly:3, "Half Yearly":6, Annual:12, "One Time Cost":12 };

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

function PaymentSchedulePage({ items }) {
  const T = { fontFamily:"'Montserrat',sans-serif" };
  const today = new Date();
  const payingBUs = ["all", ...[...new Set(items.map(i=>i.payingBU).filter(Boolean))].sort()];
  const [filterPayingBU, setFilterPayingBU] = useState("all");

  const monthKeys = [];
  for (let i=0; i<12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth()+i, 1);
    monthKeys.push(`${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`);
  }

  const scopedItems = filterPayingBU==="all" ? items : items.filter(i=>i.payingBU===filterPayingBU);

  const schedule = useMemo(() => {
    const map = {};
    monthKeys.forEach(mk => { map[mk] = { mk, items:[], total:0 }; });
    scopedItems.forEach(item => {
      // For payment schedule: use the plan month as the payment date for One Time Cost
      // and use full amount (not P&L spread) so the total matches actual outflows
      const p = parsePlanMonth(item.planMonth);
      if (!p) return;
      const costVal = (item.actual != null && item.actual > 0) ? item.actual : (parseFloat(item.budget) || 0);
      const billingFreq = item.billingFreq;

      if (billingFreq === "One Time Cost") {
        // Full payment in plan month only
        const mk = `${MONTHS[p.month]}-${String(p.year).slice(2)}`;
        if (map[mk] && costVal > 0) {
          map[mk].items.push({ ...item, pnlAmt:Math.round(costVal) });
          map[mk].total += costVal;
        }
      } else {
        // Recurring: use P&L monthly spread so each month shows its portion
        const pnl = calcPnLMonths(item);
        Object.entries(pnl).forEach(([mk, val]) => {
          if (map[mk] && val > 0) {
            map[mk].items.push({ ...item, pnlAmt:Math.round(val) });
            map[mk].total += val;
          }
        });
      }
    });
    return monthKeys.map(mk => ({ ...map[mk], total:Math.round(map[mk].total) }));
  }, [scopedItems]);

  const maxTotal = Math.max(...schedule.map(s=>s.total), 1);
  const peakMonth = schedule.reduce((a,b)=>b.total>a.total?b:a, schedule[0]);
  const grandTotal = schedule.reduce((s,d)=>s+d.total,0);

  const card = { background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, border:"1px solid rgba(94,234,212,0.12)", padding:"20px 22px", marginBottom:16 };
  const selStyle = { background:"#09131D", border:"1px solid #213547", borderRadius:8, color:"#f1f5f9", padding:"6px 12px", fontSize:12, ...T };

  return (
    <div style={T}>
      {/* Page header */}
      <div style={{ marginBottom:18 }}>
        <h2 style={{ color:"#E6FFFD", fontSize:18, fontWeight:900, margin:"0 0 14px 0" }}>📅 Payment Schedule — Next 12 Months</h2>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ color:"#9FB3C8", fontSize:12, fontWeight:700 }}>Paying BU:</span>
          <select value={filterPayingBU} onChange={e=>setFilterPayingBU(e.target.value)} style={selStyle}>
            <option value="all">All Paying BUs</option>
            {payingBUs.filter(b=>b!=="all").map(b=><option key={b} value={b}>{b}</option>)}
          </select>
          <div style={{ background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.4)", borderRadius:8, padding:"5px 14px", color:"#f59e0b", fontSize:12, fontWeight:700 }}>
            Peak: {peakMonth?.mk} · S${peakMonth?.total.toLocaleString()}
          </div>
          <div style={{ marginLeft:"auto", color:"#88A0B8", fontSize:12 }}>
            Total: <strong style={{ color:"#5EEAD4" }}>S${grandTotal.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Month cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
        {schedule.map(({mk, items:mItems, total})=>{
          const isPeak = mk===peakMonth?.mk;
          const intensity = total/maxTotal;
          return (
            <div key={mk} style={{ ...card, marginBottom:0, border:`1px solid ${isPeak?"rgba(245,158,11,0.5)":"rgba(94,234,212,0.12)"}`, padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ color:isPeak?"#f59e0b":"#5EEAD4", fontWeight:800, fontSize:13 }}>{mk}{isPeak?" 🔴 Peak":""}</span>
                <span style={{ color:"#f1f5f9", fontWeight:900, fontSize:14 }}>S${total.toLocaleString()}</span>
              </div>
              <div style={{ height:4, background:"#1e293b", borderRadius:2, marginBottom:10 }}>
                <div style={{ height:"100%", width:`${Math.round(intensity*100)}%`, background:intensity>0.8?"#ef4444":intensity>0.5?"#f59e0b":"#5EEAD4", borderRadius:2 }} />
              </div>
              {mItems.slice(0,5).map(it=>(
                <div key={it.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ color:"#9FB3C8", fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:170 }}>{it.description}</span>
                  <span style={{ color:"#5EEAD4", fontSize:11, fontWeight:600 }}>S${it.pnlAmt.toLocaleString()}</span>
                </div>
              ))}
              {mItems.length>5 && <div style={{ color:"#374151", fontSize:11, marginTop:3 }}>+{mItems.length-5} more items</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default PaymentSchedulePage;
