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
        background: "linear-gradient(180deg, rgba(237, 233, 254, 0.95), rgba(255, 247, 237, 0.95))",
        borderRight: "1px solid rgba(196, 181, 253, 0.45)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
        gap: "1rem"
      }}
    >
      <div>
        <p style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", marginBottom: "0.25rem" }}>
          Disenyorita & Isla
        </p>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Command Center</h1>
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
              color: pathname === item.href ? "#312e81" : "#475569",
              backgroundColor: pathname === item.href
                ? "rgba(196, 181, 253, 0.6)"
                : "transparent",
              textDecoration: "none",
              fontWeight: 600,
              transition: "all 0.2s ease",
              border: pathname === item.href ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent"
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: "auto", fontSize: "0.75rem", color: "#64748b" }}>
        <p style={{ margin: 0 }}>Secure multi-tenant workspace.</p>
        <p style={{ margin: 0 }}>MFA & RBAC enforced.</p>
      </div>
    </aside>
  );
}
