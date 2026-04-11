"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  Line,
} from "recharts";

function formatCurrency(value: number) {
  return `S$${Math.round(value).toLocaleString()}`;
}

function formatShortCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `S$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `S$${(value / 1_000).toFixed(0)}k`;
  return `S$${Math.round(value)}`;
}


type BudgetItem = {
  fy?: string;
  planMonth?: string;
  itemCategory?: string;
  businessUnit?: string;
  payingBU?: string;
  budget?: number | string | null;
  actual?: number | string | null;
  description?: string;
  status?: string;
  [key: string]: any;
};

type TrendAnalysisPageProps = {
  items: BudgetItem[];
  fyOptions: string[];
  onDrillDown?: (filters: any) => void;
};



function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function deriveFY(item: BudgetItem) {
  if (item.fy && String(item.fy).trim()) return String(item.fy).trim();

  const pm = String(item.planMonth || "").trim();
  if (!pm) return "Unknown";

  const match = pm.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return "Unknown";

  const monthMap: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };

  const month = monthMap[match[1]] || 0;
  let year = Number(match[2]);
  if (year < 100) year += 2000;

  if (!month || !year) return "Unknown";

  const half = month >= 4 && month <= 9 ? "H1" : "H2";

  let fyYear = year;
  if (month >= 1 && month <= 3) fyYear = year - 1;

  return `${fyYear}-${half}`;
}

function getUniqueSorted(values: Array<string | undefined | null>) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))].sort();
}

function getViewHeading(viewType: string) {
  if (viewType === "budget") return "💰 Budget & Actuals Trend";
  if (viewType === "pnl") return "📊 P&L Trend";
  return "🏷️ Category Trend";
}

function getPlanMonthKey(item: BudgetItem) {
  const pm = String(item.planMonth || "").trim();
  if (!pm) return "Unknown";

  const match = pm.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return "Unknown";

  const monthMap: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  let year = Number(match[2]);
  if (year < 100) year += 2000;

  const month = monthMap[match[1]] || "00";
  if (!year || month === "00") return "Unknown";

  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string) {
  if (!monthKey || monthKey === "Unknown") return "Unknown";

  const [year, month] = monthKey.split("-");
  const labelMap: Record<string, string> = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
  };

  return `${labelMap[month] || month}-${String(year).slice(-2)}`;
}

export default function TrendAnalysisPage({
  items,
  fyOptions,
  onDrillDown,
}: TrendAnalysisPageProps) {
  const [viewType, setViewType] = useState<"budget" | "pnl" | "category">("budget");
  const [selectedFYs, setSelectedFYs] = useState<string[]>(["all"]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBU, setSelectedBU] = useState("all");
  const [selectedPayingBU, setSelectedPayingBU] = useState("all");
  const [fyDropdownOpen, setFyDropdownOpen] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
const [apiError, setApiError] = useState("");
const [trendData, setTrendData] = useState<any>(null);

useEffect(() => {
  let cancelled = false;

  async function loadTrendSummary() {
    try {
      setApiLoading(true);
      setApiError("");

      const params = new URLSearchParams({
  fy: selectedFYs.includes("all") ? "all" : selectedFYs.join(","),
  businessUnit: selectedBU,
  payingBU: selectedPayingBU,
  category: selectedCategory,
  viewType,
});

      const res = await fetch(`/api/budget-items/trend-summary?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load trend summary");
      }

      if (!cancelled) {
        setTrendData(data);
      }
    } catch (error: any) {
      if (!cancelled) {
        setApiError(error?.message || "Failed to load trend summary");
      }
    } finally {
      if (!cancelled) {
        setApiLoading(false);
      }
    }
  }

  loadTrendSummary();

  return () => {
    cancelled = true;
  };
}, [selectedFYs, selectedCategory, selectedBU, selectedPayingBU, viewType]);

  const sourceItems = Array.isArray(items) ? items : [];

  const resolvedFyOptions = useMemo(() => {
  const fromApi = Array.isArray(trendData?.filterOptions?.fyOptions)
    ? trendData.filterOptions.fyOptions
    : [];
  const fromItems = getUniqueSorted(sourceItems.map((i) => deriveFY(i)));
  const fromProps = getUniqueSorted((fyOptions || []).map((f) => f));
  return getUniqueSorted([...fromApi, ...fromProps, ...fromItems]);
}, [trendData, sourceItems, fyOptions]);

const fyDisplayLabel = useMemo(() => {
  if (selectedFYs.includes("all")) return "All Years";
  if (selectedFYs.length === 0) return "Select FY";
  if (selectedFYs.length === 1) return selectedFYs[0];
  return `${selectedFYs.length} FYs selected`;
}, [selectedFYs]);

const toggleFY = (fy: string) => {
  if (fy === "all") {
    setSelectedFYs(["all"]);
    return;
  }

  const current = selectedFYs.includes("all") ? [] : selectedFYs;
  const exists = current.includes(fy);

  const next = exists
    ? current.filter((x) => x !== fy)
    : [...current, fy].sort();

  setSelectedFYs(next.length ? next : ["all"]);
};

  const categoryOptions = useMemo(() => {
  const fromApi = Array.isArray(trendData?.filterOptions?.categories)
    ? trendData.filterOptions.categories
    : [];
  const fromItems = getUniqueSorted(sourceItems.map((i) => i.itemCategory));
  return getUniqueSorted([...fromApi, ...fromItems]);
}, [trendData, sourceItems]);

  const buOptions = useMemo(() => {
  const fromApi = Array.isArray(trendData?.filterOptions?.businessUnits)
    ? trendData.filterOptions.businessUnits
    : [];
  const fromItems = getUniqueSorted(sourceItems.map((i) => i.businessUnit));
  return getUniqueSorted([...fromApi, ...fromItems]);
}, [trendData, sourceItems]);

  const payingBUOptions = useMemo(() => {
  const fromApi = Array.isArray(trendData?.filterOptions?.payingBUs)
    ? trendData.filterOptions.payingBUs
    : [];
  const fromItems = getUniqueSorted(sourceItems.map((i) => i.payingBU));
  return getUniqueSorted([...fromApi, ...fromItems]);
}, [trendData, sourceItems]);

  const filteredItems = useMemo(() => {
    return sourceItems.filter((item) => {
      const fy = deriveFY(item);

      const fyMatch = selectedFYs === "all" || fy === selectedFYs;
      const categoryMatch =
        selectedCategory === "all" || String(item.itemCategory || "") === selectedCategory;
      const buMatch =
        selectedBU === "all" || String(item.businessUnit || "") === selectedBU;
      const payingBUMatch =
        selectedPayingBU === "all" || String(item.payingBU || "") === selectedPayingBU;

      return fyMatch && categoryMatch && buMatch && payingBUMatch;
    });
  }, [sourceItems, selectedFYs, selectedCategory, selectedBU, selectedPayingBU]);

  const totalBudget = toNumber(trendData?.kpis?.totalBudget);

  const totalActual = toNumber(trendData?.kpis?.totalActual);

  const totalItems = toNumber(trendData?.kpis?.totalItems);

  const totalPnlBudget = toNumber(trendData?.kpis?.totalPnlBudget);
const totalPnlActual = toNumber(trendData?.kpis?.totalPnlActual);

  const pnlItemsWithActual = toNumber(trendData?.kpis?.itemsWithActual);

  const pnlPendingActual = toNumber(trendData?.kpis?.pendingActual);

  const pnlUtilPct = toNumber(trendData?.kpis?.pnlUtilPct);

  const categoryCount = toNumber(trendData?.kpis?.categoryCount);

  const budgetVariance = toNumber(trendData?.kpis?.budgetVariance);

  const chartTrend = useMemo(() => {
  return Array.isArray(trendData?.trend) ? trendData.trend : [];
}, [trendData]);

const categoryTrend = useMemo(() => {
  const rows = Array.isArray(trendData?.trend) ? trendData.trend : [];

  return rows.map((row: any) => ({
    month: row.month,
    label: row.label,
    budget: Number(row.budget || 0),
    actual: Number(row.actual || 0),
  }));
}, [trendData]);

console.log("categoryTrend", categoryTrend);


  const monthlyTrend = useMemo(() => {
  const monthMap: Record<string, { month: string; budget: number; actual: number }> = {};

  filteredItems.forEach((item) => {
    const monthKey = getPlanMonthKey(item);
    if (monthKey === "Unknown") return;

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {
        month: monthKey,
        budget: 0,
        actual: 0,
      };
    }

    monthMap[monthKey].budget += toNumber(item.budget);
    monthMap[monthKey].actual += toNumber(item.actual);
  });

  return Object.values(monthMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      label: formatMonthLabel(row.month),
    }));
}, [filteredItems]);

console.log("TrendAnalysis monthlyTrend", monthlyTrend);

  const drill = (filters: Record<string, any>) => {
    if (!onDrillDown) return;
    onDrillDown({
      fromTab: "trendline",
      ...filters,
    });
  };

  const toPlanMonthLabel = (monthKey: string) => {
  if (!monthKey) return "";

  const [year, month] = monthKey.split("-");
  const monthMap: Record<string, string> = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
  };

  const shortYear = String(year).slice(-2);
  return `${monthMap[month] || month}-${shortYear}`;
};

  const handleTrendPointDrillDown = (point: any) => {
  if (!onDrillDown || !point) return;

  const planMonth = toPlanMonthLabel(point.month);

onDrillDown({
  tab: "budget",
  fromTab: "trendline",
  planMonth,
    fy: selectedFYs.includes("all") ? undefined : selectedFYs[0],
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    businessUnit: selectedBU !== "all" ? selectedBU : undefined,
    payingBU: selectedPayingBU !== "all" ? selectedPayingBU : undefined,
  });
};
const handleChartPointClick = (_: any, payload: any) => {
  if (!payload) return;
  handleTrendPointDrillDown(payload);
};

  const cardStyle = {
    background: "linear-gradient(145deg,#0B1624,#0A1320)",
    borderRadius: 12,
    padding: 18,
  } as const;

  const labelStyle = {
    color: "#88A0B8",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  };

  const valueStyleBase = {
    fontSize: 24,
    fontWeight: 900,
    fontFamily: "monospace",
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "linear-gradient(135deg,#0C1722,#0F1B2B)",
          borderRadius: 14,
          padding: "18px 20px",
          border: "1px solid rgba(94,234,212,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ color: "#E0E7FF", margin: 0, fontSize: 18, fontWeight: 800 }}>
              📈 Trend Analysis
            </h2>
            <div style={{ color: "#88A0B8", fontSize: 12, marginTop: 4 }}>
              Analyze Budget, Actuals, P&amp;L, and Category trends over time
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { key: "budget", label: "💰 Budget & Actuals" },
              { key: "pnl", label: "📊 P&L" },
              { key: "category", label: "🏷️ Category" },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setViewType(v.key as "budget" | "pnl" | "category")}
                style={{
                  background: viewType === v.key ? "#1e3a5f" : "#0F1535",
                  border: `1px solid ${viewType === v.key ? "#60A5FA" : "#213547"}`,
                  borderRadius: 8,
                  color: viewType === v.key ? "#DBEAFE" : "#9fb3c8",
                  padding: "7px 12px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          
          <div style={{ position: "relative", minWidth: 170 }}>
  <button
    type="button"
    onClick={() => setFyDropdownOpen((v) => !v)}
    style={{
      width: "100%",
      background: "#09131D",
      border: "1px solid #213547",
      borderRadius: 10,
      color: "#f1f5f9",
      padding: "10px 14px",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <span>{fyDisplayLabel}</span>
    <span style={{ color: "#9fb3c8", marginLeft: 10 }}>▾</span>
  </button>

  {fyDropdownOpen && (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        zIndex: 50,
        width: 240,
        maxHeight: 260,
        overflowY: "auto",
        background: "#09131D",
        border: "1px solid #213547",
        borderRadius: 12,
        boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
        padding: 8,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 8,
          cursor: "pointer",
          color: "#E0E7FF",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <input
          type="checkbox"
          checked={selectedFYs.includes("all")}
          onChange={() => toggleFY("all")}
        />
        <span>All Years</span>
      </label>

      <div style={{ height: 1, background: "#213547", margin: "6px 4px" }} />

      {resolvedFyOptions.map((fy) => (
        <label
          key={fy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 8,
            cursor: "pointer",
            color: "#E0E7FF",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={!selectedFYs.includes("all") && selectedFYs.includes(fy)}
            onChange={() => toggleFY(fy)}
          />
          <span>{fy}</span>
        </label>
      ))}
    </div>
  )}
</div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              background: "#09131D",
              border: "1px solid #213547",
              borderRadius: 10,
              color: "#f1f5f9",
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              minWidth: 180,
            }}
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedBU}
            onChange={(e) => setSelectedBU(e.target.value)}
            style={{
              background: "#09131D",
              border: "1px solid #213547",
              borderRadius: 10,
              color: "#f1f5f9",
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              minWidth: 150,
            }}
          >
            <option value="all">All BUs</option>
            {buOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={selectedPayingBU}
            onChange={(e) => setSelectedPayingBU(e.target.value)}
            style={{
              background: "#09131D",
              border: "1px solid #213547",
              borderRadius: 10,
              color: "#f1f5f9",
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              minWidth: 180,
            }}
          >
            <option value="all">All Paying BUs</option>
            {payingBUOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {(!selectedFYs.includes("all") ||
  selectedCategory !== "all" ||
  selectedBU !== "all" ||
  selectedPayingBU !== "all") && (
            <button
              onClick={() => {
                setSelectedFYs(["all"]);
                setSelectedCategory("all");
                setSelectedBU("all");
                setSelectedPayingBU("all");
                setFyDropdownOpen(false);
              }}
              style={{
                background: "#450a0a",
                border: "1px solid #7f1d1d",
                borderRadius: 8,
                color: "#f87171",
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              ✕ Reset
            </button>
          )}

          <div style={{ marginLeft: "auto", color: "#88A0B8", fontSize: 13, fontWeight: 700 }}>
            {totalItems} items
          </div>
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          padding: 24,
          minHeight: 320,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ color: "#E0E7FF", fontSize: 16, fontWeight: 800, marginBottom: 18 }}>
          {getViewHeading(viewType)}
        </div>

        {apiLoading && (
  <div style={{ color: "#88A0B8", fontSize: 13, marginBottom: 12 }}>
    Loading trend summary...
  </div>
)}

{!!apiError && (
  <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>
    {apiError}
  </div>
)}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {viewType === "pnl" ? (
            <>
              <div style={{ ...cardStyle, border: "1px solid rgba(124,140,255,0.18)" }}>
                <div style={labelStyle}>Total P&amp;L Budget</div>
                <div style={{ ...valueStyleBase, color: "#7C8CFF" }}>
                  {formatCurrency(totalPnlBudget)}
                </div>
              </div>

              <div style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.18)" }}>
                <div style={labelStyle}>Total P&amp;L Actual</div>
                <div style={{ ...valueStyleBase, color: "#10b981" }}>
                  {formatCurrency(totalPnlActual)}
                </div>
              </div>

              <div style={{ ...cardStyle, border: "1px solid rgba(94,234,212,0.18)" }}>
                <div style={labelStyle}>P&amp;L Utilisation</div>
                <div style={{ ...valueStyleBase, color: "#5EEAD4" }}>
                  {pnlUtilPct}%
                </div>
              </div>

              <div
                style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.18)", cursor: "pointer" }}
                onClick={() => drill({ tab: "budget" })}
              >
                <div style={labelStyle}>Items w/ Actual</div>
                <div style={{ ...valueStyleBase, color: "#f59e0b" }}>
                  {pnlItemsWithActual} / {totalItems}
                </div>
              </div>
            </>
          ) : viewType === "category" ? (
            <>
              <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.18)" }}>
                <div style={labelStyle}>Selected Category</div>
                <div
                  style={{
                    color: "#f59e0b",
                    fontSize: 24,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {selectedCategory === "all" ? "All" : selectedCategory}
                </div>
              </div>

              <div
                style={{ ...cardStyle, border: "1px solid rgba(94,234,212,0.18)", cursor: "pointer" }}
                onClick={() =>
                  drill({
                    tab: "budget",
                    ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
                  })
                }
              >
                <div style={labelStyle}>Category Budget</div>
                <div style={{ ...valueStyleBase, color: "#5EEAD4" }}>
                  {formatCurrency(totalBudget)}
                </div>
              </div>

              <div
                style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer" }}
                onClick={() =>
                  drill({
                    tab: "budget",
                    ...(selectedCategory !== "all" ? { category: selectedCategory } : {}),
                  })
                }
              >
                <div style={labelStyle}>Category Actual</div>
                <div style={{ ...valueStyleBase, color: "#10b981" }}>
                  {formatCurrency(totalActual)}
                </div>
              </div>

              <div style={{ ...cardStyle, border: "1px solid rgba(124,140,255,0.18)" }}>
                <div style={labelStyle}>Categories in Scope</div>
                <div style={{ ...valueStyleBase, color: "#7C8CFF" }}>
                  {categoryCount}
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                style={{ ...cardStyle, border: "1px solid rgba(94,234,212,0.18)", cursor: "pointer" }}
                onClick={() => drill({ tab: "budget" })}
              >
                <div style={labelStyle}>Total Budget</div>
                <div style={{ ...valueStyleBase, color: "#5EEAD4" }}>
                  {formatCurrency(totalBudget)}
                </div>
              </div>

              <div
                style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer" }}
                onClick={() => drill({ tab: "budget", status: "Completed" })}
              >
                <div style={labelStyle}>Total Actual</div>
                <div style={{ ...valueStyleBase, color: "#10b981" }}>
                  {formatCurrency(totalActual)}
                </div>
              </div>

              <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.18)" }}>
                <div style={labelStyle}>Budget Variance</div>
                <div
                  style={{
                    ...valueStyleBase,
                    color: budgetVariance >= 0 ? "#f59e0b" : "#ef4444",
                  }}
                >
                  {budgetVariance >= 0 ? "" : "-"}
                  {formatCurrency(Math.abs(budgetVariance))}
                </div>
              </div>

              <div
                style={{ ...cardStyle, border: "1px solid rgba(96,165,250,0.18)", cursor: "pointer" }}
                onClick={() => drill({ tab: "budget" })}
              >
                <div style={labelStyle}>Total Items</div>
                <div style={{ ...valueStyleBase, color: "#60A5FA" }}>
                  {totalItems}
                </div>
              </div>
            </>
          )}
        </div>

        <div
  style={{
    background: "linear-gradient(145deg,#0B1624,#0A1320)",
    borderRadius: 14,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.05)",
  }}
>
  <div
    style={{
      color: "#E0E7FF",
      fontSize: 14,
      fontWeight: 800,
      marginBottom: 14,
    }}
  >
    {viewType === "budget" && "📈 Budget vs Actual Trend"}
    {viewType === "pnl" && "📊 P&L Trend"}
    {viewType === "category" && "🏷️ Category Trend"}
  </div>

  {viewType === "category" ? (
  categoryTrend.length === 0 ? (
    <div style={{ color: "#88A0B8", fontSize: 13, padding: "24px 0" }}>
      No category trend data available for the selected filters.
    </div>
  ) : (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={categoryTrend}>
          <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#9fb3c8", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "#9fb3c8", fontSize: 11 }}
            tickFormatter={(v) => formatShortCurrency(Number(v))}
          />
          <Tooltip
            contentStyle={{
              background: "#09131D",
              border: "1px solid #213547",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#f1f5f9" }}
            formatter={(value: any, name: string) => [
              formatCurrency(Number(value)),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#9fb3c8" }} />

          <Area
  type="monotone"
  dataKey="budget"
  fill="#F59E0B33"
  stroke="#F59E0B"
  strokeWidth={2}
  name="Category Budget"
  activeDot={{ r: 6, onClick: handleChartPointClick, style: { cursor: "pointer" } }}
/>

          <Line
  type="monotone"
  dataKey="actual"
  stroke="#10b981"
  strokeWidth={3}
  dot={{ r: 3 }}
  activeDot={{ r: 6, onClick: handleChartPointClick, style: { cursor: "pointer" } }}
  name="Category Actual"
/>

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
) : chartTrend.length === 0 ? (
  <div style={{ color: "#88A0B8", fontSize: 13, padding: "24px 0" }}>
    No trend data available for the selected filters.
  </div>
) : (
  <div style={{ width: "100%", height: 320 }}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartTrend}>
        <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#9fb3c8", fontSize: 11 }}
        />
        <YAxis
          tick={{ fill: "#9fb3c8", fontSize: 11 }}
          tickFormatter={(v) => formatShortCurrency(Number(v))}
        />
        <Tooltip
          contentStyle={{
            background: "#09131D",
            border: "1px solid #213547",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#f1f5f9" }}
          formatter={(value: any, name: string) => [
            formatCurrency(Number(value)),
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9fb3c8" }} />

        <Area
  type="monotone"
  dataKey="budget"
  fill="#5EEAD433"
  stroke="#5EEAD4"
  strokeWidth={2}
  name={viewType === "pnl" ? "P&L Budget" : "Budget"}
  activeDot={{ r: 6, onClick: handleChartPointClick, style: { cursor: "pointer" } }}
/>

        <Line
  type="monotone"
  dataKey="actual"
  stroke="#10b981"
  strokeWidth={3}
  dot={{ r: 3 }}
  activeDot={{ r: 6, onClick: handleChartPointClick, style: { cursor: "pointer" } }}
  name={viewType === "pnl" ? "P&L Actual" : "Actual"}
/>
      </ComposedChart>
    </ResponsiveContainer>
  </div>
)}
</div>
      </div>
    </div>
  );
}