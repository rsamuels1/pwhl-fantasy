// lib/services/superlatives.ts
// Pure function — no IO. Computes end-of-season superlative labels for each team.
// Input: all teams, all scored regular-season matchups.

export interface Superlative {
  label: string;
  description: string;
  icon: string;
}

interface TeamRow {
  fantasyTeamId: string;
  teamName: string;
}

interface MatchupRow {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  week: number;
  isPlayoff: boolean;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * For VTF leagues (homeScore = this team's FP, all matchups are "home"),
 * derive wins by ranking scores against the full field each week.
 *
 * Returns W-L-T for each team across the whole season.
 */
function deriveVtfRecord(
  teamIds: string[],
  matchups: MatchupRow[]
): Map<string, { wins: number; losses: number; ties: number; scores: number[] }> {
  const result = new Map<string, { wins: number; losses: number; ties: number; scores: number[] }>();
  for (const id of teamIds) {
    result.set(id, { wins: 0, losses: 0, ties: 0, scores: [] });
  }

  const weeks = [...new Set(matchups.map((m) => m.week))];
  for (const week of weeks) {
    const weekMatchups = matchups.filter((m) => m.week === week && m.homeScore !== null);
    const entries = weekMatchups.map((m) => ({ teamId: m.homeTeamId, score: m.homeScore! }));

    for (const e of entries) {
      const rec = result.get(e.teamId);
      if (!rec) continue;
      rec.scores.push(e.score);
      const wins = entries.filter((x) => x.score < e.score).length;
      const losses = entries.filter((x) => x.score > e.score).length;
      const ties = entries.filter((x) => x.score === e.score).length - 1;
      rec.wins += wins;
      rec.losses += losses;
      rec.ties += Math.max(0, ties);
    }
  }
  return result;
}

export function computeSuperlatives(
  teams: TeamRow[],
  matchups: MatchupRow[]
): Map<string, Superlative[]> {
  const regularMatchups = matchups.filter((m) => !m.isPlayoff && m.homeScore !== null);
  const result = new Map<string, Superlative[]>();
  for (const t of teams) result.set(t.fantasyTeamId, []);

  if (regularMatchups.length === 0 || teams.length < 2) return result;

  const records = deriveVtfRecord(
    teams.map((t) => t.fantasyTeamId),
    regularMatchups
  );

  const weeks = [...new Set(regularMatchups.map((m) => m.week))].sort((a, b) => a - b);
  const midpoint = Math.floor(weeks.length / 2);
  const firstHalfWeeks = new Set(weeks.slice(0, midpoint));
  const secondHalfWeeks = new Set(weeks.slice(midpoint));

  // Half-season records
  const firstHalfMatchups = regularMatchups.filter((m) => firstHalfWeeks.has(m.week));
  const secondHalfMatchups = regularMatchups.filter((m) => secondHalfWeeks.has(m.week));
  const firstHalfRecords = deriveVtfRecord(teams.map((t) => t.fantasyTeamId), firstHalfMatchups);
  const secondHalfRecords = deriveVtfRecord(teams.map((t) => t.fantasyTeamId), secondHalfMatchups);

  // ── Award: Top Scorer ────────────────────────────────────────────
  let topScorerTeamId: string | null = null;
  let topScorerTotal = -Infinity;
  for (const [teamId, rec] of records) {
    const total = rec.scores.reduce((a, b) => a + b, 0);
    if (total > topScorerTotal) {
      topScorerTotal = total;
      topScorerTeamId = teamId;
    }
  }
  if (topScorerTeamId) {
    result.get(topScorerTeamId)!.push({
      label: "Top Scorer",
      description: `Led the league with ${topScorerTotal.toFixed(1)} total FP this season.`,
      icon: "🔥",
    });
  }

  // ── Award: Feast or Famine (highest score variance) ─────────────
  let highestVarianceTeamId: string | null = null;
  let highestStdDev = -Infinity;
  for (const [teamId, rec] of records) {
    if (rec.scores.length < 2) continue;
    const sd = stdDev(rec.scores);
    if (sd > highestStdDev) {
      highestStdDev = sd;
      highestVarianceTeamId = teamId;
    }
  }
  if (highestVarianceTeamId) {
    result.get(highestVarianceTeamId)!.push({
      label: "Feast or Famine",
      description: "All-or-nothing on any given week — either dominant or quiet.",
      icon: "🎢",
    });
  }

  // ── Award: Steady Eddie (lowest score variance) ──────────────────
  let lowestVarianceTeamId: string | null = null;
  let lowestStdDev = Infinity;
  for (const [teamId, rec] of records) {
    if (rec.scores.length < 2) continue;
    const sd = stdDev(rec.scores);
    // Skip the same team as Feast or Famine
    if (teamId === highestVarianceTeamId) continue;
    if (sd < lowestStdDev) {
      lowestStdDev = sd;
      lowestVarianceTeamId = teamId;
    }
  }
  if (lowestVarianceTeamId) {
    result.get(lowestVarianceTeamId)!.push({
      label: "Steady Eddie",
      description: "The most consistent team in the league week in and week out.",
      icon: "⚖️",
    });
  }

  // ── Award: Hot Start (best first-half record) ────────────────────
  if (firstHalfWeeks.size >= 2) {
    let hotStartTeamId: string | null = null;
    let hotStartWins = -1;
    for (const [teamId, rec] of firstHalfRecords) {
      if (rec.wins > hotStartWins) {
        hotStartWins = rec.wins;
        hotStartTeamId = teamId;
      }
    }
    if (hotStartTeamId) {
      result.get(hotStartTeamId)!.push({
        label: "Hot Start",
        description: "Came out of the gate firing — best record in the first half of the season.",
        icon: "🚀",
      });
    }
  }

  // ── Award: Strong Finish (best second-half record) ───────────────
  if (secondHalfWeeks.size >= 2) {
    let strongFinishTeamId: string | null = null;
    let strongFinishWins = -1;
    for (const [teamId, rec] of secondHalfRecords) {
      if (rec.wins > strongFinishWins) {
        strongFinishWins = rec.wins;
        strongFinishTeamId = teamId;
      }
    }
    if (strongFinishTeamId) {
      result.get(strongFinishTeamId)!.push({
        label: "Strong Finish",
        description: "Turned it on when it mattered most — best record in the second half.",
        icon: "📈",
      });
    }
  }

  return result;
}
