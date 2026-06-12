import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DevTimeClear from "@/components/DevTimeClear";
import TeamNav from "./TeamNav";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";

interface TeamLayoutProps {
  children: ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/matchup`);
  const team = await requireTeamOwner(teamId, user.id);

  const cookieStore = await cookies();

  // Lightweight matchup context: one query to find the current week's matchup
  const currentMatchup = await prisma.matchup.findFirst({
    where: {
      leagueId: team.league.id,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      homeScore: null,
      isPlayoff: false,
    },
    orderBy: { week: "asc" },
  });
  const simDateRaw = (process.env.NODE_ENV !== "production" || process.env.ALLOW_SIM_DATE === "true")
    ? cookieStore.get("pwhl_dev_sim_date")?.value ?? null
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 0" }}>
        <header style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{team.name}</h1>
          {currentMatchup && (
            <Link
              href={`/team/${teamId}/matchup`}
              style={{
                fontSize: 12, padding: "3px 10px", borderRadius: 20,
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.25)",
                color: "#a5b4fc", textDecoration: "none", fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Wk {currentMatchup.week}
            </Link>
          )}
        </header>

        <TeamNav
          teamId={teamId}
          leagueId={team.league.id}
          leagueName={team.league.name}
        />

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

        <main className="bottom-nav-pad" style={{ paddingBottom: 40 }}>{children}</main>
      </div>
      <BottomNav teamId={teamId} leagueId={team.league.id} />
    </div>
  );
}
