import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";
import { isOlderThanRetention } from "../../../../src/lib/fyUtils";

type HeadcountRow = {

  id: string;

  fy?: string;

  fyHalf?: string;

  fyAndHalf?: string;

  fy_half?: string;

  period?: string;

  half?: string;

  [key: string]: any;

};

export async function POST(_req: NextRequest) {
  try {
    // 🔐 Get logged-in user
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = String(user.email || "").trim().toLowerCase();

    // 🔎 Fetch user from Firestore (supports both docId=email and field=email)
    let userData: any = null;

    const userDoc = await adminDb.collection("users").doc(userEmail).get();

    if (userDoc.exists) {
      userData = userDoc.data();
    } else {
      const userSnap = await adminDb
        .collection("users")
        .where("email", "==", userEmail)
        .limit(1)
        .get();

      if (!userSnap.empty) {
        userData = userSnap.docs[0].data();
      }
    }

    // 🔐 Admin validation
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

    // 📥 Fetch all headcount records
    const snapshot = await adminDb.collection("headcountRecords").get();

    const allRows: HeadcountRow[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Record<string, any>),
    }));

    // 📦 Filter rows older than retention window
    const rowsToArchive = allRows.filter((row) => {

  const fyValue =

    row.fy ||

    row.fyHalf ||

    row.fyAndHalf ||

    row.fy_half ||

    row["FY & Half"] ||

    row["FY and Half"] ||

    row.period ||

    row.half ||

    "";

  return isOlderThanRetention(String(fyValue));

});

    if (rowsToArchive.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No headcount records to archive",
      });
    }

    // 🔁 Batch move to archive collection
    const batch = adminDb.batch();

    rowsToArchive.forEach((row) => {
      const archiveRef = adminDb
        .collection("headcountArchive")
        .doc(row.id);

      const originalRef = adminDb
        .collection("headcountRecords")
        .doc(row.id);

      batch.set(archiveRef, {
        ...row,
        archivedAt: new Date().toISOString(),
      });

      batch.delete(originalRef);
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      message: `Archived ${rowsToArchive.length} headcount records`,
    });
  } catch (error: any) {
    console.error("Headcount archive error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Headcount archive failed",
      },
      { status: 500 }
    );
  }
}