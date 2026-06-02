/**
 * Playoff bracket generation and management.
 * 
 * Handles:
 * - Seeding teams based on regular season standings
 * - Generating single-elimination bracket structure
 * - Computing matchup pairings for each round
 * - Tracking bracket state and results
 */

export interface PlayoffSettings {
  teamsInPlayoff: number;
  topSeedsWithBye: number;
  roundDurationPeriods: number;
  higherSeedWinsTies: boolean;
}

export interface SeededTeam {
  fantasyTeamId: string;
  teamName: string;
  seed: number;
  points: number;
  hasBye: boolean;
}

export interface BracketMatchup {
  round: number;
  matchupNumber: number;
  homeTeam: SeededTeam | null; // null if bye or not yet determined
  awayTeam: SeededTeam | null;
  homeScore?: number;
  awayScore?: number;
  winner?: SeededTeam; // populated after matchup is scored
}

export interface PlayoffBracket {
  leagueId: string;
  generatedAt: Date;
  settings: PlayoffSettings;
  seededTeams: SeededTeam[];
  rounds: BracketMatchup[][];
  currentRound: number;
}

/**
 * Seed teams based on playoff points with tiebreaker.
 * Higher seed (lower number) wins tiebreakers.
 */
export function seedTeams(
  standings: Array<{ fantasyTeamId: string; teamName: string; points: number }>,
  playoffSettings: PlayoffSettings,
  tiebreaker?: (a: any, b: any) => number
): SeededTeam[] {
  const { teamsInPlayoff, topSeedsWithBye } = playoffSettings;

  // Take top N teams
  const eligible = standings.slice(0, teamsInPlayoff);

  // Sort by points (descending), then by tiebreaker if provided
  const sorted = [...eligible].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return tiebreaker ? tiebreaker(a, b) : 0;
  });

  // Assign seeds and bye status
  return sorted.map((team, index) => ({
    fantasyTeamId: team.fantasyTeamId,
    teamName: team.teamName,
    seed: index + 1,
    points: team.points,
    hasBye: index < topSeedsWithBye,
  }));
}

/**
 * Generate a single-elimination bracket from seeded teams.
 * 
 * For 6 teams with top 2 byes:
 * Round 1: 3v6, 4v5 (1 and 2 have bye)
 * Round 2: 1v(3v6 winner), 2v(4v5 winner)
 * Round 3: Finals between round 2 winners
 */
export function generateBracket(
  leagueId: string,
  seededTeams: SeededTeam[],
  playoffSettings: PlayoffSettings
): PlayoffBracket {
  const { teamsInPlayoff, topSeedsWithBye } = playoffSettings;

  if (seededTeams.length < teamsInPlayoff) {
    throw new Error(
      `Not enough teams for playoff. Expected ${teamsInPlayoff}, got ${seededTeams.length}`
    );
  }

  // Build round 1 matchups
  const round1Matchups: BracketMatchup[] = [];
  let matchupNumber = 1;

  // Bye seeds (seeds 1 to topSeedsWithBye) don't play in round 1
  const byeTeams = seededTeams.slice(0, topSeedsWithBye);
  const playingTeams = seededTeams.slice(topSeedsWithBye);

  // Pair playing teams: lowest seed vs highest, next lowest vs next highest
  for (let i = 0; i < playingTeams.length; i += 2) {
    const homeTeam = playingTeams[i]; // lower seed (higher seed number)
    const awayTeam = playingTeams[i + 1]; // higher seed (lower seed number)

    // Standard bracket: higher seed (lower number) is "home"
    round1Matchups.push({
      round: 1,
      matchupNumber: matchupNumber++,
      homeTeam: awayTeam ? { ...awayTeam } : null,
      awayTeam: homeTeam ? { ...homeTeam } : null,
    });
  }

  // Initialize bracket state
  const rounds: BracketMatchup[][] = [round1Matchups];
  const bracket: PlayoffBracket = {
    leagueId,
    generatedAt: new Date(),
    settings: playoffSettings,
    seededTeams,
    rounds,
    currentRound: 1,
  };

  // Generate subsequent rounds based on participants advancing from the previous round.
  // For 6 teams with 2 byes, round 2 should still have 2 matchups.
  let previousRoundMatchups = round1Matchups.length;
  let nextRoundMatchups = Math.ceil(
    (previousRoundMatchups + byeTeams.length) / 2
  );

  for (let round = 2; previousRoundMatchups > 1; round++) {
    const roundMatchups: BracketMatchup[] = [];

    for (let matchup = 1; matchup <= nextRoundMatchups; matchup++) {
      roundMatchups.push({
        round,
        matchupNumber: matchup,
        homeTeam: null,
        awayTeam: null,
      });
    }

    rounds.push(roundMatchups);
    previousRoundMatchups = nextRoundMatchups;
    nextRoundMatchups = Math.ceil(previousRoundMatchups / 2);

    if (round > 10) {
      break;
    }
  }

  return bracket;
}

/**
 * Get the pairings for a specific round, considering bye status and previous results.
 * 
 * Returns matchups ready to be created as Matchup records in the database.
 */
export function getPairingForRound(
  bracket: PlayoffBracket,
  round: number
): Array<{ homeTeam: SeededTeam; awayTeam: SeededTeam; matchupNumber: number }> {
  const { topSeedsWithBye } = bracket.settings;

  if (round < 1 || round > bracket.rounds.length) {
    throw new Error(`Invalid round ${round}`);
  }

  const roundIndex = round - 1;
  const roundMatchups = bracket.rounds[roundIndex];
  const pairings: Array<{
    homeTeam: SeededTeam;
    awayTeam: SeededTeam;
    matchupNumber: number;
  }> = [];

  if (round === 1) {
    // Round 1: bye teams + first-round winners (or placeholders)
    const byeTeams = bracket.seededTeams.slice(0, topSeedsWithBye);

    roundMatchups.forEach((matchup) => {
      if (matchup.homeTeam && matchup.awayTeam) {
        pairings.push({
          homeTeam: matchup.homeTeam,
          awayTeam: matchup.awayTeam,
          matchupNumber: matchup.matchupNumber,
        });
      }
    });

    // Bye teams paired with round 1 matchups in round 2
  } else {
    // Later rounds: pair previous round winners
    const prevRound = bracket.rounds[roundIndex - 1];

    for (let i = 0; i < prevRound.length; i += 2) {
      const matchup1 = prevRound[i];
      const matchup2 = prevRound[i + 1];

      const winner1 = matchup1.winner;
      const winner2 = matchup2.winner;

      if (winner1 && winner2) {
        pairings.push({
          homeTeam: winner1,
          awayTeam: winner2,
          matchupNumber: (i / 2) + 1,
        });
      }
    }
  }

  return pairings;
}

/**
 * Update bracket with a matchup result.
 * Returns the updated bracket.
 */
export function recordMatchupResult(
  bracket: PlayoffBracket,
  round: number,
  matchupNumber: number,
  homeScore: number,
  awayScore: number,
  higherSeedWinsTies: boolean
): PlayoffBracket {
  if (round < 1 || round > bracket.rounds.length) {
    throw new Error(`Invalid round ${round}`);
  }

  const roundIndex = round - 1;
  const matchup = bracket.rounds[roundIndex].find(
    (m) => m.matchupNumber === matchupNumber
  );

  if (!matchup) {
    throw new Error(`Matchup not found in round ${round}`);
  }

  matchup.homeScore = homeScore;
  matchup.awayScore = awayScore;

  // Determine winner
  let winner: SeededTeam | undefined;
  if (homeScore > awayScore) {
    winner = matchup.homeTeam;
  } else if (awayScore > homeScore) {
    winner = matchup.awayTeam;
  } else {
    // Tie: higher seed wins if enabled
    if (higherSeedWinsTies && matchup.homeTeam && matchup.awayTeam) {
      winner =
        matchup.homeTeam.seed < matchup.awayTeam.seed
          ? matchup.homeTeam
          : matchup.awayTeam;
    } else {
      throw new Error(
        `Tie score in matchup (${homeScore}-${awayScore}), but higher-seed-wins-ties is disabled`
      );
    }
  }

  matchup.winner = winner;

  return bracket;
}

/**
 * Get the current bracket state as JSON (for storage or transmission).
 */
export function serializeBracket(bracket: PlayoffBracket): string {
  return JSON.stringify(bracket, null, 2);
}

/**
 * Reconstruct bracket from serialized JSON.
 */
export function deserializeBracket(json: string): PlayoffBracket {
  const data = JSON.parse(json);
  // Reconstruct Date objects
  data.generatedAt = new Date(data.generatedAt);
  return data as PlayoffBracket;
}
