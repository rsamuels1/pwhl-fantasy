import type { PrismaClient } from "@prisma/client";
import type { ScoringSettings } from "../scoring";
import { computeTeamScoreDetailed } from "../scoring/matchups";
import type { ScoringPeriod } from "../scoring/periods";
import { getRoundLabel } from "../playoffs/brackets";
import { calculatePlayoffRounds } from "../playoffs/lifecycle";
import type { WeeklyRecap, ActivityEvent } from "./dashboard";

export async function getLastResult(
  leagueId: string,
  myTeamId: string,
  scoringSettings: ScoringSettings,
  prisma: PrismaClient,
  isVpMode: boolean
): Promise<WeeklyRecap | null> {
  const last = await prisma.matchup.findFirst({
    where: {
      leagueId,
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [{ homeTeamId: myTeamId }, { awayTeamId: myTeamId }],
    },
    orderBy: [{ round: "desc" }, { week: "desc" }],
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      league: { select: { playoffSettings: true } },
    },
  });
  if (!last) return null;

  const iAmHome = last.homeTeamId === myTeamId;
  const myScore = (iAmHome ? last.homeScore : last.awayScore) ?? 0;
  const opponentScore = (iAmHome ? last.awayScore : last.homeScore) ?? 0;
  const opponentName = iAmHome ? last.awayTeam.name : last.homeTeam.name;

  const period: ScoringPeriod = { week: last.week, startsAt: last.startsAt, endsAt: last.endsAt };
  const [detailed, weekMatchups] = await Promise.all([
    computeTeamScoreDetailed(myTeamId, period, scoringSettings, prisma),
    prisma.matchup.findMany({
      where: { leagueId, week: last.week, homeScore: { not: null }, awayScore: { not: null } },
      include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    }),
  ]);

  const top = [...detailed.players].sort((a, b) => b.points - a.points)[0];
  const myTopPerformer =
    top && top.points > 0 ? { name: top.name, points: top.points } : null;

  const teamScores = new Map<string, number>();
  const teamNames = new Map<string, string>();
  for (const m of weekMatchups) {
    if (!teamScores.has(m.homeTeamId)) { teamScores.set(m.homeTeamId, m.homeScore!); teamNames.set(m.homeTeamId, m.homeTeam.name); }
    if (!teamScores.has(m.awayTeamId)) { teamScores.set(m.awayTeamId, m.awayScore!); teamNames.set(m.awayTeamId, m.awayTeam.name); }
  }

  let closestMatchup: WeeklyRecap["closestMatchup"] = null;
  const seenPairs = new Set<string>();
  for (const m of weekMatchups) {
    const pairKey = [m.homeTeamId, m.awayTeamId].sort().join(":");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    const margin = Math.abs(m.homeScore! - m.awayScore!);
    if (closestMatchup === null || margin < closestMatchup.margin) {
      closestMatchup = { margin: Math.round(margin * 10) / 10, teams: [m.homeTeam.name, m.awayTeam.name] };
    }
  }

  let highestScore: WeeklyRecap["highestScore"] = null;
  for (const [teamId, score] of teamScores) {
    if (highestScore === null || score > highestScore.score) {
      highestScore = { teamName: teamNames.get(teamId) ?? teamId, score };
    }
  }

  const allScores = [...teamScores.values()];
  const myRank = allScores.filter((s) => s > myScore).length + 1;
  const result: WeeklyRecap["result"] = isVpMode
    ? (myScore > opponentScore ? "win" : myScore < opponentScore ? "loss" : "tie")
    : (myRank === 1 ? "win" : "loss");

  const isPlayoff = last.isPlayoff;
  const roundLabel = isPlayoff && last.round
    ? getRoundLabel(last.round, calculatePlayoffRounds((last.league?.playoffSettings as any)?.teamsInPlayoff || 4))
    : undefined;

  const opponentTeamId = iAmHome ? last.awayTeamId : last.homeTeamId;

  return {
    week: last.week, result, myScore, opponentScore, opponentTeamId, opponentName, myTopPerformer,
    myRank, teamsCount: teamScores.size, closestMatchup, highestScore,
    isPlayoff, round: last.round ?? undefined, roundLabel,
  };
}

export async function getLeagueActivityFallback(
  leagueId: string,
  prisma: PrismaClient
): Promise<ActivityEvent[]> {
  const draft = await prisma.draft.findFirst({
    where: { leagueId },
    select: { id: true },
  });
  if (!draft) return [];

  const picks = await prisma.draftPick.findMany({
    where: { draftId: draft.id, playerId: { not: null } },
    orderBy: { overall: "desc" },
    take: 10,
    include: {
      player: { select: { firstName: true, lastName: true } },
      fantasyTeam: { select: { name: true } },
    },
  });

  return picks
    .filter((pick) => pick.player !== null)
    .map((pick) => ({
      id: pick.id,
      type: "DRAFT_PICK",
      description: `${pick.fantasyTeam.name} drafted ${pick.player!.firstName} ${pick.player!.lastName} (Round ${pick.round}, Pick ${pick.overall})`,
      createdAt: pick.pickedAt ?? new Date(0),
    }));
}
