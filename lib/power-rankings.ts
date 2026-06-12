// lib/power-rankings.ts
// Pure function — no DB access. Computes weekly power rankings from matchup history.

export interface PowerRankRow {
  fantasyTeamId: string;
  teamName: string;
  rank: number;
  prevRank: number | null;
  trend: "up" | "down" | "same" | "new";
  lastWeekScore: number | null;
  last2WeeksAvg: number | null;
  seasonAvg: number;
}

type MatchupInput = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  week: number;
  isPlayoff: boolean;
};

// Extract each team's score per week from VTF matchup rows.
// In VTF, a team appears in many matchup rows in the same week (one per opponent),
// but their score is always the same. We take the first non-null value per team per week.
function extractWeeklyScores(
  teamIds: string[],
  matchups: MatchupInput[]
): Map<string, Map<number, number>> {
  const byTeam = new Map<string, Map<number, number>>();
  for (const id of teamIds) byTeam.set(id, new Map());

  for (const m of matchups) {
    if (m.isPlayoff) continue;
    if (m.homeScore === null || m.awayScore === null) continue;

    const homeWeeks = byTeam.get(m.homeTeamId);
    if (homeWeeks && !homeWeeks.has(m.week)) homeWeeks.set(m.week, m.homeScore);

    const awayWeeks = byTeam.get(m.awayTeamId);
    if (awayWeeks && !awayWeeks.has(m.week)) awayWeeks.set(m.week, m.awayScore);
  }

  return byTeam;
}

function rankTeams(
  teams: { id: string; name: string }[],
  weeklyScores: Map<string, Map<number, number>>,
  throughWeek: number | null
): Array<{ id: string; lastWeek: number | null; last2Avg: number | null; seasonAvg: number }> {
  const scored = teams.map((t) => {
    const weeks = weeklyScores.get(t.id) ?? new Map<number, number>();
    const allWeeks = [...weeks.entries()]
      .filter(([w]) => throughWeek === null || w <= throughWeek)
      .sort((a, b) => b[0] - a[0]);

    const lastWeek = allWeeks[0]?.[1] ?? null;
    const last2 = allWeeks.slice(0, 2).map(([, s]) => s);
    const last2Avg = last2.length > 0 ? last2.reduce((s, v) => s + v, 0) / last2.length : null;
    const all = allWeeks.map(([, s]) => s);
    const seasonAvg = all.length > 0 ? all.reduce((s, v) => s + v, 0) / all.length : 0;

    return { id: t.id, lastWeek, last2Avg, seasonAvg };
  });

  return scored.sort((a, b) => {
    // Primary: last week score (desc)
    if (a.lastWeek !== null && b.lastWeek !== null) {
      if (b.lastWeek !== a.lastWeek) return b.lastWeek - a.lastWeek;
    } else if (a.lastWeek !== null) return -1;
    else if (b.lastWeek !== null) return 1;
    // Secondary: 2-week average (desc)
    if (a.last2Avg !== null && b.last2Avg !== null && b.last2Avg !== a.last2Avg) {
      return b.last2Avg - a.last2Avg;
    }
    // Tertiary: season average (desc)
    return b.seasonAvg - a.seasonAvg;
  });
}

export function computePowerRankings(
  teams: { id: string; name: string }[],
  matchups: MatchupInput[]
): PowerRankRow[] {
  if (teams.length === 0) return [];

  const teamIds = teams.map((t) => t.id);
  const weeklyScores = extractWeeklyScores(teamIds, matchups);

  // Max completed week
  const maxWeek = matchups
    .filter((m) => !m.isPlayoff && m.homeScore !== null)
    .reduce((max, m) => Math.max(max, m.week), 0);

  if (maxWeek === 0) {
    // No completed weeks yet — return teams with empty rankings
    return teams.map((t, i) => ({
      fantasyTeamId: t.id, teamName: t.name,
      rank: i + 1, prevRank: null, trend: "new",
      lastWeekScore: null, last2WeeksAvg: null, seasonAvg: 0,
    }));
  }

  const current = rankTeams(teams, weeklyScores, maxWeek);
  const prev = maxWeek > 1 ? rankTeams(teams, weeklyScores, maxWeek - 1) : null;

  const prevRankMap = prev
    ? new Map(prev.map((r, i) => [r.id, i + 1]))
    : null;

  return current.map((r, i) => {
    const rank = i + 1;
    const prevRank = prevRankMap?.get(r.id) ?? null;

    let trend: PowerRankRow["trend"] = "new";
    if (prevRank !== null) {
      trend = rank < prevRank ? "up" : rank > prevRank ? "down" : "same";
    }

    const teamName = teams.find((t) => t.id === r.id)?.name ?? r.id;

    return {
      fantasyTeamId: r.id,
      teamName,
      rank,
      prevRank,
      trend,
      lastWeekScore: r.lastWeek,
      last2WeeksAvg: r.last2Avg !== null ? Math.round(r.last2Avg * 10) / 10 : null,
      seasonAvg: Math.round(r.seasonAvg * 10) / 10,
    };
  });
}
