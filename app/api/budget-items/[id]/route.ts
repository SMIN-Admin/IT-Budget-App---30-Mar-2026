import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "budget_collaborator"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const { _new, id: bodyId, ...cleanBody } = body;

    await adminDb.collection("budgetItems").doc(String(id)).set(
  {
    ...cleanBody,
    updatedAt: new Date(),
    updatedBy: user.email,
  },
  { merge: true }
);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("PUT budget-item error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to update budget item" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "budget_collaborator"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await adminDb.collection("budgetItems").doc(String(id)).delete();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE budget-item error:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to delete budget item" },
      { status: 500 }
    );
  }
}