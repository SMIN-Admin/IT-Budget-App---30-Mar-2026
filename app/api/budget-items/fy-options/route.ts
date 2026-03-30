import { NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

function getFYFromPlanMonth(planMonth: string) {
  const value = String(planMonth || "").trim();
  const match = value.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (!match) return "";

  const month = match[1].toLowerCase();
  const year = Number(match[2]);

  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  const m = monthMap[month];
  if (!m) return "";

  const fullYear = 2000 + year;
  if (m >= 4 && m <= 9) return `${fullYear + 1}-H1`;
if (m >= 10) return `${fullYear + 1}-H2`;
return `${fullYear}-H2`;
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb.collection("budgetItems").get();

    const fySet = new Set<string>();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as any;
      const fy = String(data.fy || "").trim() || getFYFromPlanMonth(data.planMonth);
      if (fy) fySet.add(fy);
    });

    const fyOptions = Array.from(fySet).sort();

    return NextResponse.json({ fyOptions });
  } catch (error: any) {
    console.error("GET fy-options error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch FY options" },
      { status: 500 }
    );
  }
}