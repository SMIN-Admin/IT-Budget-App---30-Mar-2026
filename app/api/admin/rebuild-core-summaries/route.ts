import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";

type BudgetItem = {
  id?: string;
  fy?: string;
  planMonth?: string;
  businessUnit?: string;
  payingBU?: string;
  itemCategory?: string;
  itemType?: string;
  expenseType?: string;
  status?: string;
  budget?: number | string;
  actual?: number | null;
  outsideBudget?: boolean;
  billingFreq?: string;
  country?: string;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PNL_BREAKUP: Record<string, number> = {
  Monthly: 1,
  Quarterly: 3,
  "Half Yearly": 6,
  Annual: 12,
  "One Time Cost": 12,
};

function parsePlanMonth(pm?: string | null) {
  if (!pm) return null;
  const [m, y] = String(pm).split("-");
  const mi = MONTHS.indexOf(m);
  if (mi === -1) return null;
  const year = parseInt("20" + y, 10);
  return { month: mi, year };
}

function getFY(planMonth?: string | null) {
  const p = parsePlanMonth(planMonth);
  if (!p) return "";
  const { month, year } = p;

  if (month >= 3 && month <= 8) return `${year + 1}-H1`;
  if (month >= 9) return `${year + 1}-H2`;
  return `${year}-H2`;
}

function toNumber(v: unknown) {
  const n = parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function round(n: number) {
  return Math.round(n);
}

function getDaysUntil(planMonth?: string | null) {
  const p = parsePlanMonth(planMonth);
  if (!p) return null;
  const target = new Date(p.year, p.month, 1);
  const today = new Date();
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getPnLBreakup(billingFreq?: string | null) {
  if (!billingFreq) return 12;
  return PNL_BREAKUP[billingFreq] || 12;
}

function calcPnLMonths(item: BudgetItem, mode: "budget" | "actual" | "hybrid" = "hybrid") {
  const p = parsePlanMonth(item.planMonth);
  if (!p) return {} as Record<string, number>;

  const breakup = getPnLBreakup(item.billingFreq);
  const budgetVal = toNumber(item.budget);
  const actualVal = item.actual != null ? toNumber(item.actual) : 0;

  let costVal = 0;
  if (mode === "budget") costVal = budgetVal;
  else if (mode === "actual") costVal = actualVal;
  else costVal = actualVal > 0 ? actualVal : budgetVal;

  if (costVal <= 0) return {} as Record<string, number>;

  const monthly = costVal / breakup;
  const result: Record<string, number> = {};

  for (let i = 0; i < breakup; i++) {
    let mo = p.month + i;
    let yr = p.year;

    while (mo > 11) {
      mo -= 12;
      yr++;
    }

    const key = `${MONTHS[mo]}-${String(yr).slice(2)}`;
    result[key] = (result[key] || 0) + monthly;
  }

  return result;
}

function sumPnL(item: BudgetItem, mode: "budget" | "actual" | "hybrid" = "hybrid") {
  return Object.values(calcPnLMonths(item, mode)).reduce((s, v) => s + toNumber(v), 0);
}

function calcBudgetHealthScore(items: BudgetItem[], totalBudget: number, totalActual: number) {
  const completed = items.filter(i => i.status === "Completed").length;
  const completedPct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
  const utilPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const actualsFilledPct = items.length > 0
    ? Math.round((items.filter(i => i.actual != null).length / items.length) * 100)
    : 0;

  const budgetAccuracy = Math.max(0, 100 - Math.abs(100 - utilPct));
  const score = Math.round((completedPct * 0.4) + (budgetAccuracy * 0.4) + (actualsFilledPct * 0.2));

  return {
    budgetHealthScore: score,
    completionRate: completedPct,
    budgetAccuracy,
    actualsCoverage: actualsFilledPct,
  };
}

function buildPnLMonthlyTrend(items: BudgetItem[]) {
  const monthlyMap = new Map<string, { month: string; budget: number; actual: number }>();

  for (const item of items) {
    const budgetPnL = calcPnLMonths(item, "budget");
    const actualPnL = calcPnLMonths(item, "actual");

    for (const [month, value] of Object.entries(budgetPnL)) {
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, budget: 0, actual: 0 });
      }
      const row = monthlyMap.get(month)!;
      row.budget += toNumber(value);
    }

    for (const [month, value] of Object.entries(actualPnL)) {
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, budget: 0, actual: 0 });
      }
      const row = monthlyMap.get(month)!;
      row.actual += toNumber(value);
    }
  }

  return Array.from(monthlyMap.values())
    .sort((a, b) => {
      const pa = parsePlanMonth(a.month);
      const pb = parsePlanMonth(b.month);
      if (!pa || !pb) return 0;
      return pa.year * 12 + pa.month - (pb.year * 12 + pb.month);
    })
    .map(r => ({
      ...r,
      budget: round(r.budget),
      actual: round(r.actual),
    }));
}

function buildHomeSummary(items: BudgetItem[], fy: string | null) {
  const totalBudget = round(items.reduce((s, i) => s + toNumber(i.budget), 0));
  const totalActual = round(items.reduce((s, i) => s + (i.actual != null ? toNumber(i.actual) : 0), 0));
  const totalSavings = round(totalBudget - totalActual);
  const utilPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
  const variance = round(totalBudget - totalActual);

  const completed = items.filter(i => i.status === "Completed").length;
  const pending = items.filter(i => !i.status || i.status === "Pending" || i.status === "").length;
  const cancelled = items.filter(i => i.status === "Cancel" || i.status === "Cancelled").length;
  const movedToHalf = items.filter(i => i.status === "Move to another half").length;
  const outOfBudget = items.filter(i => !!i.outsideBudget).length;

  const capexTotal = round(
    items.filter(i => String(i.expenseType || "").toLowerCase() === "capex").reduce((s, i) => s + toNumber(i.budget), 0)
  );
  const opexTotal = round(
    items.filter(i => String(i.expenseType || "").toLowerCase() === "opex").reduce((s, i) => s + toNumber(i.budget), 0)
  );

  const renewalItems = items
    .map(item => ({ ...item, daysUntil: getDaysUntil(item.planMonth) }))
    .filter(item =>
      item.daysUntil !== null &&
      item.daysUntil >= 0 &&
      item.daysUntil <= 30 &&
      item.status !== "Completed" &&
      item.status !== "Cancel" &&
      item.status !== "Cancelled"
    );

  const upcomingRenewals = renewalItems.length;
  const overdueItems = items.filter(i => {
    const d = getDaysUntil(i.planMonth);
    return d !== null && d < 0 && i.actual == null && (!i.status || i.status === "");
  }).length;

  const byKey = (
    keyGetter: (item: BudgetItem) => string,
    includeCount = false
  ) => {
    const map = new Map<string, { name: string; value?: number; budget?: number; actual?: number; count?: number }>();

    for (const item of items) {
      const key = keyGetter(item) || "Unknown";
      if (!map.has(key)) {
        map.set(
          key,
          includeCount
            ? { name: key, budget: 0, actual: 0, count: 0 }
            : { name: key, value: 0 }
        );
      }

      const row = map.get(key)!;

      if (includeCount) {
        row.budget = round((row.budget || 0) + toNumber(item.budget));
        row.actual = round((row.actual || 0) + (item.actual != null ? toNumber(item.actual) : 0));
        row.count = (row.count || 0) + 1;
      } else {
        row.value = round((row.value || 0) + toNumber(item.budget));
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const av = includeCount ? (a.budget || 0) : (a.value || 0);
      const bv = includeCount ? (b.budget || 0) : (b.value || 0);
      return bv - av;
    });
  };

  const statusMap = new Map<string, { name: string; value: number; count: number }>();
  for (const item of items) {
    const raw = item.status || "Pending";
    const name = raw === "" ? "Pending" : raw;
    if (!statusMap.has(name)) statusMap.set(name, { name, value: 0, count: 0 });
    const row = statusMap.get(name)!;
    row.value += toNumber(item.budget);
    row.count += 1;
  }
  const statusData = Array.from(statusMap.values()).map(r => ({ ...r, value: round(r.value) }));

  const monthlyMap = new Map<string, { month: string; budget: number; actual: number }>();
  for (const item of items) {
    const mk = item.planMonth || "Unknown";
    if (!monthlyMap.has(mk)) monthlyMap.set(mk, { month: mk, budget: 0, actual: 0 });
    const row = monthlyMap.get(mk)!;
    row.budget += toNumber(item.budget);
    row.actual += item.actual != null ? toNumber(item.actual) : 0;
  }
  const monthlyTrend = Array.from(monthlyMap.values())
    .sort((a, b) => {
      const pa = parsePlanMonth(a.month);
      const pb = parsePlanMonth(b.month);
      if (!pa || !pb) return 0;
      return pa.year * 12 + pa.month - (pb.year * 12 + pb.month);
    })
    .map(r => ({
      ...r,
      budget: round(r.budget),
      actual: round(r.actual),
    }));

  const topCategoriesMap = new Map<string, { name: string; value: number; hasActual: boolean }>();
  for (const item of items) {
    const cat = item.itemCategory || "Unknown";
    if (!topCategoriesMap.has(cat)) topCategoriesMap.set(cat, { name: cat, value: 0, hasActual: false });

    const row = topCategoriesMap.get(cat)!;
    const hasActual = item.actual != null && toNumber(item.actual) > 0;
    const statusBlank = !item.status || item.status === "";

    if (hasActual) {
      row.value += toNumber(item.actual);
      row.hasActual = true;
    } else if (statusBlank) {
      row.value += toNumber(item.budget);
    }
  }
  const topCategories = Array.from(topCategoriesMap.values())
    .map(r => ({ ...r, value: round(r.value) }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const health = calcBudgetHealthScore(items, totalBudget, totalActual);
  const monthlyPnLTrend = buildPnLMonthlyTrend(items);

  return {
    scope: fy ? "fy" : "global",
    fy: fy || null,
    updatedAt: new Date().toISOString(),
    itemCount: items.length,

    totals: {
      totalBudget,
      totalActual,
      totalSavings,
      utilPct,
      variance,
      completed,
      pending,
      cancelled,
      movedToHalf,
      outOfBudget,
      capexTotal,
      opexTotal,
      upcomingRenewals,
      overdueItems,
    },

    home: {
      buData: byKey(i => i.businessUnit || "Unknown", true).map(r => ({
        bu: r.name,
        budget: round(r.budget || 0),
        actual: round(r.actual || 0),
      })),
      catData: byKey(i => i.itemCategory || "Unknown", false),
      expData: byKey(i => i.expenseType || "Unknown", true),
      payingBUData: byKey(i => i.payingBU || "Unknown", true),
      statusData,
      itemTypeData: byKey(i => i.itemType || "Unknown", true),
      monthlyTrend,
      topCategories,
      ...health,
    },

    pnl: {
      totalPnLBudget: round(items.reduce((s, i) => s + sumPnL(i, "budget"), 0)),
      totalPnLActual: round(items.reduce((s, i) => s + sumPnL(i, "actual"), 0)),
      monthlyPnLTrend,
      pnlByCategory: byKey(i => i.itemCategory || "Unknown", false),
      pnlByBU: byKey(i => i.businessUnit || "Unknown", true).map(r => ({
        name: r.name,
        budget: round(r.budget || 0),
        actual: round(r.actual || 0),
        count: r.count || 0,
      })),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fyFilter = String(body?.fy || "").trim();

    const snap = await adminDb.collection("budgetItems").get();
    const items: BudgetItem[] = snap.docs.map(doc => {
      const data = doc.data() as BudgetItem;
      return {
        id: doc.id,
        ...data,
        fy: data.fy || getFY(data.planMonth),
      };
    });

    const liveFYs = Array.from(new Set(items.map(i => i.fy).filter(Boolean))).sort();
    const businessUnits = Array.from(new Set(items.map(i => i.businessUnit).filter(Boolean))).sort();
    const payingBUs = Array.from(new Set(items.map(i => i.payingBU).filter(Boolean))).sort();
    const categories = Array.from(new Set(items.map(i => i.itemCategory).filter(Boolean))).sort();
    const itemTypes = Array.from(new Set(items.map(i => i.itemType).filter(Boolean))).sort();
    const expenseTypes = Array.from(new Set(items.map(i => i.expenseType).filter(Boolean))).sort();
    const countries = Array.from(new Set(items.map(i => i.country).filter(Boolean))).sort();
    const billingFrequencies = Array.from(new Set(items.map(i => i.billingFreq).filter(Boolean))).sort();

    const batch = adminDb.batch();

    batch.set(adminDb.collection("appMeta").doc("fyOptions"), {
      values: liveFYs,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("businessUnits"), {
      values: businessUnits,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("payingBUs"), {
      values: payingBUs,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("categories"), {
      values: categories,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("itemTypes"), {
      values: itemTypes,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("expenseTypes"), {
      values: expenseTypes,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("countries"), {
      values: countries,
      updatedAt: new Date().toISOString(),
    });

    batch.set(adminDb.collection("appMeta").doc("billingFrequencies"), {
      values: billingFrequencies,
      updatedAt: new Date().toISOString(),
    });

    if (!fyFilter) {
      batch.set(
        adminDb.collection("budgetSummaries").doc("global"),
        buildHomeSummary(items, null)
      );
    }

    const targetFYs = fyFilter ? [fyFilter] : liveFYs;

    for (const fy of targetFYs) {
      const fyItems = items.filter(i => i.fy === fy);
      batch.set(
        adminDb.collection("budgetSummaries").doc(`fy_${fy}`),
        buildHomeSummary(fyItems, fy)
      );
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      message: fyFilter
        ? `Summary rebuilt for ${fyFilter}`
        : "Global + FY summaries rebuilt successfully",
      fyOptions: liveFYs,
      totalItems: items.length,
      rebuiltFYs: targetFYs,
    });
  } catch (error: any) {
    console.error("rebuild-summaries error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to rebuild summaries" },
      { status: 500 }
    );
  }
}