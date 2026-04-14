import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EMP_TYPES = ["Permanent", "Contract", "Intern", "Consultant"];

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

    const body = await req.json();

    const id = String(body?.id || "").trim();
    const businessUnit = String(body?.businessUnit || "").trim();
    const location = String(body?.location || "").trim();
    const department = String(body?.department || "").trim();
    const empType = String(body?.empType || "").trim();
    const fyHalf = String(body?.fyHalf || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Row id is required" }, { status: 400 });
    }

    if (!businessUnit) {
      return NextResponse.json({ error: "Business Unit is required" }, { status: 400 });
    }

    if (!location) {
      return NextResponse.json({ error: "Location is required" }, { status: 400 });
    }

    if (!department) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 });
    }

    if (!empType || !ALLOWED_EMP_TYPES.includes(empType)) {
      return NextResponse.json(
        { error: `Emp. Type must be one of ${ALLOWED_EMP_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!/^\d{4}-H[12]$/.test(fyHalf)) {
      return NextResponse.json(
        { error: "FY & Half must be in format YYYY-H1 or YYYY-H2" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("headcountRecords").doc(id);
    const existingDoc = await docRef.get();

    if (!existingDoc.exists) {
      return NextResponse.json({ error: "Headcount row not found" }, { status: 404 });
    }

    const existingData = existingDoc.data() || {};
const userEmailId = String(existingData.userEmailId || "").trim().toLowerCase();

const duplicateSnapshot = await adminDb
  .collection("headcountRecords")
  .where("userEmailId", "==", userEmailId)
  .where("fyHalf", "==", fyHalf)
  .get();

const duplicateExists = duplicateSnapshot.docs.some((doc) => doc.id !== id);

if (duplicateExists) {
  return NextResponse.json(
    { error: `Another row already exists for ${userEmailId} in ${fyHalf}` },
    { status: 400 }
  );
}

    await docRef.update({
      businessUnit,
      location,
      department,
      empType,
      fyHalf,
      updatedAt: new Date().toISOString(),
      uploadedBy: String(user?.email || "Unknown").trim().toLowerCase(),
    });

    return NextResponse.json({
      ok: true,
      message: "Headcount row updated successfully",
      id,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update headcount row",
      },
      { status: 500 }
    );
  }
}