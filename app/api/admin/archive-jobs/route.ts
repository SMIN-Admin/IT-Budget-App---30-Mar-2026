import { NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("archiveJobs")
      .orderBy("executedAt", "desc")
      .limit(50)
      .get();

    const jobs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      ok: true,
      jobs,
    });
  } catch (error: any) {
    console.error("archive-jobs GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load archive jobs",
      },
      { status: 500 }
    );
  }
}