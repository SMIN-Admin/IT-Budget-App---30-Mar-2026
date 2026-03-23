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

    const totalCount = items.length;

    const totalBudget = items.reduce((sum, item) => {
      return sum + (Number(item.budget) || 0);
    }, 0);

    const totalActual = items.reduce((sum, item) => {
      return sum + (item.actual != null ? Number(item.actual) || 0 : 0);
    }, 0);

    const totalSavings = items.reduce((sum, item) => {
      if (item.actual == null) return sum;
      return sum + ((Number(item.budget) || 0) - (Number(item.actual) || 0));
    }, 0);

    const completed = items.filter((i) => i.status === "Completed").length;
    const pending = items.filter((i) => !i.status || i.status === "Pending").length;
    const cancelled = items.filter((i) => ["Cancel", "Cancelled"].includes(i.status)).length;
    const movedToHalf = items.filter((i) => i.status === "Move to another half").length;
    const outOfBudget = items.filter((i) => !!i.outsideBudget).length;

    const variance = totalBudget - totalActual;
    const utilPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

    return NextResponse.json({
      totalCount,
      totalBudget,
      totalActual,
      totalSavings,
      variance,
      utilPct,
      completed,
      pending,
      cancelled,
      movedToHalf,
      outOfBudget,
    });
  } catch (error: any) {
    console.error("GET budget-items stats error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch budget item stats" },
      { status: 500 }
    );
  }
}