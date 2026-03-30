import { requireUser } from "../../../src/lib/auth";
import { redirect } from "next/navigation";
import UserAdminPage from "../../../src/components/UserAdminPage";

export default async function AdminUsersPage() {
  const user = await requireUser();

  if (user.role !== "admin") {
    redirect("/");
  }

  return <UserAdminPage currentUserEmail={user.email} />;
}
