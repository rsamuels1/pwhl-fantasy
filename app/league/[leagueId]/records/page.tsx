import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { scoreStatLine } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import type { Position } from "@prisma/client";

interface Props {
  params: Promise<{ leagueId: string }>;
}

interface PlayerWeekRecord {
  playerName: string;
  fantasyTeamName: string;
  week: number;
  fp: number;
}

interface TeamWeekRecord {
  teamName: string;
  week: number;
  score: number;
}

interface BlowoutRecord {
  winnerName: string;
  loserName: string;
  week: number;
  margin: number;
  winnerScore: number;
  loserScore: number;
}

export default async function RecordsPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/records`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { name: true, season: true, scoringSettings: true, status: true },
  });
  if (!league) notFound();

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // All scored regular-season matchups
  const matchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: false, homeScore: { not: null } },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { week: "asc" },
  });

  const hasResults = matchups.length > 0;

  // 1. Highest single-week team score
  let highScore: TeamWeekRecord | null = null;
  for (const m of matchups) {
    if (m.homeScore !== null) {
      if (!highScore || m.homeScore > highScore.score) {
        highScore = { teamName: m.homeTeam.name, week: m.week, score: m.homeScore };
      }
    }
    if (m.awayScore !== null) {
      if (!highScore || m.awayScore > highScore.score) {
        highScore = { teamName: m.awayTeam.name, week: m.week, score: m.awayScore };
      }
    }
  }

  // 2. Biggest blowout (1v1 matchups only — where both awayTeam is non-null and both scores exist)
  const duelMatchups = matchups.filter(
    (m) => m.homeScore !== null && m.awayScore !== null
  );
  let biggestBlowout: BlowoutRecord | null = null;
  for (const m of duelMatchups) {
    const margin = Math.abs((m.homeScore ?? 0) - (m.awayScore ?? 0));
    if (!biggestBlowout || margin > biggestBlowout.margin) {
      const homeWon = (m.homeScore ?? 0) >= (m.awayScore ?? 0);
      biggestBlowout = {
        winnerName: homeWon ? m.homeTeam.name : m.awayTeam.name,
        loserName: homeWon ? m.awayTeam.name : m.homeTeam.name,
        week: m.week,
        margin,
        winnerScore: homeWon ? (m.homeScore ?? 0) : (m.awayScore ?? 0),
        loserScore: homeWon ? (m.awayScore ?? 0) : (m.homeScore ?? 0),
      };
    }
  }

  // 3. Best single-season record (most VTF wins)
  const teamWins = new Map<string, { name: string; wins: number; losses: number; ties: number }>();
  for (const m of matchups) {
    if (!teamWins.has(m.homeTeamId)) {
      teamWins.set(m.homeTeamId, { name: m.homeTeam.name, wins: 0, losses: 0, ties: 0 });
    }
    if (!teamWins.has(m.awayTeamId)) {
      teamWins.set(m.awayTeamId, { name: m.awayTeam.name, wins: 0, losses: 0, ties: 0 });
    }
  }

  // Compute VTF wins: for each week, rank all homeScores vs each other
  const weekGroups = new Map<number, Array<{ teamId: string; score: number }>>();
  for (const m of matchups) {
    if (m.homeScore === null) continue;
    const arr = weekGroups.get(m.week) ?? [];
    arr.push({ teamId: m.homeTeamId, score: m.homeScore });
    weekGroups.set(m.week, arr);
  }
  for (const entries of weekGroups.values()) {
    for (const e of entries) {
      const rec = teamWins.get(e.teamId);
      if (!rec) continue;
      const wins = entries.filter((x) => x.score < e.score).length;
      const losses = entries.filter((x) => x.score > e.score).length;
      const ties = entries.filter((x) => x.score === e.score).length - 1;
      rec.wins += wins;
      rec.losses += losses;
      rec.ties += Math.max(0, ties);
    }
  }
  let bestRecord: { name: string; wins: number; losses: number; ties: number } | null = null;
  for (const rec of teamWins.values()) {
    if (!bestRecord || rec.wins > bestRecord.wins) bestRecord = rec;
  }

  // 4. Most FP by a player in a single week — aggregate StatLine by player + week
  // Only load if there are matchup results to avoid a heavyweight query on empty leagues
  let topPlayerWeeks: PlayerWeekRecord[] = [];
  if (hasResults) {
    // Get all scored weeks from the league
    const scoredWeeks = [...new Set(matchups.map((m) => m.week))];

    // For each week we need to find the ScoringPeriod date range
    const allPeriodMatchups = await prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false },
      select: { week: true, startsAt: true, endsAt: true },
      orderBy: { week: "asc" },
    });
    const weekDates = new Map<number, { startsAt: Date; endsAt: Date }>();
    for (const m of allPeriodMatchups) {
      if (!weekDates.has(m.week)) {
        weekDates.set(m.week, { startsAt: m.startsAt, endsAt: m.endsAt });
      }
    }

    // For each scored week, get stat lines and aggregate by player
    const weekPlayerFp = new Map<string, PlayerWeekRecord>(); // key = `${week}-${playerId}`

    for (const week of scoredWeeks) {
      const dates = weekDates.get(week);
      if (!dates) continue;

      const statLines = await prisma.statLine.findMany({
        where: {
          game: {
            startsAt: { gte: dates.startsAt, lt: dates.endsAt },
          },
          player: {
            rosterEntries: {
              some: {
                fantasyTeam: { leagueId },
              },
            },
          },
        },
        select: {
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
          playerId: true,
          player: {
            select: {
              firstName: true,
              lastName: true,
              position: true,
              rosterEntries: {
                where: { fantasyTeam: { leagueId } },
                select: { fantasyTeam: { select: { name: true } } },
                take: 1,
              },
            },
          },
        },
      });

      // Aggregate by player for this week
      const playerTotals = new Map<string, { fp: number; name: string; teamName: string }>();
      for (const sl of statLines) {
        const fp = scoreStatLine(
          {
            goals: sl.goals,
            assists: sl.assists,
            shots: sl.shots,
            plusMinus: sl.plusMinus,
            penaltyMinutes: sl.penaltyMinutes,
            powerPlayPts: sl.powerPlayPts,
            hits: sl.hits,
            blocks: sl.blocks,
            saves: sl.saves,
            goalsAgainst: sl.goalsAgainst,
            shutout: sl.shutout,
            win: sl.win,
          },
          sl.player.position as Position,
          scoringSettings
        );
        const existing = playerTotals.get(sl.playerId);
        const playerName = `${sl.player.firstName} ${sl.player.lastName}`;
        const teamName = sl.player.rosterEntries[0]?.fantasyTeam.name ?? "Unknown Team";
        if (existing) {
          existing.fp += fp;
        } else {
          playerTotals.set(sl.playerId, { fp, name: playerName, teamName });
        }
      }

      for (const [playerId, info] of playerTotals) {
        const key = `${week}-${playerId}`;
        const existing = weekPlayerFp.get(key);
        if (!existing || info.fp > existing.fp) {
          weekPlayerFp.set(key, {
            playerName: info.name,
            fantasyTeamName: info.teamName,
            week,
            fp: info.fp,
          });
        }
      }
    }

    // Sort by FP desc, take top 5
    topPlayerWeeks = [...weekPlayerFp.values()]
      .sort((a, b) => b.fp - a.fp)
      .slice(0, 5);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>League Record Book</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
          {league.name} &middot; Season {league.season}
        </p>
      </div>

      {!hasResults ? (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "48px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>🏒</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", margin: "0 0 6px" }}>
            No records yet
          </p>
          <p style={{ fontSize: 13, color: "var(--faint)", margin: 0 }}>
            Records will be set once the season begins. Check back after Week 1.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>

          {/* Highest single-week team score */}
          {highScore && (
            <RecordCard
              icon="🔥"
              title="Highest Weekly Score"
              value={highScore.score.toFixed(1) + " FP"}
              detail={`${highScore.teamName} · Week ${highScore.week}`}
            />
          )}

          {/* Best season record */}
          {bestRecord && (
            <RecordCard
              icon="🏆"
              title="Best Season Record"
              value={`${bestRecord.wins}–${bestRecord.losses}${bestRecord.ties > 0 ? `–${bestRecord.ties}` : ""}`}
              detail={bestRecord.name}
            />
          )}

          {/* Biggest blowout */}
          {biggestBlowout && (
            <RecordCard
              icon="💥"
              title="Biggest Blowout"
              value={biggestBlowout.margin.toFixed(1) + " pts"}
              detail={`${biggestBlowout.winnerName} def. ${biggestBlowout.loserName} · ${biggestBlowout.winnerScore.toFixed(1)}–${biggestBlowout.loserScore.toFixed(1)} · Week ${biggestBlowout.week}`}
            />
          )}

          {/* Top player weeks */}
          {topPlayerWeeks.length > 0 && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: "20px 24px",
              gridColumn: "1 / -1",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>⚡</span>
                <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--dim)", margin: 0 }}>
                  Best Individual Weeks
                </h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {topPlayerWeeks.map((row, i) => (
                  <div key={`${row.week}-${row.playerName}`} style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: i === 0 ? "rgba(245,201,123,0.06)" : "transparent",
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: i === 0 ? "var(--gold)" : "var(--faint)",
                      textAlign: "center",
                    }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{row.playerName}</div>
                      <div style={{ fontSize: 12, color: "var(--faint)" }}>{row.fantasyTeamName} &middot; Week {row.week}</div>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? "var(--gold)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                      {row.fp.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function RecordCard({ icon, title, value, detail }: {
  icon: string;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "20px 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--dim)", margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--faint)" }}>{detail}</div>
    </div>
  );
}
