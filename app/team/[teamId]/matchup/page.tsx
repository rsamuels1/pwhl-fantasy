import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getDashboardData, type ActiveMatchup, type PlayerMatchupRow } from "@/lib/services/dashboard";
import InlineLineupEditor, { type LineupPlayer } from "./InlineLineupEditor";
import { getSwingPlayers } from "@/lib/matchups/swingPlayers";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getDevNow } from "@/lib/devTime";

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
    select: { scoringSettings: true },
  });
  if (!league) notFound();

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const nowMs = await getDevNow();
  const dashboard = await getDashboardData(leagueId, teamId, nowMs, prisma);
  const { activeMatchup, remainingPlayers, topPerformers, disappointments, lineupAlerts, leagueActivity } = dashboard;

  let swingPlayers: Awaited<ReturnType<typeof getSwingPlayers>> = [];
  if (activeMatchup?.status === "active") {
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
    const benchGames = benchTeamIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gte: period.startsAt, lt: period.endsAt },
            status: { not: "FINAL" },
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
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {remainingPlayers.map((p) => (
                <div key={p.playerId} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 8,
                  background: "rgba(99,102,241,0.05)",
                  border: "1px solid rgba(99,102,241,0.12)",
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>
                      {p.position[0]} · {p.slot === "BENCH" ? "BN" : p.slot === "FORWARD" ? "F" : p.slot === "DEFENSE" ? "D" : p.slot === "GOALIE" ? "G" : p.slot}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>
                      {p.projectedPoints.toFixed(1)} proj
                    </div>
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      {formatTime(p.gameStartsAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                padding: "8px 10px", borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                  <span style={{
                    marginLeft: 8, fontSize: 11,
                    color: p.team === "mine" ? "#818cf8" : "#f59e0b",
                  }}>
                    {p.team === "mine" ? "Your player" : "Opponent"}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
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
                  <div key={p.playerId} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                    <span style={{ color: "#e2e8f0" }}>{p.name}</span>
                    <span style={{ color: "#34d399", fontWeight: 700 }}>{p.points.toFixed(1)}</span>
                  </div>
                ))}
              </Card>
            )}
            {disappointments.length > 0 && (
              <Card>
                <h2 style={{ ...sectionHead, marginBottom: 12 }}>Underperforming</h2>
                {disappointments.map((p) => (
                  <div key={p.playerId} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                    <span style={{ color: "#e2e8f0" }}>{p.name}</span>
                    <span style={{ color: "#f87171", fontWeight: 700 }}>{p.points.toFixed(1)}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </>
      )}

      {/* ── 6. Rosters ── */}
      {activeMatchup && (
        <div className="matchup-2col">
          {activeMatchup.status === "upcoming" ? (
            <>
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={sectionHead}>{activeMatchup.myTeam.name}</h2>
                  <Link href={`/team/${teamId}/lineup`} style={editLink}>Full lineup →</Link>
                </div>
                <InlineLineupEditor
                  leagueId={leagueId}
                  teamId={teamId}
                  active={activeMatchup.myPlayers.map((p) => ({ ...p, slot: p.slot }))}
                  bench={benchPlayers}
                />
              </Card>
              <Card>
                <h2 style={{ ...sectionHead, marginBottom: 14 }}>{activeMatchup.opponentTeam.name}</h2>
                <RosterTable players={activeMatchup.opponentPlayers} />
              </Card>
            </>
          ) : (
            <>
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h2 style={sectionHead}>{activeMatchup.myTeam.name}</h2>
                  <Link href={`/team/${teamId}/lineup`} style={editLink}>Edit lineup →</Link>
                </div>
                <RosterTable players={activeMatchup.myPlayers} />
              </Card>
              <Card>
                <h2 style={{ ...sectionHead, marginBottom: 14 }}>{activeMatchup.opponentTeam.name}</h2>
                <RosterTable players={activeMatchup.opponentPlayers} />
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── 7. League activity ── */}
      {leagueActivity.length > 0 && (
        <Card>
          <h2 style={{ ...sectionHead, marginBottom: 14 }}>League activity</h2>
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
  const isUpcoming = matchup.status === "upcoming";
  const myLead = matchup.myTeam.score - matchup.opponentTeam.score;
  const winPct = Math.round(matchup.winProbability * 100);
  const oppPct = 100 - winPct;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const periodLabel = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;

  const iWinning = !isUpcoming && myLead > 0;
  const tied = !isUpcoming && myLead === 0;

  const accentColor = isUpcoming ? "#f59e0b" : iWinning ? "#6366f1" : tied ? "#94a3b8" : "#ef4444";
  const accentBg = isUpcoming ? "rgba(245,158,11,0.08)" : iWinning ? "rgba(99,102,241,0.1)" : tied ? "rgba(148,163,184,0.05)" : "rgba(239,68,68,0.08)";

  return (
    <div style={{
      background: accentBg,
      border: `1px solid ${accentColor}40`,
      borderRadius: 24, padding: "24px 24px 20px",
    }}>
      {/* Week label */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>Week {matchup.week} · {periodLabel}</span>
        {isUpcoming && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            Upcoming
          </span>
        )}
      </div>

      {/* Score block */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {/* My team */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {matchup.myTeam.name}
          </div>
          <div style={{ fontSize: isUpcoming ? 32 : 52, fontWeight: 900, lineHeight: 1, color: isUpcoming ? "#475569" : "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
            {isUpcoming ? "—" : matchup.myTeam.score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            proj {matchup.myProjected.toFixed(1)}
          </div>
        </div>

        {/* Center: status label */}
        <div style={{ textAlign: "center" }}>
          {isUpcoming ? (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>vs</span>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {tied ? "Tied" : iWinning ? "Winning" : "Trailing"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: accentColor, marginTop: 2 }}>
                {tied ? "—" : `${Math.abs(myLead).toFixed(1)}`}
              </div>
            </div>
          )}
        </div>

        {/* Opponent */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {matchup.opponentTeam.name}
          </div>
          <div style={{ fontSize: isUpcoming ? 32 : 52, fontWeight: 900, lineHeight: 1, color: isUpcoming ? "#475569" : "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
            {isUpcoming ? "—" : matchup.opponentTeam.score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            proj {matchup.opponentProjected.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Win probability bar */}
      {!isUpcoming && (
        <div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${winPct}%`, background: winPct >= 50 ? "#6366f1" : "#ef4444", borderRadius: 999, transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: winPct >= 50 ? "#818cf8" : "#64748b", fontWeight: winPct >= 50 ? 700 : 400 }}>
              {matchup.myTeam.name} {winPct}%
            </span>
            <span style={{ color: oppPct > winPct ? "#818cf8" : "#64748b", fontWeight: oppPct > winPct ? 700 : 400 }}>
              {oppPct}% {matchup.opponentTeam.name}
            </span>
          </div>
        </div>
      )}

      {/* Upcoming CTA */}
      {isUpcoming && (
        <div style={{ marginTop: 4 }}>
          <Link href={`/team/${teamId}/lineup`} style={{
            display: "inline-block", fontSize: 13, fontWeight: 700,
            padding: "8px 18px", borderRadius: 10,
            background: "rgba(245,158,11,0.15)", color: "#fbbf24",
            border: "1px solid rgba(245,158,11,0.3)", textDecoration: "none",
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
