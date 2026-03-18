import { requireUser } from "../src/lib/auth";
import BudgetDashboard from "../src/components/BudgetDashboard";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main
      style={{
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#071521",
      }}
    >
      <div
        style={{
          height: "52px",
          padding: "0 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background:
            "linear-gradient(90deg, #071521 0%, #0a2233 45%, #0b2a3f 100%)",
          borderBottom: "1px solid rgba(84, 214, 255, 0.18)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#d7f6ff",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "999px",
              background: "rgba(77, 222, 255, 0.14)",
              border: "1px solid rgba(77, 222, 255, 0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#72efff",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {user.name?.slice(0, 1) || "U"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ color: "#eafcff", fontSize: "13px", fontWeight: 600 }}>
              {user.name}
            </span>
            <span style={{ color: "#7fb7c7", fontSize: "11px" }}>
              {user.role.replaceAll("_", " ")}
            </span>
          </div>
        </div>

        <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
          <button
            style={{
              height: "34px",
              padding: "0 14px",
              cursor: "pointer",
              borderRadius: "10px",
              border: "1px solid rgba(84, 214, 255, 0.28)",
              background: "rgba(84, 214, 255, 0.08)",
              color: "#dffbff",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </form>
      </div>

      <div style={{ padding: "0" }}>
        <BudgetDashboard />
      </div>
    </main>
  );
}