import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import DevTimeClear from "@/components/DevTimeClear";
import BottomNav from "@/components/BottomNav";

interface LeagueLayoutProps {
  children: ReactNode;
  params: Promise<{ leagueId: string }>;
}

export default async function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { leagueId } = await params;
  const basePath = `/league/${leagueId}`;

  const cookieStore = await cookies();
  const simDateRaw = (process.env.NODE_ENV !== "production" || process.env.ALLOW_SIM_DATE === "true")
    ? cookieStore.get("pwhl_dev_sim_date")?.value ?? null
    : null;

  const [user, league] = await Promise.all([
    getCurrentUser(),
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { commissionerId: true, name: true },
    }),
  ]);

  const isCommissioner = !!user && user.id === league?.commissionerId;

  const myTeam = user
    ? await prisma.fantasyTeam.findFirst({ where: { leagueId, ownerId: user.id }, select: { id: true } })
    : null;

  const navItems = [
    { label: "Overview", href: `${basePath}` },
    { label: "Standings", href: `${basePath}/standings` },
    { label: "Schedule", href: `${basePath}/matchups` },
    { label: "Playoffs", href: `${basePath}/bracket` },
    { label: "Power", href: `${basePath}/power-rankings` },
    { label: "Rosters", href: `${basePath}/roster` },
  ];
  const adminItem = isCommissioner
    ? { label: "⚙ Settings", href: `${basePath}/admin` }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 22, fontWeight: 700 }}>
                PWHL Fantasy
              </Link>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>{league?.name ?? "League"}</span>
            </div>
            {myTeam && (
              <Link
                href={`/team/${myTeam.id}/matchup`}
                style={{
                  fontSize: 13,
                  color: "#a5b4fc",
                  textDecoration: "none",
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                My Franchise →
              </Link>
            )}
          </div>
        </header>

        {simDateRaw && (
          <div style={{
            fontSize: 12, color: "#fbbf24",
            background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
            borderRadius: 8, padding: "6px 12px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span>⚠ Dev mode · Simulated: {new Date(simDateRaw).toLocaleString()}</span>
            <DevTimeClear />
          </div>
        )}

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 24,
            alignItems: "center",
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
          {adminItem && (
            <Link
              href={adminItem.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.15)",
                color: "#64748b",
                textDecoration: "none",
                fontSize: 12,
                marginLeft: "auto",
              }}
            >
              {adminItem.label}
            </Link>
          )}
        </nav>

        <main className="bottom-nav-pad">{children}</main>
        {myTeam && <BottomNav teamId={myTeam.id} leagueId={leagueId} />}
      </div>
    </div>
  );
}
