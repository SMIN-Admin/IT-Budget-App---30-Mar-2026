import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getFYFromPlanMonth(planMonth?: string) {
  const pm = String(planMonth || "").trim();
  if (!pm) return "";

  const match = pm.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return "";

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
  if (!month || !year) return "";

  const half = month >= 4 && month <= 9 ? "H1" : "H2";
  const fyYear = month >= 1 && month <= 3 ? year - 1 : year;

  return `${fyYear}-${half}`;
}

function getPlanMonthKey(planMonth?: string) {
  const pm = String(planMonth || "").trim();
  if (!pm) return "";

  const match = pm.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return "";

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

  const month = monthMap[match[1]] || "";
  if (!year || !month) return "";

  return `${year}-${month}`;
}

function formatMonthLabel(monthKey: string) {
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

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const fyParam = searchParams.get("fy") || "all";
const selectedFYs =
  fyParam === "all"
    ? ["all"]
    : fyParam.split(",").map((v) => v.trim()).filter(Boolean);
    const businessUnit = searchParams.get("businessUnit") || "all";
    const payingBU = searchParams.get("payingBU") || "all";
    const category = searchParams.get("category") || "all";
    const viewType = searchParams.get("viewType") || "budget";

    const snapshot = await adminDb.collection("budgetItems").get();

    const allItems = snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        fy: String(data.fy || "").trim() || getFYFromPlanMonth(data.planMonth),
      };
    });

    const fyOptions = Array.from(
      new Set(allItems.map((i) => i.fy).filter(Boolean))
    ).sort();

    const categories = Array.from(
      new Set(allItems.map((i) => String(i.itemCategory || "").trim()).filter(Boolean))
    ).sort();

    const businessUnits = Array.from(
      new Set(allItems.map((i) => String(i.businessUnit || "").trim()).filter(Boolean))
    ).sort();

    const payingBUs = Array.from(
      new Set(allItems.map((i) => String(i.payingBU || "").trim()).filter(Boolean))
    ).sort();

    const filteredItems = allItems.filter((item) => {
      const fyMatch =
  selectedFYs.includes("all") || selectedFYs.includes(String(item.fy || "").trim());
      const buMatch = businessUnit === "all" || String(item.businessUnit || "").trim() === businessUnit;
      const payingBUMatch = payingBU === "all" || String(item.payingBU || "").trim() === payingBU;
      const categoryMatch = category === "all" || String(item.itemCategory || "").trim() === category;

      return fyMatch && buMatch && payingBUMatch && categoryMatch;
    });

    const totalBudget = filteredItems.reduce((sum, item) => sum + toNumber(item.budget), 0);
    const totalActual = filteredItems.reduce((sum, item) => sum + toNumber(item.actual), 0);
    const totalItems = filteredItems.length;
    const budgetVariance = totalBudget - totalActual;

    const totalPnlBudget = totalBudget;
    const totalPnlActual = totalActual;
    const pnlUtilPct =
      totalPnlBudget > 0 ? Math.round((totalPnlActual / totalPnlBudget) * 100) : 0;

    const itemsWithActual = filteredItems.filter((item) => toNumber(item.actual) > 0).length;
    const pendingActual = totalItems - itemsWithActual;

    const categoryCount = Array.from(
      new Set(filteredItems.map((i) => String(i.itemCategory || "").trim()).filter(Boolean))
    ).length;

    const trendMap: Record<string, { month: string; budget: number; actual: number }> = {};

    filteredItems.forEach((item) => {
      const monthKey = getPlanMonthKey(item.planMonth);
      if (!monthKey) return;

      if (!trendMap[monthKey]) {
        trendMap[monthKey] = {
          month: monthKey,
          budget: 0,
          actual: 0,
        };
      }

      trendMap[monthKey].budget += toNumber(item.budget);
      trendMap[monthKey].actual += toNumber(item.actual);
    });

    const trend = Object.values(trendMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        ...row,
        label: formatMonthLabel(row.month),
      }));

    return NextResponse.json({
      ok: true,
      filters: {
  fy: fyParam,
  businessUnit,
  payingBU,
  category,
  viewType,
},
      kpis: {
        totalBudget,
        totalActual,
        totalItems,
        budgetVariance,
        totalPnlBudget,
        totalPnlActual,
        pnlUtilPct,
        itemsWithActual,
        pendingActual,
        categoryCount,
      },
      filterOptions: {
        fyOptions,
        categories,
        businessUnits,
        payingBUs,
      },
      trend,
    });
  } catch (error: any) {
    console.error("trend-summary GET error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to build trend summary",
      },
      { status: 500 }
    );
  }
}