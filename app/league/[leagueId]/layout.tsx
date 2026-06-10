import Link from "next/link";
import type { ReactNode } from "react";

interface LeagueLayoutProps {
  children: ReactNode;
  params: { leagueId: string };
}

export default function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const basePath = `/league/${params.leagueId}`;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 22, fontWeight: 700 }}>
              PWHL Fantasy
            </Link>
            <span style={{ color: "#94a3b8", fontSize: 14 }}>League dashboard</span>
          </div>
          <p style={{ marginTop: 8, color: "#94a3b8", maxWidth: 720 }}>
            Manage your fantasy league, follow standings, review upcoming matchups, and access playoffs all from a mobile-friendly league hub.
          </p>
        </header>

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Overview", href: `${basePath}` },
            { label: "Standings", href: `${basePath}/standings` },
            { label: "Matchups", href: `${basePath}/matchups` },
            { label: "Season", href: `${basePath}/season` },
            { label: "Draft", href: `${basePath}/draft` },
            { label: "Lineup", href: `${basePath}/lineup` },
            { label: "Roster", href: `${basePath}/roster` },
            { label: "Bracket", href: `${basePath}/bracket` },
            { label: "Settings", href: `${basePath}/settings` },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                color: "#e2e8f0",
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main>{children}</main>
      </div>
    </div>
  );
}
