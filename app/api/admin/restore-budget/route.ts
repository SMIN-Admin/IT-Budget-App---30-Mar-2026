import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

type ArchiveRow = {
  id: string;
  archivedAt?: string;
  archivedBy?: string;
  [key: string]: any;
};

export async function POST(req: NextRequest) {
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
    const snapshot = await adminDb
    .collection("budgetItemsArchive")
    .where("isRestored", "==", false)
    .get();

    if (snapshot.empty) {
      return NextResponse.json({
        ok: false,
        error: "No archived budget records found",
      });
    }

    const batch = adminDb.batch();

    let restoredCount = 0;
    const nowIso = new Date().toISOString();

    for (const doc of snapshot.docs) {
      const data = doc.data();

      const restoreId = String(data.originalId || doc.id);

      const restoreRef = adminDb
        .collection("budgetItems")
        .doc(restoreId);

      batch.set(restoreRef, {
        ...data,
        restoredAt: new Date().toISOString(),
      });

      batch.update(doc.ref, {

  isRestored: true,

  restoredAt: nowIso,

  restoredBy: userEmail,

});

      restoredCount++;
    }

    await batch.commit();


await adminDb.collection("archiveJobs").add({

  archiveType: "budget",

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
      message: `Restored ${restoredCount} budget records successfully`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Restore failed",
      },
      { status: 500 }
    );
  }
}