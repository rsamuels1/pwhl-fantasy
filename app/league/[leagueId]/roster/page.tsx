import { LineupSlot } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { scoreStatLine } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";

interface Props {
  params: Promise<{ leagueId: string }>;
}

const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa",
  DEFENSE: "#5fa98c",
  GOALIE: "#f59e0b",
};

const ACTIVE_SLOTS: LineupSlot[] = [LineupSlot.FORWARD, LineupSlot.DEFENSE, LineupSlot.GOALIE, LineupSlot.UTIL];

function fmtSvPct(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(3).replace(/^0/, "");
}

function Num({ v, highlight }: { v: number | null; highlight?: boolean }) {
  return (
    <span style={{
      textAlign: "right", fontSize: 12,
      color: highlight ? "var(--accent-strong)" : "var(--dim)",
      fontWeight: highlight ? 700 : 400,
    }}>
      {v != null ? v : "—"}
    </span>
  );
}

function FpNum({ v }: { v: number }) {
  return (
    <span style={{
      textAlign: "right", fontSize: 12, fontWeight: 700,
      color: "var(--accent-strong)",
    }}>
      {v.toFixed(1)}
    </span>
  );
}

export default async function LeagueLeadersPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/roster`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true, season: true },
  });

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // Fetch all fantasy teams with their active-slot roster entries
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    include: {
      owner: { select: { displayName: true } },
      roster: {
        where: { slot: { in: ACTIVE_SLOTS } },
        include: {
          player: {
            include: { team: { select: { abbreviation: true } } },
          },
        },
      },
    },
  });

  // Determine current user's team
  const myTeam = teams.find((t) => t.ownerId === user.id);
  const myPlayerIds = new Set(myTeam?.roster.map((r) => r.playerId) ?? []);

  // Collect all player IDs across active slots
  const allPlayerIds = teams.flatMap((t) => t.roster.map((r) => r.playerId));
  if (allPlayerIds.length === 0) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <section style={panelStyle}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>League Leaders</h1>
          <p style={{ color: "var(--dim)", fontSize: 14 }}>
            No active roster players yet. Check back after the draft.
          </p>
        </section>
      </div>
    );
  }

  // Batch fetch all stat lines for these players filtered to the league's season
  const statLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: allPlayerIds },
      game: { season: league.season },
    },
    select: {
      playerId: true,
      goals: true,
      assists: true,
      shots: true,
      plusMinus: true,
      penaltyMinutes: true,
      powerPlayPts: true,
      hits: true,
      blocks: true,
      saves: true,
      goalsAgainst: true,
      shutout: true,
      win: true,
    },
  });

  // Aggregate stat lines per player
  type SkaterAgg = {
    gp: number; goals: number; assists: number; points: number;
    ppp: number; shots: number; hits: number; blocks: number; fp: number;
  };
  type GoalieAgg = {
    gp: number; wins: number; saves: number; goalsAgainst: number;
    savePct: number | null; shutouts: number; fp: number;
  };

  const skaterAgg = new Map<string, SkaterAgg>();
  const goalieAgg = new Map<string, GoalieAgg>();

  // Determine player positions from roster entries
  const playerPosition = new Map<string, string>();
  for (const team of teams) {
    for (const entry of team.roster) {
      playerPosition.set(entry.playerId, entry.player.position);
    }
  }

  // Initialize accumulators
  for (const pid of allPlayerIds) {
    const pos = playerPosition.get(pid);
    if (pos === "GOALIE") {
      if (!goalieAgg.has(pid)) {
        goalieAgg.set(pid, { gp: 0, wins: 0, saves: 0, goalsAgainst: 0, savePct: null, shutouts: 0, fp: 0 });
      }
    } else {
      if (!skaterAgg.has(pid)) {
        skaterAgg.set(pid, { gp: 0, goals: 0, assists: 0, points: 0, ppp: 0, shots: 0, hits: 0, blocks: 0, fp: 0 });
      }
    }
  }

  // Accumulate stat lines
  for (const line of statLines) {
    const pos = playerPosition.get(line.playerId);
    if (pos === "GOALIE") {
      const agg = goalieAgg.get(line.playerId);
      if (!agg) continue;
      agg.gp++;
      if (line.win) agg.wins++;
      agg.saves += line.saves;
      agg.goalsAgainst += line.goalsAgainst;
      if (line.shutout) agg.shutouts++;
      agg.fp += scoreStatLine({
        goals: line.goals, assists: line.assists, shots: line.shots,
        plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
        powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
        saves: line.saves, goalsAgainst: line.goalsAgainst,
        shutout: line.shutout, win: line.win,
      }, "GOALIE", scoringSettings);
    } else {
      const agg = skaterAgg.get(line.playerId);
      if (!agg) continue;
      agg.gp++;
      agg.goals += line.goals;
      agg.assists += line.assists;
      agg.points += line.goals + line.assists;
      agg.ppp += line.powerPlayPts;
      agg.shots += line.shots;
      agg.hits += line.hits;
      agg.blocks += line.blocks;
      agg.fp += scoreStatLine({
        goals: line.goals, assists: line.assists, shots: line.shots,
        plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
        powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
        saves: line.saves, goalsAgainst: line.goalsAgainst,
        shutout: line.shutout, win: line.win,
      }, "FORWARD", scoringSettings);
    }
  }

  // Compute save pct for goalies and round fp
  for (const [, agg] of goalieAgg) {
    const total = agg.saves + agg.goalsAgainst;
    agg.savePct = total > 0 ? agg.saves / total : null;
    agg.fp = Math.round(agg.fp * 100) / 100;
  }
  for (const [, agg] of skaterAgg) {
    agg.fp = Math.round(agg.fp * 100) / 100;
  }

  // Build flat player rows
  interface SkaterRow {
    playerId: string; name: string; position: string;
    teamAbbr: string | null; fantasyTeamName: string; ownerName: string;
    isMyPlayer: boolean;
    stats: SkaterAgg;
  }
  interface GoalieRow {
    playerId: string; name: string; position: string;
    teamAbbr: string | null; fantasyTeamName: string; ownerName: string;
    isMyPlayer: boolean;
    stats: GoalieAgg;
  }

  const skaterRows: SkaterRow[] = [];
  const goalieRows: GoalieRow[] = [];

  for (const team of teams) {
    for (const entry of team.roster) {
      const { player } = entry;
      const base = {
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        position: player.position,
        teamAbbr: player.team?.abbreviation ?? null,
        fantasyTeamName: team.name,
        ownerName: team.owner.displayName ?? team.name,
        isMyPlayer: myPlayerIds.has(player.id),
      };
      if (player.position === "GOALIE") {
        const stats = goalieAgg.get(player.id) ?? { gp: 0, wins: 0, saves: 0, goalsAgainst: 0, savePct: null, shutouts: 0, fp: 0 };
        goalieRows.push({ ...base, stats });
      } else {
        const stats = skaterAgg.get(player.id) ?? { gp: 0, goals: 0, assists: 0, points: 0, ppp: 0, shots: 0, hits: 0, blocks: 0, fp: 0 };
        skaterRows.push({ ...base, stats });
      }
    }
  }

  // Sort by FP desc
  skaterRows.sort((a, b) => b.stats.fp - a.stats.fp);
  goalieRows.sort((a, b) => b.stats.fp - a.stats.fp);

  const skaterGridCols = "28px minmax(100px,1.5fr) minmax(80px,1fr) 40px 36px 36px 36px 36px 46px 46px 36px 36px 60px";
  const goalieGridCols = "28px minmax(100px,1.5fr) minmax(80px,1fr) 40px 36px 36px 60px 50px 36px 60px";

  const abbrCol = (title: string, label: string) => (
    <abbr title={title} style={{
      textAlign: "right", display: "block",
      textDecoration: "underline dotted",
      textDecorationColor: "var(--faint)",
      textUnderlineOffset: 2, cursor: "help", fontStyle: "normal",
    }}>
      {label}
    </abbr>
  );

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={panelStyle}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>League Leaders</h1>
          <p style={{ color: "var(--dim)", fontSize: 14, margin: 0 }}>
            All active-slot players ranked by season fantasy points.
          </p>
        </div>

        {/* ── Skaters ── */}
        {skaterRows.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 12 }}>
              Skaters
            </h2>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{
                display: "grid", gridTemplateColumns: skaterGridCols,
                gap: 8, padding: "6px 14px",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                textTransform: "uppercase", color: "var(--faint)",
                borderBottom: "1px solid var(--border)",
              }}>
                <span>#</span>
                <span>Player</span>
                <span>Fantasy Team</span>
                <span style={{ textAlign: "right" }}>PWHL</span>
                <span style={{ textAlign: "right" }}>GP</span>
                <span style={{ textAlign: "right" }}>G</span>
                <span style={{ textAlign: "right" }}>A</span>
                <span style={{ textAlign: "right" }}>PTS</span>
                {abbrCol("Power play points", "PPP")}
                {abbrCol("Shots on goal", "SOG")}
                {abbrCol("Hits delivered", "HIT")}
                {abbrCol("Shots blocked", "BLK")}
                {abbrCol("Fantasy points this season", "FP")}
              </div>

              {skaterRows.map((row, i) => (
                <div
                  key={row.playerId}
                  style={{
                    display: "grid", gridTemplateColumns: skaterGridCols,
                    gap: 8, padding: "9px 14px", alignItems: "center",
                    borderTop: "1px solid var(--border)",
                    background: row.isMyPlayer
                      ? "rgba(143,193,232,0.06)"
                      : i % 2 === 0 ? "transparent" : "var(--bg-raised)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>{i + 1}</span>

                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[row.position] ?? "var(--dim)", flexShrink: 0 }}>
                      {row.position[0]}
                    </span>
                    {row.isMyPlayer && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                        background: "rgba(143,193,232,0.18)", color: "var(--accent-strong)",
                        flexShrink: 0, letterSpacing: "0.05em",
                      }}>
                        You
                      </span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.fantasyTeamName}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.ownerName}
                    </div>
                  </div>

                  <span style={{ textAlign: "right", fontSize: 11, color: "var(--faint)" }}>{row.teamAbbr ?? "—"}</span>
                  <Num v={row.stats.gp} />
                  <Num v={row.stats.goals} />
                  <Num v={row.stats.assists} />
                  <Num v={row.stats.points} highlight />
                  <Num v={row.stats.ppp} />
                  <Num v={row.stats.shots} />
                  <Num v={row.stats.hits} />
                  <Num v={row.stats.blocks} />
                  <FpNum v={row.stats.fp} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Goalies ── */}
        {goalieRows.length > 0 && (
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 12 }}>
              Goalies
            </h2>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{
                display: "grid", gridTemplateColumns: goalieGridCols,
                gap: 8, padding: "6px 14px",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                textTransform: "uppercase", color: "var(--faint)",
                borderBottom: "1px solid var(--border)",
              }}>
                <span>#</span>
                <span>Player</span>
                <span>Fantasy Team</span>
                <span style={{ textAlign: "right" }}>PWHL</span>
                <span style={{ textAlign: "right" }}>GP</span>
                <span style={{ textAlign: "right" }}>W</span>
                {abbrCol("Save percentage", "SV%")}
                {abbrCol("Goals against", "GA")}
                {abbrCol("Shutouts", "SO")}
                {abbrCol("Fantasy points this season", "FP")}
              </div>

              {goalieRows.map((row, i) => (
                <div
                  key={row.playerId}
                  style={{
                    display: "grid", gridTemplateColumns: goalieGridCols,
                    gap: 8, padding: "9px 14px", alignItems: "center",
                    borderTop: "1px solid var(--border)",
                    background: row.isMyPlayer
                      ? "rgba(143,193,232,0.06)"
                      : i % 2 === 0 ? "transparent" : "var(--bg-raised)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>{i + 1}</span>

                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[row.position] ?? "var(--dim)", flexShrink: 0 }}>
                      G
                    </span>
                    {row.isMyPlayer && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                        background: "rgba(143,193,232,0.18)", color: "var(--accent-strong)",
                        flexShrink: 0, letterSpacing: "0.05em",
                      }}>
                        You
                      </span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.fantasyTeamName}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.ownerName}
                    </div>
                  </div>

                  <span style={{ textAlign: "right", fontSize: 11, color: "var(--faint)" }}>{row.teamAbbr ?? "—"}</span>
                  <Num v={row.stats.gp} />
                  <Num v={row.stats.wins} />
                  <span style={{ textAlign: "right", fontSize: 12, color: "var(--dim)" }}>
                    {fmtSvPct(row.stats.savePct)}
                  </span>
                  <Num v={row.stats.goalsAgainst} />
                  <Num v={row.stats.shutouts} />
                  <FpNum v={row.stats.fp} />
                </div>
              ))}
            </div>
          </div>
        )}

        {skaterRows.length === 0 && goalieRows.length === 0 && (
          <p style={{ color: "var(--dim)", fontSize: 14 }}>
            No active-slot players found. Check back after the draft.
          </p>
        )}
      </section>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 24,
};
