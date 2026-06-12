import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/playoffs/seeding";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getGameDays, prevGameDay } from "@/lib/replay/gameDays";
import { scoreStatLine, type ScoringSettings } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import type { Matchup } from "@prisma/client";

function computeStreaks(
  teamIds: string[],
  matchups: Matchup[]
): Map<string, { type: "W" | "L" | "T"; count: number } | null> {
  const map = new Map<string, { type: "W" | "L" | "T"; count: number } | null>();
  for (const teamId of teamIds) {
    const played = matchups
      .filter(
        (m) =>
          (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
          m.homeScore !== null &&
          !m.isPlayoff
      )
      .sort((a, b) => b.week - a.week);

    if (played.length === 0) { map.set(teamId, null); continue; }

    const first = played[0];
    const myScore = first.homeTeamId === teamId ? first.homeScore! : first.awayScore!;
    const oppScore = first.homeTeamId === teamId ? first.awayScore! : first.homeScore!;
    const firstType: "W" | "L" | "T" = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T";

    let count = 0;
    for (const m of played) {
      const ms = m.homeTeamId === teamId ? m.homeScore! : m.awayScore!;
      const os = m.homeTeamId === teamId ? m.awayScore! : m.homeScore!;
      const result: "W" | "L" | "T" = ms > os ? "W" : ms < os ? "L" : "T";
      if (result === firstType) count++;
      else break;
    }

    map.set(teamId, { type: firstType, count });
  }
  return map;
}

// Playoff-race math. Each H2H win = 1 pt, tie = 0.5. A team's max remaining points
// = games left * 1. With that we derive clinch/eliminate relative to the playoff line.
interface RaceInfo {
  status: "clinched" | "eliminated" | "in" | "bubble" | "out";
  gamesBack: number | null; // points behind the playoff line (for teams out)
  cushion: number | null;   // points ahead of the bubble (for teams in)
}

function computeRace(
  standings: { fantasyTeamId: string; points: number; wins: number; losses: number; ties: number }[],
  matchups: Matchup[],
  cutoff: number
): Map<string, RaceInfo> {
  const map = new Map<string, RaceInfo>();
  if (standings.length === 0 || cutoff <= 0 || cutoff >= standings.length) {
    standings.forEach((s) =>
      map.set(s.fantasyTeamId, { status: "in", gamesBack: null, cushion: null })
    );
    return map;
  }

  const totalWeeks = matchups
    .filter((m) => !m.isPlayoff)
    .reduce((max, m) => Math.max(max, m.week), 0);

  const remainingFor = (teamId: string) => {
    const played = matchups.filter(
      (m) => !m.isPlayoff && m.homeScore !== null &&
        (m.homeTeamId === teamId || m.awayTeamId === teamId)
    ).length;
    return Math.max(0, totalWeeks - played);
  };

  // Playoff line = points of the team currently in the last qualifying spot.
  const lineTeam = standings[cutoff - 1];
  const bubbleTeam = standings[cutoff]; // first team out

  standings.forEach((s, i) => {
    const rank = i + 1;
    const inSpot = rank <= cutoff;
    const remaining = remainingFor(s.fantasyTeamId);
    const maxPoints = s.points + remaining;

    let status: RaceInfo["status"];
    if (inSpot) {
      // Clinched if even at our floor, the bubble team's ceiling can't pass us.
      const bubbleCeiling = bubbleTeam.points + remainingFor(bubbleTeam.fantasyTeamId);
      status = bubbleCeiling < s.points ? "clinched" : rank === cutoff ? "bubble" : "in";
    } else {
      // Eliminated if our ceiling can't reach the current line team's points.
      status = maxPoints < lineTeam.points ? "eliminated" : "out";
    }

    map.set(s.fantasyTeamId, {
      status,
      gamesBack: inSpot ? null : Math.round((lineTeam.points - s.points) * 10) / 10,
      cushion: inSpot ? Math.round((s.points - bubbleTeam.points) * 10) / 10 : null,
    });
  });

  return map;
}

export default async function StandingsPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await requireAuth(`/league/${leagueId}/standings`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: { teams: true },
  });

  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    include: { homeTeam: true, awayTeam: true },
  });

  const standings = computeStandings(league.teams, matchups);
  const streaks = computeStreaks(league.teams.map((t) => t.id), matchups);

  // ── Daily FP leaderboard (replay leagues only) ──
  interface FpRow {
    teamId: string;
    teamName: string;
    isMe: boolean;
    total: number;
    today: number; // FP from the most recently completed game day
  }
  let fpLeaderboard: FpRow[] = [];
  if (league.isReplay && (league.status === "IN_SEASON" || league.status === "COMPLETE")) {
    const nowMs = getReplayNow(league, await getDevNow());

    const [rosters, gameDays] = await Promise.all([
      prisma.rosterEntry.findMany({
        where: { fantasyTeam: { leagueId }, slot: { notIn: ["BENCH", "IR"] } },
        select: {
          playerId: true,
          fantasyTeamId: true,
          player: { select: { position: true } },
        },
      }),
      getGameDays(league.season, prisma),
    ]);

    const playerIds = rosters.map((r) => r.playerId);
    const statLines = await prisma.statLine.findMany({
      where: {
        playerId: { in: playerIds },
        game: { season: league.season, startsAt: { lt: new Date(nowMs) } },
      },
      select: {
        playerId: true,
        goals: true, assists: true, shots: true, plusMinus: true,
        penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
        saves: true, goalsAgainst: true, shutout: true, win: true,
        game: { select: { startsAt: true } },
      },
    });

    const scoringSettings: ScoringSettings = parseScoringSettings(league.scoringSettings);
    const playerToTeam = new Map(rosters.map((r) => [r.playerId, r.fantasyTeamId]));
    const playerToPos = new Map(rosters.map((r) => [r.playerId, r.player.position]));
    const prevDay = prevGameDay(nowMs, gameDays);
    const prevDayMs = prevDay?.getTime() ?? 0;

    const teamTotals = new Map<string, { total: number; today: number }>(
      league.teams.map((t) => [t.id, { total: 0, today: 0 }])
    );

    for (const line of statLines) {
      const teamId = playerToTeam.get(line.playerId);
      const pos = playerToPos.get(line.playerId);
      if (!teamId || !pos) continue;
      const fp = scoreStatLine(
        {
          goals: line.goals, assists: line.assists, shots: line.shots,
          plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
          powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
          saves: line.saves, goalsAgainst: line.goalsAgainst,
          shutout: line.shutout, win: line.win,
        },
        pos,
        scoringSettings
      );
      const entry = teamTotals.get(teamId)!;
      entry.total += fp;
      if (prevDay && line.game.startsAt.getTime() >= prevDayMs) {
        entry.today += fp;
      }
    }

    fpLeaderboard = league.teams
      .map((t) => ({
        teamId: t.id,
        teamName: t.name,
        isMe: t.id === myTeam.id,
        total: teamTotals.get(t.id)?.total ?? 0,
        today: teamTotals.get(t.id)?.today ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  const playoffSettings = (league.playoffSettings ?? null) as { teamsInPlayoff?: number } | null;
  const playoffCutoff = playoffSettings?.teamsInPlayoff ?? null;
  const playoffsStarted = league.playoffStatus !== "NOT_STARTED";

  // Playoff race indicators — only meaningful once results exist and before playoffs.
  const hasResults = matchups.some((m) => !m.isPlayoff && m.homeScore !== null);
  const race =
    playoffCutoff !== null && hasResults && !playoffsStarted
      ? computeRace(standings, matchups, playoffCutoff)
      : null;

  // Banner summarizing the user's own playoff status.
  const myRaceIdx = standings.findIndex((s) => s.fantasyTeamId === myTeam.id);
  const myRace = race?.get(myTeam.id) ?? null;
  let myBanner: { text: string; color: string; bg: string } | null = null;
  if (myRace && myRaceIdx >= 0) {
    const rank = myRaceIdx + 1;
    if (myRace.status === "clinched") {
      myBanner = { text: `🎉 You've clinched a playoff spot (currently #${rank}).`, color: "#34d399", bg: "rgba(52,211,153,0.08)" };
    } else if (myRace.status === "eliminated") {
      myBanner = { text: `You've been eliminated from playoff contention (#${rank}).`, color: "#f87171", bg: "rgba(248,113,113,0.07)" };
    } else if (myRace.status === "in" || myRace.status === "bubble") {
      const cushion = myRace.cushion ?? 0;
      myBanner = cushion > 0
        ? { text: `In the playoff picture at #${rank} — ${cushion.toFixed(1)} ${cushion === 1 ? "game" : "games"} clear of the bubble.`, color: "#818cf8", bg: "rgba(99,102,241,0.08)" }
        : { text: `On the playoff bubble at #${rank} — hold your spot.`, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
    } else {
      const gb = myRace.gamesBack ?? 0;
      myBanner = { text: `On the outside at #${rank} — ${gb.toFixed(1)} ${gb === 1 ? "game" : "games"} back of the playoff line.`, color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {myBanner && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: myBanner.bg, border: `1px solid ${myBanner.color}33`,
          fontSize: 13, fontWeight: 600, color: myBanner.color,
        }}>
          {myBanner.text}
        </div>
      )}

      {/* ── Replay: daily FP power rankings ── */}
      {fpLeaderboard.length > 0 && (
        <section style={card}>
          <h2 style={{ fontSize: 18, margin: "0 0 16px", color: "#e2e8f0" }}>
            Season power rankings
            <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b", marginLeft: 10 }}>
              cumulative fantasy points
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {fpLeaderboard.map((row, i) => {
              const rank = i + 1;
              const medalColor = rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#c97d4e" : "#475569";
              return (
                <div key={row.teamId} style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: row.isMe ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                  border: row.isMe ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(148,163,184,0.06)",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: medalColor, textAlign: "center" }}>
                    {rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : rank}
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: row.isMe ? 700 : 500,
                    color: row.isMe ? "#a5b4fc" : "#e2e8f0",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {row.teamName}
                    {row.isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#6366f1" }}>YOU</span>}
                  </span>
                  {row.today > 0 && (
                    <span style={{ fontSize: 12, color: "#34d399", whiteSpace: "nowrap", fontWeight: 600 }}>
                      +{row.today.toFixed(1)}
                    </span>
                  )}
                  <span style={{
                    fontSize: 15, fontWeight: 700, color: "#e2e8f0",
                    fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap",
                  }}>
                    {row.total.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "#334155", marginTop: 12, marginBottom: 0 }}>
            +X = points added on the most recent game day · total = cumulative season FP
          </p>
        </section>
      )}

      <section style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Standings</h1>
          {playoffCutoff !== null && !playoffsStarted && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Top {playoffCutoff} teams qualify for playoffs
            </span>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ color: "#64748b", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Record</th>
                <th style={thStyle}>PF</th>
                <th style={{ ...thStyle, display: "none" }} className="standings-hide-mobile">PA</th>
                <th style={thStyle}>Streak</th>
                {!playoffsStarted && playoffCutoff !== null && (
                  <th style={thStyle} className="standings-hide-mobile">Gap</th>
                )}
              </tr>
            </thead>
            <tbody>
              {standings.map((s, index) => {
                const isMe = s.fantasyTeamId === myTeam.id;
                const streak = streaks.get(s.fantasyTeamId) ?? null;
                const inPlayoffs = playoffCutoff !== null && index < playoffCutoff;
                const onBubble = playoffCutoff !== null && index === playoffCutoff;
                const nextAbove = index > 0 ? standings[index - 1] : null;
                const gapToNext = nextAbove ? (nextAbove.points - s.points).toFixed(1) : null;

                let playoffChip: { label: string; color: string; bg: string } | null = null;
                const raceInfo = race?.get(s.fantasyTeamId) ?? null;
                if (playoffCutoff !== null) {
                  if (playoffsStarted) {
                    playoffChip = inPlayoffs
                      ? { label: "IN", color: "#34d399", bg: "rgba(52,211,153,0.1)" }
                      : { label: "OUT", color: "#64748b", bg: "rgba(100,116,139,0.1)" };
                  } else if (raceInfo?.status === "clinched") {
                    playoffChip = { label: "✓ CLINCHED", color: "#34d399", bg: "rgba(52,211,153,0.12)" };
                  } else if (raceInfo?.status === "eliminated") {
                    playoffChip = { label: "✗ ELIM", color: "#f87171", bg: "rgba(248,113,113,0.1)" };
                  } else if (raceInfo?.status === "bubble" || onBubble) {
                    playoffChip = { label: "BUBBLE", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
                  } else if (inPlayoffs) {
                    playoffChip = { label: "IN", color: "#34d399", bg: "rgba(52,211,153,0.1)" };
                  }
                }

                const streakColor = streak?.type === "W" ? "#34d399" : streak?.type === "L" ? "#f87171" : "#94a3b8";

                return (
                  <tr
                    key={s.fantasyTeamId}
                    style={{
                      background: isMe ? "rgba(99,102,241,0.08)" : "transparent",
                      borderBottom: !playoffsStarted && playoffCutoff !== null && index === playoffCutoff - 1
                        ? "2px dashed rgba(99,102,241,0.3)"
                        : "1px solid rgba(148,163,184,0.08)",
                    }}
                  >
                    <td style={{ ...tdStyle, color: "#475569", fontWeight: 700 }}>{index + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: isMe ? 700 : undefined, color: isMe ? "#a5b4fc" : "#e2e8f0" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {s.teamName}
                        {isMe && <span style={{ fontSize: 10, color: "#6366f1" }}>YOU</span>}
                        {playoffChip && (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            padding: "1px 5px", borderRadius: 3,
                            color: playoffChip.color, background: playoffChip.bg,
                          }}>
                            {playoffChip.label}
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>
                      {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{s.pointsFor.toFixed(1)}</td>
                    <td style={{ ...tdStyle, display: "none" }} className="standings-hide-mobile">
                      {s.pointsAgainst.toFixed(1)}
                    </td>
                    <td style={{ ...tdStyle, color: streakColor, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {streak ? `${streak.type}${streak.count}` : "—"}
                    </td>
                    {!playoffsStarted && playoffCutoff !== null && (
                      <td style={{ ...tdStyle, color: "#475569", fontSize: 12 }} className="standings-hide-mobile">
                        {index === 0 ? "—" : gapToNext === "0.0" ? "tied" : `-${gapToNext}`}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!playoffsStarted && playoffCutoff !== null && (
          <p style={{ fontSize: 12, color: "#475569", marginTop: 14, marginBottom: 0 }}>
            — — — playoff line — — — &nbsp; dashed line separates the top {playoffCutoff} from the rest
          </p>
        )}
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 14,
  color: "#e2e8f0",
};
