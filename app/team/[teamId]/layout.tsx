import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import DevTimeClear from "@/components/DevTimeClear";

interface TeamLayoutProps {
  children: ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/matchup`);
  const team = await requireTeamOwner(teamId, user.id);

  const cookieStore = await cookies();
  const simDateRaw = process.env.NODE_ENV !== "production"
    ? cookieStore.get("pwhl_dev_sim_date")?.value ?? null
    : null;

  const basePath = `/team/${teamId}`;
  const navItems = [
    { label: "My Matchup", href: `${basePath}/matchup` },
    { label: "My Lineup", href: `${basePath}/lineup` },
    { label: "My Roster", href: `${basePath}/roster` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{team.name}</h1>
            <Link
              href={`/league/${team.league.id}`}
              style={{ color: "#64748b", fontSize: 14, textDecoration: "none" }}
            >
              {team.league.name}
            </Link>
          </div>
        </header>

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
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

          <Link
            href={`/league/${team.league.id}`}
            style={{
              marginLeft: "auto",
              fontSize: 13,
              color: "#64748b",
              textDecoration: "none",
            }}
          >
            ← League
          </Link>
        </nav>

        {simDateRaw && (
          <div style={{
            fontSize: 12, color: "#fbbf24",
            background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
            borderRadius: 8, padding: "6px 12px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span>⚠ Dev mode · Simulated: {new Date(simDateRaw).toLocaleString()}</span>
            <DevTimeClear />
          </div>
        )}

        <main>{children}</main>
      </div>
    </div>
  );
}
