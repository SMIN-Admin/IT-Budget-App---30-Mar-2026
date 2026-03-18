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
    const itemKey = body.itemKey;

    if (!itemKey) {
      return NextResponse.json(
        { error: "itemKey is required" },
        { status: 400 }
      );
    }

    const { id, _new, ...cleanBody } = body;

    const payload = {
      ...cleanBody,
      createdBy: user.email,
      createdAt: body.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await adminDb
      .collection("budgetItems")
      .doc(String(itemKey))
      .set(payload, { merge: true });

    return NextResponse.json({
      ok: true,
      id: String(itemKey),
    });
  } catch (error: any) {
    console.error("POST budget-items error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create budget item" },
      { status: 500 }
    );
  }
}