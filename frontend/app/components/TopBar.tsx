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
        borderBottom: "1px solid rgba(148,163,184,0.2)",
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Unified Operations</h2>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.875rem" }}>Real-time overview for Disenyorita & Isla</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "0.875rem", color: "#cbd5f5" }}>{now}</span>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "rgba(56, 189, 248, 0.1)",
            borderRadius: "9999px",
            padding: "0.35rem 0.75rem",
            fontSize: "0.75rem",
            color: "#38bdf8",
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
