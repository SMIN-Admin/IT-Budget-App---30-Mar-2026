import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../src/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const limitParam = Number(searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(limitParam, 1), 100);

    const fy = String(searchParams.get("fy") || "").trim();
    const businessUnit = String(searchParams.get("businessUnit") || "").trim();
    const status = String(searchParams.get("status") || "").trim();
    const cursor = String(searchParams.get("cursor") || "").trim();

    let query: FirebaseFirestore.Query = adminDb.collection("budgetItems");

    if (fy) {
      query = query.where("fy", "==", fy);
    }

    if (businessUnit) {
      query = query.where("businessUnit", "==", businessUnit);
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    query = query.orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        query = query.startAfter(cursorDate);
      }
    }

    query = query.limit(limit + 1);

    const snapshot = await query.get();

    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;

    const items = pageDocs.map((doc) => {
      const data = doc.data() as any;

      return {
        id: doc.id,
        ...data,
        createdAt:
          data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || null,
        updatedAt:
          data.updatedAt && typeof data.updatedAt.toDate === "function"
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt || null,
      };
    });

    const lastDoc = pageDocs[pageDocs.length - 1];
    const lastData = lastDoc?.data() as any;
    const nextCursor =
      hasMore && lastData?.createdAt && typeof lastData.createdAt.toDate === "function"
        ? lastData.createdAt.toDate().toISOString()
        : null;

    return NextResponse.json({
      items,
      hasMore,
      nextCursor,
    });
  } catch (error: any) {
    console.error("GET budget-items error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch budget items" },
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

    if (!["admin", "budget_collaborator"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const itemKey = String(body.itemKey || "").trim();

    if (!itemKey) {
      return NextResponse.json(
        { error: "itemKey is required" },
        { status: 400 }
      );
    }

    const { id, _new, ...cleanBody } = body;

    const existingSnap = await adminDb
      .collection("budgetItems")
      .where("itemKey", "==", itemKey)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];

      return NextResponse.json({
        ok: true,
        id: existingDoc.id,
        skipped: true,
        message: "Duplicate item skipped",
      });
    }

    const payload = {
      ...cleanBody,
      itemKey,
      createdBy: user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await adminDb.collection("budgetItems").add(payload);

    return NextResponse.json({
      ok: true,
      id: docRef.id,
    });
  } catch (error: any) {
    console.error("POST budget-items error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create budget item" },
      { status: 500 }
    );
  }
}