// lib/services/playoff-service.ts
// Orchestrates playoff operations: loads data, calls pure domain functions,
// writes results back to the DB.
//
// Pattern mirrors lib/season/index.ts. Route handlers call these functions;
// they do not contain business logic themselves.

import type { PrismaClient } from "@prisma/client";
import { computeVpStandings } from "@/lib/scoring/vp";
import { seedTeams, generateBracket } from "@/lib/playoffs/brackets";
import type { PlayoffBracket, SeededTeam } from "@/lib/playoffs/brackets";
import {
  getPlayoffSettings,
  calculatePlayoffRounds,
} from "@/lib/playoffs/lifecycle";
import { generatePlayoffMatchups } from "@/lib/scoring/matchups";
import type { PlayoffMatchupPairing } from "@/lib/scoring/matchups";
import { derivePlayoffPeriods } from "@/lib/playoffs/schedule";
import { emitEvent, type LeagueEventType } from "@/lib/services/activity";

// ─── getBracket ────────────────────────────────────────────────────────────────

export interface BracketResult {
  leagueId: string;
  leagueName: string;
  playoffStatus: string;
  bracket: {
    settings: PlayoffBracket["settings"];
    seededTeams: SeededTeam[];
    rounds: PlayoffBracket["rounds"];
    currentRound: number;
    generatedAt: Date;
  };
}

// Builds and returns the current bracket, hydrated with any existing scored matchups.
export async function getBracket(
  leagueId: string,
  prisma: PrismaClient
): Promise<BracketResult> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { teams: true },
  });

  if (league.playoffStatus === "NOT_STARTED") {
    throw new PlayoffNotStartedError();
  }

  const [matchups, playoffMatchups] = await Promise.all([
    prisma.matchup.findMany({ where: { leagueId } }),
    prisma.matchup.findMany({
      where: { leagueId, isPlayoff: true },
      orderBy: [{ round: "asc" }, { week: "asc" }],
    }),
  ]);

  const vpStandings = computeVpStandings(
    league.teams,
    matchups.map((m) => ({
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeVP: m.homeVP, awayVP: m.awayVP,
      isPlayoff: m.isPlayoff,
    }))
  );
  const playoffSettings = getPlayoffSettings(league.playoffSettings as Parameters<typeof getPlayoffSettings>[0]);

  const seededTeams = seedTeams(
    vpStandings.map((s) => ({
      fantasyTeamId: s.fantasyTeamId,
      teamName: s.teamName,
      points: s.totalVP,
    })),
    playoffSettings
  );

  const bracket = generateBracket(leagueId, seededTeams, playoffSettings);

  // Hydrate bracket rounds with scored matchup results.
  for (const matchup of playoffMatchups) {
    if (matchup.homeScore === null || matchup.awayScore === null || !matchup.round) continue;
    const roundIndex = matchup.round - 1;
    if (roundIndex >= bracket.rounds.length) continue;
    const bracketMatchup = bracket.rounds[roundIndex].find(
      (m) =>
        m.homeTeam?.fantasyTeamId === matchup.homeTeamId ||
        m.awayTeam?.fantasyTeamId === matchup.homeTeamId
    );
    if (!bracketMatchup) continue;
    bracketMatchup.homeScore = matchup.homeScore;
    bracketMatchup.awayScore = matchup.awayScore;
    if (matchup.homeScore > matchup.awayScore) {
      bracketMatchup.winner = bracketMatchup.homeTeam ?? undefined;
    } else if (matchup.awayScore > matchup.homeScore) {
      bracketMatchup.winner = bracketMatchup.awayTeam ?? undefined;
    }
  }

  return {
    leagueId,
    leagueName: league.name,
    playoffStatus: league.playoffStatus,
    bracket: {
      settings: bracket.settings,
      seededTeams: bracket.seededTeams,
      rounds: bracket.rounds,
      currentRound: bracket.currentRound,
      generatedAt: bracket.generatedAt,
    },
  };
}

// ─── startPlayoffs ─────────────────────────────────────────────────────────────

export interface StartPlayoffsResult {
  leagueId: string;
  seededTeams: SeededTeam[];
  totalRounds: number;
  settings: ReturnType<typeof getPlayoffSettings>;
}

// Validates preconditions, seeds teams, generates bracket, creates playoff matchup
// rows, and flips the league's playoffStatus to IN_PROGRESS.
export async function startPlayoffs(
  leagueId: string,
  prisma: PrismaClient
): Promise<StartPlayoffsResult> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { teams: true },
  });

  if (league.playoffStatus !== "NOT_STARTED") {
    throw new Error(`Playoffs already ${league.playoffStatus.toLowerCase()}`);
  }

  const matchups = await prisma.matchup.findMany({ where: { leagueId } });
  const vpStandings = computeVpStandings(
    league.teams,
    matchups.map((m) => ({
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeVP: m.homeVP, awayVP: m.awayVP,
      isPlayoff: m.isPlayoff,
    }))
  );
  const playoffSettings = getPlayoffSettings(league.playoffSettings as Parameters<typeof getPlayoffSettings>[0]);

  if (vpStandings.length < playoffSettings.topSeedsWithBye) {
    throw new Error(
      `Not enough teams for playoffs. Need at least ${playoffSettings.topSeedsWithBye} teams.`
    );
  }

  const seededTeams = seedTeams(
    vpStandings.map((s) => ({
      fantasyTeamId: s.fantasyTeamId,
      teamName: s.teamName,
      points: s.totalVP,
    })),
    playoffSettings
  );

  const bracket = generateBracket(leagueId, seededTeams, playoffSettings);
  const totalRounds = calculatePlayoffRounds(playoffSettings.teamsInPlayoff);

  const games = await prisma.game.findMany({
    where: { season: league.season },
    orderBy: { startsAt: "asc" },
  });

  const playoffPeriods = derivePlayoffPeriods(
    games,
    matchups.length / league.teams.length,
    playoffSettings.roundDurationPeriods,
    totalRounds
  );

  // Build first-round pairings; subsequent rounds are created as results come in.
  const pairings: PlayoffMatchupPairing[] = [];
  for (let i = 0; i < seededTeams.length; i++) {
    const team = seededTeams[i];
    if (team.hasBye) continue;
    const pairedIndex = seededTeams.length - 1 - i;
    if (pairedIndex > i) {
      const period = playoffPeriods[0];
      pairings.push({
        homeTeamId: team.fantasyTeamId,
        awayTeamId: seededTeams[pairedIndex].fantasyTeamId,
        round: 1,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
      });
    }
  }

  // Placeholder rows for subsequent rounds (filled when previous round completes).
  for (let round = 2; round <= totalRounds; round++) {
    const period = playoffPeriods[round - 1];
    pairings.push({ homeTeamId: "", awayTeamId: "", round, startsAt: period.startsAt, endsAt: period.endsAt });
  }

  await generatePlayoffMatchups(leagueId, pairings, prisma);
  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { playoffStatus: "IN_PROGRESS" },
  });

  // Emit qualification events for each team that made the playoffs
  const qualifyingTeams = seededTeams.slice(0, playoffSettings.teamsInPlayoff);
  await Promise.all(
    qualifyingTeams.map((team, i) =>
      emitEvent(
        {
          leagueId,
          teamId: team.fantasyTeamId,
          type: "PLAYOFF_QUALIFICATION" as LeagueEventType,
          data: {
            description: `${team.teamName} qualified for the playoffs (Seed #${i + 1})`,
            teamName: team.teamName,
            seed: i + 1,
          },
        },
        prisma
      )
    )
  );

  return { leagueId, seededTeams: bracket.seededTeams, totalRounds, settings: playoffSettings };
}

// ─── Errors ────────────────────────────────────────────────────────────────────

export class PlayoffNotStartedError extends Error {
  constructor() {
    super("Playoffs have not started yet");
    this.name = "PlayoffNotStartedError";
  }
}
