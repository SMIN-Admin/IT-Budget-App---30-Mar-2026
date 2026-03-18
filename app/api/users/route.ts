import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../src/lib/firebase-admin";
import { getCurrentUser } from "../../../src/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection("users")
      .orderBy("email", "asc")
      .get();

    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("GET users error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (currentUser.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "viewer").trim();
    const isActive = body.isActive !== false;
    const allowedBusinessUnits = Array.isArray(body.allowedBusinessUnits)
      ? body.allowedBusinessUnits
      : [];

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!email.endsWith("@spacematrix.com")) {
      return NextResponse.json(
        { error: "Only @spacematrix.com users can be onboarded" },
        { status: 400 }
      );
    }

    if (!["admin", "budget_collaborator", "viewer", "approver"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role selected" },
        { status: 400 }
      );
    }

    await adminDb.collection("users").doc(email).set(
      {
        email,
        name,
        role,
        isActive,
        allowedBusinessUnits,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: currentUser.email,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      id: email,
    });
  } catch (error: any) {
    console.error("POST users error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user" },
      { status: 500 }
    );
  }
}