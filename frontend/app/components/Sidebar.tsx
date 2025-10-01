"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/automation", label: "Automation" },
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
  { href: "/financials", label: "Financials" },
  { href: "/financials/tax-calculator", label: "Tax tools" },
  { href: "/support", label: "Support" },
  { href: "/hr", label: "People" },
  { href: "/marketing", label: "Marketing" },
  { href: "/monitoring", label: "Monitoring" }
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "240px",
        background: "linear-gradient(180deg, rgba(139, 57, 33, 0.95), rgba(139, 57, 33, 0.78))",
        borderRight: "1px solid rgba(63, 34, 22, 0.25)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
        gap: "1rem"
      }}
    >
      <div>
        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#f2d5c1", letterSpacing: "0.12em", marginBottom: "0.25rem" }}>
          Disenyorita & Isla
        </p>
        <h1 style={{ fontSize: "1.35rem", margin: 0, color: "#fef9f6" }}>Command Center</h1>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx("nav-link", {
              active: pathname === item.href
            })}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              color: pathname === item.href ? "#8b3921" : "#fdece0",
              backgroundColor: pathname === item.href ? "#f7eada" : "rgba(255, 255, 255, 0.08)",
              textDecoration: "none",
              fontWeight: 600,
              transition: "all 0.2s ease",
              border: pathname === item.href ? "1px solid rgba(139, 57, 33, 0.35)" : "1px solid transparent",
              backdropFilter: pathname === item.href ? "blur(2px)" : undefined
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: "auto", fontSize: "0.75rem", color: "#f7dccc", lineHeight: 1.4 }}>
        <p style={{ margin: 0 }}>Secure multi-tenant workspace.</p>
        <p style={{ margin: 0 }}>MFA & RBAC enforced.</p>
      </div>
    </aside>
  );
}
