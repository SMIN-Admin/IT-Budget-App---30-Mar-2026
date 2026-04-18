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
  BarChart,
  Bar,
} from "recharts";

type HeadcountRecord = {
  id?: string;
  userEmailId: string;
  businessUnit: string;
  location: string;
  department: string;
  empType: string;
  fyHalf: string;
  budget?: number | string | null;
  actual?: number | string | null;
  [key: string]: any;
};

type HeadcountTrendPageProps = {
  records?: HeadcountRecord[];
  budgetSummaryByHalf?: Array<{
    fyHalf: string;
    budget: number;
    actual: number;
  }>;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number) {
  return `S$${Math.round(value).toLocaleString()}`;
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

function parseFyHalf(fyHalf: string) {
  const match = String(fyHalf || "").match(/^(\d{4})-H([12])$/);
  if (!match) return { year: 0, half: 0 };
  return { year: Number(match[1]), half: Number(match[2]) };
}

function compareFyHalf(a: string, b: string) {
  const aa = parseFyHalf(a);
  const bb = parseFyHalf(b);
  if (aa.year !== bb.year) return aa.year - bb.year;
  return aa.half - bb.half;
}

function previousFyHalf(fyHalf: string) {
  const { year, half } = parseFyHalf(fyHalf);
  if (!year || !half) return "";
  if (half === 2) return `${year}-H1`;
  return `${year - 1}-H2`;
}

function growthPct(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
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
  minWidth = 180,
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
    const next = exists ? current.filter((x) => x !== value) : [...current, value].sort(compareFyHalf);
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
            width: 280,
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
            <input type="checkbox" checked={allSelected} onChange={() => toggle("all")} />
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

export default function HeadcountTrendPage({
  records = [],
  budgetSummaryByHalf = [],
}: HeadcountTrendPageProps) {
  const [selectedFYs, setSelectedFYs] = useState<string[]>(["all"]);
  const [selectedBUs, setSelectedBUs] = useState<string[]>(["all"]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["all"]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(["all"]);
  const [selectedEmpTypes, setSelectedEmpTypes] = useState<string[]>(["all"]);
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  useEffect(() => {
    setSelectedPoint(null);
  }, [selectedFYs.join("|"), selectedBUs.join("|"), selectedLocations.join("|"), selectedDepartments.join("|"), selectedEmpTypes.join("|")]);

  const fyOptions = useMemo(() => getUniqueSorted(records.map((r) => r.fyHalf)).sort(compareFyHalf), [records]);
  const buOptions = useMemo(() => getUniqueSorted(records.map((r) => r.businessUnit)), [records]);
  const locationOptions = useMemo(() => getUniqueSorted(records.map((r) => r.location)), [records]);
  const departmentOptions = useMemo(() => getUniqueSorted(records.map((r) => r.department)), [records]);
  const empTypeOptions = useMemo(() => getUniqueSorted(records.map((r) => r.empType)), [records]);

  const filtered = useMemo(() => {
    return records.filter((row) => {
      const fyMatch = selectedFYs.includes("all") || selectedFYs.includes(row.fyHalf);
      const buMatch = selectedBUs.includes("all") || selectedBUs.includes(row.businessUnit);
      const locationMatch = selectedLocations.includes("all") || selectedLocations.includes(row.location);
      const departmentMatch = selectedDepartments.includes("all") || selectedDepartments.includes(row.department);
      const empTypeMatch = selectedEmpTypes.includes("all") || selectedEmpTypes.includes(row.empType);
      return fyMatch && buMatch && locationMatch && departmentMatch && empTypeMatch;
    });
  }, [records, selectedFYs, selectedBUs, selectedLocations, selectedDepartments, selectedEmpTypes]);

  const budgetMap = useMemo(() => {
    const map = new Map<string, { budget: number; actual: number }>();
    budgetSummaryByHalf.forEach((row) => {
      map.set(row.fyHalf, { budget: toNumber(row.budget), actual: toNumber(row.actual) });
    });

    if (budgetSummaryByHalf.length === 0) {
      filtered.forEach((row) => {
        const curr = map.get(row.fyHalf) || { budget: 0, actual: 0 };
        curr.budget += toNumber(row.budget);
        curr.actual += toNumber(row.actual);
        map.set(row.fyHalf, curr);
      });
    }

    return map;
  }, [budgetSummaryByHalf, filtered]);

  const trendData = useMemo(() => {
    const fySet = new Set<string>(filtered.map((r) => r.fyHalf));
    const rows = [...fySet]
      .sort(compareFyHalf)
      .map((fyHalf) => {
        const hcRows = filtered.filter((r) => r.fyHalf === fyHalf);
        const hc = hcRows.length;
        const prevKey = previousFyHalf(fyHalf);
        const prevHc = filtered.filter((r) => r.fyHalf === prevKey).length;
        const budgetInfo = budgetMap.get(fyHalf) || { budget: 0, actual: 0 };
        const prevBudgetInfo = budgetMap.get(prevKey) || { budget: 0, actual: 0 };

        return {
          fyHalf,
          label: fyHalf,
          headcount: hc,
          budget: budgetInfo.budget,
          actual: budgetInfo.actual,
          variance: budgetInfo.budget - budgetInfo.actual,
          headcountGrowth: growthPct(hc, prevHc),
          budgetGrowth: growthPct(budgetInfo.budget, prevBudgetInfo.budget),
          actualGrowth: growthPct(budgetInfo.actual, prevBudgetInfo.actual),
        };
      });
    return rows;
  }, [filtered, budgetMap]);

  const totalHeadcount = filtered.length;
  const totalBudget = trendData.reduce((sum, row) => sum + toNumber(row.budget), 0);
  const totalActual = trendData.reduce((sum, row) => sum + toNumber(row.actual), 0);
  const totalVariance = totalBudget - totalActual;
  const lastRow = trendData[trendData.length - 1];
  const headcountGrowth = lastRow?.headcountGrowth ?? 0;
  const budgetGrowth = lastRow?.budgetGrowth ?? 0;
  const actualGrowth = lastRow?.actualGrowth ?? 0;

  const buDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((row) => {
      map[row.businessUnit] = (map[row.businessUnit] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, headcount: value }))
      .sort((a, b) => b.headcount - a.headcount)
      .slice(0, 10);
  }, [filtered]);

  const locationDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((row) => {
      map[row.location] = (map[row.location] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, headcount: value }))
      .sort((a, b) => b.headcount - a.headcount)
      .slice(0, 10);
  }, [filtered]);

  const departmentDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((row) => {
      map[row.department] = (map[row.department] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, headcount: value }))
      .sort((a, b) => b.headcount - a.headcount)
      .slice(0, 10);
  }, [filtered]);

  const clickedHalfRows = useMemo(() => {
    if (!selectedPoint?.fyHalf) return [];
    return filtered
      .filter((row) => row.fyHalf === selectedPoint.fyHalf)
      .sort((a, b) => String(a.userEmailId).localeCompare(String(b.userEmailId)));
  }, [filtered, selectedPoint]);

  const handlePointSelect = (point: any) => {
    if (!point) return;
    setSelectedPoint(point);
  };

  const card = (label: string, value: string | number, color: string) => (
    <div
      style={{
        background: "linear-gradient(145deg,#0B1624,#0A1320)",
        borderRadius: 12,
        padding: 18,
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ color: "#88A0B8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "monospace" }}>{value}</div>
    </div>
  );

  const exportSummary = () => {
    const headers = ["fyHalf", "headcount", "budget", "actual", "variance", "headcountGrowth", "budgetGrowth", "actualGrowth"];
    const lines = trendData.map((row) =>
      [
        row.fyHalf,
        row.headcount,
        row.budget,
        row.actual,
        row.variance,
        row.headcountGrowth,
        row.budgetGrowth,
        row.actualGrowth,
      ].join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "headcount_trend_summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ color: "#E0E7FF", margin: 0, fontSize: 18, fontWeight: 800 }}>📈 Headcount Trend</h2>
            <div style={{ color: "#88A0B8", fontSize: 12, marginTop: 4 }}>
              Summary-first view of headcount, budget, actuals, and growth by FY/Half.
            </div>
          </div>

          <button
            onClick={exportSummary}
            style={{
              background: "rgba(96,165,250,0.08)",
              border: "1px solid rgba(96,165,250,0.30)",
              borderRadius: 10,
              color: "#DBEAFE",
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            ⬇ Export Summary
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <MultiSelect label="All Years" options={fyOptions} selected={selectedFYs} onChange={setSelectedFYs} minWidth={170} />
          <MultiSelect label="All BUs" options={buOptions} selected={selectedBUs} onChange={setSelectedBUs} minWidth={170} />
          <MultiSelect label="All Locations" options={locationOptions} selected={selectedLocations} onChange={setSelectedLocations} minWidth={180} />
          <MultiSelect label="All Departments" options={departmentOptions} selected={selectedDepartments} onChange={setSelectedDepartments} minWidth={190} />
          <MultiSelect label="All Emp Types" options={empTypeOptions} selected={selectedEmpTypes} onChange={setSelectedEmpTypes} minWidth={170} />

          <button
            onClick={() => {
              setSelectedFYs(["all"]);
              setSelectedBUs(["all"]);
              setSelectedLocations(["all"]);
              setSelectedDepartments(["all"]);
              setSelectedEmpTypes(["all"]);
              setSelectedPoint(null);
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
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 14 }}>
        {card("Headcount", totalHeadcount, "#5EEAD4")}
        {card("Budget", formatCurrency(totalBudget), "#7C8CFF")}
        {card("Actual", formatCurrency(totalActual), "#10B981")}
        {card("Variance", formatCurrency(totalVariance), totalVariance >= 0 ? "#F59E0B" : "#EF4444")}
        {card("HC Growth %", `${headcountGrowth}%`, "#60A5FA")}
        {card("Budget Growth %", `${budgetGrowth}%`, "#A78BFA")}
        {card("Actual Growth %", `${actualGrowth}%`, "#34D399")}
      </div>

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ color: "#E0E7FF", fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
          📊 Headcount + Budget + Actual Trend
        </div>
        <div style={{ color: "#88A0B8", fontSize: 12, marginBottom: 14 }}>
          Click any star on the chart to inspect the selected FY/Half below.
        </div>

        {trendData.length === 0 ? (
          <div style={{ color: "#88A0B8", fontSize: 13, padding: "24px 0" }}>
            No trend data available for the selected filters.
          </div>
        ) : (
          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
                <XAxis dataKey="label" tick={{ fill: "#9fb3c8", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "#9fb3c8", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9fb3c8", fontSize: 11 }} tickFormatter={(v) => formatShortCurrency(Number(v))} />
                <Tooltip
                  contentStyle={{
                    background: "#09131D",
                    border: "1px solid #213547",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#f1f5f9" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#9fb3c8" }} />

                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="budget"
                  fill="#3B82F633"
                  stroke="#2563EB"
                  strokeWidth={2}
                  name="Budget"
                  dot={(props) => <StarDot {...props} onPointSelect={handlePointSelect} />}
                  activeDot={(props: any) => <StarDot {...props} onPointSelect={handlePointSelect} />}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="actual"
                  stroke="#16A34A"
                  strokeWidth={3}
                  name="Actual"
                  dot={(props) => <StarDot {...props} onPointSelect={handlePointSelect} />}
                  activeDot={(props: any) => <StarDot {...props} onPointSelect={handlePointSelect} />}
                  isAnimationActive={false}
                />

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="headcount"
                  stroke="#FFA500"
                  strokeWidth={3}
                  name="Headcount"
                  dot={(props) => <StarDot {...props} onPointSelect={handlePointSelect} />}
                  activeDot={(props: any) => <StarDot {...props} onPointSelect={handlePointSelect} />}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
        {[
          ["Headcount by BU", buDistribution],
          ["Headcount by Location", locationDistribution],
          ["Headcount by Department", departmentDistribution],
        ].map(([title, data]) => (
          <div
            key={String(title)}
            style={{
              background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
              borderRadius: 14,
              padding: 18,
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ color: "#E0E7FF", fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
              {String(title)}
            </div>
            {Array.isArray(data) && data.length > 0 ? (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data as any[]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#213547" />
                    <XAxis dataKey="name" tick={{ fill: "#9fb3c8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9fb3c8", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#09131D",
                        border: "1px solid #213547",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="headcount" fill="#60A5FA" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ color: "#88A0B8", fontSize: 13 }}>No data in current scope.</div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ color: "#E0E7FF", fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
          FY Summary Table
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
            <thead>
              <tr>
                {["FY & Half", "Headcount", "Budget", "Actual", "Variance", "HC Growth %", "Budget Growth %", "Actual Growth %"].map((h) => (
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
              {trendData.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "20px 12px", color: "#94a3b8", textAlign: "center" }}>
                    No summary rows for the current filters.
                  </td>
                </tr>
              ) : (
                trendData.map((row) => (
                  <tr key={row.fyHalf}>
                    <td style={{ padding: "10px 12px", color: "#7dd3fc", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.fyHalf}</td>
                    <td style={{ padding: "10px 12px", color: "#E5EEF8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.headcount}</td>
                    <td style={{ padding: "10px 12px", color: "#5EEAD4", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{formatCurrency(row.budget)}</td>
                    <td style={{ padding: "10px 12px", color: "#10B981", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{formatCurrency(row.actual)}</td>
                    <td style={{ padding: "10px 12px", color: row.variance >= 0 ? "#F59E0B" : "#EF4444", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{formatCurrency(row.variance)}</td>
                    <td style={{ padding: "10px 12px", color: "#60A5FA", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.headcountGrowth}%</td>
                    <td style={{ padding: "10px 12px", color: "#A78BFA", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.budgetGrowth}%</td>
                    <td style={{ padding: "10px 12px", color: "#34D399", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.actualGrowth}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(145deg,#0F1B2B,#0C1722)",
          borderRadius: 14,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ color: "#E0E7FF", fontSize: 15, fontWeight: 800, marginBottom: 8 }}>
          Clicked Half Detail Table
        </div>
        {!selectedPoint ? (
          <div style={{ color: "#88A0B8", fontSize: 13 }}>
            Click any star on the main trend chart to see the headcount rows for that selected FY/Half.
          </div>
        ) : (
          <>
            <div style={{ color: "#88A0B8", fontSize: 12, marginBottom: 12 }}>
              Selected: <span style={{ color: "#E6FFFD", fontWeight: 700 }}>{selectedPoint.fyHalf}</span> — {clickedHalfRows.length} row{clickedHalfRows.length === 1 ? "" : "s"}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
                <thead>
                  <tr>
                    {["User Email ID", "Business Unit", "Location", "Department", "Emp. Type", "FY & Half"].map((h) => (
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
                  {clickedHalfRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "20px 12px", color: "#94a3b8", textAlign: "center" }}>
                        No headcount rows found for the selected FY/Half and filters.
                      </td>
                    </tr>
                  ) : (
                    clickedHalfRows.map((row, idx) => (
                      <tr key={row.id || `${row.userEmailId}-${row.fyHalf}-${idx}`}>
                        <td style={{ padding: "10px 12px", color: "#E5EEF8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.userEmailId}</td>
                        <td style={{ padding: "10px 12px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.businessUnit}</td>
                        <td style={{ padding: "10px 12px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.location}</td>
                        <td style={{ padding: "10px 12px", color: "#9fb3c8", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.department}</td>
                        <td style={{ padding: "10px 12px", color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.empType}</td>
                        <td style={{ padding: "10px 12px", color: "#7dd3fc", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{row.fyHalf}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
