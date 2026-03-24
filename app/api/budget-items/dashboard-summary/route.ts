import { NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

function getDaysUntil(planMonth: string) {
  const value = String(planMonth || "").trim();
  const match = value.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (!match) return null;

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const m = monthMap[match[1].toLowerCase()];
  if (m === undefined) return null;

  const y = 2000 + Number(match[2]);
  const target = new Date(y, m, 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), 1);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const fy = String(searchParams.get("fy") || "").trim();
    const businessUnit = String(searchParams.get("businessUnit") || "").trim();
    const payingBU = String(searchParams.get("payingBU") || "").trim();

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

    const buMap: Record<string, { bu: string; budget: number; actual: number }> = {};
    const catMap: Record<string, { name: string; value: number }> = {};
    const statusMap: Record<string, number> = {
      Completed: 0,
      Pending: 0,
      Cancelled: 0,
    };

    let capexBudget = 0;
    let opexBudget = 0;
    let upcomingRenewals = 0;
    let overdueItems = 0;

    for (const i of items) {
      const budget = Number(i.budget || 0);
      const actual = Number(i.actual || 0);
      const bu = String(i.businessUnit || "").trim() || "Unknown";
      const cat = String(i.itemCategory || "").trim() || "Unknown";
      const exp = String(i.expenseType || "").trim().toLowerCase();
      const status = String(i.status || "").trim();

      if (!buMap[bu]) buMap[bu] = { bu, budget: 0, actual: 0 };
      buMap[bu].budget += budget;
      buMap[bu].actual += actual;

      if (!catMap[cat]) catMap[cat] = { name: cat, value: 0 };
      catMap[cat].value += budget;

      if (exp === "capex") capexBudget += budget;
      if (exp === "opex") opexBudget += budget;

      if (status === "Completed") statusMap.Completed += 1;
      else if (!status || status === "Pending") statusMap.Pending += 1;
      else if (status === "Cancelled" || status === "Cancel") statusMap.Cancelled += 1;

      const d = getDaysUntil(i.planMonth);
      if (d !== null && d >= 0 && d <= 30 && status !== "Completed" && status !== "Cancel" && status !== "Cancelled") {
        upcomingRenewals += 1;
      }
      if (d !== null && d < 0 && (i.actual == null || Number(i.actual) <= 0) && status !== "Completed" && status !== "Cancel" && status !== "Cancelled") {
        overdueItems += 1;
      }
    }

    const buData = Object.values(buMap)
      .map((d) => ({
        bu: d.bu,
        budget: Math.round(d.budget),
        actual: Math.round(d.actual),
      }))
      .sort((a, b) => b.budget - a.budget);

    const catData = Object.values(catMap)
      .map((d) => ({
        name: d.name,
        value: Math.round(d.value),
      }))
      .sort((a, b) => b.value - a.value);

    const expData = [
      { name: "Capex", value: Math.round(capexBudget) },
      { name: "Opex", value: Math.round(opexBudget) },
    ];

    const statusData = [
      { name: "Completed", value: statusMap.Completed },
      { name: "Pending", value: statusMap.Pending },
      { name: "Cancelled", value: statusMap.Cancelled },
    ];

    return NextResponse.json({
      buData,
      catData,
      expData,
      statusData,
      upcomingRenewals,
      overdueItems,
    });
  } catch (error: any) {
    console.error("GET dashboard-summary error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}