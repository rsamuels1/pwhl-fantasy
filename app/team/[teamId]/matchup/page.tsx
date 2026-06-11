import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getDashboardData, type ActiveMatchup, type PlayerMatchupRow } from "@/lib/services/dashboard";
import { getSwingPlayers } from "@/lib/matchups/swingPlayers";
import { parseScoringSettings } from "@/lib/scoring/settings";

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
  const dashboard = await getDashboardData(leagueId, teamId, Date.now(), prisma);
  const { activeMatchup, remainingPlayers, topPerformers, disappointments, leagueActivity } = dashboard;

  let swingPlayers: Awaited<ReturnType<typeof getSwingPlayers>> = [];
  if (activeMatchup) {
    swingPlayers = await getSwingPlayers(
      teamId,
      activeMatchup.opponentTeam.id,
      activeMatchup.period,
      scoringSettings,
      prisma
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {activeMatchup ? (
        <>
          <MatchupHero matchup={activeMatchup} teamId={teamId} />

          {swingPlayers.length > 0 && (
            <Card title="Swing players">
              <div style={{ display: "grid", gap: 8 }}>
                {swingPlayers.map((p) => (
                  <div
                    key={p.playerId}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <div>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          color: p.team === "mine" ? "#6366f1" : "#f59e0b",
                        }}
                      >
                        {p.team === "mine" ? "Your player" : "Opponent"}
                      </span>
                    </div>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>
                      {p.projectedImpact.toFixed(1)} pts · {p.gamesRemaining}G left
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {remainingPlayers.length > 0 && (
            <Card title="Playing tonight">
              <div style={{ display: "grid", gap: 8 }}>
                {remainingPlayers.map((p) => (
                  <div
                    key={p.playerId}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <span>
                      {p.name}{" "}
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>{p.slot}</span>
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>
                      {p.projectedPoints.toFixed(1)} proj · {formatTime(p.gameStartsAt)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(topPerformers.length > 0 || disappointments.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {topPerformers.length > 0 && (
                <Card title="Top performers">
                  {topPerformers.map((p) => (
                    <div
                      key={p.playerId}
                      style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: "#34d399", fontWeight: 700 }}>{p.points.toFixed(1)}</span>
                    </div>
                  ))}
                </Card>
              )}
              {disappointments.length > 0 && (
                <Card title="Underperforming">
                  {disappointments.map((p) => (
                    <div
                      key={p.playerId}
                      style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: "#f87171", fontWeight: 700 }}>{p.points.toFixed(1)}</span>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: activeMatchup.status === "upcoming" ? "1fr" : "1fr 1fr",
            gap: 16,
          }}>
            <RosterTable
              title={activeMatchup.myTeam.name}
              players={activeMatchup.myPlayers}
              showSetLineup
              teamId={teamId}
            />
            {activeMatchup.status !== "upcoming" && (
              <RosterTable
                title={activeMatchup.opponentTeam.name}
                players={activeMatchup.opponentPlayers}
              />
            )}
          </div>
        </>
      ) : (
        <Card title="No matchup scheduled">
          <p style={{ color: "#94a3b8" }}>
            No scoring period is active or upcoming right now. Check back when the season is underway.
          </p>
        </Card>
      )}

      {leagueActivity.length > 0 && (
        <Card title="League activity">
          <div style={{ display: "grid", gap: 10 }}>
            {leagueActivity.map((event) => (
              <div
                key={event.id}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}
              >
                <span style={{ color: "#e2e8f0" }}>{event.description}</span>
                <span style={{ color: "#64748b", flexShrink: 0 }}>{formatRelative(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

function formatRelative(d: Date) {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(148,163,184,0.14)",
        borderRadius: 20,
        padding: 20,
      }}
    >
      <h2 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600 }}>{title}</h2>
      {children}
    </div>
  );
}

function MatchupHero({ matchup, teamId }: { matchup: ActiveMatchup; teamId: string }) {
  const isUpcoming = matchup.status === "upcoming";
  const myLead = matchup.myTeam.score - matchup.opponentTeam.score;
  const winPct = Math.round(matchup.winProbability * 100);

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const periodLabel = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;

  const leadLabel = isUpcoming
    ? `vs ${matchup.opponentTeam.name}`
    : myLead === 0
    ? "Tied"
    : myLead > 0
    ? `Leading by ${myLead.toFixed(1)}`
    : `Trailing by ${Math.abs(myLead).toFixed(1)}`;

  return (
    <div
      style={{
        background: isUpcoming
          ? "linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(15,17,23,0) 60%)"
          : "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(15,17,23,0) 60%)",
        border: `1px solid ${isUpcoming ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.3)"}`,
        borderRadius: 24,
        padding: "28px 24px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>
            Week {matchup.week} · {periodLabel}
            {isUpcoming && (
              <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>Upcoming</span>
            )}
          </p>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{leadLabel}</h2>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            {isUpcoming
              ? `Projected: ${matchup.myProjected.toFixed(1)} – ${matchup.opponentProjected.toFixed(1)}`
              : `${winPct}% chance to win`}
          </p>
          {isUpcoming && (
            <a
              href={`/team/${teamId}/lineup`}
              style={{
                display: "inline-block", marginTop: 12,
                padding: "8px 18px", borderRadius: 10,
                background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)",
                color: "#fbbf24", fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}
            >
              Set lineup →
            </a>
          )}
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <ScoreBlock
            name={matchup.myTeam.name}
            score={matchup.myTeam.score}
            projected={matchup.myProjected}
            align="left"
            isUpcoming={isUpcoming}
          />
          <span style={{ color: "#64748b", fontSize: 20, fontWeight: 700 }}>vs</span>
          <ScoreBlock
            name={matchup.opponentTeam.name}
            score={matchup.opponentTeam.score}
            projected={matchup.opponentProjected}
            align="right"
            isUpcoming={isUpcoming}
          />
        </div>
      </div>
      {!isUpcoming && (
        <div style={{ marginTop: 20, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${winPct}%`, height: "100%", background: winPct >= 50 ? "#6366f1" : "#f87171", borderRadius: 3 }} />
        </div>
      )}
    </div>
  );
}

function ScoreBlock({
  name, score, projected, align, isUpcoming,
}: {
  name: string; score: number; projected: number; align: "left" | "right"; isUpcoming: boolean;
}) {
  return (
    <div style={{ textAlign: align }}>
      <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>{name}</p>
      {isUpcoming ? (
        <p style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: "#64748b" }}>—</p>
      ) : (
        <p style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{score.toFixed(1)}</p>
      )}
      <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>proj {projected.toFixed(1)}</p>
    </div>
  );
}

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

function RosterTable({ title, players, showSetLineup, teamId }: {
  title: string;
  players: PlayerMatchupRow[];
  showSetLineup?: boolean;
  teamId?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(148,163,184,0.1)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      {/* Table header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 10px",
        borderBottom: "1px solid rgba(148,163,184,0.08)",
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{title}</span>
        {showSetLineup && teamId && (
          <a href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 600, color: "#818cf8",
            textDecoration: "none", padding: "4px 10px",
            borderRadius: 6, background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}>
            Edit lineup
          </a>
        )}
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 56px 80px",
        gap: 8, padding: "6px 16px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "#475569",
        borderBottom: "1px solid rgba(148,163,184,0.06)",
      }}>
        <span>Slot</span>
        <span>Player</span>
        <span style={{ textAlign: "center" }}>Left</span>
        <span style={{ textAlign: "right" }}>FPts</span>
      </div>

      {players.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13, padding: "16px", margin: 0 }}>
          No active players yet.
        </p>
      ) : (
        players.map((p, i) => (
          <div
            key={p.playerId}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 56px 80px",
              gap: 8, padding: "10px 16px",
              alignItems: "center",
              borderTop: i === 0 ? "none" : "1px solid rgba(148,163,184,0.05)",
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
            }}
          >
            {/* Slot badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, textAlign: "center",
              padding: "3px 0", borderRadius: 5, width: 36,
              background: `${SLOT_COLORS[p.slot] ?? "#64748b"}20`,
              color: SLOT_COLORS[p.slot] ?? "#64748b",
            }}>
              {SLOT_LABELS[p.slot] ?? p.slot}
            </span>

            {/* Player name + metadata */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] ?? "#94a3b8", flexShrink: 0 }}>
                  {p.position[0]}
                </span>
                {p.teamAbbr && (
                  <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{p.teamAbbr}</span>
                )}
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

            {/* Games remaining badge */}
            <div style={{ textAlign: "center" }}>
              {p.gamesThisPeriod !== null ? (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 4,
                  background: p.gamesThisPeriod === 0 ? "rgba(100,116,139,0.15)" : "rgba(99,102,241,0.15)",
                  color: p.gamesThisPeriod === 0 ? "#64748b" : "#818cf8",
                }}>
                  {p.gamesThisPeriod === 0 ? "0" : `${p.gamesThisPeriod}G`}
                </span>
              ) : (
                <span style={{ color: "#334155", fontSize: 10 }}>—</span>
              )}
            </div>

            {/* Fantasy points */}
            <div style={{ textAlign: "right" }}>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: p.points > 0 ? "#e2e8f0" : "#475569",
              }}>
                {p.points > 0 ? p.points.toFixed(1) : p.gameCount === 0 ? "—" : p.points.toFixed(1)}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Row total */}
      {players.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "44px 1fr 56px 80px",
          gap: 8, padding: "10px 16px",
          borderTop: "1px solid rgba(148,163,184,0.1)",
        }}>
          <span />
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Total</span>
          <span />
          <span style={{ textAlign: "right", fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>
            {players.reduce((s, p) => s + p.points, 0).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
