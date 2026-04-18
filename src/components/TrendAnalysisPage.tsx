"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

type BudgetItem = {
  id?: string;
  fy?: string;
  planMonth?: string;
  itemCategory?: string;
  businessUnit?: string;
  payingBU?: string;
  budget?: number | string | null;
  actual?: number | string | null;
  quantity?: number | string | null;
  description?: string;
  status?: string;
  currency?: string;
  [key: string]: any;
};

type TrendPoint = {
  period: string;
  label: string;
  budget: number;
  actual: number;
  count: number;
};

type TrendAnalysisPageProps = {
  items?: BudgetItem[];
  fyOptions?: string[];
  onDrillDown?: (filters: any) => void;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number) {
  return `S$${Math.round(value).toLocaleString()}`;
}

function getFYHalfFromPlanMonth(planMonth: string) {
  if (!planMonth) return "";

  // supports both:
  // 1) YYYY-MM  -> 2024-04
  // 2) Mon-YY   -> Apr-24

  // case 1: YYYY-MM
  const isoMatch = planMonth.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const monthNum = Number(isoMatch[2]);

    if (!year || !monthNum) return planMonth;

    const fy = monthNum >= 4 ? year + 1 : year;
    const half = monthNum >= 4 && monthNum <= 9 ? "H1" : "H2";

    return `FY${fy}-${half}`;
  }

  // case 2: Mon-YY
  const [mon, yy] = planMonth.split("-");
  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };

  const monthNum = monthMap[mon];
  const year2 = Number(yy);
  const fullYear = year2 >= 0 && year2 <= 99 ? 2000 + year2 : year2;

  if (!monthNum || !fullYear) return planMonth;

  const fy = monthNum >= 4 ? fullYear + 1 : fullYear;
  const half = monthNum >= 4 && monthNum <= 9 ? "H1" : "H2";

  return `FY${fy}-${half}`;
}

function sortFYHalf(a: string, b: string) {
  const ma = a.match(/^FY(\d+)-H([12])$/);
  const mb = b.match(/^FY(\d+)-H([12])$/);

  if (!ma || !mb) return a.localeCompare(b);

  const fyA = Number(ma[1]);
  const fyB = Number(mb[1]);
  if (fyA !== fyB) return fyA - fyB;

  return Number(ma[2]) - Number(mb[2]);
}

function formatShortCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `S$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `S$${Math.round(value / 1_000)}k`;
  return `S$${Math.round(value)}`;
}

function getUniqueSorted(values: Array<string | undefined | null>) {
  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))].sort();
}

function deriveFY(item: BudgetItem) {
  if (item.fy && String(item.fy).trim()) return String(item.fy).trim();

  const pm = String(item.planMonth || "").trim();
  if (!pm) return "Unknown";

  const match = pm.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return "Unknown";

  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };

  const month = monthMap[match[1]] || 0;
  let year = Number(match[2]);
  if (year < 100) year += 2000;
  if (!month || !year) return "Unknown";

  const half = month >= 4 && month <= 9 ? "H1" : "H2";
  const fyYear = month >= 1 && month <= 3 ? year - 1 : year;
  return `${fyYear}-${half}`;
}

function getPlanMonthKey(item: BudgetItem) {
  const pm = String(item.planMonth || "").trim();
  if (!pm) return "Unknown";

  const match = pm.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return "Unknown";

  const monthMap: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
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
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  };
  return `${labelMap[month] || month}-${String(year).slice(-2)}`;
}

function getViewHeading(viewType: "budget" | "pnl" | "category") {
  if (viewType === "budget") return "💰 Budget & Actuals Trend";
  if (viewType === "pnl") return "📊 P&L Trend";
  return "🏷️ Category Trend";
}

function getViewChartTitle(viewType: "budget" | "pnl" | "category") {
  if (viewType === "budget") return "💰 Budget vs Actual Trend";
  if (viewType === "pnl") return "📊 P&L Trend";
  return "🏷️ Category Trend";
}

function effectiveValue(item: BudgetItem) {
  const actual = toNumber(item.actual);
  const budget = toNumber(item.budget);
  return actual > 0 ? actual : budget;
}

function valueBasis(item: BudgetItem) {
  return toNumber(item.actual) > 0 ? "Actual" : "Budget";
}

function StarDot(props: any) {
  const { cx, cy, stroke, payload, onPointSelect } = props;
  if (cx == null || cy == null) return null;

  const outer = 10;
  const inner = 4.5;
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = (-90 + i * 36) * (Math.PI / 180);
    const radius = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push(`${x},${y}`);
  }

  return (
    <polygon
      points={points.join(" ")}
      fill={stroke || "#10b981"}
      stroke="#E6FFFA"
      strokeWidth={2}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onPointSelect?.(payload);
      }}
    />
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  minWidth = 170,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const allSelected = selected.includes("all") || selected.length === 0;

  const display = allSelected
    ? label
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  const toggle = (value: string) => {
    if (value === "all") {
      onChange(["all"]);
      return;
    }
    const current = allSelected ? [] : selected;
    const exists = current.includes(value);
    const next = exists ? current.filter((x) => x !== value) : [...current, value].sort();
    onChange(next.length ? next : ["all"]);
  };

  return (
    <div ref={ref} style={{ position: "relative", minWidth }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
        <span>{display}</span>
        <span style={{ color: "#9fb3c8", marginLeft: 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 50,
            width: 260,
            maxHeight: 280,
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
              checked={allSelected}
              onChange={() => toggle("all")}
            />
            <span>{label}</span>
          </label>

          <div style={{ height: 1, background: "#213547", margin: "6px 4px" }} />

          {options.map((option) => (
            <label
              key={option}
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
                checked={!allSelected && selected.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrendAnalysisPage({
  items = [],
  fyOptions = [],
}: TrendAnalysisPageProps) {
  const [viewType, setViewType] = useState<"budget" | "pnl" | "category">("budget");
  const [selectedFYs, setSelectedFYs] = useState<string[]>(["all"]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["all"]);
  const [selectedBUs, setSelectedBUs] = useState<string[]>(["all"]);
  const [selectedPayingBUs, setSelectedPayingBUs] = useState<string[]>(["all"]);

  const [rawItems, setRawItems] = useState<BudgetItem[]>(Array.isArray(items) ? items : []);
  const [loading, setLoading] = useState(!Array.isArray(items) || items.length === 0);
  const [error, setError] = useState("");
  const [selectedTrendPoint, setSelectedTrendPoint] = useState<TrendPoint | null>(null);

  useEffect(() => {
    setSelectedTrendPoint(null);
  }, [viewType, selectedFYs.join("|"), selectedCategories.join("|"), selectedBUs.join("|"), selectedPayingBUs.join("|")]);

  useEffect(() => {
    if (Array.isArray(items) && items.length > 0) {
      setRawItems(items);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;

    async function fetchAllItems() {
      try {
        setLoading(true);
        setError("");
        const collected: BudgetItem[] = [];
        let cursor = "";
        let guard = 0;

        while (guard < 50) {
          const params = new URLSearchParams({
            limit: "100",
            fy: "all",
            businessUnit: "all",
            status: "all",
          });
          if (cursor) params.set("cursor", cursor);

          const res = await fetch(`/api/budget-items?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || "Failed to load budget items");
          }

          const batch = Array.isArray(data?.items) ? data.items : [];
          collected.push(...batch);

          if (!data?.hasMore || !data?.nextCursor) break;
          cursor = String(data.nextCursor);
          guard += 1;
        }

        if (!cancelled) setRawItems(collected);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load budget items");
          setRawItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAllItems();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const categoryOptions = useMemo(() => getUniqueSorted(rawItems.map((i) => i.itemCategory)), [rawItems]);
  const buOptions = useMemo(() => getUniqueSorted(rawItems.map((i) => i.businessUnit)), [rawItems]);
  const payingBUOptions = useMemo(() => getUniqueSorted(rawItems.map((i) => i.payingBU)), [rawItems]);
  const resolvedFyOptions = useMemo(() => {
    const fromItems = getUniqueSorted(rawItems.map((i) => deriveFY(i)));
    const fromProps = getUniqueSorted(fyOptions);
    return getUniqueSorted([...fromItems, ...fromProps]);
  }, [rawItems, fyOptions]);

  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      const fyMatch = selectedFYs.includes("all") || selectedFYs.includes(deriveFY(item));
      const categoryMatch =
        selectedCategories.includes("all") || selectedCategories.includes(String(item.itemCategory || "").trim());
      const buMatch =
        selectedBUs.includes("all") || selectedBUs.includes(String(item.businessUnit || "").trim());
      const payingBUMatch =
        selectedPayingBUs.includes("all") || selectedPayingBUs.includes(String(item.payingBU || "").trim());
      return fyMatch && categoryMatch && buMatch && payingBUMatch;
    });
  }, [rawItems, selectedFYs, selectedCategories, selectedBUs, selectedPayingBUs]);

  const chartTrend = useMemo<TrendPoint[]>(() => {
  const periodMap: Record<string, TrendPoint> = {};

  filteredItems.forEach((item) => {
    const period = getFYHalfFromPlanMonth(getPlanMonthKey(item));
    if (!period || period === "Unknown") return;

    if (!periodMap[period]) {
      periodMap[period] = {
        period,
        label: period,
        budget: 0,
        actual: 0,
        count: 0,
      };
    }

    periodMap[period].budget += toNumber(item.budget);
    periodMap[period].actual += toNumber(item.actual);
    periodMap[period].count += 1;
  });

  return Object.values(periodMap).sort((a, b) => sortFYHalf(a.period, b.period));
}, [filteredItems]);

  const totalBudget = useMemo(() => filteredItems.reduce((sum, item) => sum + toNumber(item.budget), 0), [filteredItems]);
  const totalActual = useMemo(() => filteredItems.reduce((sum, item) => sum + toNumber(item.actual), 0), [filteredItems]);
  const totalItems = filteredItems.length;
  const budgetVariance = totalBudget - totalActual;
  const totalPnlBudget = totalBudget;
  const totalPnlActual = totalActual;
  const pnlItemsWithActual = filteredItems.filter((item) => toNumber(item.actual) > 0).length;
  const pnlUtilPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const categoryCount = getUniqueSorted(filteredItems.map((i) => i.itemCategory)).length;

  const detailRows = useMemo(() => {
    if (!selectedTrendPoint?.period) return [];
    return filteredItems
      .filter((item) => getFYHalfFromPlanMonth(getPlanMonthKey(item)) === selectedTrendPoint.period)
      .sort((a, b) => String(a.description || "").localeCompare(String(b.description || "")));
  }, [filteredItems, selectedTrendPoint]);

  const fySummaryRows = useMemo(() => {
    const scoped = detailRows.length > 0 ? detailRows : filteredItems;

    const map: Record<string, { fy: string; itemCount: number; quantity: number; budget: number; actual: number; usedValue: number }> = {};
    scoped.forEach((item) => {
      const fy = deriveFY(item);
      if (!map[fy]) {
        map[fy] = { fy, itemCount: 0, quantity: 0, budget: 0, actual: 0, usedValue: 0 };
      }
      map[fy].itemCount += 1;
      map[fy].quantity += toNumber(item.quantity);
      map[fy].budget += toNumber(item.budget);
      map[fy].actual += toNumber(item.actual);
      map[fy].usedValue += effectiveValue(item);
    });

    return Object.values(map).sort((a, b) => a.fy.localeCompare(b.fy));
  }, [detailRows, filteredItems]);

  const handlePointSelect = (point: TrendPoint | null) => {
    if (!point) return;
    setSelectedTrendPoint(point);
  };

  const handleChartClick = (state: any) => {
    const payload = state?.activePayload?.[0]?.payload || null;
    if (payload) handlePointSelect(payload);
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

  const detailTitle =
    !selectedTrendPoint
      ? "📋 FY Summary & Detail Table"
      : viewType === "category"
      ? `📋 Category Detail Rows for ${selectedTrendPoint.label}`
      : viewType === "pnl"
      ? `📋 P&L Detail Rows for ${selectedTrendPoint.label}`
      : `📋 Budget & Actual Detail Rows for ${selectedTrendPoint.label}`;

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
          <MultiSelect
            label="All Years"
            options={resolvedFyOptions}
            selected={selectedFYs}
            onChange={setSelectedFYs}
            minWidth={170}
          />
          <MultiSelect
            label="All Categories"
            options={categoryOptions}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            minWidth={180}
          />
          <MultiSelect
            label="All BUs"
            options={buOptions}
            selected={selectedBUs}
            onChange={setSelectedBUs}
            minWidth={160}
          />
          <MultiSelect
            label="All Paying BUs"
            options={payingBUOptions}
            selected={selectedPayingBUs}
            onChange={setSelectedPayingBUs}
            minWidth={190}
          />

          {(!selectedFYs.includes("all") ||
            !selectedCategories.includes("all") ||
            !selectedBUs.includes("all") ||
            !selectedPayingBUs.includes("all")) && (
            <button
              onClick={() => {
                setSelectedFYs(["all"]);
                setSelectedCategories(["all"]);
                setSelectedBUs(["all"]);
                setSelectedPayingBUs(["all"]);
                setSelectedTrendPoint(null);
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
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ color: "#E0E7FF", fontSize: 16, fontWeight: 800, marginBottom: 18 }}>
          {getViewHeading(viewType)}
        </div>

        {loading && <div style={{ color: "#88A0B8", fontSize: 13, marginBottom: 12 }}>Loading data...</div>}
        {!!error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

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
                <div style={{ ...valueStyleBase, color: "#7C8CFF" }}>{formatCurrency(totalPnlBudget)}</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.18)" }}>
                <div style={labelStyle}>Total P&amp;L Actual</div>
                <div style={{ ...valueStyleBase, color: "#10b981" }}>{formatCurrency(totalPnlActual)}</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(94,234,212,0.18)" }}>
                <div style={labelStyle}>P&amp;L Utilisation</div>
                <div style={{ ...valueStyleBase, color: "#5EEAD4" }}>{pnlUtilPct}%</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.18)" }}>
                <div style={labelStyle}>Items w/ Actual</div>
                <div style={{ ...valueStyleBase, color: "#f59e0b" }}>{pnlItemsWithActual} / {totalItems}</div>
              </div>
            </>
          ) : viewType === "category" ? (
            <>
              <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.18)" }}>
                <div style={labelStyle}>Selected Categories</div>
                <div style={{ color: "#f59e0b", fontSize: 24, fontWeight: 900 }}>
                  {selectedCategories.includes("all") ? "All" : selectedCategories.length}
                </div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(94,234,212,0.18)" }}>
                <div style={labelStyle}>Category Budget</div>
                <div style={{ ...valueStyleBase, color: "#5EEAD4" }}>{formatCurrency(totalBudget)}</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.18)" }}>
                <div style={labelStyle}>Category Actual</div>
                <div style={{ ...valueStyleBase, color: "#10b981" }}>{formatCurrency(totalActual)}</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(124,140,255,0.18)" }}>
                <div style={labelStyle}>Categories in Scope</div>
                <div style={{ ...valueStyleBase, color: "#7C8CFF" }}>{categoryCount}</div>
              </div>
            </>
          ) : (
            <>
              <div style={{ ...cardStyle, border: "1px solid rgba(94,234,212,0.18)" }}>
                <div style={labelStyle}>Total Budget</div>
                <div style={{ ...valueStyleBase, color: "#5EEAD4" }}>{formatCurrency(totalBudget)}</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(16,185,129,0.18)" }}>
                <div style={labelStyle}>Total Actual</div>
                <div style={{ ...valueStyleBase, color: "#10b981" }}>{formatCurrency(totalActual)}</div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(245,158,11,0.18)" }}>
                <div style={labelStyle}>Budget Variance</div>
                <div style={{ ...valueStyleBase, color: budgetVariance >= 0 ? "#f59e0b" : "#ef4444" }}>
                  {budgetVariance >= 0 ? "" : "-"}{formatCurrency(Math.abs(budgetVariance))}
                </div>
              </div>
              <div style={{ ...cardStyle, border: "1px solid rgba(96,165,250,0.18)" }}>
                <div style={labelStyle}>Total Items</div>
                <div style={{ ...valueStyleBase, color: "#60A5FA" }}>{totalItems}</div>
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
          <div style={{ color: "#E0E7FF", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
            {getViewChartTitle(viewType)}
          </div>

          <div style={{ color: "#88A0B8", fontSize: 12, marginBottom: 14 }}>
            Click any star to inspect that month. Stars remain stars even on hover.
          </div>

          {chartTrend.length === 0 ? (
            <div style={{ color: "#88A0B8", fontSize: 13, padding: "24px 0" }}>
              No trend data available for the selected filters.
            </div>
          ) : (
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartTrend} onClick={handleChartClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
                  <XAxis dataKey="label" tick={{ fill: "#9fb3c8", fontSize: 11 }} />
                  <YAxis
                    tick={{ fill: "#9fb3c8", fontSize: 11 }}
                    tickFormatter={(v) => formatShortCurrency(Number(v))}
                  />
                  <Tooltip
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1 }}
                    contentStyle={{
                      background: "#09131D",
                      border: "1px solid #213547",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "#f1f5f9" }}
                    formatter={(value: any, name: string) => [formatCurrency(Number(value)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9fb3c8" }} />

                  <Area
  type="monotone"
  dataKey="budget"
  fill="#3B82F633"
  stroke="#2563EB"
  strokeWidth={2}
  name={viewType === "pnl" ? "P&L Budget" : viewType === "category" ? "Category Budget" : "Budget"}
  dot={(props) => (
    <StarDot
      {...props}
      onPointSelect={(payload: TrendPoint) => handlePointSelect(payload)}
    />
  )}
  activeDot={(props: any) => (
    <StarDot
      {...props}
      onPointSelect={(payload: TrendPoint) => handlePointSelect(payload)}
    />
  )}
  isAnimationActive={false}
/>

                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#16A34A"
                    strokeWidth={3}
                    dot={(props) => (
                      <StarDot
                        {...props}
                        onPointSelect={(payload: TrendPoint) => handlePointSelect(payload)}
                      />
                    )}
                    activeDot={(props: any) => (
                      <StarDot
                        {...props}
                        onPointSelect={(payload: TrendPoint) => handlePointSelect(payload)}
                      />
                    )}
                    isAnimationActive={false}
                    name={viewType === "pnl" ? "P&L Actual" : viewType === "category" ? "Category Actual" : "Actual"}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            background: "linear-gradient(145deg,#0B1624,#0A1320)",
            border: "1px solid rgba(94,234,212,0.14)",
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ color: "#E0E7FF", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
            {detailTitle}
          </div>

          {!selectedTrendPoint ? (
            <div style={{ color: "#88A0B8", fontSize: 13 }}>
              Select a star on the chart above to see the month details. The FY summary below already reflects the current multi-select filters.
            </div>
          ) : null}

          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <div style={{ color: "#E0E7FF", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Selected FY Summary
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 860,
              }}
            >
              <thead>
                <tr>
                  {["FY", "Items", "Quantity", "Budget", "Actual", "Value Used"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: 12,
                        color: "#8B9BB4",
                        borderBottom: "1px solid #1f3142",
                        background: "rgba(255,255,255,0.02)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fySummaryRows.map((row) => (
                  <tr key={row.fy}>
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#7dd3fc", fontWeight: 700 }}>{row.fy}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>{row.itemCount}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>{row.quantity}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#5EEAD4", fontWeight: 700 }}>{formatCurrency(row.budget)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#10b981", fontWeight: 700 }}>{formatCurrency(row.actual)}</td>
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f59e0b", fontWeight: 700 }}>{formatCurrency(row.usedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedTrendPoint && (
            <div style={{ marginTop: 18, overflowX: "auto" }}>
              <div style={{ color: "#E0E7FF", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Clicked Month Detail Rows
              </div>
              {detailRows.length === 0 ? (
                <div style={{ color: "#88A0B8", fontSize: 13 }}>
                  No matching items found for this month and current filters.
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    minWidth: 1320,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Description",
                        "Category",
                        "BU",
                        "Paying BU",
                        "Plan Month",
                        "FY",
                        "Quantity",
                        "Budget",
                        "Actual",
                        "Value Used",
                        "Basis",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            fontSize: 12,
                            color: "#8B9BB4",
                            borderBottom: "1px solid #1f3142",
                            background: "rgba(255,255,255,0.02)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, idx) => (
                      <tr key={row.id || `${row.description}-${idx}`}>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#E5EEF8", fontWeight: 600 }}>
                          {row.description || "-"}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#9fb3c8" }}>
                          {row.itemCategory || "-"}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#9fb3c8" }}>
                          {row.businessUnit || "-"}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#9fb3c8" }}>
                          {row.payingBU || "-"}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#F59E0B", fontWeight: 700 }}>
                          {row.planMonth || "-"}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#7dd3fc", fontWeight: 700 }}>
                          {deriveFY(row)}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                          {toNumber(row.quantity)}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#5EEAD4", fontWeight: 700 }}>
                          {formatCurrency(toNumber(row.budget))}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#10b981", fontWeight: 700 }}>
                          {formatCurrency(toNumber(row.actual))}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f59e0b", fontWeight: 700 }}>
                          {formatCurrency(effectiveValue(row))}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                          {valueBasis(row)}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#cbd5e1" }}>
                          {row.status || "Pending"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
