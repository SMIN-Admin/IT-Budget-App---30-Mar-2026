import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../src/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb
      .collection("budgetItems")
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ items });
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