import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "./firebase-admin";

export type AppRole =
  | "admin"
  | "budget_collaborator"
  | "viewer"
  | "approver";

export type CurrentUser = {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  allowedBusinessUnits: string[];
  isActive: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);

    const uid = decoded.uid;
    const email = String(decoded.email || "").trim().toLowerCase();

    if (!email) return null;

    // 1. First try email-based document ID (new onboarding format)
    let userSnap = await adminDb.collection("users").doc(email).get();

    // 2. Fallback to old UID-based document ID
    if (!userSnap.exists) {
      userSnap = await adminDb.collection("users").doc(uid).get();
    }

    // 3. Final fallback: query by email field
    if (!userSnap.exists) {
      const querySnap = await adminDb
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        userSnap = querySnap.docs[0];
      }
    }

    if (!userSnap.exists) return null;

    const data = userSnap.data() as Omit<CurrentUser, "uid">;
    if (!data?.isActive) return null;

    return {
      uid,
      ...data,
      email: String(data.email || email).trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}