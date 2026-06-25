import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getTeamAnalysis } from "@/lib/services/analysis-service";
import { getDashboardData, type PlayerPerfSummary } from "@/lib/services/dashboard";
import AnalysisTab from "@/components/AnalysisTab";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { computeSuperlatives } from "@/lib/services/superlatives";

const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#5fa98c", GOALIE: "#f59e0b",
};

function PerformerCard({ title, players, variant }: {
  title: string;
  players: PlayerPerfSummary[];
  variant: "top" | "low";
}) {
  if (players.length === 0) return null;
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: "18px 20px",
    }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 12px", color: "var(--dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
        {title}
      </h2>
      {players.map((p) => (
        <div key={p.playerId} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, color: "var(--text)" }}>{p.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] ?? "var(--dim)" }}>
                {p.position[0]}
              </span>
            </div>
            <span style={{ color: variant === "top" ? "#5fa98c" : "#d18b7f", fontWeight: 700, fontSize: 14 }}>
              {p.points.toFixed(1)}
            </span>
          </div>
          {p.statBreakdown.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
              {p.statBreakdown.map((b) => (
                <span key={b.label} style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 999,
                  background: b.points >= 0 ? "rgba(95,169,140,0.1)" : "rgba(209,139,127,0.1)",
                  color: b.points >= 0 ? "#5fa98c" : "#d18b7f",
                }}>
                  {b.label}{b.stat > 1 ? ` ×${b.stat}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function TeamAnalysisPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/analysis`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, isReplay: true, replayCurrentDate: true },
  });
  if (!league) notFound();

  const nowMs = getReplayNow(league, await getDevNow());

  const [analysis, dashboardData, allMatchups, allTeams] = await Promise.all([
    getTeamAnalysis(leagueId, teamId, nowMs, prisma).catch((err: unknown) => {
      console.error("[analysis] getTeamAnalysis failed:", err);
      return null;
    }),
    getDashboardData(leagueId, teamId, nowMs, prisma).catch(() => null),
    prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false, homeScore: { not: null } },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, week: true, isPlayoff: true },
    }),
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true },
    }),
  ]);

  const topPerformers = dashboardData?.topPerformers ?? [];
  const disappointments = dashboardData?.disappointments ?? [];
  const hasPerformers = topPerformers.length > 0 || disappointments.length > 0;

  const superlativesMap = allMatchups.length > 0
    ? computeSuperlatives(
        allTeams.map((t) => ({ fantasyTeamId: t.id, teamName: t.name })),
        allMatchups.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          week: m.week,
          isPlayoff: m.isPlayoff,
        }))
      )
    : null;
  const mySuperlatives = superlativesMap?.get(teamId) ?? [];

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Season awards (superlatives) ── */}
      {mySuperlatives.length > 0 && (
        <section style={{
          background: "linear-gradient(135deg, rgba(245,201,123,0.07), rgba(245,158,11,0.03))",
          border: "1px solid rgba(245,201,123,0.25)",
          borderRadius: 16,
          padding: "16px 20px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 12 }}>
            Season Awards
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mySuperlatives.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── This week's performers (moved from matchup page Z7) ── */}
      {hasPerformers && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="section-accent" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--dim)" }}>
              This week
            </span>
          </div>
          {topPerformers[0] && topPerformers[0].points > 0 && (
            <div style={{
              padding: "10px 16px", borderRadius: 10,
              background: "rgba(95,169,140,0.07)",
              border: "1px solid rgba(95,169,140,0.18)",
              fontSize: 13, color: "#7fc2a6",
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 12,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
              <span>
                <strong style={{ color: "#c2e8da" }}>{topPerformers[0].name}</strong>
                {" "}is leading your team with{" "}
                <strong style={{ color: "#c2e8da" }}>{topPerformers[0].points.toFixed(1)} pts</strong>
                {" "}this week
              </span>
            </div>
          )}
          <div className="matchup-2col">
            <PerformerCard title="Top performers" players={topPerformers} variant="top" />
            <PerformerCard title="Underperforming" players={disappointments} variant="low" />
          </div>
        </section>
      )}

      {!hasPerformers && dashboardData?.activeMatchup?.status === "active" && (
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)", color: "var(--faint)", fontSize: 13 }}>
          Stats will populate as your players take the ice — check back mid-week.
        </div>
      )}

      <AnalysisTab analysis={analysis} />

      {!hasPerformers && !dashboardData?.activeMatchup && (
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)", color: "var(--faint)", fontSize: 13 }}>
          Your analysis will build up as the season gets going.{" "}
          <Link href={`/team/${teamId}/roster`} style={{ color: "var(--accent-strong)" }}>Set your lineup →</Link>
        </div>
      )}
    </div>
  );
}
