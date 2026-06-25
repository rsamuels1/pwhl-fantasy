// lib/services/storyline-service.ts
// Generates auto-written highlight cards for the league overview page after each week scores.
// All computation is pure (computeWeeklyStorylines); only emitWeeklyStorylines has IO.

import type { PrismaClient } from "@prisma/client";
import { scoreStatLine } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import type { ScoringSettings } from "@/lib/scoring";
import { emitEvent } from "@/lib/services/activity";
import { projectTeamRemainingScore } from "@/lib/projections";

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
      const existing = await prisma.leagueEvent.findFirst({
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
            description: storyline.headline,
          },
        },
        prisma
      );
    }
  } catch (err) {
    console.error("[storyline] emitWeeklyStorylines failed:", err);
  }
}

// ── Weekly Awards ─────────────────────────────────────────────────────────────

export type AwardType =
  | "ice_cold_closer"
  | "heater"
  | "heartbreaker"
  | "collapse"
  | "frozen_stick";

export interface WeeklyAward {
  awardType: AwardType;
  teamId: string;
  teamName: string;
  /** Numeric signal: actual score for closer/stick/heartbreaker; delta FP for heater/collapse. */
  value: number;
}

/**
 * Pure computation (no IO) — derive awards from pre-fetched scores and projections.
 * Returns up to 5 awards (one per type). Skips any where data is insufficient.
 *
 * @param matchups    Scored matchup rows for the week (homeScore/awayScore not null)
 * @param teamNames   Map<teamId, teamName> for all teams
 * @param projected   Map<teamId, projectedScore> at period start (used for heater/collapse)
 * @param isVpMode    Whether this league uses 1v1 VP matchups (heartbreaker needs a defined loser)
 */
export function computeWeeklyAwards(
  matchups: MatchupRow[],
  teamNames: Map<string, string>,
  projected: Map<string, number>,
  isVpMode: boolean
): WeeklyAward[] {
  const awards: WeeklyAward[] = [];

  const scored = matchups.filter(
    (m) => m.homeScore !== null && m.awayScore !== null
  );
  if (scored.length === 0) return awards;

  // Flatten to per-team actual scores (deduplicate: same team can appear home + away in VTF)
  const teamScores = new Map<string, number>();
  for (const m of scored) {
    teamScores.set(m.homeTeam.id, m.homeScore!);
    teamScores.set(m.awayTeam.id, m.awayScore!);
  }

  const teamEntries = [...teamScores.entries()];

  // 🏆 Ice-Cold Closer — highest score
  let closerEntry: [string, number] | null = null;
  for (const e of teamEntries) {
    if (!closerEntry || e[1] > closerEntry[1]) closerEntry = e;
  }
  if (closerEntry) {
    const name = teamNames.get(closerEntry[0]);
    if (name) awards.push({ awardType: "ice_cold_closer", teamId: closerEntry[0], teamName: name, value: closerEntry[1] });
  }

  // 🧊 Frozen Stick — lowest score
  let stickEntry: [string, number] | null = null;
  for (const e of teamEntries) {
    if (!stickEntry || e[1] < stickEntry[1]) stickEntry = e;
  }
  if (stickEntry) {
    const name = teamNames.get(stickEntry[0]);
    if (name) awards.push({ awardType: "frozen_stick", teamId: stickEntry[0], teamName: name, value: stickEntry[1] });
  }

  // 💀 Heartbreaker — highest score among teams who LOST (VP 1v1 mode only)
  if (isVpMode) {
    let heartEntry: { teamId: string; score: number } | null = null;
    for (const m of scored) {
      const homeWon = m.homeScore! >= m.awayScore!;
      const [loserId, loserScore] = homeWon
        ? [m.awayTeam.id, m.awayScore!]
        : [m.homeTeam.id, m.homeScore!];
      if (!heartEntry || loserScore > heartEntry.score) {
        heartEntry = { teamId: loserId, score: loserScore };
      }
    }
    if (heartEntry) {
      const name = teamNames.get(heartEntry.teamId);
      if (name) awards.push({ awardType: "heartbreaker", teamId: heartEntry.teamId, teamName: name, value: heartEntry.score });
    }
  }

  // 🔥 Heater — biggest positive delta (actual - projected)
  if (projected.size > 0) {
    let heaterEntry: { teamId: string; delta: number } | null = null;
    for (const [teamId, actual] of teamScores) {
      const proj = projected.get(teamId);
      if (proj === undefined) continue;
      const delta = actual - proj;
      if (delta > 0 && (!heaterEntry || delta > heaterEntry.delta)) {
        heaterEntry = { teamId, delta };
      }
    }
    if (heaterEntry) {
      const name = teamNames.get(heaterEntry.teamId);
      if (name) awards.push({ awardType: "heater", teamId: heaterEntry.teamId, teamName: name, value: heaterEntry.delta });
    }

    // 📉 Collapse — biggest negative delta
    let collapseEntry: { teamId: string; delta: number } | null = null;
    for (const [teamId, actual] of teamScores) {
      const proj = projected.get(teamId);
      if (proj === undefined) continue;
      const delta = actual - proj;
      if (delta < 0 && (!collapseEntry || delta < collapseEntry.delta)) {
        collapseEntry = { teamId, delta };
      }
    }
    if (collapseEntry) {
      const name = teamNames.get(collapseEntry.teamId);
      if (name) awards.push({ awardType: "collapse", teamId: collapseEntry.teamId, teamName: name, value: collapseEntry.delta });
    }
  }

  return awards;
}

/**
 * IO layer: fetches data, calls computeWeeklyAwards, emits events idempotently.
 * Fire-and-forget safe — catches all errors internally.
 */
export async function emitWeeklyAwards(
  leagueId: string,
  week: number,
  periodStart: Date,
  periodEnd: Date,
  prisma: PrismaClient
): Promise<void> {
  try {
    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { scoringSettings: true, scoringMode: true },
    });
    if (!league) return;

    const scoringSettings = parseScoringSettings(league.scoringSettings);
    const isVpMode = (league.scoringMode ?? "VTF") === "VP";

    const [matchups, allTeams] = await Promise.all([
      prisma.matchup.findMany({
        where: { leagueId, week, isPlayoff: false, homeScore: { not: null } },
        select: {
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
        },
      }),
      prisma.fantasyTeam.findMany({
        where: { leagueId },
        select: { id: true, name: true },
      }),
    ]);

    const teamNames = new Map(allTeams.map((t) => [t.id, t.name]));

    // Compute projections at period START for each team (earnedSoFar=0, nowMs=start+1ms).
    // This gives "what did we expect before any games played."
    const period = { week, startsAt: periodStart, endsAt: periodEnd };
    const projectedEntries = await Promise.all(
      allTeams.map(async (t) => {
        const proj = await projectTeamRemainingScore(
          t.id, 0, period, scoringSettings, prisma,
          periodStart.getTime() + 1
        );
        return [t.id, proj] as [string, number];
      })
    );
    const projected = new Map(projectedEntries);

    const awards = computeWeeklyAwards(
      matchups as MatchupRow[],
      teamNames,
      projected,
      isVpMode
    );

    for (const award of awards) {
      // Idempotency: skip if this award type was already emitted for this week.
      const existing = await prisma.leagueEvent.findFirst({
        where: {
          leagueId,
          type: "LEAGUE_STORYLINE",
          AND: [
            { data: { path: ["week"], equals: week } },
            { data: { path: ["awardType"], equals: award.awardType } },
            { data: { path: ["isAward"], equals: true } },
          ],
        },
      });
      if (existing) continue;

      await emitEvent(
        {
          leagueId,
          teamId: award.teamId,
          type: "LEAGUE_STORYLINE",
          data: {
            week,
            kind: award.awardType,
            awardType: award.awardType,
            isAward: true,
            teamId: award.teamId,
            teamName: award.teamName,
            value: award.value,
          },
        },
        prisma
      );
    }
  } catch (err) {
    console.error("[storyline] emitWeeklyAwards failed:", err);
  }
}
