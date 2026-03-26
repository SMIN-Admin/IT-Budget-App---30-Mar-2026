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

function CashFlowForecast({ items }) {
  const T = { fontFamily:"'Montserrat',sans-serif" };
  const [months, setMonths] = useState(12);

  // Build 12-month rolling from today
  const today = new Date();
  const monthKeys = [];
  for (let i=0; i<months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth()+i, 1);
    monthKeys.push(`${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`);
  }

  const data = useMemo(() => {
    return monthKeys.map(mk => {
      let committed=0, pending=0;
      items.forEach(item => {
        const hasActual = item.actual != null && item.actual > 0;
        const isBlankStatus = !item.status || item.status === "";
        const isCancelled = item.status === "Cancel";

        // Get the plan month key for this item
        const p = parsePlanMonth(item.planMonth);
        if (!p) return;
        const itemMk = `${MONTHS[p.month]}-${String(p.year).slice(2)}`;

        // Cash flow: money moves in the plan month (full amount, not P&L spread)
        if (itemMk !== mk) return;

        const budgetAmt = parseFloat(item.budget) || 0;
        const actualAmt = item.actual || 0;

        if (hasActual) {
          // Actual recorded → committed with actual amount
          committed += actualAmt;
        } else if (!isCancelled && isBlankStatus) {
          // Blank status, no actual → pending with budget amount
          pending += budgetAmt;
        }
        // Any other status or cancelled → excluded
      });
      return { mk, committed:Math.round(committed), pending:Math.round(pending), total:Math.round(committed+pending) };
    });
  }, [items, months]);

  const maxVal = Math.max(...data.map(d=>d.total), 1);
  let cumulative = 0;
  const dataWithCum = data.map(d => { cumulative += d.total; return { ...d, cumulative }; });

  const card = { background:"linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius:14, border:"1px solid rgba(94,234,212,0.12)", padding:"20px 22px", marginBottom:16 };

  return (
    <div style={T}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ color:"#E6FFFD", fontSize:18, fontWeight:900, margin:"0 0 14px 0" }}>💸 12-Month Rolling Cash Flow Forecast</h2>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <select value={months} onChange={e=>setMonths(Number(e.target.value))} style={{ background:"#09131D", border:"1px solid #5EEAD4", borderRadius:8, color:"#f1f5f9", padding:"6px 12px", fontSize:12, ...T }}>
            {[6,12,18,24].map(n=><option key={n} value={n}>{n} months</option>)}
          </select>
          <button onClick={()=>{ const ts=new Date().toISOString().slice(0,10); exportCSV(dataWithCum.map(d=>({month:d.mk,committed:d.committed,pending:d.pending,total:d.total,cumulative:d.cumulative})),`CashFlow_${ts}.csv`); }}
            style={{ marginLeft:"auto", background:"linear-gradient(135deg,#1a3a2a,#0f2a1a)", border:"1px solid rgba(94,234,212,0.35)", borderRadius:8, color:"#5EEAD4", padding:"6px 14px", cursor:"pointer", fontWeight:700, fontSize:12, ...T }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        {[["💰","Total Committed",data.reduce((s,d)=>s+d.committed,0),"#10b981"],["⏳","Total Pending",data.reduce((s,d)=>s+d.pending,0),"#f59e0b"],["📊","Total Forecast",data.reduce((s,d)=>s+d.total,0),"#5EEAD4"],["📈","Peak Month",data.reduce((a,b)=>b.total>a.total?b:a,data[0]||{total:0}).mk||"—","#a78bfa"]].map(([icon,lbl,val,color])=>(
          <div key={lbl} style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", border:`1px solid ${color}22`, flex:1, minWidth:140 }}>
            <div style={{ color, fontWeight:900, fontSize:18, ...T }}>{typeof val==="number"?`S$${val.toLocaleString()}`:val}</div>
            <div style={{ color:"#9FB3C8", fontSize:12, ...T }}>{icon} {lbl}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={card}>
        <div style={{ color:"#5EEAD4", fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>Monthly Cash Outflow (SGD)</div>
        <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:180, overflowX:"auto" }}>
          {dataWithCum.map(({mk,committed,pending,total})=>{
            const h = Math.round((total/maxVal)*160);
            const ch = Math.round((committed/maxVal)*160);
            return (
              <div key={mk} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, minWidth:52, flex:1 }}>
                <div style={{ fontSize:9, color:"#374151", ...T }}>{total>0?`${(total/1000).toFixed(0)}K`:""}</div>
                <div style={{ width:"100%", height:h, background:"#1e293b", borderRadius:"4px 4px 0 0", position:"relative", overflow:"hidden", minHeight:4 }}>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${committed>0?Math.round(ch/Math.max(h,1)*100):0}%`, background:"#10b981", borderRadius:"0" }} />
                  <div style={{ position:"absolute", bottom:`${committed>0?Math.round(ch/Math.max(h,1)*100):0}%`, left:0, right:0, height:`${Math.round((pending/maxVal)*160/Math.max(h,1)*100)}%`, background:"#f59e0b" }} />
                </div>
                <div style={{ fontSize:10, color:"#6B7280", ...T, textAlign:"center" }}>{mk}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:12 }}>
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#10b981" }}><span style={{ width:10, height:10, borderRadius:2, background:"#10b981", display:"inline-block" }} />Committed (Actual recorded)</span>
          <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#f59e0b" }}><span style={{ width:10, height:10, borderRadius:2, background:"#f59e0b", display:"inline-block" }} />Pending (Budget estimate)</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflowX:"auto" }}>
        <div style={{ color:"#5EEAD4", fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>Month-by-Month Detail</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, ...T }}>
          <thead>
            <tr style={{ background:"#09131D" }}>
              {["Month","Committed (SGD)","Pending (SGD)","Total (SGD)","Cumulative (SGD)"].map(h=>(
                <th key={h} style={{ padding:"8px 12px", color:"#5EEAD4", fontWeight:700, textAlign:"left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataWithCum.map(({mk,committed,pending,total,cumulative},i)=>(
              <tr key={mk} style={{ background:i%2===0?"#1e293b":"#1a2744" }}>
                <td style={{ padding:"7px 12px", color:"#CBD5E1", fontWeight:600 }}>{mk}</td>
                <td style={{ padding:"7px 12px", color:"#10b981" }}>{committed>0?`S$${committed.toLocaleString()}`:"—"}</td>
                <td style={{ padding:"7px 12px", color:"#f59e0b" }}>{pending>0?`S$${pending.toLocaleString()}`:"—"}</td>
                <td style={{ padding:"7px 12px", color:"#5EEAD4", fontWeight:700 }}>{total>0?`S$${total.toLocaleString()}`:"—"}</td>
                <td style={{ padding:"7px 12px", color:"#a78bfa" }}>S${cumulative.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default CashFlowForecast;