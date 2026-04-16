import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../src/lib/firebase-admin";

const ALLOWED_DOMAIN = "spacematrix.com";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, message: "Session route live" });
  } catch {
    return NextResponse.json({ error: "Session check failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = String(decoded.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Invalid email from Google" },
        { status: 400 }
      );
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return NextResponse.json(
        { error: "Only @spacematrix.com users are allowed" },
        { status: 403 }
      );
    }

    let userRef = adminDb.collection("users").doc(email);
    let userSnap = await userRef.get();

    if (!userSnap.exists) {
      userRef = adminDb.collection("users").doc(decoded.uid);
      userSnap = await userRef.get();
    }

    if (!userSnap.exists) {
      const querySnap = await adminDb
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        userSnap = querySnap.docs[0];
        userRef = userSnap.ref;
      }
    }

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User not onboarded by admin" },
        { status: 403 }
      );
    }

    const userData = userSnap.data();

    if (!userData?.isActive) {
      return NextResponse.json(
        { error: "User is disabled" },
        { status: 403 }
      );
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    await userRef.set(
      {
        email,
        name: decoded.name || userData?.name || "",
        photoURL: decoded.picture || userData?.photoURL || "",
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    const response = NextResponse.json({ ok: true });

    response.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}