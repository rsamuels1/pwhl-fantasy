import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getDashboardData, type ActiveMatchup, type PlayerMatchupRow, type WeeklyRecap, type LeaguePerformerRow } from "@/lib/services/dashboard";
import InlineLineupEditor, { type LineupPlayer } from "./InlineLineupEditor";
import LiveScoreRefresh from "@/components/LiveScoreRefresh";
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
    select: { scoringSettings: true, isReplay: true, replayCurrentDate: true },
  });
  if (!league) notFound();

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const nowMs = getReplayNow(league, await getDevNow());
  const dashboard = await getDashboardData(leagueId, teamId, nowMs, prisma);
  const { activeMatchup, remainingPlayers, topPerformers, disappointments, lineupAlerts, lastResult, leagueActivity, leagueTopPerformers, leagueDisappointments } = dashboard;

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

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── 1. Lineup alerts — top of page, always visible when present ── */}
      {lineupAlerts.length > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 14, padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>
                Lineup action needed
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                {lineupAlerts.map((a) => a.name).join(", ")}{" "}
                {lineupAlerts.length === 1 ? "has" : "have"} no games remaining this period
              </div>
            </div>
          </div>
          <Link href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(239,68,68,0.15)", color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.3)", textDecoration: "none", flexShrink: 0,
          }}>
            Fix lineup →
          </Link>
        </div>
      )}

      {/* ── 1b. Between-weeks lineup nudge ── */}
      {activeMatchup?.status === "upcoming" && (
        <div style={{
          background: "rgba(245,158,11,0.07)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 14, padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
              Week {activeMatchup.week} is coming up
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Set your lineup before games begin — check projected scores on the lineup page.
            </div>
          </div>
          <Link href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(245,158,11,0.15)", color: "#fbbf24",
            border: "1px solid rgba(245,158,11,0.3)", textDecoration: "none", flexShrink: 0,
          }}>
            Set lineup →
          </Link>
        </div>
      )}

      {/* ── 1c. Last week recap ── */}
      {lastResult && <RecapCard recap={lastResult} />}

      {/* ── 2. Matchup hero ── */}
      {activeMatchup ? (
        <MatchupHero matchup={activeMatchup} teamId={teamId} />
      ) : (
        <Card>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
            No scoring period is active or upcoming. Check back when the season is underway.
          </p>
        </Card>
      )}

      {/* ── 2b. Rival badge and H2H history ── */}
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

      {/* ── 3. Playing tonight — always shown during active periods ── */}
      {activeMatchup?.status === "active" && (
        <Card>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={sectionHead}>Playing tonight</h2>
            {remainingPlayers.length > 0 && (
              <span style={{ fontSize: 12, color: "#475569" }}>
                {remainingPlayers.reduce((s, p) => s + p.projectedPoints, 0).toFixed(1)} pts projected
              </span>
            )}
          </div>
          {remainingPlayers.length === 0 ? (
            <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
              No starters playing tonight — check the schedule for upcoming games.
            </p>
          ) : (() => {
            // Group players by game (homeAbbr@awayAbbr key)
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
                      {/* Game header */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 6, padding: "4px 0",
                        borderBottom: "1px solid rgba(148,163,184,0.1)",
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.04em" }}>
                          {rep.homeTeamAbbr} @ {rep.awayTeamAbbr}
                        </span>
                        <span style={{ fontSize: 11, color: "#475569" }}>
                          {formatTime(rep.gameStartsAt)}
                        </span>
                      </div>
                      {/* Players in this game */}
                      <div style={{ display: "grid", gap: 4 }}>
                        {players.map((p) => (
                          <div key={p.playerId} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "7px 10px", borderRadius: 7,
                            background: "rgba(99,102,241,0.05)",
                            border: "1px solid rgba(99,102,241,0.1)",
                          }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                              <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>
                                {p.position[0]} · {slotLabel(p.slot)}
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>
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
      )}

      {/* ── 4. Swing players (active only, when present) ── */}
      {swingPlayers.length > 0 && (
        <Card>
          <h2 style={{ ...sectionHead, marginBottom: 12 }}>Swing players</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {swingPlayers.map((p) => (
              <div key={p.playerId} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, padding: "8px 10px", borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{
                    fontSize: 11,
                    color: p.team === "mine" ? "#818cf8" : "#f59e0b",
                  }}>
                    {p.team === "mine" ? "Your player" : "Opponent"}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>
                  {p.projectedImpact.toFixed(1)} pts · {p.gamesRemaining}G left
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 5. Weekly storyline + top performers ── */}
      {(topPerformers.length > 0 || disappointments.length > 0) && (
        <>
          {/* Storyline chip */}
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

      {/* ── 5b. League leaders this week ── */}
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

      {/* ── 6. Rosters ── */}
      {activeMatchup && (
        <div className="matchup-2col">
          {/* My team — inline editor when upcoming, read-only table when active */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={sectionHead}>{activeMatchup.myTeam.name}</h2>
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
              <RosterTable players={activeMatchup.myPlayers} />
            )}
          </Card>

          {/* Opponent roster — 1v1 (playoff) only. VTF surfaces the field in the hero. */}
          {activeMatchup.opponentTeam && (
            <Card>
              <h2 style={{ ...sectionHead, marginBottom: 14 }}>{activeMatchup.opponentTeam.name}</h2>
              <RosterTable players={activeMatchup.opponentPlayers} />
            </Card>
          )}
        </div>
      )}

      {/* ── 7. League activity ── */}
      {leagueActivity.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ ...sectionHead, margin: 0 }}>League activity</h2>
            <Link href={`/league/${leagueId}`} style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
              See all →
            </Link>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {leagueActivity.map((event) => (
              <div key={event.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span style={{ color: "#cbd5e1", lineHeight: 1.5 }}>{event.description}</span>
                <span style={{ color: "#475569", flexShrink: 0, fontSize: 11 }}>{formatRelative(event.createdAt, nowMs)}</span>
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
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(148,163,184,0.14)",
      borderRadius: 20, padding: 20,
    }}>
      {children}
    </div>
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
          {tie ? "TIE" : verb} · Wk {recap.week}
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
  fontSize: 15, fontWeight: 700, margin: 0, color: "#e2e8f0",
};

const editLink: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#818cf8",
  textDecoration: "none", padding: "4px 10px",
  borderRadius: 6, background: "rgba(99,102,241,0.1)",
  border: "1px solid rgba(99,102,241,0.2)",
};

// ── MatchupHero ────────────────────────────────────────────────────────────────

function MatchupHero({ matchup, teamId }: { matchup: ActiveMatchup; teamId: string }) {
  // Two modes: 1v1 (playoffs — single opponent, win probability, rivalry) and
  // VTF (regular season — ranked against the whole field).
  return matchup.opponentTeam
    ? <DuelHero matchup={matchup} opponent={matchup.opponentTeam} teamId={teamId} />
    : <FieldHero matchup={matchup} teamId={teamId} />;
}

function heroPeriodLabel(matchup: ActiveMatchup) {
  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  return `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
}

// ── VTF (regular season): rank my team against the field ────────────────────────
function FieldHero({ matchup, teamId }: { matchup: ActiveMatchup; teamId: string }) {
  const isUpcoming = matchup.status === "upcoming";
  const periodLabel = heroPeriodLabel(matchup);
  const standings = matchup.weeklyStandings;
  const myRank = standings.findIndex((s) => s.teamId === matchup.myTeam.id) + 1;
  const total = standings.length;
  const { wins, losses, ties } = matchup.myRecord;
  const winningRecord = wins > losses;

  const accentColor = isUpcoming ? "#f59e0b" : winningRecord ? "#6366f1" : losses > wins ? "#ef4444" : "#94a3b8";
  const accentBg = isUpcoming ? "rgba(245,158,11,0.08)" : winningRecord ? "rgba(99,102,241,0.1)" : losses > wins ? "rgba(239,68,68,0.08)" : "rgba(148,163,184,0.05)";

  return (
    <div style={{ background: accentBg, border: `1px solid ${accentColor}40`, borderRadius: 24, padding: "24px 24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Week {matchup.week} · {periodLabel}</span>
          {isUpcoming && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>Upcoming</span>
          )}
        </div>
        {!isUpcoming && <LiveScoreRefresh />}
      </div>

      {/* My score + field record */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: isUpcoming ? 4 : 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {matchup.myTeam.name}
          </div>
          <div style={{ fontSize: isUpcoming ? "clamp(24px, 6vw, 32px)" : "clamp(28px, 8vw, 52px)", fontWeight: 900, lineHeight: 1, color: isUpcoming ? "#475569" : "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
            {isUpcoming ? "—" : matchup.myTeam.score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>proj {matchup.myProjected.toFixed(1)}</div>
        </div>
        {!isUpcoming && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>vs field</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: accentColor }}>
              {wins}–{losses}{ties > 0 ? `–${ties}` : ""}
            </div>
            {myRank > 0 && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>#{myRank} of {total} this week</div>
            )}
          </div>
        )}
      </div>

      {/* Field standings (active only) */}
      {!isUpcoming && (
        <div style={{ display: "grid", gap: 2 }}>
          {standings.map((s, i) => {
            const isMe = s.teamId === matchup.myTeam.id;
            return (
              <div key={s.teamId} style={{
                display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 8, alignItems: "center",
                padding: "5px 8px", borderRadius: 6,
                background: isMe ? "rgba(99,102,241,0.1)" : "transparent",
              }}>
                <span style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: isMe ? 700 : 400, color: isMe ? "#a5b4fc" : "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}{isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#6366f1" }}>YOU</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#e2e8f0" : "#64748b", fontVariantNumeric: "tabular-nums" }}>
                  {s.score.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isUpcoming && (
        <div style={{ marginTop: 4 }}>
          <Link href={`/team/${teamId}/lineup`} style={{
            display: "inline-block", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10,
            background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", textDecoration: "none",
          }}>
            Set lineup →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── 1v1 (playoffs): head-to-head duel with win probability + rivalry ────────────
function DuelHero({
  matchup, opponent, teamId,
}: {
  matchup: ActiveMatchup;
  opponent: NonNullable<ActiveMatchup["opponentTeam"]>;
  teamId: string;
}) {
  const isUpcoming = matchup.status === "upcoming";
  const myLead = matchup.myTeam.score - opponent.score;
  const winPct = Math.round(matchup.winProbability * 100);
  const oppPct = 100 - winPct;
  const periodLabel = heroPeriodLabel(matchup);

  const iWinning = !isUpcoming && myLead > 0;
  const tied = !isUpcoming && myLead === 0;
  const accentColor = isUpcoming ? "#f59e0b" : iWinning ? "#6366f1" : tied ? "#94a3b8" : "#ef4444";
  const accentBg = isUpcoming ? "rgba(245,158,11,0.08)" : iWinning ? "rgba(99,102,241,0.1)" : tied ? "rgba(148,163,184,0.05)" : "rgba(239,68,68,0.08)";
  const seriesGames = matchup.rivalry.wins + matchup.rivalry.losses + matchup.rivalry.ties;

  return (
    <div style={{ background: accentBg, border: `1px solid ${accentColor}40`, borderRadius: 24, padding: "24px 24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Week {matchup.week} · {periodLabel}</span>
          {matchup.isPlayoff && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(99,102,241,0.18)", color: "#a5b4fc" }}>Playoffs</span>
          )}
          {isUpcoming && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>Upcoming</span>
          )}
        </div>
        {!isUpcoming && <LiveScoreRefresh />}
      </div>

      {seriesGames > 0 ? (
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>
          Season series vs {opponent.name}:{" "}
          <span style={{ fontWeight: 700, color: "#94a3b8" }}>
            {matchup.rivalry.wins}–{matchup.rivalry.losses}{matchup.rivalry.ties > 0 ? `–${matchup.rivalry.ties}` : ""}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{matchup.myTeam.name}</div>
          <div style={{ fontSize: isUpcoming ? "clamp(24px, 6vw, 32px)" : "clamp(28px, 8vw, 52px)", fontWeight: 900, lineHeight: 1, color: isUpcoming ? "#475569" : "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
            {isUpcoming ? "—" : matchup.myTeam.score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>proj {matchup.myProjected.toFixed(1)}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          {isUpcoming ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>vs</span>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {tied ? "Tied" : iWinning ? "Winning" : "Trailing"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: accentColor, marginTop: 2 }}>{tied ? "—" : `${Math.abs(myLead).toFixed(1)}`}</div>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{opponent.name}</div>
          <div style={{ fontSize: isUpcoming ? "clamp(24px, 6vw, 32px)" : "clamp(28px, 8vw, 52px)", fontWeight: 900, lineHeight: 1, color: isUpcoming ? "#475569" : "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
            {isUpcoming ? "—" : opponent.score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>proj {matchup.opponentProjected.toFixed(1)}</div>
        </div>
      </div>

      {!isUpcoming && (
        <div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${winPct}%`, background: winPct >= 50 ? "#6366f1" : "#ef4444", borderRadius: 999, transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: winPct >= 50 ? "#818cf8" : "#64748b", fontWeight: winPct >= 50 ? 700 : 400 }}>{matchup.myTeam.name} {winPct}%</span>
            <span style={{ color: oppPct > winPct ? "#818cf8" : "#64748b", fontWeight: oppPct > winPct ? 700 : 400 }}>{oppPct}% {opponent.name}</span>
          </div>
        </div>
      )}

      {isUpcoming && (
        <div style={{ marginTop: 4 }}>
          <Link href={`/team/${teamId}/lineup`} style={{
            display: "inline-block", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10,
            background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", textDecoration: "none",
          }}>
            Set lineup →
          </Link>
        </div>
      )}
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

function RosterTable({ players }: { players: PlayerMatchupRow[] }) {
  if (players.length === 0) {
    return <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>No active players yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "40px 1fr 36px 56px",
        gap: 8, padding: "0 0 6px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "#334155",
        borderBottom: "1px solid rgba(148,163,184,0.08)",
        marginBottom: 4,
      }}>
        <span>Slot</span><span>Player</span><span style={{ textAlign: "center" }}>Left</span><span style={{ textAlign: "right" }}>FPts</span>
      </div>

      {players.map((p, i) => (
        <div key={p.playerId} style={{
          display: "grid", gridTemplateColumns: "40px 1fr 36px 56px",
          gap: 8, padding: "9px 0", alignItems: "center",
          borderTop: i === 0 ? "none" : "1px solid rgba(148,163,184,0.05)",
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textAlign: "center",
            padding: "3px 0", borderRadius: 5, width: 32,
            background: `${SLOT_COLORS[p.slot] ?? "#64748b"}20`,
            color: SLOT_COLORS[p.slot] ?? "#64748b",
          }}>
            {SLOT_LABELS[p.slot] ?? p.slot}
          </span>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] ?? "#94a3b8", flexShrink: 0 }}>
                {p.position[0]}
              </span>
              {p.teamAbbr && <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{p.teamAbbr}</span>}
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
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: "2px 5px", borderRadius: 4,
                background: p.gamesThisPeriod === 0 ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)",
                color: p.gamesThisPeriod === 0 ? "#f87171" : "#818cf8",
              }}>
                {p.gamesThisPeriod === 0 ? "0" : `${p.gamesThisPeriod}G`}
              </span>
            ) : (
              <span style={{ color: "#334155", fontSize: 10 }}>—</span>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: p.points > 0 ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
              {p.gameCount === 0 && p.points === 0 ? "—" : p.points.toFixed(1)}
            </span>
          </div>
        </div>
      ))}

      {/* Total row */}
      <div style={{
        display: "grid", gridTemplateColumns: "40px 1fr 36px 56px",
        gap: 8, padding: "10px 0 0",
        borderTop: "1px solid rgba(148,163,184,0.12)", marginTop: 2,
      }}>
        <span /><span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Total</span><span />
        <span style={{ textAlign: "right", fontSize: 15, fontWeight: 800, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
          {players.reduce((s, p) => s + p.points, 0).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
