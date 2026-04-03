
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
  location?: string;
  city?: string;
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

type DataRow = {
  id: string;
  description: string;
  businessUnit: string;
  itemCategory: string;
  expenseType: string;
  planMonth: string;
  fy: string;
  budget: number;
  actual: number | null;
  amount: number;
  status: string;
  outsideBudget: boolean;
  vendor: string;
  payingBU: string;
  billingFreq: string;
  country: string;
  location: string;
  city: string;
  remarks: string;
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

function prettyMonth(date: Date) {
  return `${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function money(n: number) {
  return `S$${Math.round(n).toLocaleString()}`;
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string) {
  return normalise(text).split(" ").filter(Boolean);
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((p) => text.includes(p));
}

function uniqueSorted(values: Array<string | undefined | null>) {
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))].sort();
}

function canonicalStatus(status?: string | null) {
  const s = normalise(String(status || ""));
  if (!s) return "Pending";
  if (s === "cancel" || s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "completed") return "Completed";
  if (s === "move to another half") return "Move to another half";
  if (s === "unused") return "Unused";
  if (s === "outside budget") return "Outside Budget";
  return String(status || "").trim();
}

function isCompleted(status?: string | null) {
  return canonicalStatus(status) === "Completed";
}

function isCancelled(status?: string | null) {
  return canonicalStatus(status) === "Cancelled";
}

function isPending(status?: string | null) {
  return canonicalStatus(status) === "Pending";
}

function isOutsideBudget(item: BudgetItem) {
  return (
    item.outsideBudget === true ||
    String(item.outsideBudget || "").toLowerCase() === "true" ||
    canonicalStatus(item.status) === "Outside Budget"
  );
}

function recurringMonths(freq?: string | null) {
  const f = normalise(String(freq || ""));
  if (f === "monthly") return 1;
  if (f === "quarterly") return 3;
  if (f === "half yearly" || f === "half-yearly" || f === "halfyearly") return 6;
  if (f === "annual" || f === "yearly") return 12;
  return 0;
}

function addMonths(d: Date, months: number) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function scoreTextMatch(question: string, row: DataRow) {
  const qTokens = new Set(tokens(question));
  const hay = tokens([
    row.description,
    row.businessUnit,
    row.itemCategory,
    row.vendor,
    row.payingBU,
    row.country,
    row.location,
    row.city,
    row.expenseType,
    row.status,
    row.fy,
    row.remarks,
    row.billingFreq,
  ].join(" "));
  let score = 0;
  hay.forEach((t) => {
    if (qTokens.has(t)) score += 1;
  });
  return score;
}

function buildData(items: BudgetItem[], fxRates: Record<string, unknown>) {
  const rows: DataRow[] = items.map((item) => {
    const budget = num(item.budget);
    const actual = item.actual == null ? null : num(item.actual);
    return {
      id: String(item.id ?? `${item.description || "item"}-${item.planMonth || ""}-${item.businessUnit || ""}`),
      description: item.description || "Unknown Item",
      businessUnit: item.businessUnit || "Unknown BU",
      itemCategory: item.itemCategory || "Unknown Category",
      expenseType: item.expenseType || "Unknown Expense Type",
      planMonth: item.planMonth || "",
      fy: item.fy || getFY(item.planMonth),
      budget,
      actual,
      amount: actual != null && actual > 0 ? actual : budget,
      status: canonicalStatus(item.status),
      outsideBudget: isOutsideBudget(item),
      vendor: item.vendor || "Unknown Vendor",
      payingBU: item.payingBU || "Unknown Paying BU",
      billingFreq: item.billingFreq || "",
      country: item.country || "",
      location: item.location || "",
      city: item.city || item.location || item.country || "",
      remarks: item.remarks || "",
    };
  });

  return {
    rows,
    fys: uniqueSorted(rows.map((r) => r.fy)),
    businessUnits: uniqueSorted(rows.map((r) => r.businessUnit)),
    categories: uniqueSorted(rows.map((r) => r.itemCategory)),
    vendors: uniqueSorted(rows.map((r) => r.vendor)),
    payingBUs: uniqueSorted(rows.map((r) => r.payingBU)),
    locations: uniqueSorted(rows.map((r) => r.city || r.location || r.country)),
    inrRate:
      Number((fxRates as any)?.INR) ||
      Number((fxRates as any)?.SGD_TO_INR) ||
      Number((fxRates as any)?.INR_RATE) ||
      0,
  };
}

function findFY(question: string, fyList: string[]) {
  const q = question.toLowerCase();
  const direct = fyList.find((fy) => q.includes(fy.toLowerCase()));
  if (direct) return direct;
  const m = q.match(/\b(20\d{2})\s*[- ]?\s*(h1|h2)\b/i);
  if (!m) return null;
  return `${m[1]}-${m[2].toUpperCase()}`;
}

function findOne(question: string, list: string[]) {
  const q = normalise(question);
  const sorted = [...list].sort((a, b) => b.length - a.length);
  return sorted.find((v) => q.includes(normalise(v))) || null;
}

function findMultiple(question: string, list: string[]) {
  const q = normalise(question);
  return [...list]
    .sort((a, b) => b.length - a.length)
    .filter((v) => q.includes(normalise(v)))
    .slice(0, 4);
}

function applyScope(data: ReturnType<typeof buildData>, question: string) {
  const fy = findFY(question, data.fys);
  const bu = findOne(question, data.businessUnits);
  const category = findOne(question, data.categories);
  const vendor = findOne(question, data.vendors);
  const payingBU = findOne(question, data.payingBUs);
  const location = findOne(question, data.locations);

  const rows = data.rows.filter((r) => {
    if (fy && r.fy !== fy) return false;
    if (bu && r.businessUnit !== bu) return false;
    if (category && r.itemCategory !== category) return false;
    if (vendor && r.vendor !== vendor) return false;
    if (payingBU && r.payingBU !== payingBU) return false;
    if (location) {
      const locs = [r.city, r.location, r.country].map((x) => normalise(String(x || "")));
      if (!locs.includes(normalise(location))) return false;
    }
    return true;
  });

  return { fy, bu, category, vendor, payingBU, location, rows };
}

function scopeText(scope: ReturnType<typeof applyScope>) {
  const parts: string[] = [];
  if (scope.fy) parts.push(`FY: ${scope.fy}`);
  if (scope.bu) parts.push(`BU: ${scope.bu}`);
  if (scope.payingBU) parts.push(`Paying BU: ${scope.payingBU}`);
  if (scope.category) parts.push(`Category: ${scope.category}`);
  if (scope.vendor) parts.push(`Vendor: ${scope.vendor}`);
  if (scope.location) parts.push(`Location: ${scope.location}`);
  return parts.length ? `Scope: ${parts.join(" | ")}` : "Scope: Entire loaded app dataset";
}

function groupedSpend(rows: DataRow[], key: keyof DataRow) {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const k = String(r[key] || "Unknown");
    map.set(k, (map.get(k) || 0) + r.amount);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function groupedBudgetActual(rows: DataRow[], key: keyof DataRow) {
  const map = new Map<string, { budget: number; actual: number; items: number }>();
  rows.forEach((r) => {
    const k = String(r[key] || "Unknown");
    const prev = map.get(k) || { budget: 0, actual: 0, items: 0 };
    prev.budget += r.budget;
    prev.actual += r.actual || 0;
    prev.items += 1;
    map.set(k, prev);
  });
  return [...map.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.budget - a.budget);
}

function nextRenewal(rows: DataRow[]) {
  const today = new Date();
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const candidates = rows
    .map((r) => {
      const parsed = parsePlanMonth(r.planMonth);
      const cycle = recurringMonths(r.billingFreq);
      if (!parsed || !cycle) return null;

      let d = new Date(parsed.year, parsed.month, 1);
      while (d < startOfCurrentMonth) {
        d = addMonths(d, cycle);
      }

      return { ...r, renewalDate: d };
    })
    .filter(Boolean) as Array<DataRow & { renewalDate: Date }>;

  candidates.sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime());
  return candidates[0] || null;
}

function format(lines: string[]) {
  return lines.filter(Boolean).join("\n\n");
}

function fallbackAnswer(question: string, scopedRows: DataRow[], scope: ReturnType<typeof applyScope>) {
  const matches = scopedRows
    .map((r) => ({ row: r, score: scoreTextMatch(question, r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.row.amount - a.row.amount)
    .slice(0, 5);

  if (!matches.length) {
    const totalBudget = scopedRows.reduce((s, r) => s + r.budget, 0);
    const totalActual = scopedRows.reduce((s, r) => s + (r.actual || 0), 0);
    return format([
      "I checked the app data and could not map that question to a specific metric confidently.",
      scopeText(scope),
      `Closest safe summary: Budget ${money(totalBudget)} | Actual ${money(totalActual)} | Items ${scopedRows.length}`,
      "Try asking with a BU, FY, vendor, category, status, location, top item, renewal, actual, budget, or outside-budget wording.",
    ]);
  }

  return format([
    "I matched your question to the closest relevant items in the app data:",
    scopeText(scope),
    ...matches.map((m, i) => `${i + 1}. ${m.row.description} — ${m.row.businessUnit} — ${m.row.city || m.row.location || m.row.country || "NA"} — ${money(m.row.amount)}`),
  ]);
}

function answerQuestion(question: string, data: ReturnType<typeof buildData>) {
  const q = normalise(question);
  const scope = applyScope(data, question);
  const rows = scope.rows;

  if (!rows.length) {
    return format([
      "I checked the app data first, but I could not find matching records for that question.",
      scopeText(scope),
      "Try adding an FY, BU, vendor, category, location, or ask for budget / actual / top items.",
    ]);
  }

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + (r.actual || 0), 0);
  const savings = rows.reduce((s, r) => s + (r.actual != null ? r.budget - r.actual : 0), 0);
  const util = pct(totalActual, totalBudget);

  const askRenewal = includesAny(q, [
    "next renewal", "upcoming renewal", "renewal due", "when is my next renewal", "what is my next renewal",
    "renewals", "subscription renewal", "license renewal"
  ]);

  const askBiggestItem = includesAny(q, [
    "biggest line item","largest line item","highest line item","highest cost item","biggest item","largest item","top item","costliest item"
  ]);

  const askTotalBudget = includesAny(q, [
    "total budget","budget total","planned budget","budget amount","how much budget"
  ]);

  const askTotalActual = includesAny(q, [
    "total actual","actual spend","spent so far","how much spent","actual amount","how much have we spent"
  ]);

  const askSavings = includesAny(q, [
    "savings","variance","over budget","under budget","budget variance","overspend"
  ]);

  const askTopVendor = includesAny(q, [
    "top vendor","top vendors","largest vendor","highest vendor","vendor spend","vendors by spend"
  ]);

  const askCapexOpex = includesAny(q, [
    "capex vs opex","capex opex","capex","opex"
  ]);

  const askOutsideBudget = includesAny(q, [
    "outside budget","out of budget","unplanned"
  ]);

  const askStatus = includesAny(q, [
    "status summary","status split","status breakdown","completed","pending","cancelled","canceled","unused"
  ]);

  const askByFY = includesAny(q, [
    "each fy","by fy","fy wise","financial year wise","all years","half wise"
  ]);

  const askByBU = includesAny(q, [
    "which bu","which business unit","highest bu","highest spend bu","largest bu","top bu","business unit"
  ]);

  const askTopCategory = includesAny(q, [
    "top category","top categories","highest category","largest category","costing category","which category"
  ]);

  const askTopLocation = includesAny(q, [
    "which city","which location","highest city","highest location","costing most city","costing most location","which place"
  ]);

  const compareTargets = [
    ...findMultiple(question, data.businessUnits),
    ...findMultiple(question, data.vendors),
    ...findMultiple(question, data.categories),
  ];

  if (askRenewal) {
    const renewal = nextRenewal(rows);
    if (!renewal) {
      return format([
        "I checked the loaded app data and could not find a recurring renewal schedule for the current scope.",
        scopeText(scope),
        "This usually means billing frequency is missing or items are one-time costs only.",
      ]);
    }

    return format([
      `Next renewal: ${prettyMonth(renewal.renewalDate)}`,
      scopeText(scope),
      `Item: ${renewal.description}`,
      `BU: ${renewal.businessUnit}`,
      `Vendor: ${renewal.vendor}`,
      `Billing frequency: ${renewal.billingFreq || "Not specified"}`,
      `Expected amount: ${money(renewal.amount)} ${renewal.actual != null && renewal.actual > 0 ? "(using Actual)" : "(using Budget)"}`,
    ]);
  }

  if (askBiggestItem) {
    const top = [...rows].sort((a, b) => b.amount - a.amount)[0];
    const next = [...rows]
      .sort((a, b) => b.amount - a.amount)
      .slice(1, 4)
      .map((r, i) => `${i + 2}. ${r.description} — ${r.businessUnit} — ${r.city || r.location || r.country || "NA"} — ${money(r.amount)}`);

    return format([
      `Biggest line item: ${top.description}`,
      scopeText(scope),
      `BU: ${top.businessUnit}`,
      `City / Location: ${top.city || top.location || top.country || "Not specified"}`,
      `Vendor: ${top.vendor || "Unknown Vendor"}`,
      `FY: ${top.fy || "Unknown"}`,
      `Amount: ${money(top.amount)} ${top.actual != null && top.actual > 0 ? "(using Actual)" : "(using Budget)"}`,
      next.length ? `Next biggest items:\n${next.join("\n")}` : "",
    ]);
  }

  if (askTopVendor) {
    const top = groupedSpend(rows, "vendor").slice(0, 5);
    return format([
      "Top vendors by spend from the loaded app data:",
      scopeText(scope),
      ...top.map(([name, value], i) => `${i + 1}. ${name} — ${money(value)}`),
    ]);
  }

  if (askCapexOpex) {
    const capex = rows
      .filter((r) => normalise(r.expenseType).includes("capex"))
      .reduce((s, r) => s + r.amount, 0);
    const opex = rows
      .filter((r) => normalise(r.expenseType).includes("opex"))
      .reduce((s, r) => s + r.amount, 0);
    const total = capex + opex;

    return format([
      "Capex vs Opex split:",
      scopeText(scope),
      `Capex: ${money(capex)} (${pct(capex, total)}%)`,
      `Opex: ${money(opex)} (${pct(opex, total)}%)`,
      `Total: ${money(total)}`,
    ]);
  }

  if (askOutsideBudget) {
    const outside = rows.filter((r) => r.outsideBudget);
    const total = outside.reduce((s, r) => s + r.amount, 0);
    const topItems = outside
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((r, i) => `${i + 1}. ${r.description} — ${r.businessUnit} — ${r.fy} — ${money(r.amount)}`);

    return format([
      `Outside-budget items: ${outside.length}`,
      scopeText(scope),
      `Total impact: ${money(total)}`,
      data.inrRate ? `Approx INR: ₹${Math.round(total * data.inrRate).toLocaleString()}` : "",
      topItems.length ? `Largest outside-budget items:\n${topItems.join("\n")}` : "No outside-budget items found.",
    ]);
  }

  if (askStatus) {
    const completed = rows.filter((r) => isCompleted(r.status)).length;
    const pending = rows.filter((r) => isPending(r.status)).length;
    const cancelled = rows.filter((r) => isCancelled(r.status)).length;
    const unused = rows.filter((r) => normalise(r.status) === "unused").length;
    const moved = rows.filter((r) => normalise(r.status) === "move to another half").length;

    return format([
      "Status summary:",
      scopeText(scope),
      `Completed: ${completed}`,
      `Pending: ${pending}`,
      `Cancelled: ${cancelled}`,
      `Unused: ${unused}`,
      `Move to another half: ${moved}`,
      `Total items: ${rows.length}`,
    ]);
  }

  if (askByFY) {
    const byFY = groupedBudgetActual(rows, "fy").sort((a, b) => a.label.localeCompare(b.label));
    return format([
      "FY-wise summary:",
      scopeText(scope),
      ...byFY.map((r) => `${r.label} — Budget ${money(r.budget)} | Actual ${money(r.actual)} | Items ${r.items}`),
    ]);
  }

  if (askByBU && includesAny(q, ["highest","largest","biggest","top"])) {
    const top = groupedSpend(rows, "businessUnit")[0];
    return format([
      "Highest-spend business unit:",
      scopeText(scope),
      `${top?.[0] || "Unknown"} — ${money(top?.[1] || 0)}`,
    ]);
  }

  if (askTopCategory) {
    const top = groupedSpend(rows, "itemCategory").slice(0, 5);
    return format([
      "Top categories by spend:",
      scopeText(scope),
      ...top.map(([name, value], i) => `${i + 1}. ${name} — ${money(value)}`),
    ]);
  }

  if (askTopLocation) {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const loc = r.city || r.location || r.country || "Unknown";
      map.set(loc, (map.get(loc) || 0) + r.amount);
    });
    const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return format([
      "Top locations by spend:",
      scopeText(scope),
      ...top.map(([name, value], i) => `${i + 1}. ${name} — ${money(value)}`),
    ]);
  }

  if (compareTargets.length >= 2) {
    const uniq = [...new Set(compareTargets)].slice(0, 2);
    const comparisons = uniq.map((name) => {
      const subset = data.rows.filter((r) =>
        r.businessUnit === name || r.vendor === name || r.itemCategory === name
      );
      const budget = subset.reduce((s, r) => s + r.budget, 0);
      const actual = subset.reduce((s, r) => s + (r.actual || 0), 0);
      return `${name} — Budget ${money(budget)} | Actual ${money(actual)} | Items ${subset.length}`;
    });

    return format([
      "Comparison from the app data:",
      ...comparisons,
    ]);
  }

  if (askTotalBudget) {
    return format([
      `Total budget: ${money(totalBudget)}`,
      scopeText(scope),
      `Items covered: ${rows.length}`,
    ]);
  }

  if (askTotalActual) {
    return format([
      `Total actual: ${money(totalActual)}`,
      scopeText(scope),
      `Utilisation: ${util}% of budget`,
      `Items with actual entered: ${rows.filter((r) => r.actual != null && r.actual > 0).length}`,
    ]);
  }

  if (askSavings) {
    const label = savings >= 0 ? "Savings / positive variance" : "Overspend / negative variance";
    return format([
      `${label}: ${savings >= 0 ? money(savings) : `-${money(Math.abs(savings)).replace("S$", "S$")}`}`,
      scopeText(scope),
      `Budget: ${money(totalBudget)}`,
      `Actual: ${money(totalActual)}`,
      `Utilisation: ${util}%`,
    ]);
  }

  return fallbackAnswer(question, rows, scope);
}

export default function AIInsights({ items, fxRates, role }: AIInsightsProps) {
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
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const data = useMemo(() => buildData(items, fxRates), [items, fxRates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore storage errors
    }
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const prompts = [
    "What is the biggest line item in all these years, and for which BU, city and how much does it cost?",
    "When is my next renewal and what is the item?",
    "Show top 5 vendors by spend",
    "How much actual have we spent in 2026-H1?",
    "Give outside budget summary",
    "Which BU has the highest spend?",
    "Which city is costing the most?",
    "Compare Blink and WP - India Common",
  ];

  async function ask() {
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const answer = answerQuestion(text, data);
      await new Promise((resolve) => setTimeout(resolve, 120));
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (e: any) {
      setError(e?.message || "Failed to answer from app data.");
    } finally {
      setLoading(false);
    }
  }

  function renderText(text: string) {
    return text.split("\n").map((line, i) => (
      <div
        key={i}
        style={{
          marginBottom: line.trim() ? 6 : 12,
          color: "#CBD5E1",
          lineHeight: 1.65,
          whiteSpace: "pre-wrap",
        }}
      >
        {line}
      </div>
    ));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 16,
          padding: 18,
          border: "1px solid rgba(94,234,212,0.22)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "linear-gradient(135deg,#22d3ee,#34d399)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🧠
          </div>
          <div>
            <div style={{ color: "#5EEAD4", fontWeight: 800, fontSize: 16 }}>
              Budget Insight Assistant
            </div>
            <div style={{ color: "#88A0B8", fontSize: 13, marginTop: 4 }}>
              Checks the loaded app data first, then answers in plain business language.
            </div>
          </div>
        </div>

        <div
          style={{
            color: "#5EEAD4",
            border: "1px solid rgba(94,234,212,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          App-grounded mode
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 16,
          border: "1px solid rgba(94,234,212,0.16)",
          minHeight: 560,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {messages.length === 0 && (
            <div
              style={{
                maxWidth: 660,
                background: "rgba(9,19,29,0.78)",
                borderRadius: 18,
                padding: 18,
                border: "1px solid rgba(94,234,212,0.12)",
              }}
            >
              <div style={{ color: "#E2E8F0", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                Ask in normal day-to-day language.
              </div>
              <div style={{ color: "#94A3B8", lineHeight: 1.7, marginBottom: 14 }}>
                I work only on the budget data loaded in this app. I first check the data, detect the intent,
                apply BU / FY / vendor / category / location scope, then answer clearly.
              </div>

              <div style={{ color: "#F8FAFC", fontWeight: 700, marginBottom: 10 }}>
                Examples
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    style={{
                      textAlign: "left",
                      background: "#0B1520",
                      color: "#CBD5E1",
                      border: "1px solid #1E3A5F",
                      borderRadius: 12,
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  background: m.role === "user" ? "#1E2A59" : "rgba(9,19,29,0.85)",
                  border: "1px solid rgba(94,234,212,0.14)",
                  borderRadius: 18,
                  padding: "14px 16px",
                }}
              >
                {renderText(m.text)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ color: "#88A0B8", fontWeight: 600 }}>
              Checking app data...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(94,234,212,0.12)",
            padding: 16,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="Ask naturally: next renewal, biggest item, top vendor, what did we spend, compare BU..."
            style={{
              flex: 1,
              background: "#08131D",
              color: "#E2E8F0",
              border: "1px solid #1E3A5F",
              borderRadius: 12,
              padding: "14px 16px",
              outline: "none",
              fontSize: 14,
            }}
          />

          <button
            onClick={ask}
            disabled={loading}
            style={{
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px 20px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Send ↗
          </button>

          <button
            onClick={() => setMessages([])}
            style={{
              background: "#1E293B",
              color: "#CBD5E1",
              border: "none",
              borderRadius: 12,
              padding: "14px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "#F87171", fontWeight: 700 }}>{error}</div>
      )}

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          border: "1px solid rgba(94,234,212,0.12)",
          padding: "12px 16px",
          color: "#64748B",
          fontSize: 12,
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <span><strong style={{ color: "#60A5FA" }}>{data.rows.length}</strong> items</span>
        <span><strong style={{ color: "#60A5FA" }}>{data.fys.length}</strong> FY halves</span>
        <span><strong style={{ color: "#60A5FA" }}>{data.businessUnits.length}</strong> BUs</span>
        <span><strong style={{ color: "#60A5FA" }}>{data.categories.length}</strong> categories</span>
        <span><strong style={{ color: "#60A5FA" }}>{data.vendors.length}</strong> vendors</span>
        <span>role: <strong style={{ color: "#60A5FA" }}>{role}</strong></span>
      </div>
    </div>
  );
}
