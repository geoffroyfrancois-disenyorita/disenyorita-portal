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
        padding: "1.5rem 2rem",
        borderBottom: "1px solid rgba(196, 181, 253, 0.35)",
        background: "rgba(255, 255, 255, 0.82)",
        backdropFilter: "blur(14px)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Unified Operations</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>Real-time overview for Disenyorita & Isla</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "0.875rem", color: "#475569" }}>{now}</span>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "rgba(129, 140, 248, 0.18)",
            borderRadius: "9999px",
            padding: "0.35rem 0.75rem",
            fontSize: "0.75rem",
            color: "#6366f1",
            fontWeight: 600
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
