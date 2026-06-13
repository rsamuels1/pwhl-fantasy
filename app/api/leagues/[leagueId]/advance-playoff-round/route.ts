// app/api/leagues/[leagueId]/advance-playoff-round/route.ts
// Commissioner-only: score the current playoff round and populate the next round's
// matchup (or mark the league COMPLETE if this was the final round).

import type { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { computeAllTeamScores } from "@/lib/scoring/matchups";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getPlayoffSettings, calculatePlayoffRounds } from "@/lib/playoffs/lifecycle";
import { emitEvent, type LeagueEventType } from "@/lib/services/activity";
import { getRoundLabel } from "@/lib/playoffs/brackets";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueId } = await params;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { playoffStatus: true, playoffSettings: true, scoringSettings: true },
  });

  if (league.playoffStatus !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Playoffs are not currently in progress." },
      { status: 409 }
    );
  }

  // Find all playoff matchups that are fully populated (both teams set) but not yet scored
  // to identify the current active round.
  const allPlayoffMatchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: true },
    orderBy: { round: "asc" },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
  });

  // The "current round" is the highest round that has matchups with both teams set
  // but at least one matchup is not yet scored (homeScore === null).
  const populatedMatchups = allPlayoffMatchups.filter(
    (m) => m.homeTeamId && m.awayTeamId && m.homeTeamId !== "" && m.awayTeamId !== ""
  );

  // Find unscoredpopulated matchups to determine the current active round
  const unscoredPopulated = populatedMatchups.filter((m) => m.homeScore === null);

  if (unscoredPopulated.length === 0) {
    return NextResponse.json(
      { error: "No incomplete playoff round found. All rounds may already be scored." },
      { status: 409 }
    );
  }

  // The current round is the minimum round that still has unscored matchups
  const currentRound = Math.min(...unscoredPopulated.map((m) => m.round ?? 1));
  const currentRoundMatchups = unscoredPopulated.filter((m) => (m.round ?? 1) === currentRound);

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const playoffSettings = getPlayoffSettings(
    league.playoffSettings as Parameters<typeof getPlayoffSettings>[0]
  );
  const totalRounds = calculatePlayoffRounds(playoffSettings.teamsInPlayoff);
  const higherSeedWinsTies = playoffSettings.higherSeedWinsTies;

  // Score each matchup in the current round
  const results: Array<{
    matchupId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
    winnerId: string;
  }> = [];

  // Load seeded teams once for tie-breaking by seed
  // (seeded teams: the order in which they appear in the VP standings at playoff start)
  const seededTeamOrder = await getSeededTeamOrder(leagueId, prisma);

  for (const m of currentRoundMatchups) {
    const period = { week: m.week, startsAt: m.startsAt, endsAt: m.endsAt };
    const allScores = await computeAllTeamScores(leagueId, period, scoringSettings, prisma);
    const homeScore = allScores.get(m.homeTeamId) ?? 0;
    const awayScore = allScores.get(m.awayTeamId) ?? 0;

    let winnerId: string;
    if (homeScore > awayScore) {
      winnerId = m.homeTeamId;
    } else if (awayScore > homeScore) {
      winnerId = m.awayTeamId;
    } else if (higherSeedWinsTies) {
      // Tie-break: higher seed (lower seed number) wins
      const homeSeedIdx = seededTeamOrder.indexOf(m.homeTeamId);
      const awaySeedIdx = seededTeamOrder.indexOf(m.awayTeamId);
      // Lower index = higher seed = wins
      winnerId = (homeSeedIdx !== -1 && (awaySeedIdx === -1 || homeSeedIdx < awaySeedIdx))
        ? m.homeTeamId
        : m.awayTeamId;
    } else {
      return NextResponse.json(
        { error: `Tie score in round ${currentRound} with no tie-break rule configured.` },
        { status: 409 }
      );
    }

    await prisma.matchup.update({
      where: { id: m.id },
      data: { homeScore, awayScore },
    });

    results.push({
      matchupId: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeTeamName: m.homeTeam?.name ?? m.homeTeamId,
      awayTeamName: m.awayTeam?.name ?? m.awayTeamId,
      homeScore,
      awayScore,
      winnerId,
    });
  }

  const winnerIds = results.map((r) => r.winnerId);
  const isFinalRound = currentRound >= totalRounds;

  let nextRound: number | null = null;
  let playoffComplete = false;

  if (isFinalRound) {
    // Mark playoffs as complete
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { playoffStatus: "COMPLETE", status: "COMPLETE" },
    });
    playoffComplete = true;
  } else {
    // Populate the next round matchup. It may already exist as a placeholder
    // (created by startPlayoffs for future rounds) or need to be created fresh.
    nextRound = currentRound + 1;
    await populateOrCreateNextRound(leagueId, nextRound, winnerIds, allPlayoffMatchups, prisma);
  }

  // Emit elimination / clinch / championship events for the activity feed
  await Promise.all(
    results.map(async (r) => {
      const loserId   = r.winnerId === r.homeTeamId ? r.awayTeamId   : r.homeTeamId;
      const loserName = r.winnerId === r.homeTeamId ? r.awayTeamName : r.homeTeamName;
      const winnerName = r.winnerId === r.homeTeamId ? r.homeTeamName : r.awayTeamName;
      const roundLabel = getRoundLabel(currentRound, totalRounds);
      const nextLabel  = getRoundLabel(currentRound + 1, totalRounds);

      await emitEvent(
        { leagueId, teamId: loserId, type: "PLAYOFF_ELIMINATION" as LeagueEventType,
          data: { description: `${loserName} eliminated in the ${roundLabel}`, round: currentRound } },
        prisma
      );
      if (isFinalRound) {
        await emitEvent(
          { leagueId, teamId: r.winnerId, type: "CHAMPIONSHIP_WON" as LeagueEventType,
            data: { description: `🏆 ${winnerName} are the champions!`, round: currentRound } },
          prisma
        );
      } else {
        await emitEvent(
          { leagueId, teamId: r.winnerId, type: "PLAYOFF_CLINCH" as LeagueEventType,
            data: { description: `${winnerName} advance to the ${nextLabel}`, round: currentRound } },
          prisma
        );
      }
    })
  );

  return NextResponse.json({
    round: currentRound,
    matchupsScored: results.length,
    results,
    nextRound,
    playoffComplete,
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function getSeededTeamOrder(leagueId: string, prisma: PrismaClient): Promise<string[]> {
  // Reconstruct seed order from the first round playoff matchups (lowest seed / best team goes first)
  // Seeds are inferred from the VP standings used when playoffs were started.
  // We use the order teams appear in round-1 playoff matchups (away teams are typically higher seeds
  // in the convention from brackets.ts, but the simplest approach is to read all teams' round-1
  // appearance and order by their implied seeding from standings).
  // Fall back to all teams ordered by their leagueId (won't matter unless there's a tie).
  const { computeVpStandings } = await import("@/lib/scoring/vp");
  const [teams, allMatchups] = await Promise.all([
    prisma.fantasyTeam.findMany({ where: { leagueId }, select: { id: true, name: true } }),
    prisma.matchup.findMany({ where: { leagueId } }),
  ]);
  const vpStandings = computeVpStandings(
    teams,
    allMatchups.map((m) => ({
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeVP: m.homeVP, awayVP: m.awayVP,
      isPlayoff: m.isPlayoff,
      week: m.week,
    }))
  );
  return vpStandings.map((s) => s.fantasyTeamId);
}

type PlayoffMatchupRow = Awaited<ReturnType<typeof prisma.matchup.findMany>>[number] & {
  homeTeam?: { id: string; name: string } | null;
  awayTeam?: { id: string; name: string } | null;
};

async function populateOrCreateNextRound(
  leagueId: string,
  nextRound: number,
  winnerIds: string[],
  allPlayoffMatchups: PlayoffMatchupRow[],
  prisma: PrismaClient
): Promise<void> {
  if (winnerIds.length < 2) {
    // Odd number of winners (shouldn't happen in our 4-team bracket), nothing to pair
    return;
  }

  // Check if a placeholder already exists for the next round
  const placeholder = allPlayoffMatchups.find(
    (m) => m.isPlayoff && (m.round ?? 0) === nextRound && (m.homeTeamId === "" || m.homeTeamId === null)
  );

  if (placeholder) {
    await prisma.matchup.update({
      where: { id: placeholder.id },
      data: { homeTeamId: winnerIds[0], awayTeamId: winnerIds[1] },
    });
  } else {
    // Look for an existing next-round matchup (may have been pre-created without teams)
    const existingNextRound = allPlayoffMatchups.find(
      (m) => m.isPlayoff && (m.round ?? 0) === nextRound
    );

    if (existingNextRound) {
      await prisma.matchup.update({
        where: { id: existingNextRound.id },
        data: { homeTeamId: winnerIds[0], awayTeamId: winnerIds[1] },
      });
    } else {
      // Create the next-round matchup fresh. Use the same time window as the current round
      // shifted by the same duration.
      const currentRoundMatchup = allPlayoffMatchups.find(
        (m) => m.isPlayoff && (m.round ?? 0) === nextRound - 1
      );
      if (!currentRoundMatchup) return;

      const duration = currentRoundMatchup.endsAt.getTime() - currentRoundMatchup.startsAt.getTime();
      const startsAt = new Date(currentRoundMatchup.endsAt);
      const endsAt = new Date(startsAt.getTime() + duration);

      // Determine week number: maxRegularWeek + nextRound
      const maxWeekRow = await prisma.matchup.aggregate({
        where: { leagueId, isPlayoff: false },
        _max: { week: true },
      });
      const maxRegularWeek = maxWeekRow._max.week ?? 0;
      const playoffWeek = maxRegularWeek + nextRound;

      await prisma.matchup.create({
        data: {
          leagueId,
          week: playoffWeek,
          homeTeamId: winnerIds[0],
          awayTeamId: winnerIds[1],
          startsAt,
          endsAt,
          isPlayoff: true,
          round: nextRound,
        },
      });
    }
  }
}
