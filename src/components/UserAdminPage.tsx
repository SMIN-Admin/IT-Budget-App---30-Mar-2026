"use client";

import { useEffect, useState } from "react";
import { fetchUsers, createUser, updateUser } from "../lib/user-api";

const roles = ["admin", "budget_collaborator", "viewer", "approver"];

export default function UserAdminPage({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "viewer",
    isActive: true,
  });

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await fetchUsers();
      setUsers(data);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      alert(error?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate() {
    try {
      if (!form.email.trim()) {
        alert("Email is required");
        return;
      }

      setSaving(true);

      await createUser({
        email: form.email,
        name: form.name,
        role: form.role,
        isActive: form.isActive,
        allowedBusinessUnits: [],
      });

      setForm({
        email: "",
        name: "",
        role: "viewer",
        isActive: true,
      });

      await loadUsers();
      alert("User onboarded successfully");
    } catch (error: any) {
      console.error("Create user failed:", error);
      alert(error?.message || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(user: any) {
    try {
      await updateUser(user.email, {
        isActive: !user.isActive,
      });

      await loadUsers();
    } catch (error: any) {
      console.error("Update active failed:", error);
      alert(error?.message || "Failed to update user");
    }
  }

  async function handleRoleChange(user: any, role: string) {
    try {
      await updateUser(user.email, { role });
      await loadUsers();
    } catch (error: any) {
      console.error("Update role failed:", error);
      alert(error?.message || "Failed to update role");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#071521",
        color: "#E5E7EB",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Admin — User Onboarding</h1>
            <p style={{ margin: "8px 0 0 0", color: "#8AA0B7", fontSize: 14 }}>
              Signed in as {currentUserEmail}
            </p>
          </div>

          <a
            href="/"
            style={{
              color: "#DFFBFF",
              textDecoration: "none",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(84, 214, 255, 0.28)",
              background: "rgba(84, 214, 255, 0.08)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Back to Dashboard
          </a>
        </div>

        <section
          style={{
            background: "#0F1B2B",
            borderRadius: 16,
            padding: 20,
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Onboard New User</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#9FB3C8" }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="user@spacematrix.com"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#09131D",
                  color: "#E5E7EB",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#9FB3C8" }}>Name</label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Full name"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#09131D",
                  color: "#E5E7EB",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#9FB3C8" }}>Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, role: e.target.value }))
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#09131D",
                  color: "#E5E7EB",
                  outline: "none",
                }}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingTop: 26,
              }}
            >
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                }
              />
              <label htmlFor="isActive" style={{ fontSize: 14 }}>
                Active user
              </label>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              onClick={handleCreate}
              disabled={saving}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg,#10b981,#059669)",
                color: "#fff",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Onboard User"}
            </button>
          </div>
        </section>

        <section
          style={{
            background: "#0F1B2B",
            borderRadius: 16,
            padding: 20,
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Existing Users</h2>

          {loading ? (
            <div style={{ color: "#9FB3C8" }}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={{ color: "#9FB3C8" }}>No users found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ textAlign: "left", padding: 12 }}>Email</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Name</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Role</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Status</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.email}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <td style={{ padding: 12 }}>{u.email}</td>
                      <td style={{ padding: 12 }}>{u.name || "-"}</td>
                      <td style={{ padding: 12 }}>
                        <select
                          value={u.role || "viewer"}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "#09131D",
                            color: "#E5E7EB",
                          }}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 12 }}>
                        {u.isActive ? "Active" : "Inactive"}
                      </td>
                      <td style={{ padding: 12 }}>
                        <button
                          onClick={() => handleToggleActive(u)}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: u.isActive ? "#3F1D1D" : "#113726",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          {u.isActive ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}