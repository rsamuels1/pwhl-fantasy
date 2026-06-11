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
          <MatchupHero matchup={activeMatchup} />

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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <RosterBreakdown
              title={`${activeMatchup.myTeam.name}`}
              players={activeMatchup.myPlayers}
            />
            <RosterBreakdown
              title={`${activeMatchup.opponentTeam.name}`}
              players={activeMatchup.opponentPlayers}
            />
          </div>
        </>
      ) : (
        <Card title="No active matchup">
          <p style={{ color: "#94a3b8" }}>
            There is no active scoring period right now. Check back when the season is underway.
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

function MatchupHero({ matchup }: { matchup: ActiveMatchup }) {
  const myLead = matchup.myTeam.score - matchup.opponentTeam.score;
  const winPct = Math.round(matchup.winProbability * 100);
  const leadLabel =
    myLead === 0
      ? "Tied"
      : myLead > 0
      ? `You lead by ${myLead.toFixed(1)}`
      : `Trailing by ${Math.abs(myLead).toFixed(1)}`;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(15,17,23,0) 60%)",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 24,
        padding: "28px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>
            Week {matchup.week} Matchup
          </p>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{leadLabel}</h2>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>{winPct}% chance to win</p>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <ScoreBlock
            name={matchup.myTeam.name}
            score={matchup.myTeam.score}
            projected={matchup.myProjected}
            align="left"
          />
          <span style={{ color: "#64748b", fontSize: 20, fontWeight: 700 }}>vs</span>
          <ScoreBlock
            name={matchup.opponentTeam.name}
            score={matchup.opponentTeam.score}
            projected={matchup.opponentProjected}
            align="right"
          />
        </div>
      </div>
      <div
        style={{
          marginTop: 20,
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${winPct}%`,
            height: "100%",
            background: winPct >= 50 ? "#6366f1" : "#f87171",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}

function ScoreBlock({
  name,
  score,
  projected,
  align,
}: {
  name: string;
  score: number;
  projected: number;
  align: "left" | "right";
}) {
  return (
    <div style={{ textAlign: align }}>
      <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 2 }}>{name}</p>
      <p style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{score.toFixed(1)}</p>
      <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>proj {projected.toFixed(1)}</p>
    </div>
  );
}

function RosterBreakdown({ title, players }: { title: string; players: PlayerMatchupRow[] }) {
  return (
    <Card title={title}>
      <div style={{ display: "grid", gap: 12 }}>
        {players.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>No active players have scored yet.</p>
        ) : (
          players.map((p) => (
            <div key={p.playerId}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: p.points > 0 ? "#34d399" : "#94a3b8",
                  }}
                >
                  {p.points.toFixed(1)}
                </span>
              </div>
              {p.statBreakdown.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.statBreakdown.map((b) => (
                    <span
                      key={b.label}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          b.points >= 0
                            ? "rgba(52,211,153,0.12)"
                            : "rgba(248,113,113,0.12)",
                        color: b.points >= 0 ? "#34d399" : "#f87171",
                      }}
                    >
                      {b.label}
                      {b.stat > 1 ? ` ×${b.stat}` : ""} ({b.points > 0 ? "+" : ""}
                      {b.points.toFixed(1)})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
