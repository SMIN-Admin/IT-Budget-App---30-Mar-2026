import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";
import { NextRequest, NextResponse } from "next/server";

function buildHeadcountSummaryRows(rows: any[]) {
  const summaryMap = new Map<string, any>();

  rows.forEach((row) => {
    const fyHalf = String(row.fyHalf || "").trim();
    const businessUnit = String(row.businessUnit || "").trim() || "All";
    const location = String(row.location || "").trim() || "All";
    const department = String(row.department || "").trim() || "All";
    const empType = String(row.empType || "").trim() || "All";

    const key = [fyHalf, businessUnit, location, department, empType].join("__");

    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        fyHalf,
        businessUnit,
        location,
        department,
        empType,
        headcount: 0,
      });
    }

    const current = summaryMap.get(key);
    current.headcount += 1;
  });

  return Array.from(summaryMap.values());
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = String(user?.role || "");
    if (!["admin", "budget_collaborator"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawSnapshot = await adminDb.collection("headcountRecords").get();
    const rawRows = rawSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const summaryRows = buildHeadcountSummaryRows(rawRows);
    const now = new Date().toISOString();

    const existingSummarySnapshot = await adminDb.collection("headcountSummary").get();

    for (let start = 0; start < existingSummarySnapshot.docs.length; start += 400) {
      const batch = adminDb.batch();
      const chunk = existingSummarySnapshot.docs.slice(start, start + 400);

      chunk.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    }

    for (let start = 0; start < summaryRows.length; start += 400) {
      const batch = adminDb.batch();
      const chunk = summaryRows.slice(start, start + 400);

      chunk.forEach((row: any) => {
        const summaryDocId = [
          String(row.fyHalf || "").trim(),
          String(row.businessUnit || "").trim(),
          String(row.location || "").trim(),
          String(row.department || "").trim(),
          String(row.empType || "").trim(),
        ]
          .map((value) => value.replace(/\s+/g, "_"))
          .join("__");

        const docRef = adminDb.collection("headcountSummary").doc(summaryDocId);

        batch.set(docRef, {
          fyHalf: row.fyHalf,
          businessUnit: row.businessUnit,
          location: row.location,
          department: row.department,
          empType: row.empType,
          headcount: Number(row.headcount || 0),
          createdAt: now,
          updatedAt: now,
          uploadedBy: String(user?.email || "Unknown").trim().toLowerCase(),
        });
      });

      await batch.commit();
    }

    return NextResponse.json({
      ok: true,
      rawCount: rawRows.length,
      summaryCount: summaryRows.length,
      message: "Headcount summary rebuilt successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to rebuild headcount summary",
      },
      { status: 500 }
    );
  }
}