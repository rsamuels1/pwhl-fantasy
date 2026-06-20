// lib/services/storyline-service.ts
// Generates auto-written highlight cards for the league overview page after each week scores.
// All computation is pure (computeWeeklyStorylines); only emitWeeklyStorylines has IO.

import type { PrismaClient } from "@prisma/client";
import { scoreStatLine } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import type { ScoringSettings } from "@/lib/scoring";
import { emitEvent } from "@/lib/services/activity";

export type StorylineKind = "closest_match" | "high_score" | "player_standout";

export interface Storyline {
  kind: StorylineKind;
  headline: string;
  detail?: string;
  teamId?: string;
  playerId?: string;
  value: number;
}

// Shape of matchup rows we need from the DB.
interface MatchupRow {
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}

// Shape of stat line rows we need from the DB.
interface StatLineRow {
  playerId: string;
  goals: number;
  assists: number;
  shots: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayPts: number;
  hits: number;
  blocks: number;
  saves: number;
  goalsAgainst: number;
  shutout: boolean;
  win: boolean;
  player: {
    position: string;
    firstName: string;
    lastName: string;
    rosterEntries: Array<{
      fantasyTeamId: string;
      fantasyTeam: { name: string };
    }>;
  };
}

/**
 * Pure computation (no IO) — accepts pre-fetched data.
 * Returns up to 3 storylines for a completed week.
 */
export function computeWeeklyStorylines(
  matchups: MatchupRow[],
  statLines: StatLineRow[],
  scoringSettings: ScoringSettings
): Storyline[] {
  const storylines: Storyline[] = [];

  // ── Storyline 1: closest_match ──────────────────────────────────────────────
  const scoredMatchups = matchups.filter(
    (m) => m.homeScore !== null && m.awayScore !== null
  );

  if (scoredMatchups.length >= 2) {
    let closest: MatchupRow | null = null;
    let smallestMargin = Infinity;

    for (const m of scoredMatchups) {
      const margin = Math.abs(m.homeScore! - m.awayScore!);
      if (margin < smallestMargin) {
        smallestMargin = margin;
        closest = m;
      }
    }

    if (closest) {
      const homeWon = closest.homeScore! >= closest.awayScore!;
      const winner = homeWon ? closest.homeTeam : closest.awayTeam;
      const loser = homeWon ? closest.awayTeam : closest.homeTeam;
      storylines.push({
        kind: "closest_match",
        headline: `${winner.name} edged ${loser.name} by ${smallestMargin.toFixed(1)} pts`,
        teamId: winner.id,
        value: smallestMargin,
      });
    }
  }

  // ── Storyline 2: high_score ─────────────────────────────────────────────────
  if (scoredMatchups.length > 0) {
    let topScore = -Infinity;
    let topTeam: { id: string; name: string } | null = null;

    for (const m of scoredMatchups) {
      if (m.homeScore! > topScore) {
        topScore = m.homeScore!;
        topTeam = m.homeTeam;
      }
      if (m.awayScore! > topScore) {
        topScore = m.awayScore!;
        topTeam = m.awayTeam;
      }
    }

    if (topTeam) {
      storylines.push({
        kind: "high_score",
        headline: `${topTeam.name} put up ${topScore.toFixed(1)} pts — the week's top score`,
        teamId: topTeam.id,
        value: topScore,
      });
    }
  }

  // ── Storyline 3: player_standout ────────────────────────────────────────────
  if (statLines.length > 0) {
    // Aggregate total FP per player across all their stat lines this week.
    const fpByPlayer = new Map<
      string,
      {
        fp: number;
        firstName: string;
        lastName: string;
        teamId: string;
        teamName: string;
        playerId: string;
      }
    >();

    for (const line of statLines) {
      const entry = line.player.rosterEntries[0];
      if (!entry) continue; // no active-slot roster entry, skip

      const fp = scoreStatLine(
        {
          goals: line.goals,
          assists: line.assists,
          shots: line.shots,
          plusMinus: line.plusMinus,
          penaltyMinutes: line.penaltyMinutes,
          powerPlayPts: line.powerPlayPts,
          hits: line.hits,
          blocks: line.blocks,
          saves: line.saves,
          goalsAgainst: line.goalsAgainst,
          shutout: line.shutout,
          win: line.win,
        },
        line.player.position as import("@prisma/client").Position,
        scoringSettings
      );

      const existing = fpByPlayer.get(line.playerId);
      if (existing) {
        existing.fp += fp;
      } else {
        fpByPlayer.set(line.playerId, {
          fp,
          firstName: line.player.firstName,
          lastName: line.player.lastName,
          teamId: entry.fantasyTeamId,
          teamName: entry.fantasyTeam.name,
          playerId: line.playerId,
        });
      }
    }

    if (fpByPlayer.size > 0) {
      let topEntry: (typeof fpByPlayer extends Map<string, infer V> ? V : never) | null = null;
      for (const entry of fpByPlayer.values()) {
        if (!topEntry || entry.fp > topEntry.fp) {
          topEntry = entry;
        }
      }

      if (topEntry) {
        storylines.push({
          kind: "player_standout",
          headline: `${topEntry.firstName} ${topEntry.lastName} dropped ${topEntry.fp.toFixed(1)} pts for ${topEntry.teamName} this week`,
          teamId: topEntry.teamId,
          playerId: topEntry.playerId,
          value: topEntry.fp,
        });
      }
    }
  }

  return storylines;
}

/**
 * IO layer: fetches data, calls computeWeeklyStorylines, emits events idempotently.
 * Fire-and-forget safe — catches all errors internally.
 */
export async function emitWeeklyStorylines(
  leagueId: string,
  week: number,
  periodStart: Date,
  periodEnd: Date,
  prisma: PrismaClient
): Promise<void> {
  try {
    const leagueEventModel = (prisma as unknown as Record<string, unknown>).leagueEvent;
    if (!leagueEventModel) return; // LeagueEvent table not yet available

    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { scoringSettings: true, season: true },
    });
    if (!league) return;

    const scoringSettings = parseScoringSettings(league.scoringSettings);

    // Query A: matchup scores for this week
    const matchups = await prisma.matchup.findMany({
      where: { leagueId, week, isPlayoff: false, homeScore: { not: null } },
      select: {
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });

    // Query B: stat lines for active-slot rostered players during the period
    const rawLines = await prisma.statLine.findMany({
      where: {
        game: {
          startsAt: { gte: periodStart, lt: periodEnd },
          season: league.season,
        },
        player: {
          rosterEntries: {
            some: {
              slot: { notIn: ["BENCH", "IR"] },
              fantasyTeam: { leagueId },
            },
          },
        },
      },
      select: {
        playerId: true,
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
        player: {
          select: {
            position: true,
            firstName: true,
            lastName: true,
            rosterEntries: {
              where: {
                slot: { notIn: ["BENCH", "IR"] },
                fantasyTeam: { leagueId },
              },
              select: {
                fantasyTeamId: true,
                fantasyTeam: { select: { name: true } },
              },
              take: 1,
            },
          },
        },
      },
    });

    const storylines = computeWeeklyStorylines(
      matchups as MatchupRow[],
      rawLines as unknown as StatLineRow[],
      scoringSettings
    );

    // Emit each storyline idempotently (skip if already exists for week + kind)
    for (const storyline of storylines) {
      const existing = await (leagueEventModel as {
        findFirst: (args: unknown) => Promise<unknown>;
      }).findFirst({
        where: {
          leagueId,
          type: "LEAGUE_STORYLINE",
          AND: [
            { data: { path: ["week"], equals: week } },
            { data: { path: ["kind"], equals: storyline.kind } },
          ],
        },
      });
      if (existing) continue;

      await emitEvent(
        {
          leagueId,
          teamId: storyline.teamId,
          playerId: storyline.playerId,
          type: "LEAGUE_STORYLINE",
          data: {
            week,
            kind: storyline.kind,
            headline: storyline.headline,
            detail: storyline.detail,
            value: storyline.value,
          },
        },
        prisma
      );
    }
  } catch (err) {
    console.error("[storyline] emitWeeklyStorylines failed:", err);
  }
}
