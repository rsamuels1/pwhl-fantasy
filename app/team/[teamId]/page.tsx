import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { scoreStatLine, DEFAULT_SCORING, type ScoringSettings } from "@/lib/scoring";
import { Position } from "@prisma/client";

function formatPoints(value: number) {
  return value.toFixed(2);
}

function positionLabel(pos: Position) {
  if (pos === Position.FORWARD) return "Forward";
  if (pos === Position.DEFENSE) return "Defense";
  return "Goalie";
}

export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId;

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    include: {
      owner: true,
      league: true,
      roster: {
        include: {
          player: { include: { team: { select: { abbreviation: true } } } },
        },
      },
    },
  });

  if (!team) notFound();

  const latestGame = await prisma.game.findFirst({ orderBy: { startsAt: "desc" }, select: { season: true } });
  const lastSeason = latestGame?.season ?? team.league.season;

  const rosterPlayerIds = team.roster.map((entry) => entry.playerId);
  const statLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: rosterPlayerIds },
      game: { season: lastSeason },
    },
    include: {
      player: true,
      game: true,
    },
  });

  const scoringSettings = (team.league.scoringSettings as ScoringSettings) || DEFAULT_SCORING;
  const playerStats = new Map<string, { points: number; games: number; lastName: string; firstName: string; position: Position; team: string | null }>();

  for (const line of statLines) {
    const existing = playerStats.get(line.playerId) ?? {
      points: 0,
      games: 0,
      firstName: line.player.firstName,
      lastName: line.player.lastName,
      position: line.player.position,
      team: line.player.team?.abbreviation ?? null,
    };
    const points = scoreStatLine(
      {
        goals: line.goals,
        assists: line.assists,
        shots: line.shots,
        plusMinus: line.plusMinus,
        penaltyMinutes: line.penaltyMinutes,
        powerPlayPts: line.powerPlayPts,
        hits: line.hits,
        blocks: line.blocks,
        saves: line.saves,
        goalsAgainst: line.goalsAgainst,
        shutout: line.shutout,
        win: line.win,
      },
      line.player.position,
      scoringSettings
    );
    existing.points += points;
    existing.games += 1;
    playerStats.set(line.playerId, existing);
  }

  const playerSummaries = team.roster.map((entry) => {
    const stats = playerStats.get(entry.playerId);
    return {
      id: entry.playerId,
      slot: entry.slot,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position,
      team: entry.player.team?.abbreviation ?? "N/A",
      points: stats?.points ?? 0,
      games: stats?.games ?? 0,
    };
  });

  const totalPoints = playerSummaries.reduce((sum, item) => sum + item.points, 0);
  const topPlayers = [...playerSummaries].sort((a, b) => b.points - a.points).slice(0, 6);

  const matchups = await prisma.matchup.findMany({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { week: "asc" },
  });

  const record = matchups.reduce(
    (acc, matchup) => {
      if (matchup.homeScore == null || matchup.awayScore == null) return acc;
      const isHome = matchup.homeTeamId === teamId;
      const ourScore = isHome ? matchup.homeScore : matchup.awayScore;
      const theirScore = isHome ? matchup.awayScore : matchup.homeScore;
      if (ourScore > theirScore) acc.wins += 1;
      else if (ourScore < theirScore) acc.losses += 1;
      else acc.ties += 1;
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 }
  );

  return (
    <main style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gap: 28 }}>
        <section style={{ display: "grid", gap: 12 }}>
          <div>
            <p style={{ color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 12, marginBottom: 8 }}>Team page</p>
            <h1 style={{ fontSize: "clamp(2rem, 3vw, 3rem)", margin: 0 }}>{team.name}</h1>
            <p style={{ color: "#94a3b8", marginTop: 10 }}>
              Owned by {team.owner.displayName} · League: {team.league.name} · Draft order: {team.draftOrder ?? "Unassigned"}
            </p>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <StatCard label="Roster size" value={`${team.roster.length}`} />
            <StatCard label="Last season total" value={formatPoints(totalPoints)} />
            <StatCard label="Recorded matchups" value={`${matchups.length}`} />
            <StatCard label="Record" value={`${record.wins}-${record.losses}-${record.ties}`} />
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Roster analytics ({lastSeason})</h2>
          <p style={{ color: "#94a3b8", marginBottom: 18 }}>Projected points based on the most recent season data for the current roster.</p>
          <div style={{ display: "grid", gap: 12 }}>
            {playerSummaries.map((player) => (
              <div key={player.id} style={playerRowStyle}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{player.name}</p>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                    {positionLabel(player.position)} · {player.team} · {player.slot}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{formatPoints(player.points)}</p>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>{player.games} games</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Top players from last season</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {topPlayers.map((player) => (
              <div key={player.id} style={playerRowStyle}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{player.name}</p>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                    {positionLabel(player.position)} · {player.team}
                  </p>
                </div>
                <p style={{ margin: 0, fontWeight: 700 }}>{formatPoints(player.points)}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Draft history</h2>
          {team.draftOrder ? (
            <p style={{ color: "#94a3b8" }}>Draft order is {team.draftOrder}. Open the draft room to see completed picks and manage live selection.</p>
          ) : (
            <p style={{ color: "#94a3b8" }}>This team has not been assigned a draft order yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 18, padding: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.12)" }}>
      <p style={{ color: "#94a3b8", marginBottom: 8, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 24,
};

const playerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  padding: 16,
  borderRadius: 18,
  background: "rgba(255,255,255,0.02)",
};
