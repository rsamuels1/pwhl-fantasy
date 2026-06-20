import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getRoundLabel } from "@/lib/playoffs/brackets";
import { calculatePlayoffRounds } from "@/lib/playoffs/lifecycle";
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

export default async function MatchupsPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/matchups`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const isVpMode = (league as { scoringMode?: string }).scoringMode === "VP";

  const nowMs = getReplayNow(league, await getDevNow());

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    orderBy: [{ week: "asc" }, { startsAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  const regularMatchups = matchups.filter((m) => !m.isPlayoff);
  const playoffMatchups = matchups.filter((m) => m.isPlayoff);

  // Fetch playoff seeds
  const teamSeeds = await getTeamSeeds(leagueId);

  // Group regular season by week
  const byWeek = new Map<number, typeof regularMatchups>();
  for (const m of regularMatchups) {
    const arr = byWeek.get(m.week) ?? [];
    arr.push(m);
    byWeek.set(m.week, arr);
  }

  // Group playoff by round
  const byRound = new Map<number, typeof playoffMatchups>();
  let totalPlayoffRounds = 0;
  for (const m of playoffMatchups) {
    const round = m.round ?? 1;
    totalPlayoffRounds = Math.max(totalPlayoffRounds, round);
    const arr = byRound.get(round) ?? [];
    arr.push(m);
    byRound.set(round, arr);
  }

  // Find "current" week using sim date
  const started = regularMatchups.filter((m) => new Date(m.startsAt).getTime() <= nowMs);
  const currentWeek = started.length > 0
    ? Math.max(...started.map((m) => m.week))
    : regularMatchups.length > 0
    ? Math.min(...regularMatchups.map((m) => m.week))
    : null;

  // Find the first playoff matchup info for the divider
  const firstPlayoffMatchup = playoffMatchups.length > 0 ? playoffMatchups[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      <h1 style={{ fontSize: 24, margin: 0 }}>Schedule</h1>

      {/* Regular season */}
      {byWeek.size === 0 ? (
        <div style={card}>
          <p style={{ color: "#64748b", margin: 0 }}>No matchups scheduled yet.</p>
        </div>
      ) : (
        [...byWeek.entries()].map(([week, weekMatchups]) => {
          const isCurrent = week === currentWeek;
          const period = weekMatchups[0];
          const dateRange = `${fmtDate(new Date(period.startsAt))} – ${fmtDate(new Date(period.endsAt))}`;

          return (
            <section key={week} style={{
              ...card,
              border: isCurrent
                ? "1px solid rgba(99,102,241,0.3)"
                : "1px solid rgba(148,163,184,0.14)",
              background: isCurrent
                ? "rgba(99,102,241,0.04)"
                : "rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Week {week}</span>
                <span style={{ fontSize: 12, color: "#475569" }}>{dateRange}</span>
                {isCurrent && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                  }}>
                    Current
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {weekMatchups.map((m) => {
                  const scored = m.homeScore !== null && m.awayScore !== null;
                  const homeIsMe = m.homeTeamId === myTeam.id;
                  const awayIsMe = m.awayTeamId === myTeam.id;
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
                      background: isMyMatchup ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.02)",
                      border: isMyMatchup ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(148,163,184,0.06)",
                    }}>
                      {/* Home */}
                      <div style={{ textAlign: "right", minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: homeIsMe ? 700 : 500,
                          color: homeIsMe ? "#e2e8f0" : "#94a3b8",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {m.homeTeam.name}
                        </div>
                        {scored && (
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: 17, fontWeight: 800, color: homeWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                              {m.homeScore!.toFixed(1)}
                            </span>
                            {isVpMode && homeVP != null && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>{homeVP} VP</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Middle */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", textAlign: "center", letterSpacing: "0.5px", minWidth: 36 }}>
                        {scored ? "FINAL" : "VS"}
                      </div>

                      {/* Away */}
                      <div style={{ textAlign: "left", minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: awayIsMe ? 700 : 500,
                          color: awayIsMe ? "#e2e8f0" : "#94a3b8",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {m.awayTeam.name}
                        </div>
                        {scored && (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                            <span style={{ fontSize: 17, fontWeight: 800, color: awayWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
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
                })}
              </div>
            </section>
          );
        })
      )}

      {/* Playoff start divider */}
      {playoffMatchups.length > 0 && firstPlayoffMatchup && (
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
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            <div style={{ marginBottom: 6 }}>
              {fmtDate(new Date(firstPlayoffMatchup.startsAt))} – {fmtDate(new Date(firstPlayoffMatchup.endsAt))}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Single-elimination · Best seed wins ties
            </div>
          </div>
        </div>
      )}

      {/* Playoffs */}
      {playoffMatchups.length > 0 && (
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px", color: "#e2e8f0" }}>Playoff Rounds</h2>
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
                  {/* Round header with seed matchup info */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{roundName}</span>
                      <span style={{ fontSize: 11, color: "#475569" }}>{dateRange}</span>
                    </div>
                    {round === 1 && totalPlayoffRounds > 1 && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Semifinals: (1 vs 4, 2 vs 3)
                      </div>
                    )}
                    {round === 1 && totalPlayoffRounds === 1 && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Championship Match
                      </div>
                    )}
                    {round > 1 && round === totalPlayoffRounds && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Championship: Winners advance
                      </div>
                    )}
                    {round > 1 && round < totalPlayoffRounds && (
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        Round {round}: Winners advance
                      </div>
                    )}
                  </div>
                  {/* Matchups in this round */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {roundMatchups.map((m) => {
                      const scored = m.homeScore !== null && m.awayScore !== null;
                      const homeWon = scored && m.homeScore! > m.awayScore!;
                      const awayWon = scored && m.awayScore! > m.homeScore!;
                      const isMyMatchup = m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id;
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
                          background: isMyMatchup ? "rgba(99,102,241,0.08)" : "rgba(217, 119, 6, 0.04)",
                          border: isMyMatchup ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(217, 119, 6, 0.15)",
                        }}>
                          <div style={{ textAlign: "right", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.homeTeam.name}
                              </div>
                              {homeSeed && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "rgba(217, 119, 6, 0.2)", color: "#fdba74" }}>
                                  {homeSeed}
                                </span>
                              )}
                            </div>
                            {scored && (
                              <div style={{ fontSize: 17, fontWeight: 800, color: homeWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                                {m.homeScore!.toFixed(1)}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: "center", minWidth: 44 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: "0.5px" }}>
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
                              <div style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m.awayTeam.name}
                              </div>
                            </div>
                            {scored && (
                              <div style={{ fontSize: 17, fontWeight: 800, color: awayWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
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
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};
