"use client";

import { useMemo } from "react";

export function TopBar(): JSX.Element {
  const now = useMemo(() => new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" }).format(new Date()), []);

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1.75rem 2.5rem",
        borderBottom: "1px solid rgba(139, 57, 33, 0.18)",
        background: "linear-gradient(90deg, rgba(255, 248, 241, 0.92), rgba(255, 255, 255, 0.76))",
        backdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.6rem", color: "#8b3921" }}>Unified Operations</h2>
        <p style={{ margin: 0, color: "#8c6f63", fontSize: "0.9rem" }}>Real-time overview for Disenyorita & Isla</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "0.9rem", color: "#6f4d3d", fontWeight: 500 }}>{now}</span>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "rgba(139, 57, 33, 0.1)",
            borderRadius: "9999px",
            padding: "0.45rem 0.85rem",
            fontSize: "0.78rem",
            color: "#8b3921",
            fontWeight: 600,
            letterSpacing: "0.08em"
          }}
        >
          <span>RBAC</span>
          <span>•</span>
          <span>MFA</span>
          <span>•</span>
          <span>Audit log</span>
        </div>
      </div>
    </header>
  );
}
