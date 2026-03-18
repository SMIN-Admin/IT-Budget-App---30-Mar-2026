import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firebase-admin";
import { getCurrentUser } from "@/src/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "budget_collaborator"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

    if (!ids.length) {
      return NextResponse.json(
        { error: "No item IDs provided" },
        { status: 400 }
      );
    }

    const BATCH_SIZE = 400; // keep below Firestore 500 limit
    let deletedCount = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      batchIds.forEach((id: string) => {
        const ref = adminDb.collection("budgetItems").doc(String(id));
        batch.delete(ref);
      });

      await batch.commit();
      deletedCount += batchIds.length;
    }

    return NextResponse.json({
      ok: true,
      deletedCount,
    });
  } catch (error: any) {
    console.error("Bulk delete budget-items error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to bulk delete budget items" },
      { status: 500 }
    );
  }
}