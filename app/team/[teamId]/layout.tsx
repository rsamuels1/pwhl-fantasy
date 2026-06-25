import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TeamNav from "./TeamNav";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import FeedbackWidget from "@/components/FeedbackWidget";

interface TeamLayoutProps {
  children: ReactNode;
  params: Promise<{ teamId: string }>;
}

export default async function TeamLayout({ children, params }: TeamLayoutProps) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/matchup`);
  const team = await requireTeamOwner(teamId, user.id);

  const cookieStore = await cookies();

  // Fetch betaStatus and league status (for TeamNav "Draft Queue" tab and beta banner).
  // trophyCount has a fallback of 0 in case the Trophy table hasn't been migrated yet
  // (graceful degradation — the Trophy Cabinet tab simply won't appear).
  const [leagueExtra, trophyCount] = await Promise.all([
    prisma.fantasyLeague.findUnique({
      where: { id: team.league.id },
      select: { betaStatus: true, status: true },
    }),
    prisma.trophy.count({ where: { teamId } }).catch(() => 0),
  ]);

  // Lightweight matchup context: find current week's matchup, falling back to playoff matchup
  const currentMatchup = await prisma.matchup.findFirst({
    where: {
      leagueId: team.league.id,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      homeScore: null,
      isPlayoff: false,
    },
    orderBy: { week: "asc" },
  });

  // Fallback: if no regular season matchup, check for playoff matchup
  const playoffMatchup = currentMatchup
    ? null
    : await prisma.matchup.findFirst({
        where: {
          leagueId: team.league.id,
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          isPlayoff: true,
        },
        orderBy: { round: "desc" },
      });

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "var(--text)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 0" }}>
        <header style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{team.name}</h1>
          {currentMatchup && (
            <Link
              href={`/team/${teamId}/matchup`}
              style={{
                fontSize: 12, padding: "3px 10px", borderRadius: 20,
                background: "rgba(143,193,232,0.1)",
                border: "1px solid rgba(143,193,232,0.25)",
                color: "var(--accent-strong)", textDecoration: "none", fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Wk {currentMatchup.week}
            </Link>
          )}
          {playoffMatchup && (
            <Link
              href={`/team/${teamId}/matchup`}
              style={{
                fontSize: 12, padding: "3px 10px", borderRadius: 20,
                background: "rgba(217, 119, 6, 0.1)",
                border: "1px solid rgba(217, 119, 6, 0.25)",
                color: "#fdba74", textDecoration: "none", fontWeight: 600,
                flexShrink: 0,
              }}
            >
              R{playoffMatchup.round}
            </Link>
          )}
        </header>

        <TeamNav
          teamId={teamId}
          leagueId={team.league.id}
          leagueName={team.league.name}
          playoffStatus={team.league.playoffStatus ?? "NOT_STARTED"}
          leagueStatus={leagueExtra?.status ?? undefined}
          hasTrophies={trophyCount > 0}
        />


        {leagueExtra?.betaStatus === "ACTIVE" && (
          <div style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 6,
            padding: "8px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#fbbf24",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>Beta League</span>
            <span style={{ color: "#78716c" }}>·</span>
            <span style={{ color: "#a8a29e" }}>Using 2025-26 replay data. Your feedback shapes the real thing.</span>
          </div>
        )}

        <main className="bottom-nav-pad" style={{ paddingBottom: 40 }}>{children}</main>
      </div>
      <BottomNav teamId={teamId} leagueId={team.league.id} />
      <FeedbackWidget leagueId={team.league.id} />
    </div>
  );
}
