"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type BudgetItem = {
  id?: string | number;
  description?: string;
  businessUnit?: string;
  itemCategory?: string;
  expenseType?: string;
  planMonth?: string;
  fy?: string;
  budget?: number | string;
  actual?: number | null;
  status?: string;
  outsideBudget?: boolean | string;
  vendor?: string;
  payingBU?: string;
  billingFreq?: string;
  country?: string;
  remarks?: string;
};

type AIInsightsProps = {
  items: BudgetItem[];
  fxRates: Record<string, unknown>;
  role: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

function parsePlanMonth(pm?: string | null) {
  if (!pm) return null;
  const [m, y] = String(pm).split("-");
  const mi = MONTHS.indexOf(m as (typeof MONTHS)[number]);
  if (mi === -1) return null;
  const yy = Number(y);
  if (!Number.isFinite(yy)) return null;
  return { month: mi, year: 2000 + yy };
}

function getFY(planMonth?: string | null) {
  const p = parsePlanMonth(planMonth);
  if (!p) return "";
  const { month, year } = p;
  if (month >= 3 && month <= 8) return `${year + 1}-H1`;
  if (month >= 9) return `${year + 1}-H2`;
  return `${year}-H2`;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function isCompleted(status?: string | null) {
  return String(status || "").trim().toLowerCase() === "completed";
}

function isCancelled(status?: string | null) {
  const s = String(status || "").trim().toLowerCase();
  return s === "cancel" || s === "cancelled";
}

function isPending(status?: string | null) {
  const s = String(status || "").trim().toLowerCase();
  return s === "" || s === "pending";
}

function isOutsideBudget(item: BudgetItem) {
  return (
    item.outsideBudget === true ||
    String(item.outsideBudget || "").toLowerCase() === "true" ||
    String(item.status || "").trim().toLowerCase() === "outside budget"
  );
}

function money(n: number) {
  return `S$${Math.round(n).toLocaleString()}`;
}

function safePct(numr: number, den: number) {
  if (!den) return 0;
  return Math.round((numr / den) * 100);
}

function topN<T>(arr: T[], n: number, getter: (x: T) => number) {
  return [...arr].sort((a, b) => getter(b) - getter(a)).slice(0, n);
}

function normaliseText(s: string) {
  return s.toLowerCase().replace(/[^\w\s&-]/g, " ").replace(/\s+/g, " ").trim();
}

function findOne(query: string, values: string[]) {
  const nq = normaliseText(query);
  return values.find((v) => nq.includes(normaliseText(v)));
}

function findFY(query: string, fyList: string[]) {
  const direct = fyList.find((fy) => query.toLowerCase().includes(fy.toLowerCase()));
  if (direct) return direct;
  const m = query.match(/\b(20\d{2})\s*[- ]?\s*(h1|h2)\b/i);
  if (m) {
    const fy = `${m[1]}-${m[2].toUpperCase()}`;
    if (fyList.includes(fy)) return fy;
  }
  return "";
}

function buildDataset(items: BudgetItem[], fxRates: Record<string, unknown>) {
  const enriched = items.map((item) => {
    const budget = num(item.budget);
    const actualRaw = item.actual;
    const actual = actualRaw == null || actualRaw === "" ? null : num(actualRaw);
    const fy = item.fy || getFY(item.planMonth);
    const status = String(item.status || "").trim();
    const amount = actual != null && actual > 0 ? actual : budget;
    const savings = actual != null ? budget - actual : 0;

    return {
      ...item,
      fy,
      budget,
      actual,
      amount,
      savings,
      status,
      businessUnit: item.businessUnit || "Unknown",
      itemCategory: item.itemCategory || "Unknown",
      expenseType: item.expenseType || "Unknown",
      vendor: item.vendor || "Unknown",
      payingBU: item.payingBU || "Unknown",
      country: item.country || "Unknown",
      description: item.description || "Unknown Item",
      outsideBudget: isOutsideBudget(item),
    };
  });

  const fys = [...new Set(enriched.map((i) => i.fy).filter(Boolean))].sort();
  const businessUnits = [...new Set(enriched.map((i) => i.businessUnit).filter(Boolean))].sort();
  const categories = [...new Set(enriched.map((i) => i.itemCategory).filter(Boolean))].sort();
  const vendors = [...new Set(enriched.map((i) => i.vendor).filter(Boolean))].sort();

  const totalBudget = enriched.reduce((s, i) => s + i.budget, 0);
  const totalActual = enriched.reduce((s, i) => s + (i.actual || 0), 0);
  const totalSavings = enriched.reduce((s, i) => s + (i.actual != null ? i.savings : 0), 0);
  const outsideItems = enriched.filter((i) => i.outsideBudget);
  const outsideBudgetTotal = outsideItems.reduce((s, i) => s + i.amount, 0);

  const fySummary = fys.map((fy) => {
    const arr = enriched.filter((i) => i.fy === fy);
    const budget = arr.reduce((s, i) => s + i.budget, 0);
    const actual = arr.reduce((s, i) => s + (i.actual || 0), 0);
    return {
      fy,
      items: arr.length,
      budget,
      actual,
      utilisation: safePct(actual, budget),
      completed: arr.filter((i) => isCompleted(i.status)).length,
      pending: arr.filter((i) => isPending(i.status)).length,
      cancelled: arr.filter((i) => isCancelled(i.status)).length,
      outsideBudget: arr.filter((i) => i.outsideBudget).length,
    };
  });

  const inrRate =
    Number((fxRates as any)?.INR) ||
    Number((fxRates as any)?.["SGD_TO_INR"]) ||
    Number((fxRates as any)?.["INR_RATE"]) ||
    0;

  return { items: enriched, fys, businessUnits, categories, vendors, totalBudget, totalActual, totalSavings, outsideItems, outsideBudgetTotal, fySummary, inrRate };
}

function makeList(rows: string[]) {
  return rows.map((r) => `- ${r}`);
}

function answerQuestion(query: string, dataset: ReturnType<typeof buildDataset>) {
  const q = normaliseText(query);
  const fy = findFY(query, dataset.fys);
  const bu = findOne(query, dataset.businessUnits);
  const category = findOne(query, dataset.categories);
  const vendor = findOne(query, dataset.vendors);

  let scoped = dataset.items;
  if (fy) scoped = scoped.filter((i) => i.fy === fy);
  if (bu) scoped = scoped.filter((i) => i.businessUnit === bu);
  if (category) scoped = scoped.filter((i) => i.itemCategory === category);
  if (vendor) scoped = scoped.filter((i) => i.vendor === vendor);

  const scopedBudget = scoped.reduce((s, i) => s + i.budget, 0);
  const scopedActual = scoped.reduce((s, i) => s + (i.actual || 0), 0);
  const scopedSavings = scoped.reduce((s, i) => s + (i.actual != null ? i.savings : 0), 0);
  const scopeBits = [fy ? `FY ${fy}` : "", bu ? `BU ${bu}` : "", category ? `Category ${category}` : "", vendor ? `Vendor ${vendor}` : ""].filter(Boolean);
  const scopeTitle = scopeBits.length ? `Scope: ${scopeBits.join(" · ")}` : "Scope: Entire loaded budget dataset";

  if (q.includes("outside budget")) {
    const arr = fy ? dataset.outsideItems.filter((i) => i.fy === fy) : dataset.outsideItems;
    const total = arr.reduce((s, i) => s + i.amount, 0);
    const byFy = dataset.fys.map((oneFy) => ({ fy: oneFy, amt: arr.filter((i) => i.fy === oneFy).reduce((s, i) => s + i.amount, 0) })).filter((x) => x.amt > 0);
    const itemLines = arr.length ? arr.slice(0, 20).map((i) => `${i.description} (${i.businessUnit} · ${i.fy}) — ${money(i.amount)}`) : ["No outside-budget items found in the current dataset."];
    const out = [
      "Outside Budget Summary",
      "",
      scopeTitle,
      `- Total Outside Budget: ${money(total)}`,
      `- Items: ${arr.length}`,
      "",
      "Breakdown by FY:",
      ...makeList(byFy.map((x) => `${x.fy}: ${money(x.amt)}`)),
      "",
      "Items:",
      ...makeList(itemLines),
    ];
    if (dataset.inrRate) out.push("", `Approx. INR Value: INR ${Math.round(total * dataset.inrRate).toLocaleString()} (rate ${dataset.inrRate})`);
    return out.join("\n");
  }

  if ((q.includes("capex") && q.includes("opex")) || q.includes("split")) {
    const capex = scoped.filter((i) => String(i.expenseType).toLowerCase() === "capex").reduce((s, i) => s + i.budget, 0);
    const opex = scoped.filter((i) => String(i.expenseType).toLowerCase() === "opex").reduce((s, i) => s + i.budget, 0);
    const total = capex + opex;
    return ["Capex vs Opex Split", "", scopeTitle, `- Capex: ${money(capex)} (${safePct(capex, total)}%)`, `- Opex: ${money(opex)} (${safePct(opex, total)}%)`, `- Total: ${money(total)}`].join("\n");
  }

  if (q.includes("top") && q.includes("vendor")) {
    const rows = topN(dataset.vendors.map((v) => {
      const arr = scoped.filter((i) => i.vendor === v);
      return { vendor: v, budget: arr.reduce((s, i) => s + i.budget, 0), actual: arr.reduce((s, i) => s + (i.actual || 0), 0) };
    }).filter((x) => x.budget > 0 || x.actual > 0), 5, (x) => x.actual > 0 ? x.actual : x.budget);
    return ["Top Vendors by Spend", "", scopeTitle, ...makeList(rows.map((r, idx) => `${idx + 1}. ${r.vendor} — Budget ${money(r.budget)} | Actual ${money(r.actual)}`))].join("\n");
  }

  if ((q.includes("highest") || q.includes("top")) && (q.includes("bu") || q.includes("business unit"))) {
    const rows = topN(dataset.businessUnits.map((b) => {
      const arr = scoped.filter((i) => i.businessUnit === b);
      return { bu: b, budget: arr.reduce((s, i) => s + i.budget, 0), actual: arr.reduce((s, i) => s + (i.actual || 0), 0) };
    }).filter((x) => x.budget > 0 || x.actual > 0), 5, (x) => x.actual > 0 ? x.actual : x.budget);
    return ["Top Business Units by Spend", "", scopeTitle, ...makeList(rows.map((r, idx) => `${idx + 1}. ${r.bu} — Budget ${money(r.budget)} | Actual ${money(r.actual)}`))].join("\n");
  }

  if (q.includes("trend") || (q.includes("budget") && q.includes("fy")) || q.includes("each fy")) {
    const rows = dataset.fySummary.filter((r) => !fy || r.fy === fy).map((r) => `${r.fy} — Budget ${money(r.budget)} | Actual ${money(r.actual)} | Utilisation ${r.utilisation}% | Items ${r.items}`);
    return ["Budget / Actual by FY", "", ...makeList(rows)].join("\n");
  }

  if ((q.includes("overspend") || q.includes("variance")) && (q.includes("category") || q.includes("categories"))) {
    const rows = dataset.categories.map((c) => {
      const arr = scoped.filter((i) => i.itemCategory === c);
      const budget = arr.reduce((s, i) => s + i.budget, 0);
      const actual = arr.reduce((s, i) => s + (i.actual || 0), 0);
      return { category: c, budget, actual, variance: budget - actual };
    }).filter((x) => x.budget > 0 || x.actual > 0).sort((a, b) => a.variance - b.variance).slice(0, 8);
    return ["Categories with Highest Overspend / Variance Risk", "", scopeTitle, ...makeList(rows.map((r) => `${r.category} — Budget ${money(r.budget)} | Actual ${money(r.actual)} | Variance ${r.variance >= 0 ? money(r.variance) : `-${money(Math.abs(r.variance)).replace("S$", "S$")}`}`))].join("\n");
  }

  if (q.includes("pending") || q.includes("completed") || q.includes("cancelled") || q.includes("status")) {
    const completed = scoped.filter((i) => isCompleted(i.status)).length;
    const pending = scoped.filter((i) => isPending(i.status)).length;
    const cancelled = scoped.filter((i) => isCancelled(i.status)).length;
    const moved = scoped.filter((i) => String(i.status).toLowerCase() === "move to another half").length;
    const unused = scoped.filter((i) => String(i.status).toLowerCase() === "unused").length;
    return ["Status Summary", "", scopeTitle, `- Total Items: ${scoped.length}`, `- Completed: ${completed}`, `- Pending: ${pending}`, `- Cancelled: ${cancelled}`, `- Move to Another Half: ${moved}`, `- Unused: ${unused}`].join("\n");
  }

  if (q.includes("utilisation") || q.includes("utilization")) {
    return ["Budget Utilisation", "", scopeTitle, `- Budget: ${money(scopedBudget)}`, `- Actual: ${money(scopedActual)}`, `- Utilisation: ${safePct(scopedActual, scopedBudget)}%`, `- Realised Savings / Variance: ${scopedSavings >= 0 ? money(scopedSavings) : `-${money(Math.abs(scopedSavings)).replace("S$", "S$")}`}`].join("\n");
  }

  if (q.includes("budget") || q.includes("actual") || q.includes("savings") || q.includes("summary") || q.includes("total")) {
    return ["Budget Summary", "", scopeTitle, `- Items: ${scoped.length}`, `- Budget: ${money(scopedBudget)}`, `- Actual: ${money(scopedActual)}`, `- Savings / Variance: ${scopedSavings >= 0 ? money(scopedSavings) : `-${money(Math.abs(scopedSavings)).replace("S$", "S$")}`}`, `- Utilisation: ${safePct(scopedActual, scopedBudget)}%`].join("\n");
  }

  return [
    "I can answer budget questions from the data loaded in this app.",
    "",
    scopeTitle,
    "",
    "Try asking one of these:",
    ...makeList([
      "total budget for each FY",
      "highest spend BU in 2026-H2",
      "top 5 vendors by spend",
      "outside budget summary",
      "capex vs opex split",
      "status summary for 2026-H1",
    ]),
  ].join("\n");
}

function renderRichText(text: string, T: React.CSSProperties) {
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    if (!line.startsWith("- ") && line.endsWith("Summary")) return <div key={i} style={{ color: "#E6FFFD", fontWeight: 800, fontSize: 14, margin: "8px 0 4px", ...T }}>{line}</div>;
    if (!line.startsWith("- ") && /:$/.test(line)) return <div key={i} style={{ color: "#DDE9F8", fontWeight: 700, margin: "8px 0 4px", ...T }}>{line}</div>;
    if (line.startsWith("- ")) return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}><span style={{ color: "#5EEAD4", flexShrink: 0 }}>▸</span><span>{line.slice(2)}</span></div>;
    return <div key={i} style={{ marginBottom: 2 }}>{line}</div>;
  });
}

export default function AIInsights({ items, fxRates, role }: AIInsightsProps) {
  const T = { fontFamily: "'Montserrat',sans-serif" } as const;
  const todayKey = new Date().toISOString().slice(0, 10);
  const storageKey = `itbudget_ai_chat_${todayKey}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const dataset = useMemo(() => buildDataset(items, fxRates), [items, fxRates]);
  const isAdmin = role === "admin";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch (error) { console.error("Failed to save AI chat:", error); }
  }, [messages, storageKey]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const sendMessage = async (userMsg: string) => {
    const trimmed = userMsg.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const answer = answerQuestion(trimmed, dataset);
      await new Promise((r) => setTimeout(r, 180));
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTED = [
    "Total IT budget for each FY half",
    "Which BU has highest spend in 2026-H2",
    "Top 5 vendors by total spend",
    "Overall Capex vs Opex split",
    "All outside-budget items and their SGD impact",
    "Status summary for 2026-H1",
    "Budget utilisation trend across FY halves",
    "Categories with overspend risk",
  ];

  const card = { background: "linear-gradient(145deg,#0F1B2B,#0C1722)", borderRadius: 14, border: "1px solid rgba(94,234,212,0.12)" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, ...T, height: "calc(100vh - 180px)", minHeight: 580 }}>
      <div style={{ ...card, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#22D3EE,#2DD4BF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧠</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: "#5EEAD4", fontWeight: 800, fontSize: 13 }}>Budget Insight Assistant</div>
          <div style={{ color: "#8AA0B7", fontSize: 11, marginTop: 1 }}>Answers are generated only from the budget data currently loaded in this app. No outside browsing, no external knowledge.</div>
        </div>
        {isAdmin && <div style={{ background: "rgba(94,234,212,0.08)", border: "1px solid rgba(94,234,212,0.30)", borderRadius: 9, padding: "8px 16px", color: "#5EEAD4", fontSize: 12, fontWeight: 700 }}>App-grounded mode</div>}
      </div>

      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.length === 0 && <div style={{ textAlign: "center", paddingTop: 10 }}><div style={{ fontSize: 44, marginBottom: 10 }}>✨</div><div style={{ color: "#E0E7FF", fontWeight: 800, fontSize: 17, marginBottom: 5, ...T }}>Ask anything about your IT budget</div><div style={{ color: "#6B7280", fontSize: 12, marginBottom: 20, ...T }}>Grounded on loaded app data · {dataset.items.length} items · {dataset.fys.length} FY halves</div><div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 760, margin: "0 auto" }}>{SUGGESTED.map((q, i) => <button key={i} onClick={() => void sendMessage(q)} style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.17)", borderRadius: 20, color: "#9FB3C8", padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 600, maxWidth: 280, ...T }}>{q}</button>)}</div></div>}

          {messages.map((msg, i) => <div key={i} style={{ display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}><div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: msg.role === "user" ? "linear-gradient(135deg,#22D3EE,#2DD4BF)" : "linear-gradient(135deg,#4285F4,#0F9D58)" }}>{msg.role === "user" ? "👤" : "📊"}</div><div style={{ maxWidth: "78%", background: msg.role === "user" ? "rgba(79,70,229,0.18)" : "rgba(0,0,0,0.28)", border: `1px solid ${msg.role === "user" ? "rgba(94,234,212,0.22)" : "rgba(255,255,255,0.05)"}`, borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px", padding: "12px 16px" }}><div style={{ color: msg.role === "user" ? "#E6FFFD" : "#9FB3C8", fontSize: 12, lineHeight: 1.75, ...T }}>{msg.role === "assistant" ? renderRichText(msg.text, T) : msg.text}</div></div></div>)}

          {loading && <div style={{ display: "flex", gap: 10 }}><div style={{ width: 30, height: 30, borderRadius: 999, background: "linear-gradient(135deg,#4285F4,#0F9D58)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>📊</div><div style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px 14px 14px 14px", padding: "13px 18px", display: "flex", gap: 6, alignItems: "center" }}>{[0,1,2].map((i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 999, background: "#4285F4", animation: `aibounce 1.2s ${i * 0.2}s infinite` }} />)}<style>{`@keyframes aibounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}`}</style><span style={{ color: "#374151", fontSize: 11, marginLeft: 4, ...T }}>Analysing loaded budget data…</span></div></div>}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: "1px solid rgba(94,234,212,0.10)", padding: "12px 18px", display: "flex", gap: 10, flexShrink: 0, background: "rgba(0,0,0,0.15)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }} placeholder="Ask about budget, actuals, utilisation, vendors, BU, FY, categories…" disabled={loading} style={{ flex: 1, background: "rgba(0,0,0,0.38)", border: "1px solid rgba(66,133,244,0.35)", borderRadius: 10, color: "#E5E7EB", padding: "10px 16px", fontSize: 13, outline: "none", ...T }} />
          <button onClick={() => void sendMessage(input)} disabled={!input.trim() || loading} style={{ background: !input.trim() || loading ? "rgba(66,133,244,0.20)" : "linear-gradient(135deg,#4285F4,#0F9D58)", border: "none", borderRadius: 10, color: "#fff", padding: "10px 22px", cursor: !input.trim() || loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, ...T, flexShrink: 0 }}>{loading ? "⏳" : "Send ↗"}</button>
          {messages.length > 0 && <button onClick={() => setMessages([])} style={{ background: "rgba(71,85,105,0.2)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 10, color: "#6B7280", padding: "10px 14px", cursor: "pointer", fontSize: 12, ...T }}>Clear</button>}
        </div>
      </div>

      <div style={{ ...card, padding: "10px 18px", flexShrink: 0, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "#374151", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Data context</span>
        {[[dataset.items.length, "items"], [dataset.fys.length, "FY halves"], [dataset.businessUnits.length, "BUs"], [dataset.categories.length, "categories"], [dataset.vendors.length, "vendors"]].map(([n, l]) => <div key={String(l)} style={{ display: "flex", gap: 5, alignItems: "baseline" }}><span style={{ color: "#4285F4", fontWeight: 800, fontSize: 14, ...T }}>{String(n)}</span><span style={{ color: "#374151", fontSize: 11, ...T }}>{String(l)}</span></div>)}
        <div style={{ marginLeft: "auto", color: "#374151", fontSize: 10, ...T }}>App-only budget reasoning</div>
      </div>
    </div>
  );
}
