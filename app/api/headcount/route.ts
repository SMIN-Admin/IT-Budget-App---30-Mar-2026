import { adminDb } from "../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../src/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

const snapshot = await adminDb.collection("headcountRecords").limit(50).get();

const items = snapshot.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
}));

    return NextResponse.json({
      ok: true,
      items,
      hasMore: false,
      nextCursor: null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to fetch headcount records",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const role = String(user?.role || "");

if (!["admin", "budget_collaborator"].includes(role)) {
  return NextResponse.json(
    { error: "Forbidden" },
    { status: 403 }
  );
}
    const body = await req.json();
const rows = Array.isArray(body?.rows) ? body.rows : [];
if (!rows.length) {
  return NextResponse.json(
    { error: "No headcount rows received" },
    { status: 400 }
  );
}

const allowedEmpTypes = ["Permanent", "Contract", "Intern", "Consultant"];
const seenKeys = new Set<string>();

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i] || {};
  const rowNo = i + 1;

  const userEmailId = String(row.userEmailId || "").trim();
  const businessUnit = String(row.businessUnit || "").trim();
  const location = String(row.location || "").trim();
  const department = String(row.department || "").trim();
  const empType = String(row.empType || "").trim();
  const fyHalf = String(row.fyHalf || "").trim();
  const uniqueKey = `${userEmailId.toLowerCase()}__${fyHalf}`;

if (seenKeys.has(uniqueKey)) {
  return NextResponse.json(
    { error: `Row ${rowNo}: same user email is repeated within the same FY/Half in the import file` },
    { status: 400 }
  );
}

seenKeys.add(uniqueKey);

  if (!userEmailId || !userEmailId.includes("@")) {
    return NextResponse.json(
      { error: `Row ${rowNo}: userEmailId is required and must be a valid email` },
      { status: 400 }
    );
  }

  if (!businessUnit) {
    return NextResponse.json(
      { error: `Row ${rowNo}: businessUnit is required` },
      { status: 400 }
    );
  }

  if (!location) {
    return NextResponse.json(
      { error: `Row ${rowNo}: location is required` },
      { status: 400 }
    );
  }

  if (!department) {
    return NextResponse.json(
      { error: `Row ${rowNo}: department is required` },
      { status: 400 }
    );
  }

  if (!empType || !allowedEmpTypes.includes(empType)) {
    return NextResponse.json(
      { error: `Row ${rowNo}: empType must be one of ${allowedEmpTypes.join(", ")}` },
      { status: 400 }
    );
  }

  if (!/^\d{4}-H[12]$/.test(fyHalf)) {
    return NextResponse.json(
      { error: `Row ${rowNo}: fyHalf must be in format YYYY-H1 or YYYY-H2` },
      { status: 400 }
    );
  }
}

for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i] || {};
  const userEmailId = String(row.userEmailId || "").trim().toLowerCase();
  const fyHalf = String(row.fyHalf || "").trim();

  const existingSnapshot = await adminDb
    .collection("headcountRecords")
    .where("userEmailId", "==", userEmailId)
    .where("fyHalf", "==", fyHalf)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    return NextResponse.json(
      {
        error: `Row ${i + 1}: same user email already exists in ${fyHalf}`,
      },
      { status: 400 }
    );
  }
}

const now = new Date().toISOString();
const batch = adminDb.batch();

rows.forEach((row: any) => {
  const docRef = adminDb.collection("headcountRecords").doc();

  batch.set(docRef, {
    userEmailId: String(row.userEmailId || "").trim().toLowerCase(),
    businessUnit: String(row.businessUnit || "").trim(),
    location: String(row.location || "").trim(),
    department: String(row.department || "").trim(),
    empType: String(row.empType || "").trim(),
    fyHalf: String(row.fyHalf || "").trim(),
    createdAt: now,
    updatedAt: now,
    uploadedBy: String(user?.email || "Unknown").trim().toLowerCase(),
  });
});

await batch.commit();

    return NextResponse.json({
      ok: true,
      message: "Headcount POST route created",
      receivedCount: rows.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save headcount records",
      },
      { status: 500 }
    );
  }
}