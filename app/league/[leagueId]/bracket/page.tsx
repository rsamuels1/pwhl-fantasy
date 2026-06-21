import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueAccess } from "@/lib/auth";
import { getStandings } from "@/lib/services/standings-service";
import { getBracket, PlayoffNotStartedError } from "@/lib/services/playoff-service";
import { computeRace, type RaceInfo } from "@/lib/playoffs/seeding";
import PlayoffBracket from "@/components/PlayoffBracket";
import type { Matchup } from "@prisma/client";

function RaceChip({ info }: { info: RaceInfo }) {
  if (info.status === "clinched") {
    return <span className="chip-clinched" style={{ flexShrink: 0 }}>✓ CLINCHED</span>;
  }
  if (info.status === "eliminated") {
    return <span className="chip-eliminated" style={{ flexShrink: 0 }}>✗ ELIM</span>;
  }
  if (info.status === "bubble") {
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(214,169,78,0.12)", border: "1px solid rgba(214,169,78,0.28)", color: "#e3c989", flexShrink: 0 }}>BUBBLE</span>;
  }
  return null;
}

export default async function PlayoffsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/bracket`);
  const { myTeam } = await requireLeagueAccess(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, playoffStatus: true, playoffSettings: true },
  });
  if (!league) notFound();

  const hasPlayoffs = league.playoffStatus !== "NOT_STARTED";

  const [standingsResult, bracketResult, matchups] = await Promise.all([
    getStandings(leagueId, prisma),
    hasPlayoffs
      ? getBracket(leagueId, prisma).catch((err) => {
          if (err instanceof PlayoffNotStartedError) return null;
          throw err;
        })
      : Promise.resolve(null),
    !hasPlayoffs
      ? prisma.matchup.findMany({ where: { leagueId } })
      : Promise.resolve([] as Matchup[]),
  ]);

  const { standings } = standingsResult;
  const cutoffIdx = standings.findIndex((s) => !s.isPlayoffEligible);
  const playoffCutoff = cutoffIdx >= 0 ? cutoffIdx : null;

  const ps = (league.playoffSettings ?? {}) as { teamsInPlayoff?: number; topSeedsWithBye?: number };
  const teamsInPlayoff = ps.teamsInPlayoff ?? 4;
  const topSeedsWithBye = ps.topSeedsWithBye ?? 0;

  // Season progress stats for the race banner
  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const totalWeeks = regularMatchups.reduce((max, m) => Math.max(max, m.week), 0);
  const scoredWeeks = new Set(regularMatchups.filter((m) => m.homeScore !== null).map((m) => m.week)).size;
  const weeksRemaining = Math.max(0, totalWeeks - scoredWeeks);

  const hasResults = regularMatchups.some((m) => m.homeScore !== null);
  const race =
    playoffCutoff !== null && hasResults && !hasPlayoffs
      ? computeRace(standings.map(s => ({ ...s, points: s.totalVP })), matchups, playoffCutoff, 4)
      : null;

  const statusLabel =
    league.playoffStatus === "COMPLETE" ? "Complete" :
    hasPlayoffs ? "In Progress" : "Regular Season";

  const statusColor = hasPlayoffs
    ? (league.playoffStatus === "COMPLETE" ? "#34d399" : "#818cf8")
    : "#94a3b8";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Playoffs</h1>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: "rgba(148,163,184,0.1)", color: statusColor,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* ── Regular season: Playoff Race view ────────────────────────────────── */}
      {!hasPlayoffs && (
        <>
          {/* Race banner */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
            padding: "12px 16px", borderRadius: 12,
            background: "var(--accent-dim)",
            border: "1px solid var(--accent-border)",
            fontSize: 13, color: "var(--muted)",
          }}>
            <span style={{ color: "#c9b6ff", fontWeight: 700 }}>🏆 {teamsInPlayoff} teams qualify</span>
            {topSeedsWithBye > 0 && (
              <>
                <span style={{ color: "#334155" }}>·</span>
                <span>Top {topSeedsWithBye} seeds receive a first-round bye</span>
              </>
            )}
            {totalWeeks > 0 && (
              <>
                <span style={{ color: "#334155" }}>·</span>
                <span style={{ color: weeksRemaining === 0 ? "#34d399" : "#94a3b8" }}>
                  {weeksRemaining === 0 ? "Season complete" : `${weeksRemaining} week${weeksRemaining !== 1 ? "s" : ""} remaining`}
                </span>
              </>
            )}
          </div>

          {/* Leaderboard */}
          <section style={card}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {standings.map((s, i) => {
                const inZone = s.isPlayoffEligible;
                const hasBye = s.seed !== null && s.seed <= topSeedsWithBye;
                const raceInfo = race?.get(s.fantasyTeamId) ?? null;
                const isMe = myTeam && s.fantasyTeamId === myTeam.id;
                const isLastIn = playoffCutoff !== null && i === playoffCutoff - 1;

                return (
                  <div key={s.fantasyTeamId}>
                    <div style={{
                      padding: "11px 16px",
                      display: "flex", alignItems: "center", gap: 10,
                      background: isMe ? "var(--accent-dim)" : "transparent",
                      borderLeft: isMe ? "3px solid var(--accent)" : inZone ? "3px solid rgba(95,169,140,0.25)" : "3px solid transparent",
                    }}>
                      {/* Rank */}
                      <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: inZone ? "var(--faint)" : "var(--dim)", textAlign: "right", flexShrink: 0 }}>
                        {i + 1}
                      </span>

                      {/* Team name */}
                      <span style={{
                        flex: 1, fontSize: 14,
                        fontWeight: isMe ? 700 : 500,
                        color: inZone ? "var(--text)" : "var(--faint)",
                      }}>
                        {s.teamName}
                      </span>

                      {/* Bye badge */}
                      {hasBye && (
                        <span className="chip-in" style={{ flexShrink: 0 }}>BYE</span>
                      )}

                      {/* Race chip */}
                      {raceInfo && <RaceChip info={raceInfo} />}

                      {/* Record */}
                      <span className="font-stats" style={{
                        fontSize: 13,
                        color: inZone ? "var(--muted)" : "var(--faint)",
                        minWidth: 48, textAlign: "right",
                      }}>
                        {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                      </span>

                      {/* Points for */}
                      <span className="font-stats" style={{
                        fontSize: 13,
                        color: inZone ? "var(--dim)" : "var(--faint)",
                        minWidth: 44, textAlign: "right",
                      }}>
                        {s.pointsFor.toFixed(1)}
                      </span>
                    </div>

                    {/* Playoff line divider after last "in" team */}
                    {isLastIn && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px" }}>
                        <div style={{ flex: 1, height: 2, background: "var(--accent-border)", borderRadius: 1 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#c9b6ff", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                          Playoff line
                        </span>
                        <div style={{ flex: 1, height: 2, background: "var(--accent-border)", borderRadius: 1 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Column headers (bottom, subtle) */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 16px 4px", borderTop: "1px solid rgba(148,163,184,0.08)",
              marginTop: 4,
            }}>
              <span style={{ width: 18, flexShrink: 0 }} />
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--faint)", minWidth: 48, textAlign: "right" }}>W–L</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--faint)", minWidth: 44, textAlign: "right" }}>PF</span>
            </div>
          </section>
        </>
      )}

      {/* ── Playoffs active: Bracket view ────────────────────────────────────── */}
      {hasPlayoffs && bracketResult?.bracket && (
        <section style={card}>
          <PlayoffBracket
            bracket={bracketResult.bracket as Parameters<typeof PlayoffBracket>[0]["bracket"]}
            myTeamId={myTeam?.id}
          />
        </section>
      )}

      {hasPlayoffs && !bracketResult?.bracket && (
        <section style={card}>
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 8 }}>⏳ Bracket is being set up</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Check back shortly.</div>
          </div>
        </section>
      )}

    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
};
