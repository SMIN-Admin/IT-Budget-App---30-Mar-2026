import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

export async function POST(_req: NextRequest) {
    const user = await getCurrentUser();

if (!user) {

  return NextResponse.json(

    { ok: false, error: "Unauthorized" },

    { status: 401 }

  );

}

const userEmail = String(user.email || "")

  .trim()

  .toLowerCase();
    
  try {
    const body = await _req.json().catch(() => ({}));

const restoreAll = body?.restoreAll === true;
const fy = String(body?.fy || "").trim();
const half = String(body?.half || "").trim();

let query: any = adminDb
  .collection("headcountArchive")
  .where("isRestored", "==", false);

if (!restoreAll && fy) {
  query = query.where("fy", "==", fy);

  if (half && half !== "ALL") {
    query = query.where("fyHalf", "==", `${fy}-${half}`);
  }
}

const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({
        ok: true,
        message: "No archived headcount records found to restore",
      });
    }

    const batch = adminDb.batch();
    let restoredCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const {
        archivedAt,
        archivedBy,
        archiveBatchId,
        archiveType,
        id,
        ...cleanData
      } = data;

      const restoreId = String(id || doc.id);

      const restoreRef = adminDb
        .collection("headcountRecords")
        .doc(restoreId);

      batch.set(restoreRef, {
        ...cleanData,
        restoredAt: new Date().toISOString(),
      });

      batch.update(doc.ref, {
  isRestored: true,
  restoredAt: new Date().toISOString(),
  restoredBy: userEmail,
});
      restoredCount++;
    }

    await batch.commit();

    const nowIso = new Date().toISOString();

await adminDb.collection("archiveJobs").add({

  archiveType: "headcount",

  type: "restore",

  archivedCount: 0,

  restoredCount,

  keptCount: 0,

  executedBy: userEmail,

  executedAt: nowIso,

  status: "completed",

});

    return NextResponse.json({
      ok: true,
      restoredCount,
      message: `Restored ${restoredCount} headcount records successfully`,
    });
  } catch (error: any) {
    console.error("Restore headcount error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Headcount restore failed",
      },
      { status: 500 }
    );
  }
}