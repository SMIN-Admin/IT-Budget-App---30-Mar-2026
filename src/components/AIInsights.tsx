"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type BudgetItem = {
  description?: string;
  businessUnit?: string;
  itemCategory?: string;
  expenseType?: string;
  planMonth?: string;
  fy?: string;
  budget?: number | string;
  actual?: number | null;
  status?: string;
  outsideBudget?: boolean;
  vendor?: string;
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
function buildOutsideBudgetAnswer(items: any[], fxRates: Record<string, unknown>) {
  const outsideItems = items.filter((i: any) =>
    i.outsideBudget === true ||
    i.outsideBudget === "true" ||
    String(i.status || "").toLowerCase() === "outside budget"
  );

  const amountForItem = (i: any) => {
    const budgetSgd = Number(i.budget) || 0;
    const actualVal = i.actual != null && i.actual !== "" ? Number(i.actual) || 0 : null;
    return actualVal !== null ? actualVal : budgetSgd;
  };

  const totalSgd = outsideItems.reduce((sum: number, i: any) => sum + amountForItem(i), 0);

  const byFyMap = outsideItems.reduce((acc: Record<string, number>, i: any) => {
    const fy = i.fy || "Unknown";
    acc[fy] = (acc[fy] || 0) + amountForItem(i);
    return acc;
  }, {});

  const fyLines =
    Object.keys(byFyMap).length > 0
      ? Object.entries(byFyMap)
          .map(([fy, amt]) => `- ${fy}: SGD ${Number(amt).toLocaleString()}`)
          .join("\n")
      : "- None";

  const itemLines =
    outsideItems.length > 0
      ? outsideItems
          .map((i: any) => {
            const amt = amountForItem(i);
            return `- ${i.description || "Unknown Item"} (${i.businessUnit || "Unknown BU"} - ${i.fy || "Unknown FY"}): SGD ${amt.toLocaleString()}`;
          })
          .join("\n")
      : "- None";

  let inrLine = "INR conversion not available.";
  const inrRate =
    Number((fxRates as any)?.INR) ||
    Number((fxRates as any)?.["SGD_TO_INR"]) ||
    Number((fxRates as any)?.["INR_RATE"]);

  if (inrRate) {
    const totalInr = totalSgd * inrRate;
    inrLine = `Total in INR: INR ${Math.round(totalInr).toLocaleString()} (using rate ${inrRate})`;
  }

  return [
    `Outside Budget Summary:`,
    `- Total Outside Budget (SGD): ${totalSgd.toLocaleString()}`,
    ``,
    `Breakdown by FY:`,
    fyLines,
    ``,
    `Items:`,
    itemLines,
    ``,
    inrLine,
  ].join("\n");
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
  const [error, setError] = useState("");
  useEffect(() => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch (error) {
    console.error("Failed to save AI chat:", error);
  }
}, [messages, storageKey]);
  const endRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const buildCtx = () => {
    const fys = [...new Set(items.map((i) => i.fy || getFY(i.planMonth || "")).filter(Boolean))].sort();
    const bus = [...new Set(items.map((i) => i.businessUnit).filter(Boolean))].sort();
    const cats = [...new Set(items.map((i) => i.itemCategory).filter(Boolean))].sort();

    const fySummary = fys.map((fy) => {
      const fi = items.filter((i) => (i.fy || getFY(i.planMonth || "")) === fy);
      return {
        fy,
        count: fi.length,
        budget: Math.round(fi.reduce((s, i) => s + (parseFloat(String(i.budget || 0)) || 0), 0)),
        actual: Math.round(fi.filter((i) => i.actual != null).reduce((s, i) => s + Number(i.actual || 0), 0)),
        completed: fi.filter((i) => i.status === "Completed").length,
        cancelled: fi.filter((i) => i.status === "Cancel" || i.status === "Cancelled").length,
        outside: fi.filter((i) => i.outsideBudget).length,
      };
    });

    const vendors = [...new Set(items.map((i) => i.vendor).filter(Boolean))];
    const vendorSummary = vendors
      .map((v) => {
        const vi = items.filter((i) => i.vendor === v);
        return {
          vendor: v,
          budget: Math.round(vi.reduce((s, i) => s + (parseFloat(String(i.budget || 0)) || 0), 0)),
          actual: Math.round(vi.filter((i) => i.actual != null).reduce((s, i) => s + Number(i.actual || 0), 0)),
        };
      })
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 15);

    const compactItems = items.slice(0, 250).map((i) => ({
      d: String(i.description || "").slice(0, 60),
      bu: i.businessUnit || "",
      cat: i.itemCategory || "",
      t: i.expenseType || "",
      m: i.planMonth || "",
      fy: i.fy || getFY(i.planMonth || ""),
      b: Math.round(parseFloat(String(i.budget || 0)) || 0),
      a: i.actual != null ? Math.round(Number(i.actual)) : null,
      st: i.status || "Pending",
      ob: !!i.outsideBudget,
      v: String(i.vendor || "").slice(0, 30),
    }));

    return {
      meta: {
        org: "SMG",
        currency: "SGD",
        fyRule: "Apr-Sep=H1, Oct-Mar=H2",
        totalItems: items.length,
        totalFxPeriods: Object.keys(fxRates || {}).length,
        fys,
        bus,
        cats,
      },
      fySummary,
      vendorSummary,
      items: compactItems,
    };
  };

  const aiContext = useMemo(() => JSON.stringify(buildCtx()), [items, fxRates]);

  const sendMessage = async (userMsg: string) => {
    const trimmed = userMsg.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      // ---- Build Smart Budget Context ----
const totalItems = items.length;

const outsideBudgetItems = items.filter((i: any) =>
  i.outsideBudget === true ||
  i.outsideBudget === "true" ||
  i.status === "Outside Budget"
);
const outsideBudgetTotal = outsideBudgetItems.reduce((sum: number, i: any) => {
  const amount =
    i.actual != null
      ? Number(i.actual) || 0
      : Number(i.budget) || 0;
  return sum + amount;
}, 0);

const totalBudget = items.reduce((sum: number, i: any) => {
  return sum + (Number(i.budget) || 0);
}, 0);

const totalActual = items.reduce((sum: number, i: any) => {
  return sum + (i.actual != null ? Number(i.actual) || 0 : 0);
}, 0);

const fyList = [...new Set(items.map((i: any) => i.fy).filter(Boolean))];
const buList = [...new Set(items.map((i: any) => i.businessUnit).filter(Boolean))];

const compactItems = items.slice(0, 200).map((i: any) => {
  const budget = Number(i.budget) || 0;
  const actual = i.actual != null ? Number(i.actual) || 0 : null;

  const amount = actual !== null ? actual : budget;

  return {
    description: i.description || "Unknown",
    bu: i.businessUnit || "Unknown",
    fy: i.fy || "Unknown",
    category: i.itemCategory || "Unknown",
    vendor: i.vendor || "Unknown",
    budget,
    actual,
    amount,
    outsideBudget:
      i.outsideBudget === true ||
      i.outsideBudget === "true" ||
      i.status === "Outside Budget",
  };
});

const appContext = `
You are a FINANCE ANALYST for an IT Budget system.

STRICT INSTRUCTIONS:
- You MUST answer using ONLY the provided dataset
- DO NOT say "not available" if data exists
- ALWAYS compute totals, breakdowns, and lists if asked
- NEVER ask follow-up questions
- ALWAYS give structured answers

WHEN USER ASKS ABOUT "OUTSIDE BUDGET":
You MUST:
1. Calculate TOTAL outside budget (use actual if present, else budget)
2. Group by FY (financial year)
3. List ALL items:
   - Description
   - BU
   - FY
   - Amount (SGD)
4. Provide TOTAL in SGD
5. If user asks INR → convert using fxRates if available

FORMAT RESPONSE LIKE:

Outside Budget Summary:
- Total Outside Budget (SGD): XXX

Breakdown by FY:
- FY2026: XXX
- FY2027: XXX

Items:
- Item 1 (BU - FY): SGD XXX
- Item 2 (BU - FY): SGD XXX

IMPORTANT:
- Do NOT skip items
- Do NOT collapse results
- Do NOT say "not available" if data exists

DATA SUMMARY:
- Total items: ${totalItems}
- Total Budget: ${totalBudget}
- Total Actual: ${totalActual}
- Outside Budget Total: ${outsideBudgetTotal}
- FYs: ${fyList.join(", ")}
- Business Units: ${buList.join(", ")}

DATA:
${JSON.stringify(compactItems)}
`;

const finalPrompt = `
${appContext}

USER QUESTION:
${trimmed}
`;

// ---- Call API ----
// ✅ DEBUG (ADD HERE)
console.log("AI DATA SENT:", compactItems);
console.log("OUTSIDE ITEMS:", outsideBudgetItems);
const res = await fetch("/api/ai/gemini", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: finalPrompt,
  }),
});

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "AI request failed");
      }

      setMessages((prev) => [...prev, { role: "assistant", text: data.text || "No response." }]);
    } catch (e: any) {
      setError(e?.message || "Failed to get AI response.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const renderMd = (text: string) =>
    text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.+?)\*\*/g);
      const content = parts.map((p, j) =>
        j % 2 === 1 ? (
          <strong key={j} style={{ color: "#E5E7EB" }}>
            {p}
          </strong>
        ) : (
          <React.Fragment key={j}>{p}</React.Fragment>
        )
      );

      if (line.startsWith("- ") || line.startsWith("• ")) {
        return (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
            <span style={{ color: "#5EEAD4", flexShrink: 0 }}>▸</span>
            <span>{content.slice(1)}</span>
          </div>
        );
      }

      if (/^#{1,3} /.test(line)) {
        return (
          <div key={i} style={{ color: "#E6FFFD", fontWeight: 800, fontSize: 14, margin: "10px 0 4px", ...T }}>
            {line.replace(/^#{1,3} /, "")}
          </div>
        );
      }

      return <div key={i} style={{ marginBottom: line === "" ? 6 : 2 }}>{content}</div>;
    });

  const SUGGESTED = [
    "Total IT budget for each FY half?",
    "Which BU has highest spend in 2026-H2?",
    "Increment ratio of End-User Hardware over 3 years?",
    "Categories showing consistent overspend?",
    "Overall Capex vs Opex split?",
    "All outside-budget items and their SGD impact?",
    "Top 5 vendors by total spend?",
    "Budget utilisation trend across FY halves?",
  ];

  const card = {
    background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
    borderRadius: 14,
    border: "1px solid rgba(94,234,212,0.12)",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, ...T, height: "calc(100vh - 180px)", minHeight: 580 }}>
      {isAdmin && (
        <div
          style={{
            ...card,
            padding: "14px 18px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            border: "1px solid rgba(66,133,244,0.28)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "linear-gradient(135deg,#4285F4,#0F9D58)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
              boxShadow: "0 3px 14px rgba(66,133,244,0.25)",
            }}
          >
            ✨
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ color: "#4285F4", fontWeight: 800, fontSize: 13 }}>Google Gemini (server-side)</div>
            <div style={{ color: "#8AA0B7", fontSize: 11, marginTop: 1 }}>
              API configuration is admin-only. Regular users can ask questions, but cannot view or change providers or keys.
            </div>
          </div>
          <div
            style={{
              background: "rgba(94,234,212,0.08)",
              border: "1px solid rgba(94,234,212,0.30)",
              borderRadius: 9,
              padding: "8px 16px",
              color: "#5EEAD4",
              fontSize: 12,
              fontWeight: 700,
              ...T,
            }}
          >
            ✅ Gemini active
          </div>
          <div
            style={{
              width: "100%",
              background: "rgba(71,85,105,0.12)",
              border: "1px solid rgba(71,85,105,0.25)",
              borderRadius: 7,
              padding: "7px 12px",
              color: "#88A0B8",
              fontSize: 10,
            }}
          >
            To change the API later, update GEMINI_API_KEY in your backend environment or your future admin settings page.
          </div>
        </div>
      )}

      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 10 }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✨</div>
              <div style={{ color: "#E0E7FF", fontWeight: 800, fontSize: 17, marginBottom: 5, ...T }}>
                Ask anything about your IT budget
              </div>
              <div style={{ color: "#6B7280", fontSize: 12, marginBottom: 20, ...T }}>
                Powered by <strong style={{ color: "#4285F4" }}>Google Gemini</strong> · {items.length} items loaded
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", maxWidth: 680, margin: "0 auto" }}>
                {SUGGESTED.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => void sendMessage(q)}
                    style={{
                      background: "rgba(99,102,241,0.07)",
                      border: "1px solid rgba(99,102,241,0.17)",
                      borderRadius: 20,
                      color: "#9FB3C8",
                      padding: "6px 14px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      maxWidth: 260,
                      ...T,
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 10, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  background: msg.role === "user" ? "linear-gradient(135deg,#22D3EE,#2DD4BF)" : "linear-gradient(135deg,#4285F4,#0F9D58)",
                  boxShadow: msg.role === "assistant" ? "0 2px 10px rgba(66,133,244,0.25)" : "none",
                }}
              >
                {msg.role === "user" ? "👤" : "✨"}
              </div>
              <div
                style={{
                  maxWidth: "78%",
                  background: msg.role === "user" ? "rgba(79,70,229,0.18)" : "rgba(0,0,0,0.28)",
                  border: `1px solid ${msg.role === "user" ? "rgba(94,234,212,0.22)" : "rgba(255,255,255,0.05)"}`,
                  borderRadius: msg.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  padding: "12px 16px",
                }}
              >
                <div style={{ color: msg.role === "user" ? "#E6FFFD" : "#9FB3C8", fontSize: 12, lineHeight: 1.75, ...T }}>
                  {msg.role === "assistant" ? renderMd(msg.text) : msg.text}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "linear-gradient(135deg,#4285F4,#0F9D58)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                ✨
              </div>
              <div
                style={{
                  background: "rgba(0,0,0,0.28)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "4px 14px 14px 14px",
                  padding: "13px 18px",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{ width: 7, height: 7, borderRadius: 999, background: "#4285F4", animation: `aibounce 1.2s ${i * 0.2}s infinite` }}
                  />
                ))}
                <style>{`@keyframes aibounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-8px)}}`}</style>
                <span style={{ color: "#374151", fontSize: 11, marginLeft: 4, ...T }}>Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "11px 15px", color: "#FCA5A5", fontSize: 12, ...T }}>
              ⚠️ {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: "1px solid rgba(94,234,212,0.10)", padding: "12px 18px", display: "flex", gap: 10, flexShrink: 0, background: "rgba(0,0,0,0.15)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask Gemini about your budget… (Enter)"
            disabled={loading}
            style={{
              flex: 1,
              background: "rgba(0,0,0,0.38)",
              border: "1px solid rgba(66,133,244,0.35)",
              borderRadius: 10,
              color: "#E5E7EB",
              padding: "10px 16px",
              fontSize: 13,
              outline: "none",
              ...T,
              transition: "border .2s",
            }}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              background: (!input.trim() || loading) ? "rgba(66,133,244,0.20)" : "linear-gradient(135deg,#4285F4,#0F9D58)",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              padding: "10px 22px",
              cursor: (!input.trim() || loading) ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 13,
              ...T,
              flexShrink: 0,
            }}
          >
            {loading ? "⏳" : "Send ↗"}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              style={{
                background: "rgba(71,85,105,0.2)",
                border: "1px solid rgba(71,85,105,0.3)",
                borderRadius: 10,
                color: "#6B7280",
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: 12,
                ...T,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ ...card, padding: "10px 18px", flexShrink: 0, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "#374151", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Context sent to AI</span>
        {[
          [items.length, "items"],
          [[...new Set(items.map(i => i.fy || getFY(i.planMonth || "")).filter(Boolean))].length, "FY halves"],
          [[...new Set(items.map(i => i.businessUnit).filter(Boolean))].length, "BUs"],
          [[...new Set(items.map(i => i.itemCategory).filter(Boolean))].length, "categories"],
        ].map(([n, l]) => (
          <div key={String(l)} style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
            <span style={{ color: "#4285F4", fontWeight: 800, fontSize: 14, ...T }}>{String(n)}</span>
            <span style={{ color: "#374151", fontSize: 11, ...T }}>{String(l)}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", color: "#374151", fontSize: 10, ...T }}>Google Gemini · server-side</div>
      </div>
    </div>
  );
}
