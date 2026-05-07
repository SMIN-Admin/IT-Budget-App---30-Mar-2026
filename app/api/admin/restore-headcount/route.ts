import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";

export async function POST(_req: NextRequest) {
  try {
    const snapshot = await adminDb.collection("headcountArchive").get();

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

      batch.delete(doc.ref);
      restoredCount++;
    }

    await batch.commit();

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