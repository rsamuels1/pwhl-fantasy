// lib/services/morning-skate-service.ts
// Generates a weekly "Morning Skate" newsletter edition after each period scores.
// Pure generation in generateEdition(); IO (idempotency + persistence) in emitMorningSkateEdition().

import type { PrismaClient } from "@prisma/client";
import { computeVpStandings } from "@/lib/scoring/vp";
import { computeWeeklyAwards } from "@/lib/services/storyline-service";
import { getLeagueActivity } from "@/lib/services/activity";
import { parseScoringSettings } from "@/lib/scoring/settings";

export interface EditionSection {
  title: string;
  blurbs: string[];
}

export interface EditionData {
  headline: string;
  lede: string;
  sections: EditionSection[];
}

/**
 * Assembles an EditionData object from pre-fetched league data.
 * Pure — no IO side effects.
 */
export async function generateEdition(
  leagueId: string,
  periodId: string,
  prisma: PrismaClient
): Promise<EditionData> {
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { name: true, scoringSettings: true, scoringMode: true, season: true },
  });
  if (!league) throw new Error(`League ${leagueId} not found`);

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // Load the period (matchup row gives us week + date range)
  const periodMatchup = await prisma.matchup.findFirst({
    where: { leagueId, isPlayoff: false, homeScore: { not: null } },
    orderBy: { week: "desc" },
    select: { week: true, startsAt: true, endsAt: true },
  });
  const week = periodMatchup?.week ?? 1;

  // Load all teams + scored matchups for standings
  const [allTeams, allMatchups] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true },
    }),
    prisma.matchup.findMany({
      where: { leagueId },
      select: {
        homeTeamId: true, awayTeamId: true,
        homeScore: true, awayScore: true,
        homeVP: true, awayVP: true,
        isPlayoff: true, week: true,
      },
    }),
  ]);

  // Standings snapshot
  const standings = computeVpStandings(allTeams, allMatchups);
  const top3 = standings.slice(0, 3);

  // This week's scored matchups
  const weekMatchups = allMatchups
    .filter((m) => !m.isPlayoff && m.week === week && m.homeScore !== null && m.awayScore !== null)
    .map((m) => ({
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
      homeTeam: { id: m.homeTeamId, name: allTeams.find((t) => t.id === m.homeTeamId)?.name ?? m.homeTeamId },
      awayTeam: { id: m.awayTeamId, name: allTeams.find((t) => t.id === m.awayTeamId)?.name ?? m.awayTeamId },
    }));

  // Top scorer for the week
  const teamScores = new Map<string, number>();
  for (const m of weekMatchups) {
    teamScores.set(m.homeTeam.id, m.homeScore);
    teamScores.set(m.awayTeam.id, m.awayScore);
  }
  let topScorerEntry: { name: string; score: number } | null = null;
  for (const [teamId, score] of teamScores) {
    if (!topScorerEntry || score > topScorerEntry.score) {
      topScorerEntry = { name: allTeams.find((t) => t.id === teamId)?.name ?? teamId, score };
    }
  }

  // Weekly awards (use existing pure function)
  const teamNames = new Map(allTeams.map((t) => [t.id, t.name]));
  const isVpMode = (league.scoringMode ?? "VP") === "VP";
  const awards = computeWeeklyAwards(weekMatchups, teamNames, new Map(), isVpMode);
  const topAward = awards.find((a) => a.awardType === "ice_cold_closer") ?? awards[0] ?? null;

  // Activity feed (1-2 notable events)
  const activity = await getLeagueActivity(leagueId, 5, prisma).catch(() => []);
  const recentEvents = activity.slice(0, 2);

  // Build headline from top award or top scorer
  const headline = topAward
    ? `${topAward.teamName} takes the top spot — Week ${week} in the ${league.name}`
    : `Week ${week} in the ${league.name}`;

  // Lede: plain-English one-sentence summary
  const lede = topScorerEntry
    ? `${topScorerEntry.name} led the week with ${topScorerEntry.score.toFixed(1)} Fantasy Points (FP), while the standings race tightens heading into Week ${week + 1}.`
    : `Week ${week} of the ${league.name} is in the books — here's what you missed.`;

  // Section 1: Standings snapshot
  const standingsBlurbs: string[] = [];
  if (top3.length > 0) {
    standingsBlurbs.push(
      `${top3[0].teamName} leads the ${league.name} with ${top3[0].totalVP} VP (${top3[0].wins}–${top3[0].losses}).`
    );
  }
  if (top3.length > 1) {
    standingsBlurbs.push(
      `${top3[1].teamName} sits second with ${top3[1].totalVP} VP, ${top3[0].totalVP - top3[1].totalVP} back.`
    );
  }
  if (top3.length > 2) {
    standingsBlurbs.push(
      `${top3[2].teamName} is third with ${top3[2].totalVP} VP — still very much in the hunt.`
    );
  }

  // Section 2: Week recap
  const recapBlurbs: string[] = [];
  if (topScorerEntry) {
    recapBlurbs.push(`${topScorerEntry.name} led the week with ${topScorerEntry.score.toFixed(1)} FP — the high-water mark for Week ${week}.`);
  }
  if (weekMatchups.length > 0) {
    // Closest matchup
    let closest: typeof weekMatchups[0] | null = null;
    let smallestMargin = Infinity;
    for (const m of weekMatchups) {
      const margin = Math.abs(m.homeScore - m.awayScore);
      if (margin < smallestMargin) {
        smallestMargin = margin;
        closest = m;
      }
    }
    if (closest && smallestMargin < 20) {
      const homeWon = closest.homeScore >= closest.awayScore;
      const winner = homeWon ? closest.homeTeam.name : closest.awayTeam.name;
      const loser = homeWon ? closest.awayTeam.name : closest.homeTeam.name;
      recapBlurbs.push(`${winner} edged ${loser} by ${smallestMargin.toFixed(1)} FP in the week's closest result.`);
    }
  }
  if (recapBlurbs.length < 2) {
    recapBlurbs.push(`Week ${week} results are locked in — check the scoreboard for the full breakdown.`);
  }

  // Section 3: Awards
  const awardBlurbs: string[] = [];
  const AWARD_LABELS: Record<string, string> = {
    ice_cold_closer: "Ice-Cold Closer (highest weekly score)",
    frozen_stick: "Frozen Stick (lowest score of the week)",
    heater: "Heater (biggest over-projection)",
    collapse: "Collapse (biggest under-projection)",
    heartbreaker: "Heartbreaker (most FP by a losing team)",
  };
  for (const award of awards.slice(0, 3)) {
    const label = AWARD_LABELS[award.awardType] ?? award.awardType;
    awardBlurbs.push(`${award.teamName} earned the ${label} with ${Math.abs(award.value).toFixed(1)} FP.`);
  }
  if (awardBlurbs.length === 0) {
    awardBlurbs.push("Awards will appear once the week's stats are finalized.");
  }

  // Section 4: Around the league
  const aroundBlurbs: string[] = [];
  for (const event of recentEvents) {
    if (event.description && event.description !== event.type) {
      aroundBlurbs.push(event.description);
    }
  }
  if (aroundBlurbs.length === 0) {
    aroundBlurbs.push(`Activity from around the ${league.name} — trades, adds, and drops — are tracked in the Transactions feed.`);
  }
  if (aroundBlurbs.length < 2) {
    aroundBlurbs.push(`Stay sharp: Week ${week + 1} lineups lock when games begin. Check your roster now.`);
  }

  return {
    headline,
    lede,
    sections: [
      { title: "Standings", blurbs: standingsBlurbs },
      { title: "Week Recap", blurbs: recapBlurbs },
      { title: "Weekly Awards", blurbs: awardBlurbs },
      { title: "Around the League", blurbs: aroundBlurbs },
    ],
  };
}

/**
 * IO layer: checks for an existing edition (idempotent), then generates and persists.
 */
export async function emitMorningSkateEdition(
  leagueId: string,
  periodId: string,
  prisma: PrismaClient
): Promise<void> {
  const existing = await prisma.morningSkateEdition.findUnique({
    where: { leagueId_periodId: { leagueId, periodId } },
  });
  if (existing) return;

  const editionData = await generateEdition(leagueId, periodId, prisma);

  await prisma.morningSkateEdition.create({
    data: {
      leagueId,
      periodId,
      data: editionData as object,
    },
  });
}
