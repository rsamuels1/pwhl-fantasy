import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/services/standings-service";
import { getBracket, PlayoffNotStartedError } from "@/lib/services/playoff-service";
import { computeRace, type RaceInfo } from "@/lib/playoffs/seeding";
import PlayoffBracket from "@/components/PlayoffBracket";
import type { Matchup } from "@prisma/client";

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
};

function RaceChip({ info }: { info: RaceInfo }) {
  if (info.status === "clinched") {
    return <span className="chip-clinched" style={{ flexShrink: 0 }}>✓ CLINCHED</span>;
  }
  if (info.status === "eliminated") {
    return <span className="chip-eliminated" style={{ flexShrink: 0 }}>✗ ELIM</span>;
  }
  if (info.status === "bubble") {
    return <span className="chip-bubble" style={{ flexShrink: 0 }}>◉ BUBBLE</span>;
  }
  return null;
}

interface Props {
  leagueId: string;
  myTeamId: string | undefined;
  userId?: string;
}

export default async function BracketPageContent({ leagueId, myTeamId, userId }: Props) {
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, playoffStatus: true, playoffSettings: true, commissionerId: true },
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

  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const totalWeeks = regularMatchups.reduce((max, m) => Math.max(max, m.week), 0);
  const scoredWeeks = new Set(regularMatchups.filter((m) => m.homeScore !== null).map((m) => m.week)).size;
  const weeksRemaining = Math.max(0, totalWeeks - scoredWeeks);

  const hasResults = regularMatchups.some((m) => m.homeScore !== null);
  const race =
    playoffCutoff !== null && hasResults && !hasPlayoffs
      ? computeRace(standings.map(s => ({ ...s, points: s.totalVP })), matchups, playoffCutoff, 4)
      : null;

  const isCommissioner = !!(userId && league.commissionerId === userId);

  // Round context for IN_PROGRESS playoffs
  const currentRound = bracketResult?.bracket?.currentRound ?? null;
  const totalRounds = bracketResult?.bracket?.rounds?.length ?? null;

  function playoffRoundLabel(round: number, total: number): string {
    if (round === total) return "Final";
    if (total - round === 1) return "Semifinals";
    if (total - round === 2) return "Quarterfinals";
    return `Round ${round}`;
  }

  const currentRoundLabel = currentRound !== null && totalRounds !== null
    ? playoffRoundLabel(currentRound, totalRounds)
    : null;

  // Is the current round fully scored? (all populated matchups in this round have scores)
  const currentRoundMatchups = currentRound !== null && bracketResult?.bracket
    ? bracketResult.bracket.rounds[currentRound - 1] ?? []
    : [];
  const currentRoundComplete = currentRoundMatchups.length > 0 &&
    currentRoundMatchups.every((m) => m.homeScore != null && m.awayScore != null);

  const statusLabel =
    league.playoffStatus === "COMPLETE" ? "Complete" :
    hasPlayoffs ? "In Progress" : "Regular Season";

  const statusColor = hasPlayoffs
    ? (league.playoffStatus === "COMPLETE" ? "#5fa98c" : "var(--accent-strong)")
    : "var(--dim)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Playoffs</h1>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "var(--border)", color: statusColor }}>
          {statusLabel}
        </span>
        {league.playoffStatus === "IN_PROGRESS" && currentRoundLabel && (
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(143,193,232,0.12)", color: "var(--accent-strong)", border: "1px solid rgba(143,193,232,0.25)" }}>
            {currentRoundComplete ? `${currentRoundLabel} — complete` : currentRoundLabel}
          </span>
        )}
      </div>

      {/* Commissioner: advance-round prompt when current round is fully scored */}
      {isCommissioner && league.playoffStatus === "IN_PROGRESS" && currentRoundComplete && (
        <div style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.10), rgba(212,175,55,0.04))",
          border: "1px solid rgba(212,175,55,0.30)",
          borderLeft: "3px solid var(--gold)",
          borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{currentRoundLabel} is complete</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>All matchups are scored. Advance the bracket to set up the next round.</div>
          </div>
          <a href={`/league/${leagueId}/season`} style={{
            fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, flexShrink: 0,
            background: "rgba(212,175,55,0.18)", color: "var(--gold)",
            border: "1px solid rgba(212,175,55,0.35)", textDecoration: "none",
          }}>
            Advance bracket →
          </a>
        </div>
      )}

      {league.playoffStatus === "IN_PROGRESS" && (
        <div style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(143,193,232,0.08)", border: "1px solid rgba(143,193,232,0.22)", fontSize: 14, color: "#c7d2e0", lineHeight: 1.6 }}>
          {currentRoundLabel === "Final"
            ? <><strong style={{ color: "var(--accent-strong)" }}>This is the Final.</strong>{" "}One matchup decides the champion. Highest score wins.</>
            : <><strong style={{ color: "var(--accent-strong)" }}>{currentRoundLabel || "Playoffs are here!"}.</strong>{" "}Head-to-head — one team advances per matchup. Highest score wins.</>
          }
        </div>
      )}

      {!hasPlayoffs && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "var(--accent-dim)", border: "1px solid var(--accent-border)", fontSize: 13, color: "var(--muted)" }}>
            <span style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{teamsInPlayoff} teams qualify</span>
            {topSeedsWithBye > 0 && (
              <>
                <span style={{ color: "#334155" }}>·</span>
                <span>Top {topSeedsWithBye} seeds receive a first-round bye</span>
              </>
            )}
            {totalWeeks > 0 && (
              <>
                <span style={{ color: "#334155" }}>·</span>
                <span style={{ color: weeksRemaining === 0 ? "#5fa98c" : "var(--dim)" }}>
                  {weeksRemaining === 0 ? "Season complete" : `${weeksRemaining} week${weeksRemaining !== 1 ? "s" : ""} remaining`}
                </span>
              </>
            )}
          </div>

          <section style={card}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 4px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--faint)", minWidth: 48, textAlign: "right" }}>W–L</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--faint)", minWidth: 44, textAlign: "right" }}>PF</span>
              </div>

              {standings.map((s, i) => {
                const inZone = s.isPlayoffEligible;
                const hasBye = s.seed !== null && s.seed <= topSeedsWithBye;
                const raceInfo = race?.get(s.fantasyTeamId) ?? null;
                const isMe = myTeamId && s.fantasyTeamId === myTeamId;
                const isLastIn = playoffCutoff !== null && i === playoffCutoff - 1;

                return (
                  <div key={s.fantasyTeamId}>
                    <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, background: isMe ? "var(--accent-dim)" : "transparent", borderLeft: isMe ? "3px solid var(--accent)" : inZone ? "3px solid rgba(95,169,140,0.25)" : "3px solid transparent" }}>
                      <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: inZone ? "var(--faint)" : "var(--dim)", textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: inZone ? "var(--text)" : "var(--faint)" }}>{s.teamName}</span>
                      {hasBye && <span className="chip-in" style={{ flexShrink: 0 }}>BYE</span>}
                      {raceInfo && <RaceChip info={raceInfo} />}
                      <span className="font-stats" style={{ fontSize: 13, color: inZone ? "var(--muted)" : "var(--faint)", minWidth: 48, textAlign: "right" }}>
                        {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                      </span>
                      <span className="font-stats" style={{ fontSize: 13, color: inZone ? "var(--dim)" : "var(--faint)", minWidth: 44, textAlign: "right" }}>
                        {s.pointsFor.toFixed(1)}
                      </span>
                    </div>
                    {isLastIn && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px" }}>
                        <div style={{ flex: 1, height: 2, background: "var(--accent-border)", borderRadius: 1 }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-strong)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Playoff line</span>
                        <div style={{ flex: 1, height: 2, background: "var(--accent-border)", borderRadius: 1 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {hasPlayoffs && bracketResult?.bracket && (
        <section style={card}>
          <PlayoffBracket
            bracket={bracketResult.bracket as Parameters<typeof PlayoffBracket>[0]["bracket"]}
            myTeamId={myTeamId}
          />
        </section>
      )}

      {hasPlayoffs && !bracketResult?.bracket && (
        <section style={card}>
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--dim)", marginBottom: 8 }}>⏳ Bracket is being set up</div>
            <div style={{ fontSize: 12, color: "var(--faint)" }}>Check back shortly.</div>
          </div>
        </section>
      )}
    </div>
  );
}
