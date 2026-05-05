"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchUsers, createUser, updateUser } from "../lib/user-api";

const roles = ["admin", "budget_collaborator", "viewer", "approver"] as const;
type UserRole = (typeof roles)[number];

type AdminUser = {
  id?: string;
  email: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  createdAt?: string | null;
  lastLoginAt?: string | null;
};

function getInitials(name?: string, email?: string) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-SG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleMeta(role?: string) {
  switch (role) {
    case "admin":
      return {
        label: "Admin",
        tone: "#F59E0B",
        bg: "rgba(245,158,11,0.14)",
        border: "rgba(245,158,11,0.32)",
        icon: "🛡️",
      };
    case "budget_collaborator":
      return {
        label: "Collaborator",
        tone: "#34D399",
        bg: "rgba(52,211,153,0.14)",
        border: "rgba(52,211,153,0.32)",
        icon: "🧩",
      };
    case "approver":
      return {
        label: "Approver",
        tone: "#FB7185",
        bg: "rgba(251,113,133,0.14)",
        border: "rgba(251,113,133,0.32)",
        icon: "✔️",
      };
    default:
      return {
        label: "Viewer",
        tone: "#60A5FA",
        bg: "rgba(96,165,250,0.14)",
        border: "rgba(96,165,250,0.32)",
        icon: "👁️",
      };
  }
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(9,24,41,0.96), rgba(7,18,32,0.98))",
        border: "1px solid rgba(94, 234, 212, 0.12)",
        borderRadius: 22,
        padding: 18,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
        minHeight: 118,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -24,
          right: -20,
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        }}
      />
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div
        style={{
          color: "#8EA5BC",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          marginTop: 8,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ color: "#7D93A8", fontSize: 12, marginTop: 6 }}>{sub}</div>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(10,24,40,0.96), rgba(8,18,31,0.98))",
        border: "1px solid rgba(88,166,255,0.12)",
        borderRadius: 24,
        padding: 22,
        boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#F8FAFC",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                color: "#8EA5BC",
                fontSize: 13,
                marginTop: 6,
                lineHeight: 1.55,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        color: "#8EA5BC",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 8,
        display: "block",
      }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#08121F",
  border: "1px solid rgba(88,166,255,0.16)",
  color: "#E6EDF5",
  borderRadius: 16,
  padding: "13px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  background: "#08121F",
  border: "1px solid rgba(88,166,255,0.16)",
  color: "#E6EDF5",
  borderRadius: 16,
  padding: "13px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const compactSelectStyle: React.CSSProperties = {
  width: "100%",
  background: "#08121F",
  border: "1px solid rgba(88,166,255,0.16)",
  color: "#E6EDF5",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

export default function UserAdminPage({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState<{
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
  }>({
    email: "",
    name: "",
    role: "viewer",
    isActive: true,
  });

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await fetchUsers();

      if (Array.isArray(data)) {
        setUsers(data);
      } else if (Array.isArray((data as any)?.users)) {
        setUsers((data as any).users);
      } else {
        setUsers([]);
      }
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
        email: form.email.trim(),
        name: form.name.trim(),
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

  async function handleToggleActive(user: AdminUser) {
    try {
      setBusyAction(`toggle-${user.email}`);
      await updateUser(user.email, {
        isActive: !user.isActive,
      });
      await loadUsers();
    } catch (error: any) {
      console.error("Update active failed:", error);
      alert(error?.message || "Failed to update user");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRoleChange(user: AdminUser, role: string) {
    try {
      setBusyAction(`role-${user.email}`);
      await updateUser(user.email, { role });
      await loadUsers();
    } catch (error: any) {
      console.error("Update role failed:", error);
      alert(error?.message || "Failed to update role");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRebuildSummaries() {
    try {
      setBusyAction("rebuild");
      const res = await fetch("/api/admin/rebuild-core-summaries", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to rebuild summaries");
        return;
      }

      alert(`Success: ${data?.message || "Core summaries rebuilt successfully"}`);
    } catch (error: any) {
      alert(error?.message || "Failed to rebuild summaries");
    } finally {
      setBusyAction(null);
    }
  }
const handleArchiveBudget = async () => {
  try {
    setBusyAction("archive-budget");

    const res = await fetch("/api/admin/archive-budget", {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Archive failed");
      return;
    }

    alert("Budget archive completed successfully");
  } catch (err: any) {
    alert(err.message || "Archive failed");
  } finally {
    setBusyAction(null);
  }
};

const handleArchiveHeadcount = async () => {
  try {
    setBusyAction("archive-headcount");

    const res = await fetch("/api/admin/archive-headcount", {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Headcount archive failed");
      return;
    }

    alert(data?.message || "Headcount archive completed successfully");
  } catch (err: any) {
    alert(err?.message || "Headcount archive failed");
  } finally {
    setBusyAction(null);
  }
};


  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive !== false).length;
    const disabled = users.filter((u) => u.isActive === false).length;
    const admins = users.filter((u) => u.role === "admin").length;
    const collaborators = users.filter((u) => u.role === "budget_collaborator").length;
    const approvers = users.filter((u) => u.role === "approver").length;
    const viewers = users.filter((u) => (u.role || "viewer") === "viewer").length;

    return { total, active, disabled, admins, collaborators, approvers, viewers };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((u) => {
      const matchesSearch =
        !q ||
        [u.email, u.name, u.role].some((v) =>
          String(v || "").toLowerCase().includes(q)
        );

      const matchesRole =
        roleFilter === "all" ? true : String(u.role || "viewer") === roleFilter;

      const isActive = u.isActive !== false;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? isActive
          : !isActive;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const recentActivity = useMemo(() => {
    return [...users]
      .filter((u) => u.lastLoginAt || u.createdAt)
      .sort((a, b) => {
        const aTime = new Date(a.lastLoginAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastLoginAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [users]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(34,211,238,0.12), transparent 24%), radial-gradient(circle at top right, rgba(124,140,255,0.12), transparent 18%), linear-gradient(180deg, #040d17 0%, #071521 54%, #06111b 100%)",
        color: "#E5E7EB",
        padding: "30px clamp(18px, 3vw, 34px)",
        fontFamily:
          'Montserrat, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');
      `}</style>

      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 22 }}>
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(9, 27, 43, 0.85)",
                border: "1px solid rgba(94,234,212,0.16)",
                borderRadius: 999,
                padding: "8px 14px",
                color: "#5EEAD4",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              <span>🛡️</span>
              <span>Admin Workspace</span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 3vw, 42px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#F8FAFC",
              }}
            >
              User Access & System Control
            </h1>

            <div
              style={{
                marginTop: 10,
                color: "#8EA5BC",
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              Signed in as{" "}
              <span style={{ color: "#E8F4FF", fontWeight: 700 }}>{currentUserEmail}</span>
            </div>
          </div>

          <a
            href="/"
            style={{
              background: "rgba(11, 25, 42, 0.96)",
              color: "#E2F3FF",
              border: "1px solid rgba(88,166,255,0.22)",
              borderRadius: 16,
              padding: "14px 18px",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 180,
              boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
            }}
          >
            ← Back to Dashboard
          </a>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <StatCard icon="👥" label="Total Users" value={stats.total} color="#60A5FA" />
          <StatCard icon="✅" label="Active Users" value={stats.active} color="#34D399" />
          <StatCard icon="🛡️" label="Admins" value={stats.admins} color="#F59E0B" />
          <StatCard icon="🧩" label="Collaborators" value={stats.collaborators} color="#A78BFA" />
          <StatCard icon="✔️" label="Approvers" value={stats.approvers} color="#FB7185" />
          <StatCard icon="👁️" label="Viewers" value={stats.viewers} color="#60A5FA" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1.2fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <SectionCard
            title="Onboard New User"
            subtitle="Create access quickly with the right role and activation status."
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="user@spacematrix.com"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <FieldLabel>Full Name</FieldLabel>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter full name"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 14,
                  alignItems: "end",
                }}
              >
                <div>
                  <FieldLabel>Role</FieldLabel>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        role: e.target.value as UserRole,
                      }))
                    }
                    style={selectStyle}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#E2E8F0",
                    fontSize: 14,
                    fontWeight: 600,
                    paddingBottom: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    style={{ width: 18, height: 18 }}
                  />
                  Active user
                </label>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  style={{
                    background: "linear-gradient(135deg, #10b981, #22c55e)",
                    color: "#F8FAFC",
                    border: "none",
                    borderRadius: 16,
                    padding: "14px 22px",
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.65 : 1,
                    boxShadow: "0 12px 24px rgba(16,185,129,0.25)",
                  }}
                >
                  {saving ? "Saving..." : "Onboard User"}
                </button>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: "rgba(11,25,42,0.88)",
                    border: "1px solid rgba(88,166,255,0.16)",
                    borderRadius: 16,
                    padding: "12px 14px",
                    color: "#8EA5BC",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span>ℹ️</span>
                  <span>
                    Admins manage everything, collaborators manage budget, approvers review,
                    viewers only view.
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="System Tools"
            subtitle="Privileged utilities for summary rebuild and admin-side maintenance."
            right={
              <div
                style={{
                  display: "inline-flex",
                  gap: 10,
                  alignItems: "center",
                  background: "rgba(94,234,212,0.06)",
                  border: "1px solid rgba(94,234,212,0.16)",
                  borderRadius: 14,
                  padding: "10px 14px",
                  color: "#5EEAD4",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>⚙️</span>
                <span>Restricted</span>
              </div>
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr 1fr",
                gap: 14,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(180deg, rgba(7,19,33,0.96), rgba(5,14,25,0.98))",
                  border: "1px solid rgba(34,197,94,0.22)",
                  borderRadius: 20,
                  padding: 18,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 24 }}>🔁</div>
                <div style={{ color: "#F8FAFC", fontSize: 18, fontWeight: 700 }}>
                  Rebuild Summaries
                </div>
                <div style={{ color: "#8EA5BC", fontSize: 13, lineHeight: 1.6 }}>
                  Regenerates core summary and app option documents used across dashboards
                  and reports.
                </div>
                <button
                  onClick={handleRebuildSummaries}
                  disabled={busyAction === "rebuild"}
                  style={{
                    width: "fit-content",
                    background: "#22c55e",
                    color: "#06111c",
                    border: "none",
                    borderRadius: 14,
                    padding: "12px 16px",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: busyAction === "rebuild" ? "not-allowed" : "pointer",
                    opacity: busyAction === "rebuild" ? 0.7 : 1,
                  }}
                >
                  {busyAction === "rebuild" ? "Rebuilding..." : "Run Now"}
                </button>
              </div>

              <div
  style={{
    background: "linear-gradient(145deg,#0B1624,#0A1320)",
    borderRadius: 16,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.06)",
    minHeight: 190,
  }}
>
  <div style={{ fontSize: 28, marginBottom: 10 }}>🗂️</div>
  <div style={{ color: "#EAF2FF", fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
    Archive Budget History
  </div>
  <div style={{ color: "#88A0B8", fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
    Move budget line items older than the 3-FY retention window into archive storage.
  </div>
  <button
  onClick={handleArchiveBudget}
  disabled={busyAction === "archive-budget"}
  style={{
    background: "#22c55e",
    color: "#04120A",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontWeight: 800,
    cursor: busyAction === "archive-budget" ? "not-allowed" : "pointer",
    opacity: busyAction === "archive-budget" ? 0.7 : 1,
  }}
>
  {busyAction === "archive-budget" ? "Archiving..." : "Run Budget Archive"}
</button>
</div>

<div
  style={{
    background: "linear-gradient(145deg,#0B1624,#0A1320)",
    borderRadius: 16,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.06)",
    minHeight: 190,
  }}
>
  <div style={{ fontSize: 28, marginBottom: 10 }}>🧾</div>
  <div style={{ color: "#EAF2FF", fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
    Archive Headcount History
  </div>
  <div style={{ color: "#88A0B8", fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
    Move headcount rows older than the 3-FY retention window into archive storage.
  </div>
  <button
  onClick={handleArchiveHeadcount}
  disabled={busyAction === "archive-headcount"}
  style={{
    background: "#22c55e",
    color: "#04120A",
    border: "none",
    borderRadius: 10,
    padding: "10px 16px",
    fontWeight: 800,
    cursor: busyAction === "archive-headcount" ? "not-allowed" : "pointer",
    opacity: busyAction === "archive-headcount" ? 0.7 : 1,
  }}
>
  {busyAction === "archive-headcount" ? "Archiving..." : "Run Headcount Archive"}
</button>
</div>

              <div
                style={{
                  background: "linear-gradient(180deg, rgba(7,19,33,0.96), rgba(5,14,25,0.98))",
                  border: "1px solid rgba(88,166,255,0.12)",
                  borderRadius: 20,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    color: "#8EA5BC",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Mode
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: "#60A5FA",
                    fontWeight: 800,
                    fontSize: 24,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Manual
                </div>
              </div>

              <div
                style={{
                  background: "linear-gradient(180deg, rgba(7,19,33,0.96), rgba(5,14,25,0.98))",
                  border: "1px solid rgba(88,166,255,0.12)",
                  borderRadius: 20,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    color: "#8EA5BC",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Access
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: "#F59E0B",
                    fontWeight: 800,
                    fontSize: 24,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Admins Only
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 0.9fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <SectionCard
            title="Existing Users"
            subtitle="Review access, update roles, search users, and enable or disable accounts."
            right={
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email, name, or role..."
                  style={{
                    ...inputStyle,
                    width: 250,
                    padding: "12px 14px",
                  }}
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  style={{ ...compactSelectStyle, width: 170 }}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="budget_collaborator">Collaborator</option>
                  <option value="viewer">Viewer</option>
                  <option value="approver">Approver</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ ...compactSelectStyle, width: 150 }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            }
          >
            {loading ? (
              <div style={{ color: "#8EA5BC", padding: "6px 4px" }}>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ color: "#8EA5BC", padding: "6px 4px" }}>No users found.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    minWidth: 980,
                  }}
                >
                  <thead>
                    <tr>
                      {["User", "Role", "Status", "Actions"].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            textAlign: "left",
                            padding: "0 12px 12px 12px",
                            color: "#8EA5BC",
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map((u) => {
                      const meta = roleMeta(u.role || "viewer");
                      const active = u.isActive !== false;
                      const isBusy =
                        busyAction === `role-${u.email}` || busyAction === `toggle-${u.email}`;

                      return (
                        <tr key={u.email}>
                          <td
                            style={{
                              padding: "12px 12px",
                              borderTop: "1px solid rgba(148,163,184,0.10)",
                              verticalAlign: "middle",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 12,
                                  background:
                                    "linear-gradient(135deg, rgba(96,165,250,0.32), rgba(34,211,238,0.18))",
                                  display: "grid",
                                  placeItems: "center",
                                  color: "#E2E8F0",
                                  fontSize: 14,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {getInitials(u.name, u.email)}
                              </div>

                              <div>
                                <div
                                  style={{
                                    color: "#F8FAFC",
                                    fontWeight: 700,
                                    fontSize: 15,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {u.name || "Unnamed User"}
                                </div>
                                <div
                                  style={{
                                    color: "#8EA5BC",
                                    fontSize: 13,
                                    marginTop: 3,
                                  }}
                                >
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td
                            style={{
                              padding: "12px 12px",
                              borderTop: "1px solid rgba(148,163,184,0.10)",
                              verticalAlign: "middle",
                              width: 270,
                            }}
                          >
                            <div style={{ display: "grid", gap: 8 }}>
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "fit-content",
                                  background: meta.bg,
                                  border: `1px solid ${meta.border}`,
                                  color: meta.tone,
                                  borderRadius: 999,
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                <span>{meta.icon}</span>
                                <span>{meta.label}</span>
                              </div>

                              <select
                                value={u.role || "viewer"}
                                onChange={(e) => handleRoleChange(u, e.target.value)}
                                disabled={isBusy}
                                style={{
                                  ...compactSelectStyle,
                                  opacity: isBusy ? 0.7 : 1,
                                }}
                              >
                                {roles.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>

                          <td
                            style={{
                              padding: "12px 12px",
                              borderTop: "1px solid rgba(148,163,184,0.10)",
                              verticalAlign: "middle",
                              width: 140,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                background: active
                                  ? "rgba(34,197,94,0.1)"
                                  : "rgba(239,68,68,0.1)",
                                border: `1px solid ${
                                  active ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.28)"
                                }`,
                                color: active ? "#4ADE80" : "#FCA5A5",
                                borderRadius: 999,
                                padding: "7px 11px",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              <span>●</span>
                              <span>{active ? "Active" : "Disabled"}</span>
                            </span>
                          </td>

                          <td
                            style={{
                              padding: "12px 12px",
                              borderTop: "1px solid rgba(148,163,184,0.10)",
                              verticalAlign: "middle",
                              width: 130,
                            }}
                          >
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={isBusy}
                              style={{
                                background: active
                                  ? "linear-gradient(135deg, rgba(127,29,29,0.95), rgba(153,27,27,0.95))"
                                  : "linear-gradient(135deg, rgba(6,95,70,0.95), rgba(5,150,105,0.95))",
                                color: "#F8FAFC",
                                border: "none",
                                borderRadius: 12,
                                padding: "10px 14px",
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: isBusy ? "not-allowed" : "pointer",
                                opacity: isBusy ? 0.7 : 1,
                                minWidth: 104,
                              }}
                            >
                              {isBusy ? "Updating..." : active ? "Disable" : "Enable"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="User Activity"
            subtitle="Recent login or onboarding activity for the latest users."
          >
            {recentActivity.length === 0 ? (
              <div style={{ color: "#8EA5BC" }}>No recent activity available.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentActivity.map((u) => {
                  const active = u.isActive !== false;
                  return (
                    <div
                      key={`activity-${u.email}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px 1fr auto",
                        gap: 12,
                        alignItems: "center",
                        background: "rgba(8,18,31,0.72)",
                        border: "1px solid rgba(88,166,255,0.10)",
                        borderRadius: 16,
                        padding: "12px 14px",
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background:
                            "linear-gradient(135deg, rgba(96,165,250,0.32), rgba(34,211,238,0.18))",
                          display: "grid",
                          placeItems: "center",
                          color: "#E2E8F0",
                          fontSize: 14,
                          fontWeight: 800,
                        }}
                      >
                        {getInitials(u.name, u.email)}
                      </div>

                      <div>
                        <div style={{ color: "#F8FAFC", fontSize: 14, fontWeight: 700 }}>
                          {u.name || u.email}
                        </div>
                        <div style={{ color: "#8EA5BC", fontSize: 12, marginTop: 4 }}>
                          {u.lastLoginAt
                            ? `Last login: ${formatDateTime(u.lastLoginAt)}`
                            : `Created: ${formatDate(u.createdAt)}`}
                        </div>
                      </div>

                      <div
                        style={{
                          color: active ? "#4ADE80" : "#FCA5A5",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {active ? "Active" : "Disabled"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}