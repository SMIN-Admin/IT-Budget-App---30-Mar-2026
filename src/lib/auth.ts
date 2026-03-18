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

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) return null;

    const data = userSnap.data() as Omit<CurrentUser, "uid">;
    if (!data?.isActive) return null;

    return {
      uid,
      ...data,
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
