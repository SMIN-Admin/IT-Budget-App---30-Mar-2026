import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";
import { isOlderThanRetention } from "../../../../src/lib/fyUtils";

type BudgetArchiveRow = {
  id: string;
  fy?: string;
  [key: string]: any;
};

export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = String(user.email || "").trim().toLowerCase();

let userData: any = null;

// First try: user document ID is email

const userDoc = await adminDb.collection("users").doc(userEmail).get();

if (userDoc.exists) {

  userData = userDoc.data();

} else {

  // Second try: user document has email field

  const userSnap = await adminDb

    .collection("users")

    .where("email", "==", userEmail)

    .limit(1)

    .get();

  if (!userSnap.empty) {

    userData = userSnap.docs[0].data();

  }

}

    const userRole = String(userData?.role || "").trim().toLowerCase();

const userIsActive = userData?.isActive !== false;

if (!userData || userRole !== "admin" || !userIsActive) {

  return NextResponse.json(

    {

      ok: false,

      error: `Admins only | email=${userEmail} | role=${userData?.role || "missing"} | isActive=${String(userData?.isActive)}`,

    },

    { status: 403 }

  );

}

    const snapshot = await adminDb.collection("budgetItems").get();

    const allRows: BudgetArchiveRow[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
    }));

    const rowsToArchive = allRows.filter((row) => isOlderThanRetention(row.fy));
    const keptRows = allRows.length - rowsToArchive.length;

    if (rowsToArchive.length === 0) {
      return NextResponse.json({
        ok: true,
        archivedCount: 0,
        keptCount: keptRows,
        message: "No budget rows qualified for archive.",
      });
    }

    const batchId = `budget-archive-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let batch = adminDb.batch();
    let opCount = 0;

    for (const row of rowsToArchive) {
      const sourceRef = adminDb.collection("budgetItems").doc(row.id);
      const archiveRef = adminDb.collection("budgetItemsArchive").doc(row.id);

      batch.set(archiveRef, {
        ...row,
        originalId: row.id,
        archivedAt: nowIso,
        archiveBatchId: batchId,
        archiveType: "budget",
      });

      batch.delete(sourceRef);
      opCount += 2;

      if (opCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    await adminDb.collection("archiveJobs").doc(batchId).set({
      id: batchId,
      archiveType: "budget",
      archivedCount: rowsToArchive.length,
      keptCount: keptRows,
      executedBy: userEmail,
      executedAt: nowIso,
      status: "completed",
    });

    return NextResponse.json({
      ok: true,
      archiveBatchId: batchId,
      archivedCount: rowsToArchive.length,
      keptCount: keptRows,
      message: "Budget archive completed successfully.",
    });
  } catch (error: any) {
    console.error("archive-budget POST error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to archive budget rows",
      },
      { status: 500 }
    );
  }
}