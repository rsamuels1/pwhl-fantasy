import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getStandings } from "@/lib/services/standings-service";
import { getBracket, PlayoffNotStartedError } from "@/lib/services/playoff-service";
import PlayoffBracket from "@/components/PlayoffBracket";
import type { Matchup } from "@prisma/client";

interface RaceInfo {
  status: "clinched" | "eliminated" | "in" | "bubble" | "out";
  gamesBack: number | null;
  cushion: number | null;
}

function computeRace(
  standings: { fantasyTeamId: string; points: number }[],
  matchups: Matchup[],
  cutoff: number
): Map<string, RaceInfo> {
  const map = new Map<string, RaceInfo>();
  if (standings.length === 0 || cutoff <= 0 || cutoff >= standings.length) {
    standings.forEach((s) =>
      map.set(s.fantasyTeamId, { status: "in", gamesBack: null, cushion: null })
    );
    return map;
  }

  const totalWeeks = matchups
    .filter((m) => !m.isPlayoff)
    .reduce((max, m) => Math.max(max, m.week), 0);

  const remainingFor = (teamId: string) => {
    const played = matchups.filter(
      (m) => !m.isPlayoff && m.homeScore !== null &&
        (m.homeTeamId === teamId || m.awayTeamId === teamId)
    ).length;
    return Math.max(0, totalWeeks - played);
  };

  const lineTeam = standings[cutoff - 1];
  const bubbleTeam = standings[cutoff];

  standings.forEach((s, i) => {
    const rank = i + 1;
    const inSpot = rank <= cutoff;
    const maxPoints = s.points + remainingFor(s.fantasyTeamId);

    let status: RaceInfo["status"];
    if (inSpot) {
      const bubbleCeiling = bubbleTeam.points + remainingFor(bubbleTeam.fantasyTeamId);
      status = bubbleCeiling < s.points ? "clinched" : rank === cutoff ? "bubble" : "in";
    } else {
      status = maxPoints < lineTeam.points ? "eliminated" : "out";
    }

    map.set(s.fantasyTeamId, {
      status,
      gamesBack: inSpot ? null : Math.round((lineTeam.points - s.points) * 10) / 10,
      cushion: inSpot ? Math.round((s.points - bubbleTeam.points) * 10) / 10 : null,
    });
  });

  return map;
}

function RaceChip({ info }: { info: RaceInfo }) {
  if (info.status === "clinched") {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(52,211,153,0.15)", color: "#34d399", flexShrink: 0 }}>
        ✓ CLINCHED
      </span>
    );
  }
  if (info.status === "eliminated") {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(248,113,113,0.12)", color: "#f87171", flexShrink: 0 }}>
        ✗ ELIM
      </span>
    );
  }
  if (info.status === "bubble") {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: "#f59e0b", flexShrink: 0 }}>
        BUBBLE
      </span>
    );
  }
  return null;
}

export default async function PlayoffsPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const { leagueId } = params;
  const user = await requireAuth(`/league/${leagueId}/bracket`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

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
  const teamsInPlayoff = ps.teamsInPlayoff ?? 6;
  const topSeedsWithBye = ps.topSeedsWithBye ?? 2;

  // Season progress stats for the race banner
  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const totalWeeks = regularMatchups.reduce((max, m) => Math.max(max, m.week), 0);
  const scoredWeeks = new Set(regularMatchups.filter((m) => m.homeScore !== null).map((m) => m.week)).size;
  const weeksRemaining = Math.max(0, totalWeeks - scoredWeeks);

  const hasResults = regularMatchups.some((m) => m.homeScore !== null);
  const race =
    playoffCutoff !== null && hasResults && !hasPlayoffs
      ? computeRace(standings, matchups, playoffCutoff)
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
            background: "rgba(99,102,241,0.07)",
            border: "1px solid rgba(99,102,241,0.2)",
            fontSize: 13, color: "#94a3b8",
          }}>
            <span style={{ color: "#a5b4fc", fontWeight: 700 }}>🏆 {teamsInPlayoff} teams qualify</span>
            <span style={{ color: "#334155" }}>·</span>
            <span>Top {topSeedsWithBye} seeds receive a first-round bye</span>
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
                const isMe = s.fantasyTeamId === myTeam.id;
                const isLastIn = playoffCutoff !== null && i === playoffCutoff - 1;

                return (
                  <div key={s.fantasyTeamId}>
                    <div style={{
                      padding: "11px 16px",
                      display: "flex", alignItems: "center", gap: 10,
                      background: isMe ? "rgba(99,102,241,0.08)" : "transparent",
                      borderLeft: isMe ? "3px solid #6366f1" : inZone ? "3px solid rgba(52,211,153,0.25)" : "3px solid transparent",
                    }}>
                      {/* Rank */}
                      <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: inZone ? "#64748b" : "#334155", textAlign: "right", flexShrink: 0 }}>
                        {i + 1}
                      </span>

                      {/* Team name */}
                      <span style={{
                        flex: 1, fontSize: 14,
                        fontWeight: isMe ? 700 : 500,
                        color: inZone ? "#e2e8f0" : "#64748b",
                      }}>
                        {s.teamName}
                      </span>

                      {/* Bye badge */}
                      {hasBye && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                          background: "rgba(99,102,241,0.15)", color: "#818cf8", flexShrink: 0,
                        }}>
                          BYE
                        </span>
                      )}

                      {/* Race chip */}
                      {raceInfo && <RaceChip info={raceInfo} />}

                      {/* Record */}
                      <span style={{
                        fontSize: 13, fontVariantNumeric: "tabular-nums",
                        color: inZone ? "#94a3b8" : "#475569",
                        minWidth: 48, textAlign: "right",
                      }}>
                        {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                      </span>

                      {/* Points for */}
                      <span style={{
                        fontSize: 13, fontVariantNumeric: "tabular-nums",
                        color: inZone ? "#64748b" : "#334155",
                        minWidth: 44, textAlign: "right",
                      }}>
                        {s.pointsFor.toFixed(1)}
                      </span>
                    </div>

                    {/* Playoff line divider after last "in" team */}
                    {isLastIn && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px" }}>
                        <div style={{ flex: 1, height: 2, background: "rgba(99,102,241,0.3)", borderRadius: 1 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
                          Playoff line
                        </span>
                        <div style={{ flex: 1, height: 2, background: "rgba(99,102,241,0.3)", borderRadius: 1 }} />
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
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#334155", minWidth: 48, textAlign: "right" }}>W–L</span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#334155", minWidth: 44, textAlign: "right" }}>PF</span>
            </div>
          </section>
        </>
      )}

      {/* ── Playoffs active: Bracket view ────────────────────────────────────── */}
      {hasPlayoffs && bracketResult?.bracket && (
        <section style={card}>
          <PlayoffBracket
            bracket={bracketResult.bracket as Parameters<typeof PlayoffBracket>[0]["bracket"]}
            myTeamId={myTeam.id}
          />
        </section>
      )}

      {hasPlayoffs && !bracketResult?.bracket && (
        <p style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>
          Bracket is being generated.
        </p>
      )}

    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  overflow: "hidden",
};
