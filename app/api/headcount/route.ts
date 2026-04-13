import { adminDb } from "../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../src/lib/auth";
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

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const limitParam = Number(searchParams.get("limit") || "100");
    const limit = Math.min(Math.max(limitParam, 1), 200);
    const cursor = String(searchParams.get("cursor") || "").trim();

    let query: FirebaseFirestore.Query = adminDb
      .collection("headcountRecords")
      .orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDoc = await adminDb.collection("headcountRecords").doc(cursor).get();

      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.limit(limit).get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const hasMore = snapshot.docs.length === limit;
    const nextCursor = hasMore ? snapshot.docs[snapshot.docs.length - 1]?.id || null : null;

    return NextResponse.json({
      ok: true,
      items,
      hasMore,
      nextCursor,
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
          {
            error: `Row ${rowNo}: same user email is repeated within the same FY/Half in the import file`,
          },
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
          {
            error: `Row ${rowNo}: empType must be one of ${allowedEmpTypes.join(", ")}`,
          },
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

    const fyHalvesInImport = [
      ...new Set(rows.map((row: any) => String(row.fyHalf || "").trim())),
    ];

    const existingKeys = new Set<string>();

    for (const fyHalf of fyHalvesInImport) {
      const snapshot = await adminDb
        .collection("headcountRecords")
        .where("fyHalf", "==", fyHalf)
        .get();

      snapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        const existingEmail = String(data.userEmailId || "").trim().toLowerCase();
        if (existingEmail) {
          existingKeys.add(`${existingEmail}__${fyHalf}`);
        }
      });
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const userEmailId = String(row.userEmailId || "").trim().toLowerCase();
      const fyHalf = String(row.fyHalf || "").trim();
      const uniqueKey = `${userEmailId}__${fyHalf}`;

      if (existingKeys.has(uniqueKey)) {
        return NextResponse.json(
          {
            error: `Row ${i + 1}: same user email already exists in ${fyHalf}`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const chunkSize = 400;

    for (let start = 0; start < rows.length; start += chunkSize) {
      const chunk = rows.slice(start, start + chunkSize);
      const batch = adminDb.batch();

      chunk.forEach((row: any) => {
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
    }

    const summaryRows = buildHeadcountSummaryRows(rows);
    const summaryBatch = adminDb.batch();

    for (const row of summaryRows) {
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
      const existingDoc = await docRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() || {} : {};
      const existingHeadcount = Number(existingData.headcount || 0);

      summaryBatch.set(docRef, {
        fyHalf: row.fyHalf,
        businessUnit: row.businessUnit,
        location: row.location,
        department: row.department,
        empType: row.empType,
        headcount: existingHeadcount + Number(row.headcount || 0),
        createdAt: existingData.createdAt || now,
        updatedAt: now,
        uploadedBy: String(user?.email || "Unknown").trim().toLowerCase(),
      });
    }

    await summaryBatch.commit();

    return NextResponse.json({
      ok: true,
      message: "Headcount rows saved successfully",
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