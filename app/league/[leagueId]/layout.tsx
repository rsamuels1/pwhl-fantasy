import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

interface LeagueLayoutProps {
  children: ReactNode;
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { leagueId } = await params;
  const basePath = `/league/${leagueId}`;

  const [user, league] = await Promise.all([
    getCurrentUser(),
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { commissionerId: true },
    }),
  ]);

  const isCommissioner = !!user && user.id === league?.commissionerId;

  const navItems = [
    { label: "Matchup", href: `${basePath}/matchup` },
    { label: "Overview", href: `${basePath}` },
    { label: "Standings", href: `${basePath}/standings` },
    { label: "Schedule", href: `${basePath}/matchups` },
    { label: "Lineup", href: `${basePath}/lineup` },
    { label: "Roster", href: `${basePath}/roster` },
    { label: "Bracket", href: `${basePath}/bracket` },
    ...(isCommissioner ? [{ label: "Admin", href: `${basePath}/admin` }] : []),
  ];

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
        </header>

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {navItems.map((item) => (
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
