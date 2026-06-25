import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getRoundLabel } from "@/lib/playoffs/brackets";
import { getBracket, PlayoffNotStartedError } from "@/lib/services/playoff-service";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

async function getTeamSeeds(leagueId: string): Promise<Map<string, number>> {
  try {
    const bracket = await getBracket(leagueId, prisma);
    const seedMap = new Map<string, number>();
    for (const seededTeam of bracket.bracket.seededTeams) {
      seedMap.set(seededTeam.fantasyTeamId, seededTeam.seed);
    }
    return seedMap;
  } catch (error) {
    if (error instanceof PlayoffNotStartedError) {
      return new Map();
    }
    throw error;
  }
}

interface Props {
  leagueId: string;
  myTeamId: string | undefined;
}

export default async function ScoreboardPageContent({ leagueId, myTeamId }: Props) {
  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const isVpMode = (league as { scoringMode?: string }).scoringMode === "VP";
  const isVtfMode = isVpMode;

  const nowMs = getReplayNow(league, await getDevNow());

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    orderBy: [{ week: "asc" }, { startsAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const playoffMatchups = matchups.filter((m) => m.isPlayoff);

  const teamSeeds = await getTeamSeeds(leagueId);

  const byWeek = new Map<number, typeof regularMatchups>();
  for (const m of regularMatchups) {
    const arr = byWeek.get(m.week) ?? [];
    arr.push(m);
    byWeek.set(m.week, arr);
  }

  const byRound = new Map<number, typeof playoffMatchups>();
  let totalPlayoffRounds = 0;
  for (const m of playoffMatchups) {
    const round = m.round ?? 1;
    totalPlayoffRounds = Math.max(totalPlayoffRounds, round);
    const arr = byRound.get(round) ?? [];
    arr.push(m);
    byRound.set(round, arr);
  }

  const started = regularMatchups.filter((m) => new Date(m.startsAt).getTime() <= nowMs);
  const currentWeek = started.length > 0
    ? Math.max(...started.map((m) => m.week))
    : regularMatchups.length > 0
    ? Math.min(...regularMatchups.map((m) => m.week))
    : null;

  const firstPlayoffMatchup = playoffMatchups.length > 0 ? playoffMatchups[0] : null;

  const lastRegularMatchup = regularMatchups.length > 0
    ? regularMatchups.reduce((a, b) => (new Date(b.endsAt) > new Date(a.endsAt) ? b : a))
    : null;
  const expectedPlayoffStart = lastRegularMatchup
    ? new Date(new Date(lastRegularMatchup.endsAt).getTime() + 24 * 60 * 60 * 1000)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>Scoreboard</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
          Every team&apos;s score, week by week — ranked highest to lowest. No single opponent: you compete against the whole league each week.
        </p>
      </div>

      {byWeek.size === 0 ? (
        <div style={card}>
          <p style={{ color: "var(--faint)", margin: 0 }}>No matchups scheduled yet.</p>
        </div>
      ) : (
        [...byWeek.entries()].map(([week, weekMatchups]) => {
          const isCurrent = week === currentWeek;
          const period = weekMatchups[0];
          const dateRange = `${fmtDate(new Date(period.startsAt))} – ${fmtDate(new Date(period.endsAt))}`;

          let vtfRanked: Array<{ teamId: string; team: typeof period.homeTeam; score: number | null; wins: number; losses: number; ties: number }> | null = null;
          if (isVtfMode) {
            const teamMap = new Map<string, { teamId: string; team: typeof period.homeTeam; score: number | null; wins: number; losses: number; ties: number }>();

            for (const m of weekMatchups) {
              if (!teamMap.has(m.homeTeamId)) {
                teamMap.set(m.homeTeamId, { teamId: m.homeTeamId, team: m.homeTeam, score: m.homeScore, wins: 0, losses: 0, ties: 0 });
              }
              if (!teamMap.has(m.awayTeamId)) {
                teamMap.set(m.awayTeamId, { teamId: m.awayTeamId, team: m.awayTeam, score: m.awayScore, wins: 0, losses: 0, ties: 0 });
              }
            }

            const scored = weekMatchups.some(m => m.homeScore != null && m.awayScore != null);
            if (scored) {
              for (const m of weekMatchups) {
                if (m.homeScore == null || m.awayScore == null) continue;
                const home = teamMap.get(m.homeTeamId)!;
                const away = teamMap.get(m.awayTeamId)!;
                if (m.homeScore > m.awayScore) {
                  home.wins++;
                  away.losses++;
                } else if (m.homeScore < m.awayScore) {
                  home.losses++;
                  away.wins++;
                } else {
                  home.ties++;
                  away.ties++;
                }
              }
            }

            vtfRanked = [...teamMap.values()].sort((a, b) => {
              if (a.score != null && b.score != null) return b.score - a.score;
              if (a.score != null) return -1;
              if (b.score != null) return 1;
              return a.team.name.localeCompare(b.team.name);
            });
          }

          return (
            <section key={week} style={{
              ...card,
              border: isCurrent
                ? "1px solid rgba(143,193,232,0.3)"
                : "1px solid var(--border)",
              background: isCurrent
                ? "rgba(143,193,232,0.04)"
                : "var(--surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Week {week}</span>
                <span style={{ fontSize: 12, color: "var(--faint)" }}>{dateRange}</span>
                {isVtfMode && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                    background: "rgba(148, 163, 184, 0.2)", color: "var(--muted)",
                  }}>
                    vs Field
                  </span>
                )}
                {isCurrent && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
                  }}>
                    Current
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {isVtfMode && vtfRanked ? (
                  vtfRanked.map((entry, idx) => {
                    const isMyTeam = entry.teamId === myTeamId;
                    const rank = idx + 1;
                    const scoreStr = entry.score != null ? entry.score.toFixed(1) : "—";
                    const recordStr = entry.score != null ? `${entry.wins}-${entry.losses}-${entry.ties}` : "—";

                    return (
                      <div key={entry.teamId} style={{
                        display: "grid",
                        gridTemplateColumns: "auto auto 1fr auto auto",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: isMyTeam ? "rgba(143,193,232,0.06)" : "var(--bg-raised)",
                        border: isMyTeam ? "1px solid rgba(143,193,232,0.2)" : "1px solid var(--border)",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", minWidth: 24 }}>
                          {rank}.
                        </div>
                        <div style={{
                          fontSize: 13, fontWeight: isMyTeam ? 700 : 500,
                          color: isMyTeam ? "var(--text)" : "var(--dim)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {entry.team.name}
                        </div>
                        <div />
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums", minWidth: 60, textAlign: "right" }}>
                          {scoreStr}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--faint)", minWidth: 70, textAlign: "right" }}>
                          {recordStr}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  weekMatchups.map((m) => {
                    const scored = m.homeScore !== null && m.awayScore !== null;
                    const homeIsMe = m.homeTeamId === myTeamId;
                    const awayIsMe = m.awayTeamId === myTeamId;
                    const isMyMatchup = homeIsMe || awayIsMe;
                    const homeWon = scored && m.homeScore! > m.awayScore!;
                    const awayWon = scored && m.awayScore! > m.homeScore!;
                    const homeVP = m.homeVP;
                    const awayVP = m.awayVP;

                    return (
                      <div key={m.id} style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        gap: "4px 10px",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: isMyMatchup ? "rgba(143,193,232,0.06)" : "var(--bg-raised)",
                        border: isMyMatchup ? "1px solid rgba(143,193,232,0.2)" : "1px solid var(--border)",
                      }}>
                        <div style={{ textAlign: "right", minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: homeIsMe ? 700 : 500,
                            color: homeIsMe ? "var(--text)" : "var(--dim)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {m.homeTeam.name}
                          </div>
                          {scored && (
                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: 17, fontWeight: 800, color: homeWon ? "var(--text)" : "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                                {m.homeScore!.toFixed(1)}
                              </span>
                              {isVpMode && homeVP != null && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>{homeVP} VP</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textAlign: "center", letterSpacing: "0.5px", minWidth: 36 }}>
                          {scored ? "FINAL" : "VS"}
                        </div>

                        <div style={{ textAlign: "left", minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: awayIsMe ? 700 : 500,
                            color: awayIsMe ? "var(--text)" : "var(--dim)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {m.awayTeam.name}
                          </div>
                          {scored && (
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: 17, fontWeight: 800, color: awayWon ? "var(--text)" : "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                                {m.awayScore!.toFixed(1)}
                              </span>
                              {isVpMode && awayVP != null && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>{awayVP} VP</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })
      )}

      {(playoffMatchups.length > 0 || (league.playoffStatus === "NOT_STARTED" && expectedPlayoffStart)) && (
        <div style={{
          ...card,
          background: "rgba(217, 119, 6, 0.08)",
          border: "2px solid rgba(217, 119, 6, 0.3)",
          padding: "16px 20px",
          marginTop: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fdba74" }}>🏆 Playoffs Begin</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--dim)" }}>
            <div style={{ marginBottom: 6 }}>
              {(() => {
                const dividerDate = firstPlayoffMatchup
                  ? new Date(firstPlayoffMatchup.startsAt)
                  : expectedPlayoffStart!;
                return `${fmtDate(dividerDate)} – ${fmtDate(new Date(dividerDate.getTime() + 7 * 24 * 60 * 60 * 1000))}`;
              })()}
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)" }}>
              Single-elimination · Best seed wins ties
            </div>
          </div>
        </div>
      )}

      {playoffMatchups.length > 0 && (
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px", color: "var(--text)" }}>Playoff Rounds</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: totalPlayoffRounds }, (_, i) => {
              const round = i + 1;
              const roundMatchups = byRound.get(round) ?? [];
              if (roundMatchups.length === 0) return null;
              const roundName = getRoundLabel(round, totalPlayoffRounds);
              const dateRange = roundMatchups.length > 0
                ? `${fmtDate(new Date(roundMatchups[0].startsAt))} – ${fmtDate(new Date(roundMatchups[0].endsAt))}`
                : "";

              return (
                <div key={round}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{roundName}</span>
                      <span style={{ fontSize: 11, color: "var(--faint)" }}>{dateRange}</span>
                    </div>
                    {round === 1 && totalPlayoffRounds > 1 && (
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>
                        Semifinals: (1 vs 4, 2 vs 3)
                      </div>
                    )}
                    {round === 1 && totalPlayoffRounds === 1 && (
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>
                        Championship Match
                      </div>
                    )}
                    {round > 1 && round === totalPlayoffRounds && (
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>
                        Championship: Winners advance
                      </div>
                    )}
                    {round > 1 && round < totalPlayoffRounds && (
                      <div style={{ fontSize: 11, color: "var(--faint)" }}>
                        Round {round}: Winners advance
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {roundMatchups.map((m) => {
                      const scored = m.homeScore !== null && m.awayScore !== null;
                      const homeWon = scored && m.homeScore! > m.awayScore!;
                      const awayWon = scored && m.awayScore! > m.homeScore!;
                      const isMyMatchup = m.homeTeamId === myTeamId || m.awayTeamId === myTeamId;
                      const homeSeed = teamSeeds.get(m.homeTeamId);
                      const awaySeed = teamSeeds.get(m.awayTeamId);

                      return (
                        <div key={m.id} style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto 1fr",
                          alignItems: "center",
                          gap: "4px 10px",
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: isMyMatchup ? "rgba(143,193,232,0.08)" : "rgba(217, 119, 6, 0.04)",
                          border: isMyMatchup ? "1px solid rgba(143,193,232,0.3)" : "1px solid rgba(217, 119, 6, 0.15)",
                        }}>
                          <div style={{ textAlign: "right", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.homeTeam.name}
                              </div>
                              {homeSeed && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "rgba(217, 119, 6, 0.2)", color: "#fdba74" }}>
                                  {homeSeed}
                                </span>
                              )}
                            </div>
                            {scored && (
                              <div style={{ fontSize: 17, fontWeight: 800, color: homeWon ? "var(--text)" : "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                                {m.homeScore!.toFixed(1)}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "center", minWidth: 44 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.5px" }}>
                              {scored ? "FINAL" : "VS"}
                            </div>
                          </div>
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              {awaySeed && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "rgba(217, 119, 6, 0.2)", color: "#fdba74" }}>
                                  {awaySeed}
                                </span>
                              )}
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.awayTeam.name}
                              </div>
                            </div>
                            {scored && (
                              <div style={{ fontSize: 17, fontWeight: 800, color: awayWon ? "var(--text)" : "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                                {m.awayScore!.toFixed(1)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 20,
};
