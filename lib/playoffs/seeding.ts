/**
 * Playoff seeding and standings computation.
 * 
 * Handles:
 * - Computing regular season standings from matchups
 * - Playoff eligibility checks
 * - Tiebreaker logic (head-to-head, points for/against, etc.)
 */

import { FantasyLeague, FantasyTeam, Matchup } from "@prisma/client";

export interface Standing {
  fantasyTeamId: string;
  teamName: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

/**
 * Compute regular season standings from completed matchups.
 * 
 * Returns teams sorted by:
 * 1. Total points (descending)
 * 2. Wins (descending) - if points tie
 * 3. Head-to-head results (descending) - if still tied
 * 4. Points for (descending) - if still tied
 */
export function computeStandings(
  teams: Array<FantasyTeam & { _count?: { homeMatchups: number; awayMatchups: number } }>,
  matchups: Matchup[]
): Standing[] {
  // Initialize standings for each team
  const standings = new Map<string, Standing>();
  teams.forEach((team) => {
    standings.set(team.id, {
      fantasyTeamId: team.id,
      teamName: team.name,
      points: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  });

  // Filter to regular season matchups only
  const regularSeasonMatchups = matchups.filter(
    (m) => !m.isPlayoff && m.homeScore !== null && m.awayScore !== null
  );

  // Aggregate scores
  regularSeasonMatchups.forEach((matchup) => {
    const homeStanding = standings.get(matchup.homeTeamId);
    const awayStanding = standings.get(matchup.awayTeamId);

    if (!homeStanding || !awayStanding) return;

    const homeScore = matchup.homeScore!;
    const awayScore = matchup.awayScore!;

    homeStanding.pointsFor += homeScore;
    homeStanding.pointsAgainst += awayScore;
    awayStanding.pointsFor += awayScore;
    awayStanding.pointsAgainst += homeScore;

    // Award wins/losses/ties (standard: 1 point per win, 0.5 per tie, 0 per loss)
    if (homeScore > awayScore) {
      homeStanding.wins++;
      homeStanding.points += 1;
      awayStanding.losses++;
    } else if (awayScore > homeScore) {
      awayStanding.wins++;
      awayStanding.points += 1;
      homeStanding.losses++;
    } else {
      homeStanding.ties++;
      homeStanding.points += 0.5;
      awayStanding.ties++;
      awayStanding.points += 0.5;
    }
  });

  // Sort by standings (points, then wins, then points for)
  const sorted = Array.from(standings.values()).sort((a, b) => {
    // Primary: total points
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    // Secondary: wins
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    // Tertiary: points for
    return b.pointsFor - a.pointsFor;
  });

  return sorted;
}

/**
 * Check if a team is eligible for playoffs based on league settings.
 */
export function isPlayoffEligible(
  ranking: number,
  playoffSettings: {
    teamsInPlayoff: number;
  }
): boolean {
  return ranking <= playoffSettings.teamsInPlayoff;
}

/**
 * Compute head-to-head record between two teams.
 * Used as a tiebreaker.
 */
export function getHeadToHeadRecord(
  team1Id: string,
  team2Id: string,
  matchups: Matchup[]
): { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number } {
  const h2h = {
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  };

  const relevant = matchups.filter(
    (m) =>
      !m.isPlayoff &&
      m.homeScore !== null &&
      m.awayScore !== null &&
      ((m.homeTeamId === team1Id && m.awayTeamId === team2Id) ||
        (m.homeTeamId === team2Id && m.awayTeamId === team1Id))
  );

  relevant.forEach((matchup) => {
    const isHome = matchup.homeTeamId === team1Id;
    const team1Score = isHome ? matchup.homeScore! : matchup.awayScore!;
    const team2Score = isHome ? matchup.awayScore! : matchup.homeScore!;

    h2h.pointsFor += team1Score;
    h2h.pointsAgainst += team2Score;

    if (team1Score > team2Score) {
      h2h.wins++;
    } else if (team2Score > team1Score) {
      h2h.losses++;
    } else {
      h2h.ties++;
    }
  });

  return h2h;
}

/**
 * Playoff race math.
 * Each H2H win = 1 pt, tie = 0.5. A team's max remaining = games left × 1.
 * Derives clinch/eliminate status relative to the playoff line.
 */
export interface RaceInfo {
  status: "clinched" | "eliminated" | "in" | "bubble" | "out";
  gamesBack: number | null;  // points behind playoff line (teams out only)
  cushion: number | null;    // points ahead of bubble (teams in only)
}

export function computeRace(
  standings: Pick<Standing, "fantasyTeamId" | "points" | "wins" | "losses" | "ties">[],
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

  const lineTeam = standings[cutoff - 1];   // last team in
  const bubbleTeam = standings[cutoff];     // first team out

  standings.forEach((s, i) => {
    const rank = i + 1;
    const inSpot = rank <= cutoff;
    const remaining = remainingFor(s.fantasyTeamId);
    const maxPoints = s.points + remaining;

    let status: RaceInfo["status"];
    if (inSpot) {
      const bubbleCeiling = bubbleTeam.points + remainingFor(bubbleTeam.fantasyTeamId);
      status = bubbleCeiling < s.points ? "clinched" : rank === cutoff ? "bubble" : "in";
    } else {
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

/**
 * Get playoff standings (top N teams sorted by seed).
 * Called after regular season completes.
 */
export function getPlayoffStandings(
  standings: Standing[],
  playoffSettings: {
    teamsInPlayoff: number;
  }
): Standing[] {
  return standings.slice(0, playoffSettings.teamsInPlayoff);
}
