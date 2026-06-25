import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Position, type LineupSlot } from "@prisma/client";
import { DEFAULT_SCORING, scoreStatLine } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { generateSnakeOrder, rostersToRounds } from "@/lib/draft/snake";
import { startSeason, advanceSeason } from "@/lib/season";
import { startPlayoffs } from "@/lib/services/playoff-service";
import { computeAllTeamScores } from "@/lib/scoring/matchups";

const FAR_FUTURE = new Date("2027-06-01").getTime();
const SEASON = "2025-26";
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };
const SLOT_CAPS: Record<LineupSlot, number> = {
  FORWARD: 3, DEFENSE: 2, GOALIE: 1, UTIL: 1, BENCH: 6, IR: 0,
};
const TEAM_NAMES = [
  "Sim Alpha", "Sim Beta", "Sim Gamma", "Sim Delta",
  "Sim Epsilon", "Sim Zeta", "Sim Eta", "Sim Theta",
];

function pickSlot(
  position: "FORWARD" | "DEFENSE" | "GOALIE",
  filled: Record<LineupSlot, number>
): LineupSlot | null {
  if (filled[position] < SLOT_CAPS[position]) return position;
  if (position !== "GOALIE" && filled.UTIL < SLOT_CAPS.UTIL) return "UTIL";
  if (filled.BENCH < SLOT_CAPS.BENCH) return "BENCH";
  return null;
}

function positionNeeds(filled: Record<LineupSlot, number>): Position[] {
  const needs: Position[] = [];
  if (filled.GOALIE < SLOT_CAPS.GOALIE) needs.push(Position.GOALIE);
  if (filled.FORWARD < SLOT_CAPS.FORWARD) needs.push(Position.FORWARD);
  if (filled.DEFENSE < SLOT_CAPS.DEFENSE) needs.push(Position.DEFENSE);
  if (filled.UTIL < SLOT_CAPS.UTIL) needs.push(Position.FORWARD, Position.DEFENSE);
  needs.push(Position.FORWARD, Position.DEFENSE, Position.GOALIE);
  return needs;
}

async function autoDraft(leagueId: string): Promise<void> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { draftOrder: "asc" } },
      draft: { include: { picks: { orderBy: { overall: "asc" } } } },
    },
  });

  if (!league.draft) throw new Error("No draft record found.");
  if (league.draft.status === "COMPLETE") return;

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, position: true },
  });

  const statLines = await prisma.statLine.findMany({
    where: { playerId: { in: players.map((p) => p.id) }, game: { season: SEASON } },
    select: {
      playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
      penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
      saves: true, goalsAgainst: true, shutout: true, win: true,
      player: { select: { position: true } },
    },
  });

  const fpByPlayer = new Map<string, number>();
  for (const l of statLines) {
    const fp = scoreStatLine(l, l.player.position, scoringSettings);
    fpByPlayer.set(l.playerId, (fpByPlayer.get(l.playerId) ?? 0) + fp);
  }
  players.sort((a, b) => (fpByPlayer.get(b.id) ?? 0) - (fpByPlayer.get(a.id) ?? 0));

  const rounds = rostersToRounds(ROSTER_SETTINGS);
  const teamIds = league.teams.map((t) => t.id);
  const pickOrder = generateSnakeOrder(teamIds, rounds);
  const pickSlotMap = new Map(league.draft.picks.map((p) => [p.overall, p]));
  const taken = new Set<string>();
  const teamFilled = new Map<string, Record<LineupSlot, number>>(
    teamIds.map((id) => [id, { FORWARD: 0, DEFENSE: 0, GOALIE: 0, UTIL: 0, BENCH: 0, IR: 0 }])
  );

  const pickUpdates: { id: string; playerId: string }[] = [];
  const rosterEntries: { playerId: string; fantasyTeamId: string; slot: LineupSlot }[] = [];

  for (const slot of pickOrder) {
    const pick = pickSlotMap.get(slot.overall);
    if (!pick) continue;
    const filled = teamFilled.get(slot.fantasyTeamId)!;
    let chosen: (typeof players)[number] | null = null;
    for (const pos of positionNeeds(filled)) {
      const c = players.find((p) => p.position === pos && !taken.has(p.id));
      if (c) { chosen = c; break; }
    }
    if (!chosen) chosen = players.find((p) => !taken.has(p.id)) ?? null;
    if (!chosen) break;
    taken.add(chosen.id);
    const assignedSlot = pickSlot(chosen.position as "FORWARD" | "DEFENSE" | "GOALIE", filled);
    if (!assignedSlot) continue;
    filled[assignedSlot]++;
    pickUpdates.push({ id: pick.id, playerId: chosen.id });
    rosterEntries.push({ playerId: chosen.id, fantasyTeamId: slot.fantasyTeamId, slot: assignedSlot });
  }

  await prisma.$transaction([
    ...pickUpdates.map(({ id, playerId }) =>
      prisma.draftPick.update({ where: { id }, data: { playerId, auto: false } })
    ),
    prisma.rosterEntry.createMany({ data: rosterEntries }),
    prisma.draft.update({
      where: { id: league.draft!.id },
      data: { status: "COMPLETE", completedAt: new Date(), currentPick: pickOrder.length + 1 },
    }),
  ]);
}

async function scorePlayoffRound(
  leagueId: string,
  round: number,
  scoringSettings: ReturnType<typeof parseScoringSettings>,
  higherSeedWinsTies: boolean
): Promise<{ winnerId: string }[]> {
  const matchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: true, round, homeTeamId: { not: "" }, awayTeamId: { not: "" } },
  });

  const results: { winnerId: string }[] = [];
  for (const m of matchups) {
    const period = { week: 0, startsAt: m.startsAt, endsAt: m.endsAt };
    const allScores = await computeAllTeamScores(leagueId, period, scoringSettings, prisma);
    const homeScore = allScores.get(m.homeTeamId) ?? 0;
    const awayScore = allScores.get(m.awayTeamId) ?? 0;
    const winnerId =
      homeScore > awayScore ? m.homeTeamId :
      awayScore > homeScore ? m.awayTeamId :
      higherSeedWinsTies ? m.homeTeamId : m.awayTeamId;

    await prisma.matchup.update({ where: { id: m.id }, data: { homeScore, awayScore } });
    results.push({ winnerId });
  }
  return results;
}

async function populateNextRound(leagueId: string, round: number, winnerIds: string[]): Promise<void> {
  if (winnerIds.length < 2) return;

  // Look for existing matchup with empty teams
  let matchup = await prisma.matchup.findFirst({
    where: { leagueId, isPlayoff: true, round, homeTeamId: "" },
  });

  if (matchup) {
    // Update existing placeholder
    await prisma.matchup.update({
      where: { id: matchup.id },
      data: { homeTeamId: winnerIds[0], awayTeamId: winnerIds[1] },
    });
  } else {
    // Check if matchup already exists with teams (created by advance-playoff-round)
    const existing = await prisma.matchup.findFirst({
      where: { leagueId, isPlayoff: true, round },
    });
    if (existing) {
      // Matchup already fully populated, nothing to do
      return;
    }
    // Create the matchup fresh (in case it was never created)
    const allMatchups = await prisma.matchup.findMany({ where: { leagueId, isPlayoff: true } });
    const prevRound = allMatchups.find((m) => m.round === (round - 1));
    if (!prevRound) return;

    const duration = prevRound.endsAt.getTime() - prevRound.startsAt.getTime();
    const startsAt = new Date(prevRound.endsAt);
    const endsAt = new Date(startsAt.getTime() + duration);
    const maxWeekRow = await prisma.matchup.aggregate({
      where: { leagueId, isPlayoff: false },
      _max: { week: true },
    });
    const playoffWeek = (maxWeekRow._max.week ?? 0) + round;

    await prisma.matchup.create({
      data: {
        leagueId,
        week: playoffWeek,
        homeTeamId: winnerIds[0],
        awayTeamId: winnerIds[1],
        startsAt,
        endsAt,
        isPlayoff: true,
        round,
      },
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueSize = 4 } = await req.json().catch(() => ({}));
  const numTeams = Math.min(8, Math.max(4, leagueSize));
  const startTime = Date.now();

  // Verify fixture
  const fixtureGame = await prisma.game.findFirst({ where: { season: SEASON } });
  if (!fixtureGame) {
    return NextResponse.json(
      { error: `No ${SEASON} fixture loaded. Run: npm run seed-fixture -- --season ${SEASON}` },
      { status: 422 }
    );
  }

  // Clean up previous sim league by this route (name prefix match)
  const simTag = "Founder-Sim-";
  const priorLeagues = await prisma.fantasyLeague.findMany({ where: { name: { startsWith: simTag } } });
  for (const prior of priorLeagues) {
    await prisma.draftPick.deleteMany({ where: { draft: { leagueId: prior.id } } });
    await prisma.rosterEntry.deleteMany({ where: { fantasyTeam: { leagueId: prior.id } } });
    await prisma.draft.deleteMany({ where: { leagueId: prior.id } });
    await prisma.matchup.deleteMany({ where: { leagueId: prior.id } });
    await prisma.leagueEvent.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyLeague.delete({ where: { id: prior.id } });
  }

  // Create commissioner user (upsert — idempotent)
  const commissioner = await prisma.user.upsert({
    where: { email: "founder-sim@dev.local" },
    update: {},
    create: { email: "founder-sim@dev.local", displayName: "Founder Sim" },
  });

  const leagueName = `${simTag}${numTeams}T-${Date.now()}`;
  const league = await prisma.fantasyLeague.create({
    data: {
      name: leagueName,
      season: SEASON,
      maxTeams: numTeams,
      status: "PRE_DRAFT",
      commissionerId: commissioner.id,
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: ROSTER_SETTINGS,
      draftStartsAt: new Date(),
      scoringMode: "VP",
    },
  });
  const leagueId = league.id;

  // Create teams
  const teams: { id: string; name: string }[] = [];
  for (let i = 1; i <= numTeams; i++) {
    const owner = i === 1 ? commissioner : await prisma.user.upsert({
      where: { email: `founder-sim-${i}@dev.local` },
      update: {},
      create: { email: `founder-sim-${i}@dev.local`, displayName: `Sim Owner ${i}` },
    });
    const team = await prisma.fantasyTeam.create({
      data: { name: TEAM_NAMES[i - 1] ?? `Team ${i}`, leagueId, ownerId: owner.id, draftOrder: i },
    });
    teams.push(team);
  }

  // Create draft + picks skeleton
  const rounds = rostersToRounds(ROSTER_SETTINGS);
  await prisma.draft.create({
    data: {
      leagueId,
      status: "PENDING",
      pickTimerSecs: 30,
      currentPick: 1,
      picks: {
        createMany: {
          data: generateSnakeOrder(teams.map((t) => t.id), rounds).map((slot) => ({
            overall: slot.overall,
            round: slot.round,
            fantasyTeamId: slot.fantasyTeamId,
          })),
        },
      },
    },
  });

  // Auto-draft
  await autoDraft(leagueId);

  // Start + advance regular season
  await startSeason(leagueId, prisma);
  const { scoredWeeks } = await advanceSeason(leagueId, FAR_FUTURE, prisma);

  // Ensure playoffs started (advanceSeason auto-calls startPlayoffs; verify)
  const leagueAfter = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { playoffStatus: true, playoffSettings: true },
  });
  if (leagueAfter.playoffStatus === "NOT_STARTED") {
    await startPlayoffs(leagueId, prisma);
  }

  // Score playoff rounds
  const settings = (leagueAfter.playoffSettings as { teamsInPlayoff?: number; higherSeedWinsTies?: boolean } | null) ?? {};
  const teamsInPlayoff = settings.teamsInPlayoff ?? 4;
  const higherSeedWinsTies = settings.higherSeedWinsTies ?? true;
  const totalRounds = Math.ceil(Math.log2(teamsInPlayoff));
  const scoringSettings = parseScoringSettings(DEFAULT_SCORING as object);

  let championId: string | null = null;
  for (let round = 1; round <= totalRounds; round++) {
    const roundResults = await scorePlayoffRound(leagueId, round, scoringSettings, higherSeedWinsTies);
    const winnerIds = roundResults.map((r) => r.winnerId);
    if (round < totalRounds) {
      await populateNextRound(leagueId, round + 1, winnerIds);
    } else {
      championId = winnerIds[0] ?? null;
    }
  }

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { playoffStatus: "COMPLETE", status: "COMPLETE" },
  });

  const champion = teams.find((t) => t.id === championId);

  return NextResponse.json({
    leagueId,
    champion: champion?.name ?? championId ?? "Unknown",
    weeks: scoredWeeks.length,
    playoffRounds: totalRounds,
    durationMs: Date.now() - startTime,
    pass: true,
  });
}
