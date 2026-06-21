import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner, isFounder } from "@/lib/auth";
import { getDashboardData, type ActiveMatchup, type PlayerMatchupRow, type WeeklyRecap, type LeaguePerformerRow, type ChampionInfo } from "@/lib/services/dashboard";
import InlineLineupEditor, { type LineupPlayer } from "./InlineLineupEditor";
import LiveScoreRefresh from "@/components/LiveScoreRefresh";
import { LogoShield } from "@/components/LogoShield";
import { getSwingPlayers } from "@/lib/matchups/swingPlayers";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getRival } from "@/lib/playoffs/seeding";
import { RivalBadge } from "@/components/RivalBadge";
import { HeadToHeadHistory } from "@/components/HeadToHeadHistory";

export default async function TeamMatchupPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/matchup`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, rosterSettings: true, isReplay: true, replayCurrentDate: true },
  });
  if (!league) notFound();

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const rs = (league.rosterSettings as Record<string, number>) ?? {};
  const activeSlotCount = (rs.forward ?? 3) + (rs.defense ?? 2) + (rs.goalie ?? 1) + (rs.util ?? 1);
  const nowMs = getReplayNow(league, await getDevNow());
  const dashboard = await getDashboardData(leagueId, teamId, nowMs, prisma);

  const { activeMatchup, remainingPlayers, topPerformers, disappointments, lineupAlerts, lastResult, leagueActivity, leagueTopPerformers, leagueDisappointments, eliminationInfo, championInfo, playoffPending, myPlayersLastWeek, lastWeekLabel } = dashboard;

  // Fetch teams and matchups for rival badge
  const [allTeams, allMatchups] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true },
    }),
    prisma.matchup.findMany({
      where: { leagueId },
    }),
  ]);
  const rival = getRival(teamId, allTeams, allMatchups);

  // Swing players are a 1v1 concept — only meaningful in playoff (single-opponent) matchups.
  let swingPlayers: Awaited<ReturnType<typeof getSwingPlayers>> = [];
  if (activeMatchup?.status === "active" && activeMatchup.opponentTeam) {
    swingPlayers = await getSwingPlayers(
      teamId,
      activeMatchup.opponentTeam.id,
      activeMatchup.period,
      scoringSettings,
      prisma
    );
  }

  // Bench players for inline editor (upcoming matchups only)
  let benchPlayers: LineupPlayer[] = [];
  if (activeMatchup?.status === "upcoming") {
    const period = activeMatchup.period;
    const benchEntries = await prisma.rosterEntry.findMany({
      where: { fantasyTeamId: teamId, slot: "BENCH" },
      include: { player: { select: { id: true, firstName: true, lastName: true, position: true, team: { select: { id: true, abbreviation: true } } } } },
    });
    const benchTeamIds = [...new Set(benchEntries.map((e) => e.player.team?.id).filter((id): id is string => !!id))];
    // No status filter — historical fixture has all games as FINAL.
    // For upcoming periods, startsAt >= period.startsAt proves games haven't been played.
    const nowForBench = new Date(nowMs);
    const benchGames = benchTeamIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gte: nowForBench, lt: period.endsAt },
            OR: [{ homeTeamId: { in: benchTeamIds } }, { awayTeamId: { in: benchTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : [];
    const benchGamesPerTeam = new Map<string, number>();
    for (const g of benchGames) {
      benchGamesPerTeam.set(g.homeTeamId, (benchGamesPerTeam.get(g.homeTeamId) ?? 0) + 1);
      benchGamesPerTeam.set(g.awayTeamId, (benchGamesPerTeam.get(g.awayTeamId) ?? 0) + 1);
    }
    benchPlayers = benchEntries.map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      slot: "BENCH",
      teamAbbr: e.player.team?.abbreviation ?? null,
      gamesThisPeriod: e.player.team?.id ? (benchGamesPerTeam.get(e.player.team.id) ?? 0) : null,
    }));
  }

  const isChampion = championInfo && championInfo.teamId === teamId;

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── 0. Champion card — top of page when playoffs complete and I won ── */}
      {isChampion && championInfo && (
        <div style={{
          background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))",
          border: "2px solid rgba(251,191,36,0.4)",
          borderRadius: 20, padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>🏆</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24", lineHeight: 1.1 }}>
                Champions!
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                {championInfo.teamName} won the championship
              </div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
            background: "rgba(251,191,36,0.06)", borderRadius: 12,
            border: "1px solid rgba(251,191,36,0.15)",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                {championInfo.teamName}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>
                {championInfo.myScore.toFixed(1)}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}>vs</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                {championInfo.opponentTeamName}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                {championInfo.opponentScore.toFixed(1)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#78716c" }}>
            Congratulations on a great season. See you next year!
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            display: "inline-block", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(251,191,36,0.15)", color: "#fbbf24",
            border: "1px solid rgba(251,191,36,0.3)", textDecoration: "none", alignSelf: "flex-start",
          }}>
            View bracket →
          </Link>
        </div>
      )}

      {/* ── 1. Lineup alerts — top of page, always visible when present ── */}
      {lineupAlerts.length > 0 && (
        <div style={{
          background: "rgba(214,169,78,0.08)",
          border: "1px solid rgba(214,169,78,0.30)",
          borderRadius: 14, padding: "18px 20px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "rgba(214,169,78,0.16)", border: "1px solid rgba(214,169,78,0.40)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>⚠️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Lineup action needed
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                {lineupAlerts.length === 1 ? "This player has" : "These players have"} no games remaining this period
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {lineupAlerts.map((a) => (
                  <span key={a.playerId} style={{
                    fontSize: 12, fontWeight: 600, color: "#e3c989",
                    background: "rgba(214,169,78,0.12)", border: "1px solid rgba(214,169,78,0.28)",
                    borderRadius: 7, padding: "6px 11px",
                  }}>{a.name}</span>
                ))}
              </div>
            </div>
          </div>
          <Link href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(214,169,78,0.15)", color: "#e3c989",
            border: "1px solid rgba(214,169,78,0.30)", textDecoration: "none", flexShrink: 0,
          }}>
            Fix lineup →
          </Link>
        </div>
      )}

      {/* ── 1a. Between-weeks lineup nudge ── */}
      {activeMatchup?.status === "upcoming" && (activeMatchup.myPlayers.length < activeSlotCount) && (
        <div style={{
          background: "rgba(214,169,78,0.08)",
          border: "1px solid rgba(214,169,78,0.30)",
          borderRadius: 14, padding: "18px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {activeMatchup.isPlayoff && activeMatchup.roundLabel
                ? `${activeMatchup.roundLabel} is coming up`
                : `Week ${activeMatchup.week} is coming up`}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
              Set your lineup before games begin — check projected scores on the lineup page.
            </div>
          </div>
          <Link href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(214,169,78,0.15)", color: "#e3c989",
            border: "1px solid rgba(214,169,78,0.30)", textDecoration: "none", flexShrink: 0,
          }}>
            Set lineup →
          </Link>
        </div>
      )}

      {/* ── 2. Matchup hero ── */}
      {activeMatchup ? (
        <MatchupHero matchup={activeMatchup} teamId={teamId} leagueId={leagueId} />
      ) : eliminationInfo ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🏁</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                You were eliminated in the {eliminationInfo.roundLabel}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                You made a great playoff run. Better luck next season!
              </div>
            </div>
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(99,102,241,0.15)", color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.3)", textDecoration: "none",
          }}>
            View bracket →
          </Link>
        </Card>
      ) : playoffPending ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                Playoffs are advancing
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                You advanced to the next round! Your next matchup will appear shortly once the commissioner advances the bracket.
              </div>
            </div>
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(99,102,241,0.15)", color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.3)", textDecoration: "none",
          }}>
            View bracket →
          </Link>
        </Card>
      ) : championInfo && !isChampion ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🏆</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                Season complete — {championInfo.teamName} are champions!
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                Great season. See you next year!
              </div>
            </div>
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(99,102,241,0.15)", color: "#818cf8",
            border: "1px solid rgba(99,102,241,0.3)", textDecoration: "none",
          }}>
            View bracket →
          </Link>
        </Card>
      ) : (
        <Card>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
            No scoring period is active or upcoming. Check back when the season is underway.
          </p>
        </Card>
      )}

      {/* ── Z3. Live situation grid: Playing Tonight + Swing (left) | Roster Status (right) ── */}
      {activeMatchup?.status === "active" && (
        <div className="matchup-2col" style={{ alignItems: "start" }}>
          {/* Left: Playing Tonight + Swing Players */}
          <div style={{ display: "grid", gap: 12 }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="section-accent" />
                  <h2 style={sectionHead}>Playing tonight</h2>
                </div>
                {remainingPlayers.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>
                    {remainingPlayers.reduce((s, p) => s + p.projectedPoints, 0).toFixed(1)} pts projected
                  </span>
                )}
              </div>
              {remainingPlayers.length === 0 ? (
                <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>
                  No starters playing tonight — check the schedule for upcoming games.
                </p>
              ) : (() => {
                const byGame = new Map<string, typeof remainingPlayers>();
                for (const p of remainingPlayers) {
                  const key = `${p.homeTeamAbbr}@${p.awayTeamAbbr}`;
                  if (!byGame.has(key)) byGame.set(key, []);
                  byGame.get(key)!.push(p);
                }
                return (
                  <div style={{ display: "grid", gap: 12 }}>
                    {[...byGame.entries()].map(([gameKey, players]) => {
                      const rep = players[0];
                      const slotLabel = (slot: string) =>
                        slot === "FORWARD" ? "F" : slot === "DEFENSE" ? "D" : slot === "GOALIE" ? "G" : slot === "UTIL" ? "UTIL" : "BN";
                      return (
                        <div key={gameKey}>
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            marginBottom: 6, padding: "4px 0",
                            borderBottom: "1px solid var(--border)",
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em" }}>
                              {rep.homeTeamAbbr} @ {rep.awayTeamAbbr}
                            </span>
                            <span className="font-stats" style={{ fontSize: 11, color: "var(--muted)", background: "rgba(150,160,200,0.08)", padding: "2px 7px", borderRadius: 7 }}>
                              {formatTime(rep.gameStartsAt)}
                            </span>
                          </div>
                          <div style={{ display: "grid", gap: 4 }}>
                            {players.map((p) => (
                              <div key={p.playerId} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px", borderRadius: 8,
                                background: "rgba(150,160,200,0.04)",
                                borderLeft: "3px solid var(--accent-deep)",
                              }}>
                                <div>
                                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{p.name}</span>
                                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--dim)" }}>
                                    {p.position[0]} · {slotLabel(p.slot)}
                                  </span>
                                </div>
                                <span className="font-stats" style={{ fontSize: 12, color: "#c9b6ff", fontWeight: 600 }}>
                                  {p.projectedPoints.toFixed(1)} proj
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>

            {swingPlayers.length > 0 && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span className="section-accent" />
                  <h2 style={sectionHead}>Swing players</h2>
                  <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 4 }}>players who could flip the result</span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {swingPlayers.map((p) => (
                    <div key={p.playerId} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 8, padding: "13px 15px", borderRadius: 10,
                      background: "rgba(150,160,200,0.04)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: p.team === "mine" ? "#c9b6ff" : "var(--dim)" }}>
                          {p.team === "mine" ? "Your player" : "Opponent"}
                        </span>
                      </div>
                      <span className="font-stats" style={{ fontSize: 19, fontWeight: 700, flexShrink: 0, color: p.team === "mine" ? "#5fa98c" : "#c2776c" }}>
                        {p.projectedImpact > 0 ? "+" : ""}{p.projectedImpact.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Roster Status widget */}
          <RosterStatusWidget matchup={activeMatchup} activeSlotCount={activeSlotCount} teamId={teamId} />
        </div>
      )}

      {/* ── Z3b. Roster Status widget (upcoming state, full width) ── */}
      {activeMatchup?.status === "upcoming" && (
        <RosterStatusWidget matchup={activeMatchup} activeSlotCount={activeSlotCount} teamId={teamId} />
      )}

      {/* ── Z4. Rival badge and H2H history ── */}
      {rival && (
        <Card>
          <RivalBadge rival={rival} compact={false} />
          <div style={{ marginTop: 14 }}>
            <HeadToHeadHistory
              myTeamId={teamId}
              opponentTeamId={rival.teamId}
              opponentName={rival.teamName}
              matchups={allMatchups}
              limit={5}
            />
          </div>
        </Card>
      )}

      {/* ── Z5. Last week recap (moved below live situation) ── */}
      {lastResult && <RecapCard recap={lastResult} />}

      {/* ── Z6. Rosters ── */}
      {activeMatchup && (
        <div className="matchup-2col">
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="section-accent" style={{ background: "linear-gradient(180deg, #a78bfa, var(--accent-deep))" }} />
                <h2 style={sectionHead}>{activeMatchup.myTeam.name}</h2>
                {activeMatchup.status === "active" && (
                  <span className="font-stats" style={{ fontSize: 17, color: "#c9b6ff", fontWeight: 700 }}>
                    {activeMatchup.myTeam.score.toFixed(1)}
                  </span>
                )}
              </div>
              <Link href={`/team/${teamId}/lineup`} style={editLink}>
                {activeMatchup.status === "upcoming" ? "Full lineup →" : "Edit lineup →"}
              </Link>
            </div>
            {activeMatchup.status === "upcoming" ? (
              <InlineLineupEditor
                leagueId={leagueId}
                teamId={teamId}
                active={activeMatchup.myPlayers.map((p) => ({ ...p, slot: p.slot }))}
                bench={benchPlayers}
              />
            ) : (
              <RosterTable players={activeMatchup.myPlayers} isMyTeam />
            )}
          </Card>

          {activeMatchup.opponentTeam && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span className="section-accent" style={{ background: "linear-gradient(180deg, #5b6480, #3a4258)" }} />
                <h2 style={sectionHead}>{activeMatchup.opponentTeam.name}</h2>
                {activeMatchup.status === "active" && (
                  <span className="font-stats" style={{ fontSize: 17, color: "var(--muted)", fontWeight: 700 }}>
                    {activeMatchup.opponentTeam.score.toFixed(1)}
                  </span>
                )}
              </div>
              <RosterTable players={activeMatchup.opponentPlayers} />
            </Card>
          )}
        </div>
      )}

      {/* ── Z6b. Last week's stats (SETUP phase fallback) ── */}
      {lastWeekLabel && myPlayersLastWeek && myPlayersLastWeek.length > 0 && (
        <Card>
          <h2 style={{ ...sectionHead, marginBottom: 14 }}>
            {lastWeekLabel} · final
            <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b", marginLeft: 8 }}>
              This week&apos;s stats will appear after simulating
            </span>
          </h2>
          <RosterTable players={myPlayersLastWeek} />
        </Card>
      )}

      {/* ── Z7. Top performers + Underperforming ── */}
      {(topPerformers.length > 0 || disappointments.length > 0) && (
        <>
          {topPerformers[0] && topPerformers[0].points > 0 && (
            <div style={{
              padding: "10px 16px", borderRadius: 10,
              background: "rgba(52,211,153,0.07)",
              border: "1px solid rgba(52,211,153,0.18)",
              fontSize: 13, color: "#6ee7b7",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span>
                <strong style={{ color: "#a7f3d0" }}>{topPerformers[0].name}</strong>
                {" "}is leading your team with{" "}
                <strong style={{ color: "#a7f3d0" }}>{topPerformers[0].points.toFixed(1)} pts</strong>
                {" "}this week
              </span>
            </div>
          )}
          <div className="matchup-2col">
            {topPerformers.length > 0 && (
              <Card>
                <h2 style={{ ...sectionHead, marginBottom: 12 }}>Top performers</h2>
                {topPerformers.map((p) => (
                  <div key={p.playerId} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, color: "#e2e8f0" }}>{p.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] ?? "#94a3b8" }}>{p.position[0]}</span>
                      </div>
                      <span style={{ color: "#34d399", fontWeight: 700, fontSize: 14 }}>{p.points.toFixed(1)}</span>
                    </div>
                    {p.statBreakdown.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                        {p.statBreakdown.map((b) => (
                          <span key={b.label} style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 999,
                            background: b.points >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                            color: b.points >= 0 ? "#34d399" : "#f87171",
                          }}>
                            {b.label}{b.stat > 1 ? ` ×${b.stat}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
            {disappointments.length > 0 && (
              <Card>
                <h2 style={{ ...sectionHead, marginBottom: 12 }}>Underperforming</h2>
                {disappointments.map((p) => (
                  <div key={p.playerId} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, color: "#e2e8f0" }}>{p.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] ?? "#94a3b8" }}>{p.position[0]}</span>
                      </div>
                      <span style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>{p.points.toFixed(1)}</span>
                    </div>
                    {p.statBreakdown.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                        {p.statBreakdown.map((b) => (
                          <span key={b.label} style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 999,
                            background: b.points >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                            color: b.points >= 0 ? "#34d399" : "#f87171",
                          }}>
                            {b.label}{b.stat > 1 ? ` ×${b.stat}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </div>
        </>
      )}

      {/* ── Z8. League leaders this week ── */}
      {activeMatchup?.status === "active" && leagueTopPerformers.length > 0 && (
        <Card>
          <h2 style={{ ...sectionHead, marginBottom: 14 }}>
            League leaders · Week {activeMatchup.week}
          </h2>
          <div className="matchup-2col">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Scoring leaders
              </div>
              {leagueTopPerformers.map((p, i) => (
                <LeaguePerformerItem key={p.playerId} player={p} rank={i + 1} variant="top" />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Underperforming
              </div>
              {leagueDisappointments.map((p, i) => (
                <LeaguePerformerItem key={p.playerId} player={p} rank={i + 1} variant="low" />
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Z9. League activity ── */}
      {leagueActivity.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="section-accent" />
              <h2 style={sectionHead}>League activity</h2>
            </div>
            <Link href={`/league/${leagueId}`} style={{ fontSize: 12, color: "var(--faint)", textDecoration: "none" }}>
              See all →
            </Link>
          </div>
          <div>
            {leagueActivity.map((event) => (
              <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(150,160,200,0.07)", padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "var(--accent-dim)", border: "1px solid rgba(124,58,237,0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontSize: 13 }}>
                    ⚡
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>{event.description}</span>
                </div>
                <span style={{ color: "var(--faint)", flexShrink: 0, fontSize: 11 }}>{formatRelative(event.createdAt, nowMs)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(d);
}

function formatRelative(d: Date, nowMs: number) {
  const diff = nowMs - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16, padding: "18px 20px",
    }}>
      {children}
    </div>
  );
}

function RosterStatusWidget({
  matchup,
  activeSlotCount,
  teamId,
}: {
  matchup: ActiveMatchup;
  activeSlotCount: number;
  teamId: string;
}) {
  const starters = matchup.myPlayers.filter((p) => p.slot !== "BENCH" && p.slot !== "IR");
  const lockedCount = starters.filter((p) => p.gameCount > 0).length;
  const filledCount = starters.length;
  const hasIssues = filledCount < activeSlotCount;
  const isUpcoming = matchup.status === "upcoming";

  const lockLabel = lockedCount > 0
    ? `🔒 ${lockedCount} of ${filledCount} starters locked`
    : isUpcoming
      ? "Lineup not yet locked"
      : "No starters locked yet";

  const lockColor = lockedCount > 0 ? "#94a3b8" : "#475569";

  const statusLabel = hasIssues
    ? `⚠ ${filledCount}/${activeSlotCount} starters set`
    : `✓ ${filledCount}/${activeSlotCount} starters`;
  const statusColor = hasIssues ? "#fbbf24" : "#34d399";

  return (
    <Card>
      <h2 style={{ ...sectionHead, marginBottom: 14 }}>Roster status</h2>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#94a3b8" }}>Lineup</span>
          <span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#94a3b8" }}>Lock state</span>
          <span style={{ fontWeight: 600, color: lockColor, fontSize: 12 }}>{lockLabel}</span>
        </div>
        {matchup.myProjected > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span style={{ color: "#94a3b8" }}>Projected</span>
            <span style={{ fontWeight: 700, color: "#818cf8" }}>{matchup.myProjected.toFixed(1)} FP</span>
          </div>
        )}
        {matchup.opponentTeam && matchup.opponentProjected > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span style={{ color: "#94a3b8" }}>Opp. projected</span>
            <span style={{ fontWeight: 700, color: "#64748b" }}>{matchup.opponentProjected.toFixed(1)} FP</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href={`/team/${teamId}/lineup`} style={{
          display: "block", textAlign: "center",
          fontSize: 13, fontWeight: 700, padding: "9px 0", borderRadius: 10,
          background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
          border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none",
        }}>
          Adjust lineup →
        </Link>
      </div>
    </Card>
  );
}

function RecapCard({ recap }: { recap: WeeklyRecap }) {
  const won = recap.result === "win";
  const tie = recap.result === "tie";
  const color = won ? "#34d399" : tie ? "#94a3b8" : "#f87171";
  const bg = won ? "rgba(52,211,153,0.07)" : tie ? "rgba(148,163,184,0.05)" : "rgba(248,113,113,0.07)";
  const verb = won ? "Won" : "Lost";

  const isHighScore = recap.highestScore?.teamName === recap.opponentName ||
    recap.myRank === 1;

  const periodLabel = recap.isPlayoff && recap.roundLabel
    ? recap.roundLabel
    : `Wk ${recap.week}`;

  return (
    <div style={{
      background: bg, border: `1px solid ${color}33`,
      borderRadius: 14, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Top row: badge + score summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
          color, padding: "3px 9px", borderRadius: 20, background: `${color}1f`, flexShrink: 0,
        }}>
          {tie ? "TIE" : verb} · {periodLabel}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
          {recap.myScore.toFixed(1)}
          <span style={{ fontWeight: 400, color: "#475569", fontSize: 13 }}>
            {" "}pts
          </span>
        </span>
        {recap.myRank !== null && recap.teamsCount > 0 && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            #{recap.myRank} of {recap.teamsCount} this week
          </span>
        )}
      </div>

      {/* Details row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {recap.myTopPerformer && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            ⭐ {recap.myTopPerformer.name} led with {recap.myTopPerformer.points.toFixed(1)} pts
          </span>
        )}
        {recap.closestMatchup && recap.teamsCount > 2 && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            ⚡ Closest: {recap.closestMatchup.teams[0]} vs {recap.closestMatchup.teams[1]} — {recap.closestMatchup.margin.toFixed(1)} pt margin
          </span>
        )}
        {recap.highestScore && recap.myRank !== 1 && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            🏆 League high: {recap.highestScore.teamName} with {recap.highestScore.score.toFixed(1)} pts
          </span>
        )}
        {recap.highestScore && recap.myRank === 1 && (
          <span style={{ fontSize: 12, color: "#fbbf24" }}>
            🏆 You had the league-high score this week!
          </span>
        )}
      </div>
    </div>
  );
}

function LeaguePerformerItem({ player, rank, variant }: { player: LeaguePerformerRow; rank: number; variant: "top" | "low" }) {
  const rankColor = rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : "#475569";
  const fpColor = variant === "top" ? "#34d399" : "#f87171";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 10px", borderRadius: 8, marginBottom: 4,
      background: player.isMyPlayer ? "rgba(99,102,241,0.08)" : "transparent",
      borderLeft: player.isMyPlayer ? "2px solid rgba(99,102,241,0.4)" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: rankColor, width: 16, flexShrink: 0, textAlign: "center" }}>
        {rank}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: player.isMyPlayer ? "#a5b4fc" : "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {player.name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[player.position] ?? "#94a3b8", flexShrink: 0 }}>
            {player.position[0]}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
          {player.fantasyTeamName}
          {player.isMyPlayer && <span style={{ color: "#6366f1", fontWeight: 700 }}> · YOU</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: fpColor, fontVariantNumeric: "tabular-nums" }}>
          {player.points.toFixed(1)}
        </div>
        <div style={{ fontSize: 10, color: "#475569" }}>{player.gamesPlayed}GP</div>
      </div>
    </div>
  );
}

const sectionHead: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, margin: 0, color: "var(--dim)",
  letterSpacing: "0.14em", textTransform: "uppercase",
};

const editLink: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#818cf8",
  textDecoration: "none", padding: "4px 10px",
  borderRadius: 6, background: "rgba(99,102,241,0.1)",
  border: "1px solid rgba(99,102,241,0.2)",
};

// ── MatchupHero ────────────────────────────────────────────────────────────────

function MatchupHero({ matchup, teamId, leagueId }: { matchup: ActiveMatchup; teamId: string; leagueId: string }) {
  // Two modes: 1v1 (playoffs — single opponent, win probability, rivalry) and
  // VTF (regular season — ranked against the whole field).
  return matchup.opponentTeam
    ? <DuelHero matchup={matchup} opponent={matchup.opponentTeam} teamId={teamId} leagueId={leagueId} />
    : <FieldHero matchup={matchup} teamId={teamId} />;
}

// ── VTF (regular season): rank my team against the field ────────────────────────
function FieldHero({ matchup, teamId }: { matchup: ActiveMatchup; teamId: string }) {
  const isUpcoming = matchup.status === "upcoming";
  const hideScore = isUpcoming || !!matchup.isSetupPhase;
  const standings = matchup.weeklyStandings;
  const myRank = standings.findIndex((s) => s.teamId === matchup.myTeam.id) + 1;
  const total = standings.length;
  const { wins, losses, ties } = matchup.myRecord;
  const winningRecord = wins > losses;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const dateRange = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
  const weekLabel = matchup.isPlayoff && matchup.roundLabel ? matchup.roundLabel : `Week ${matchup.week}`;

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, #1b1346 0%, #161a36 48%, #121829 100%)",
      border: "1px solid rgba(124,58,237,0.32)",
      borderRadius: 22,
      boxShadow: "0 40px 90px -45px rgba(0,0,0,0.8)",
    }}>
      {/* Ambient glow overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(620px 280px at 18% -20%, rgba(167,139,250,0.20), transparent 70%), radial-gradient(560px 260px at 92% 120%, rgba(124,58,237,0.16), transparent 70%)" }} />

      {/* Top bar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 26px", borderBottom: "1px solid rgba(150,160,200,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <LogoShield size={24} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c7d2e0" }}>
            {weekLabel} · {dateRange}
          </span>
        </div>
        {isUpcoming && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e3c989", background: "rgba(214,169,78,0.12)", border: "1px solid rgba(214,169,78,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            Upcoming — set your lineup
          </span>
        )}
        {!isUpcoming && matchup.isSetupPhase && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e3c989", background: "rgba(214,169,78,0.12)", border: "1px solid rgba(214,169,78,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            No games yet
          </span>
        )}
        {!hideScore && <LiveScoreRefresh />}
      </div>

      {/* Body */}
      <div style={{ position: "relative", padding: "28px 30px 26px" }}>
        {/* My score + field record */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: hideScore ? 4 : 18 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "#a78bfa", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
              You
            </div>
            <div className="font-stats" style={{ fontSize: hideScore ? "clamp(24px, 6vw, 32px)" : "clamp(48px, 6vw, 64px)", fontWeight: 700, lineHeight: 0.8, color: hideScore ? "var(--dim)" : "var(--text)" }}>
              {hideScore ? "—" : matchup.myTeam.score.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>proj {matchup.myProjected.toFixed(1)}</div>
          </div>
          {!hideScore && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 2 }}>vs field</div>
              <div className="font-stats" style={{ fontSize: 22, fontWeight: 800, color: winningRecord ? "#a78bfa" : losses > wins ? "#c2776c" : "var(--muted)" }}>
                {wins}–{losses}{ties > 0 ? `–${ties}` : ""}
              </div>
              {myRank > 0 && (
                <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>#{myRank} of {total} this week</div>
              )}
            </div>
          )}
        </div>

        {/* Field standings (active only) */}
        {!hideScore && (
          <div style={{ display: "grid", gap: 2 }}>
            {standings.map((s, i) => {
              const isMe = s.teamId === matchup.myTeam.id;
              return (
                <div key={s.teamId} style={{
                  display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8, alignItems: "center",
                  padding: "5px 8px", borderRadius: 6,
                  background: isMe ? "var(--accent-dim)" : "transparent",
                }}>
                  <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? "#c9b6ff" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}{isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#a78bfa" }}>YOU</span>}
                  </span>
                  <span className="font-stats" style={{ fontSize: 13, fontWeight: 700, color: isMe ? "var(--text)" : "var(--dim)" }}>
                    {s.score.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {hideScore && (
          <div style={{ marginTop: 4 }}>
            <Link href={`/team/${teamId}/lineup`} style={{
              display: "inline-block", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10,
              background: "rgba(214,169,78,0.15)", color: "#e3c989", border: "1px solid rgba(214,169,78,0.30)", textDecoration: "none",
            }}>
              Set lineup →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 1v1 (playoffs): head-to-head duel with win probability + rivalry ────────────
function DuelHero({
  matchup, opponent, teamId, leagueId,
}: {
  matchup: ActiveMatchup;
  opponent: NonNullable<ActiveMatchup["opponentTeam"]>;
  teamId: string;
  leagueId: string;
}) {
  const isUpcoming = matchup.status === "upcoming";
  const isSetupPhase = !!matchup.isSetupPhase;
  const showDash = isSetupPhase;
  const winPct = Math.round(matchup.winProbability * 100);
  const oppPct = 100 - winPct;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const dateRange = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
  const weekLabel = matchup.isPlayoff && matchup.roundLabel ? matchup.roundLabel : `Week ${matchup.week}`;

  // Score display: upcoming → projected FP, setup phase → "—", active → actual score
  const myScoreDisplay = showDash ? "—" : isUpcoming ? matchup.myProjected.toFixed(1) : matchup.myTeam.score.toFixed(1);
  const oppScoreDisplay = showDash ? "—" : isUpcoming ? matchup.opponentProjected.toFixed(1) : opponent.score.toFixed(1);
  const scoreLabel = showDash ? "No games yet" : isUpcoming ? "Projected FP" : "Points earned";
  const myScoreColor = showDash ? "var(--dim)" : "#f6f7fb";
  const oppScoreColor = showDash ? "var(--dim)" : "#c7d2e0";

  // Win prob margin label
  const myProj = matchup.myTeam.score + matchup.myProjected;
  const oppProj = opponent.score + matchup.opponentProjected;
  const diff = Math.abs(myProj - oppProj).toFixed(1);
  const marginLabel = myProj >= oppProj ? `+${diff} edge` : `${diff} underdog`;

  // Starters with games this period
  const startersWithGames = matchup.myPlayers.filter(
    (p) => p.slot !== "BENCH" && p.slot !== "IR" && (p.gamesThisPeriod ?? 0) > 0
  ).length;

  // Top active scorer (active state only)
  const topScorer = !isUpcoming && !isSetupPhase
    ? matchup.myPlayers
        .filter((p) => p.slot !== "BENCH" && p.slot !== "IR" && p.points > 0)
        .sort((a, b) => b.points - a.points)[0] ?? null
    : null;

  const seriesRecord = `${matchup.rivalry.wins}–${matchup.rivalry.losses}${matchup.rivalry.ties > 0 ? `–${matchup.rivalry.ties}` : ""}`;

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(135deg, #1b1346 0%, #161a36 48%, #121829 100%)",
      border: "1px solid rgba(124,58,237,0.32)",
      borderRadius: 22,
      boxShadow: "0 40px 90px -45px rgba(0,0,0,0.8)",
    }}>
      {/* Ambient glow overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(620px 280px at 18% -20%, rgba(167,139,250,0.20), transparent 70%), radial-gradient(560px 260px at 92% 120%, rgba(124,58,237,0.16), transparent 70%)" }} />

      {/* Top bar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 26px", borderBottom: "1px solid rgba(150,160,200,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <LogoShield size={24} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#c7d2e0" }}>
            {weekLabel} · {dateRange}
          </span>
        </div>
        {isUpcoming && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e3c989", background: "rgba(214,169,78,0.12)", border: "1px solid rgba(214,169,78,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e3c989" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Set lineup now
          </span>
        )}
        {isSetupPhase && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#e3c989", background: "rgba(214,169,78,0.12)", border: "1px solid rgba(214,169,78,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            No games yet
          </span>
        )}
        {!isUpcoming && !isSetupPhase && <LiveScoreRefresh />}
      </div>

      {/* Main 3-column grid */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18, padding: "30px 30px 22px" }}>

        {/* YOU column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          {/* Avatar + team name */}
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #7c3aed, #4c1d95)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", boxShadow: "0 8px 20px -8px rgba(124,58,237,0.8)", flexShrink: 0 }}>
              {matchup.myTeam.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: "#f6f7fb", letterSpacing: "-0.01em" }}>{matchup.myTeam.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "#c9b6ff", background: "rgba(124,58,237,0.18)", borderRadius: 5, padding: "2px 7px" }}>YOU</span>
              </div>
              <div style={{ fontSize: 12, color: "#9aa3bd", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                {matchup.myRecord.wins}–{matchup.myRecord.losses}{matchup.myRecord.ties > 0 ? `–${matchup.myRecord.ties}` : ""}
                {seriesRecord !== "0–0" && ` · ${seriesRecord} series`}
              </div>
            </div>
          </div>

          {/* Score */}
          <div>
            <div className="font-stats" style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.82, color: myScoreColor, fontVariantNumeric: "tabular-nums" }}>
              {myScoreDisplay}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6f788e", marginTop: 6 }}>
              {scoreLabel}
            </div>
          </div>

          {/* Top scorer chip (active state only) */}
          {topScorer && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(150,160,200,0.05)", border: "1px solid rgba(150,160,200,0.12)", borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(124,58,237,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#c9b6ff", flexShrink: 0 }}>
                {topScorer.slot === "GOALIE" ? "G" : topScorer.slot === "DEFENSE" ? "D" : "F"}
              </span>
              <span style={{ fontSize: 12, color: "#c7d2e0" }}>
                Leading · <strong style={{ color: "#f3f5fb", fontWeight: 700 }}>{topScorer.name.split(" ").pop()}</strong>
              </span>
              <span className="font-stats" style={{ fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>
                {topScorer.points.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Center VS column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, alignSelf: "stretch", justifyContent: "center" }}>
          <div style={{ flex: 1, width: 1, background: "linear-gradient(rgba(150,160,200,0), rgba(150,160,200,0.22), rgba(150,160,200,0))", minHeight: 14 }} />
          <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(167,139,250,0.4)", background: "rgba(124,58,237,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", color: "#c9b6ff", flexShrink: 0 }}>
            VS
          </div>
          <div style={{ flex: 1, width: 1, background: "linear-gradient(rgba(150,160,200,0), rgba(150,160,200,0.22), rgba(150,160,200,0))", minHeight: 14 }} />
        </div>

        {/* OPPONENT column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14, textAlign: "right" }}>
          {/* Avatar + team name */}
          <div style={{ display: "flex", alignItems: "center", gap: 13, flexDirection: "row-reverse" }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #3a4258, #222a3d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#dfe3ee", flexShrink: 0 }}>
              {opponent.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: "#e7eaf3", letterSpacing: "-0.01em" }}>{opponent.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "#9aa3bd", border: "1px solid rgba(150,160,200,0.22)", borderRadius: 5, padding: "2px 7px" }}>OPP</span>
              </div>
              <div style={{ fontSize: 12, color: "#9aa3bd", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                {seriesRecord} season series
              </div>
            </div>
          </div>

          {/* Score */}
          <div>
            <div className="font-stats" style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.82, color: oppScoreColor, fontVariantNumeric: "tabular-nums" }}>
              {oppScoreDisplay}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6f788e", marginTop: 6 }}>
              {scoreLabel}
            </div>
          </div>

          {/* Spacer to match top scorer chip height when absent */}
          {!topScorer && <div style={{ height: 40 }} />}
          {topScorer && <div style={{ height: 40 }} />}
        </div>
      </div>

      {/* Win probability bar */}
      <div style={{ position: "relative", padding: "0 30px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#c9b6ff", fontVariantNumeric: "tabular-nums" }}>{winPct}% win probability</span>
          <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6f788e" }}>Projected · {marginLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#9aa3bd", fontVariantNumeric: "tabular-nums" }}>{oppPct}%</span>
        </div>
        <div style={{ height: 9, borderRadius: 6, overflow: "hidden", background: "rgba(150,160,200,0.12)" }}>
          <div style={{ height: "100%", width: `${winPct}%`, background: "linear-gradient(90deg, #a78bfa, #7c3aed)" }} />
        </div>
      </div>

      {/* Footer CTA */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "18px 30px 24px", borderTop: "1px solid rgba(150,160,200,0.10)", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "#8b93a7", minWidth: 160 }}>
          {isUpcoming
            ? <>Set your lineup before puck drop — you have <strong style={{ color: "#e3c989", fontWeight: 700 }}>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""}</strong> with games this period.</>
            : <>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""} active this period.</>
          }
        </span>
        <Link href={matchup.isPlayoff ? `/league/${leagueId}/bracket` : `/league/${leagueId}/matchups`} style={{
          background: "rgba(150,160,200,0.06)", border: "1px solid rgba(150,160,200,0.18)", color: "#e7eaf3",
          padding: "12px 20px", borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          {matchup.isPlayoff ? "View bracket" : "View schedule"}
        </Link>
        {isUpcoming && (
          <Link href={`/team/${teamId}/lineup`} style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff",
            padding: "12px 22px", borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          }}>
            Set lineup
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── RosterTable ────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN", IR: "IR",
};
const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
};
const SLOT_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
  UTIL: "#a78bfa", BENCH: "#64748b", IR: "#ef4444",
};

function RosterTable({ players, isMyTeam }: { players: PlayerMatchupRow[]; isMyTeam?: boolean }) {
  if (players.length === 0) {
    return <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>No active players yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "44px 1fr 36px 56px",
        gap: 8, padding: "0 12px 6px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: "var(--faint)",
        borderBottom: "1px solid var(--border)",
        marginBottom: 4,
      }}>
        <span>Slot</span><span>Player</span><span style={{ textAlign: "center" }}>Left</span><span style={{ textAlign: "right" }}>FPts</span>
      </div>

      {players.map((p) => {
        const isBench = p.slot === "BENCH" || p.slot === "IR";
        const rowStyle: React.CSSProperties = isBench
          ? { background: "rgba(150,160,200,0.02)", border: "1px solid rgba(150,160,200,0.06)", opacity: 0.62, borderRadius: 10, padding: "11px 12px" }
          : isMyTeam
            ? { background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "11px 12px" }
            : { background: "rgba(150,160,200,0.04)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px" };
        return (
          <div key={p.playerId} style={{ display: "grid", gridTemplateColumns: "44px 1fr 36px 56px", gap: 8, alignItems: "center", ...rowStyle }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, textAlign: "center",
              padding: "3px 7px", borderRadius: 5,
              background: "rgba(91,33,182,0.6)", color: "#fff",
            }}>
              {SLOT_LABELS[p.slot] ?? p.slot}
            </span>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
                {p.teamAbbr && <span style={{ fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>{p.teamAbbr}</span>}
              </div>
              {p.statBreakdown.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                  {p.statBreakdown.map((b) => (
                    <span key={b.label} style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 999,
                      background: b.points >= 0 ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                      color: b.points >= 0 ? "#34d399" : "#f87171",
                    }}>
                      {b.label}{b.stat > 1 ? ` ×${b.stat}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              {p.gamesThisPeriod !== null ? (
                <span className="font-stats" style={{
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 5px", borderRadius: 4,
                  background: p.gamesThisPeriod === 0 ? "rgba(239,68,68,0.12)" : "var(--accent-dim)",
                  color: p.gamesThisPeriod === 0 ? "#f87171" : "#c9b6ff",
                  border: p.gamesThisPeriod > 0 ? "1px solid var(--accent-border)" : undefined,
                }}>
                  {p.gamesThisPeriod === 0 ? "0" : `${p.gamesThisPeriod}G`}
                </span>
              ) : (
                <span style={{ color: "var(--faint)", fontSize: 10 }}>—</span>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <span className="font-stats" style={{ fontSize: 18, fontWeight: 700, color: p.points > 0 ? (isMyTeam ? "var(--muted)" : "var(--text)") : "var(--dim)" }}>
                {p.gameCount === 0 && p.points === 0 ? "—" : p.points.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Total row */}
      <div style={{
        display: "grid", gridTemplateColumns: "44px 1fr 36px 56px",
        gap: 8, padding: "10px 12px 0",
        borderTop: "1px solid var(--border)", marginTop: 2,
      }}>
        <span /><span style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600 }}>Total</span><span />
        <span className="font-stats" style={{ textAlign: "right", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
          {players.reduce((s, p) => s + p.points, 0).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
