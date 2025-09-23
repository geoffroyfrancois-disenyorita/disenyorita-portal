import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";

export const metadata: Metadata = {
  title: "Disenyorita & Isla Platform",
  description: "Unified operations portal for project, client, finance, support, marketing, and monitoring management."
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <TopBar />
            <div className="content-area">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
