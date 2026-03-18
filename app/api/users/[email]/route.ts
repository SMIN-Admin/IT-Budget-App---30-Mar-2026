import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../../src/lib/auth";

type RouteContext = {
  params: Promise<{ email: string }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email } = await context.params;
    const decodedEmail = decodeURIComponent(email);
    const body = await req.json();

    const updateData: any = {
      updatedAt: new Date(),
      updatedBy: currentUser.email,
    };

    if ("name" in body) {
      updateData.name = String(body.name || "").trim();
    }

    if ("role" in body) {
      const role = String(body.role || "").trim();

      if (!["admin", "budget_collaborator", "viewer", "approver"].includes(role)) {
        return NextResponse.json(
          { error: "Invalid role selected" },
          { status: 400 }
        );
      }

      updateData.role = role;
    }

    if ("isActive" in body) {
      updateData.isActive = Boolean(body.isActive);
    }

    if ("allowedBusinessUnits" in body) {
      updateData.allowedBusinessUnits = Array.isArray(body.allowedBusinessUnits)
        ? body.allowedBusinessUnits
        : [];
    }

    await adminDb.collection("users").doc(decodedEmail).set(updateData, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("PUT users/[email] error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update user" },
      { status: 500 }
    );
  }
}