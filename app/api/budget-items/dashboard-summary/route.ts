import { NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const fy = String(searchParams.get("fy") || "all").trim();
    const businessUnit = String(searchParams.get("businessUnit") || "all").trim();
    const payingBU = String(searchParams.get("payingBU") || "all").trim();

    // For now:
    // - if all filters are all => use global summary
    // - if only FY is selected => use FY summary
    // - if BU / Paying BU filter is used => fallback to live query (temporary until filtered summaries are built)

    const needsLiveFallback =
      (businessUnit && businessUnit !== "all") ||
      (payingBU && payingBU !== "all");

    if (!needsLiveFallback) {
      const summaryDocId = fy && fy !== "all" ? `fy_${fy}` : "global";
      const summarySnap = await adminDb.collection("budgetSummaries").doc(summaryDocId).get();

      if (!summarySnap.exists) {
        return NextResponse.json(
          { error: `Summary not found for ${summaryDocId}. Please run Rebuild Summaries.` },
          { status: 404 }
        );
      }

      const summary = summarySnap.data() || {};

      return NextResponse.json({
  totals: summary.totals || {},
  home: summary.home || {},
  pnl: summary.pnl || {},
});
    }

    // Temporary fallback for BU / Paying BU filtered dashboard view
    let query: FirebaseFirestore.Query = adminDb.collection("budgetItems");

    if (fy && fy !== "all") {
      query = query.where("fy", "==", fy);
    }

    if (businessUnit && businessUnit !== "all") {
      query = query.where("businessUnit", "==", businessUnit);
    }

    if (payingBU && payingBU !== "all") {
      query = query.where("payingBU", "==", payingBU);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => doc.data() as any);

    const buMap: Record<string, { bu: string; budget: number; actual: number; count: number }> = {};
    const catMap: Record<string, { name: string; value: number }> = {};
    const expMap: Record<string, { name: string; value: number }> = {};
    const payingBUMap: Record<string, { name: string; budget: number; actual: number }> = {};
    const itemTypeMap: Record<string, { name: string; budget: number; actual: number; count: number }> = {};
    const statusCountMap: Record<string, number> = {
      Completed: 0,
      Pending: 0,
      Cancelled: 0,
    };

    let totalBudget = 0;
    let totalActual = 0;
    let completed = 0;
    let pending = 0;
    let cancelled = 0;
    let movedToHalf = 0;
    let outOfBudget = 0;
    let capexTotal = 0;
    let opexTotal = 0;

    for (const i of items) {
      const budget = Number(i.budget || 0);
      const actual = i.actual != null ? Number(i.actual || 0) : 0;
      const bu = String(i.businessUnit || "").trim() || "Unknown";
      const cat = String(i.itemCategory || "").trim() || "Unknown";
      const paying = String(i.payingBU || "").trim() || "Unknown";
      const itemType = String(i.itemType || "").trim() || "Unknown";
      const exp = String(i.expenseType || "").trim() || "Unknown";
      const status = String(i.status || "").trim();

      totalBudget += budget;
      totalActual += actual;

      if (!buMap[bu]) buMap[bu] = { bu, budget: 0, actual: 0, count: 0 };
buMap[bu].budget += budget;
buMap[bu].actual += actual;
buMap[bu].count += 1;

      if (!catMap[cat]) catMap[cat] = { name: cat, value: 0 };
      catMap[cat].value += budget;

      if (!expMap[exp]) expMap[exp] = { name: exp, value: 0 };
      expMap[exp].value += budget;

      if (!payingBUMap[paying]) payingBUMap[paying] = { name: paying, budget: 0, actual: 0 };
      payingBUMap[paying].budget += budget;
      payingBUMap[paying].actual += actual;

      if (!itemTypeMap[itemType]) itemTypeMap[itemType] = { name: itemType, budget: 0, actual: 0, count: 0 };
      itemTypeMap[itemType].budget += budget;
      itemTypeMap[itemType].actual += actual;
      itemTypeMap[itemType].count += 1;

      if (exp.toLowerCase() === "capex") capexTotal += budget;
      if (exp.toLowerCase() === "opex") opexTotal += budget;

      if (status === "Completed") {
        completed += 1;
        statusCountMap.Completed += 1;
      } else if (status === "Cancel" || status === "Cancelled") {
        cancelled += 1;
        statusCountMap.Cancelled += 1;
      } else {
        pending += 1;
        statusCountMap.Pending += 1;
      }

      if (status === "Move to another half") {
        movedToHalf += 1;
      }

      if (i.outsideBudget) {
        outOfBudget += 1;
      }
    }

    const utilPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
    const variance = Math.round(totalBudget - totalActual);
    const totalSavings = Math.round(totalBudget - totalActual);

    const summaryLikeResponse = {
  totals: {
    totalBudget: Math.round(totalBudget),
    totalActual: Math.round(totalActual),
    totalSavings,
    utilPct,
    variance,
    completed,
    pending,
    cancelled,
    movedToHalf,
    outOfBudget,
    capexTotal: Math.round(capexTotal),
    opexTotal: Math.round(opexTotal),
    upcomingRenewals: 0,
    overdueItems: 0,
  },
  home: {
    buData: Object.values(buMap)
  .map((d) => ({
    bu: d.bu,
    budget: Math.round(d.budget),
    actual: Math.round(d.actual),
    count: d.count,
  }))
  .sort((a, b) => b.budget - a.budget),

    catData: Object.values(catMap)
      .map((d) => ({
        name: d.name,
        value: Math.round(d.value),
      }))
      .sort((a, b) => b.value - a.value),

    expData: Object.values(expMap)
      .map((d) => ({
        name: d.name,
        value: Math.round(d.value),
      }))
      .sort((a, b) => b.value - a.value),

    payingBUData: Object.values(payingBUMap)
      .map((d) => ({
        name: d.name,
        budget: Math.round(d.budget),
        actual: Math.round(d.actual),
      }))
      .sort((a, b) => b.budget - a.budget),

    statusData: [
      { name: "Completed", value: statusCountMap.Completed },
      { name: "Pending", value: statusCountMap.Pending },
      { name: "Cancelled", value: statusCountMap.Cancelled },
    ],

    itemTypeData: Object.values(itemTypeMap)
      .map((d) => ({
        name: d.name,
        budget: Math.round(d.budget),
        actual: Math.round(d.actual),
        count: d.count,
      }))
      .sort((a, b) => b.budget - a.budget),

    monthlyTrend: [],
    topCategories: [],
    budgetHealthScore: 0,
    completionRate: 0,
    budgetAccuracy: 0,
    actualsCoverage: 0,
  },
  pnl: {
    monthlyPnLTrend: [],
  },
};

    return NextResponse.json(summaryLikeResponse);
  } catch (error: any) {
    console.error("GET dashboard-summary error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}