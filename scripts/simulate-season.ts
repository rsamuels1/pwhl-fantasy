// scripts/simulate-season.ts
// End-to-end season simulation: Create League → Draft → Weekly Matchups → VP Standings → Playoffs → Champion
//
// Requires the 2025-26 fixture to be loaded:
//   npm run seed-fixture -- --season 2025-26
//
// Usage:
//   npx tsx scripts/simulate-season.ts              # full simulation
//   npx tsx scripts/simulate-season.ts --league <id>  # reuse an existing league
//   npx tsx scripts/simulate-season.ts --dry-run    # print plan, no DB writes

import { PrismaClient, Position, type LineupSlot } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SCORING } from "../lib/scoring";
import { parseScoringSettings } from "../lib/scoring/settings";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { scoreStatLine } from "../lib/scoring";
import { startSeason, advanceSeason } from "../lib/season";
import { startPlayoffs } from "../lib/services/playoff-service";
import { computeAllTeamScores } from "../lib/scoring/matchups";
import { computeVpStandings } from "../lib/scoring/vp";

const prisma = new PrismaClient();

const DEV_PASSWORD_HASH = bcrypt.hashSync("password", 10);
const SEASON = "2025-26";
const LEAGUE_NAME = "Simulate Season League";
const NUM_TEAMS = 8;
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

const TEAM_NAMES = [
  "Northern Lights", "Ice Wolves", "Hat Trick Heroes", "Puck Royals",
  "Rink Renegades", "Power Play FC", "Slapshot Squad", "The Breakaway",
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const DRY_RUN = process.argv.includes("--dry-run");
const LEAGUE_ARG = arg("--league");

// ---------------------------------------------------------------------------
// Auto-draft helper (mirrors auto-draft.ts without the CLI arg requirement)
// ---------------------------------------------------------------------------

const SLOT_CAPS: Record<LineupSlot, number> = {
  FORWARD: ROSTER_SETTINGS.forward,
  DEFENSE: ROSTER_SETTINGS.defense,
  GOALIE: ROSTER_SETTINGS.goalie,
  UTIL: ROSTER_SETTINGS.util,
  BENCH: ROSTER_SETTINGS.bench,
  IR: 0,
};

function pickSlot(
  position: "FORWARD" | "DEFENSE" | "GOALIE",
  filled: Record<LineupSlot, number>,
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
  if (filled.UTIL < SLOT_CAPS.UTIL) { needs.push(Position.FORWARD); needs.push(Position.DEFENSE); }
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

  if (!league.draft) throw new Error("No draft record found — run league setup first.");
  if (league.draft.status === "COMPLETE") {
    console.log("  Draft already complete — skipping.");
    return;
  }

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, position: true, firstName: true, lastName: true },
  });

  // Rank players by cumulative season FP so the snake distributes talent evenly.
  const statLines = await prisma.statLine.findMany({
    where: { playerId: { in: players.map(p => p.id) }, game: { season: SEASON } },
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
  const teamIds = league.teams.map(t => t.id);
  const pickOrder = generateSnakeOrder(teamIds, rounds);
  const pickSlotMap = new Map(league.draft.picks.map(p => [p.overall, p]));
  const taken = new Set<string>();
  const teamFilled = new Map<string, Record<LineupSlot, number>>(
    teamIds.map(id => [id, { FORWARD: 0, DEFENSE: 0, GOALIE: 0, UTIL: 0, BENCH: 0, IR: 0 }])
  );

  const pickUpdates: { id: string; playerId: string }[] = [];
  const rosterEntries: { playerId: string; fantasyTeamId: string; slot: LineupSlot }[] = [];

  for (const slot of pickOrder) {
    const pick = pickSlotMap.get(slot.overall);
    if (!pick) continue;
    const filled = teamFilled.get(slot.fantasyTeamId)!;
    let chosen: (typeof players)[number] | null = null;
    for (const pos of positionNeeds(filled)) {
      const c = players.find(p => p.position === pos && !taken.has(p.id));
      if (c) { chosen = c; break; }
    }
    if (!chosen) chosen = players.find(p => !taken.has(p.id)) ?? null;
    if (!chosen) { console.warn(`  Warning: ran out of players at pick ${slot.overall}`); break; }
    taken.add(chosen.id);
    const assignedSlot = pickSlot(chosen.position as "FORWARD" | "DEFENSE" | "GOALIE", filled);
    if (!assignedSlot) { console.warn(`  Warning: roster full at pick ${slot.overall}`); continue; }
    filled[assignedSlot]++;
    pickUpdates.push({ id: pick.id, playerId: chosen.id });
    rosterEntries.push({ playerId: chosen.id, fantasyTeamId: slot.fantasyTeamId, slot: assignedSlot });
  }

  if (!DRY_RUN) {
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
  console.log(`  Drafted ${pickUpdates.length} picks across ${teamIds.length} teams.`);
}

// ---------------------------------------------------------------------------
// Playoff round scorer
// ---------------------------------------------------------------------------

async function scorePlayoffRound(
  leagueId: string,
  round: number,
  higherSeedWinsTies: boolean
): Promise<{ winnerId: string; homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number }[]> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    select: { scoringSettings: true },
  });
  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // Playoff matchups for this round (skip placeholder rows with empty teams)
  const matchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: true, round, homeTeamId: { not: "" }, awayTeamId: { not: "" } },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
  });

  if (matchups.length === 0) {
    throw new Error(`No playoff matchups found for round ${round} in league ${leagueId}`);
  }

  const results = [];
  for (const m of matchups) {
    // Construct a ScoringPeriod from the matchup's time window.
    const period = { week: 0, startsAt: m.startsAt, endsAt: m.endsAt };
    const allScores = await computeAllTeamScores(leagueId, period, scoringSettings, prisma);
    const homeScore = allScores.get(m.homeTeamId) ?? 0;
    const awayScore = allScores.get(m.awayTeamId) ?? 0;

    let winnerId: string;
    if (homeScore > awayScore) {
      winnerId = m.homeTeamId;
    } else if (awayScore > homeScore) {
      winnerId = m.awayTeamId;
    } else if (higherSeedWinsTies) {
      // Tie-break: whoever was seeded higher (we don't have seed info here, default home wins)
      winnerId = m.homeTeamId;
    } else {
      throw new Error(`Playoff tie with no tie-break rule — round ${round}`);
    }

    if (!DRY_RUN) {
      await prisma.matchup.update({
        where: { id: m.id },
        data: { homeScore, awayScore },
      });
    }

    results.push({ winnerId, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore, awayScore });
    console.log(
      `    ${m.homeTeam?.name ?? m.homeTeamId} ${homeScore.toFixed(1)} – ` +
      `${awayScore.toFixed(1)} ${m.awayTeam?.name ?? m.awayTeamId}` +
      (winnerId === m.homeTeamId ? ` → ${m.homeTeam?.name ?? m.homeTeamId} wins` : ` → ${m.awayTeam?.name ?? m.awayTeamId} wins`)
    );
  }
  return results;
}

// Wire up next-round matchup with the winners from the previous round.
// Mirrors populateOrCreateNextRound in advance-playoff-round/route.ts: updates an
// existing placeholder if present, otherwise creates a new matchup row with dates
// shifted from the previous round.
async function populateNextRound(
  leagueId: string,
  round: number,
  winnerIds: string[]
): Promise<void> {
  if (DRY_RUN) return;
  if (winnerIds.length < 2) {
    throw new Error(`Need at least 2 winners to fill round ${round} — got ${winnerIds.length}`);
  }

  // Update existing matchup for this round (placeholder or pre-created)
  const existing = await prisma.matchup.findFirst({
    where: { leagueId, isPlayoff: true, round },
  });
  if (existing) {
    await prisma.matchup.update({
      where: { id: existing.id },
      data: { homeTeamId: winnerIds[0], awayTeamId: winnerIds[1] },
    });
    return;
  }

  // No pre-created row — create fresh, shifting dates from the previous round.
  const prevRound = await prisma.matchup.findFirst({
    where: { leagueId, isPlayoff: true, round: round - 1 },
  });
  if (!prevRound) return;

  const duration = prevRound.endsAt.getTime() - prevRound.startsAt.getTime();
  const startsAt = new Date(prevRound.endsAt);
  const endsAt = new Date(startsAt.getTime() + duration);

  const maxWeekRow = await prisma.matchup.aggregate({
    where: { leagueId, isPlayoff: false },
    _max: { week: true },
  });
  const maxRegularWeek = maxWeekRow._max.week ?? 0;

  await prisma.matchup.create({
    data: {
      leagueId,
      week: maxRegularWeek + round,
      homeTeamId: winnerIds[0],
      awayTeamId: winnerIds[1],
      startsAt,
      endsAt,
      isPlayoff: true,
      round,
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n=== PWHL Fantasy Season Simulation ===");
  if (DRY_RUN) console.log("(dry-run mode — no DB writes)\n");

  // 1. Verify fixture
  const fixtureGame = await prisma.game.findFirst({ where: { season: SEASON } });
  if (!fixtureGame) {
    console.error(`ERROR: No ${SEASON} games found. Load the fixture first:\n  npm run seed-fixture -- --season ${SEASON}`);
    process.exit(1);
  }

  // 2. Resolve or create league
  let leagueId: string;

  if (LEAGUE_ARG) {
    leagueId = LEAGUE_ARG;
    const exists = await prisma.fantasyLeague.findUnique({ where: { id: leagueId }, select: { id: true, name: true } });
    if (!exists) { console.error(`League ${leagueId} not found.`); process.exit(1); }
    console.log(`Reusing league: ${exists.name} (${leagueId})`);
  } else {
    console.log("Creating new simulation league...");

    // Clean up any prior simulation league to keep the DB tidy.
    const prior = await prisma.fantasyLeague.findFirst({ where: { name: LEAGUE_NAME } });
    if (prior && !DRY_RUN) {
      await prisma.draftPick.deleteMany({ where: { draft: { leagueId: prior.id } } });
      await prisma.rosterEntry.deleteMany({ where: { fantasyTeam: { leagueId: prior.id } } });
      await (prisma as any).waiverPriority?.deleteMany({ where: { leagueId: prior.id } });
      await (prisma as any).waiverClaim?.deleteMany({ where: { leagueId: prior.id } });
      await prisma.draft.deleteMany({ where: { leagueId: prior.id } });
      await prisma.matchup.deleteMany({ where: { leagueId: prior.id } });
      await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
      await (prisma as any).leagueEvent?.deleteMany({ where: { leagueId: prior.id } });
      await prisma.fantasyLeague.delete({ where: { id: prior.id } });
      console.log("  Removed previous simulation league.");
    }

    if (DRY_RUN) {
      leagueId = "<new-league-id>";
    } else {
      const commissioner = await prisma.user.upsert({
        where: { email: "sim-commish@dev.local" },
        update: { passwordHash: DEV_PASSWORD_HASH },
        create: { email: "sim-commish@dev.local", displayName: "Sim Commish", passwordHash: DEV_PASSWORD_HASH },
      });

      const league = await prisma.fantasyLeague.create({
        data: {
          name: LEAGUE_NAME,
          season: SEASON,
          maxTeams: NUM_TEAMS,
          status: "PRE_DRAFT",
          commissionerId: commissioner.id,
          scoringSettings: DEFAULT_SCORING as object,
          rosterSettings: ROSTER_SETTINGS,
          draftStartsAt: new Date(),
          scoringMode: "VP",
        },
      });
      leagueId = league.id;

      const teams = [];
      for (let i = 1; i <= NUM_TEAMS; i++) {
        const owner = i === 1 ? commissioner : await prisma.user.upsert({
          where: { email: `sim-owner${i}@dev.local` },
          update: { passwordHash: DEV_PASSWORD_HASH },
          create: { email: `sim-owner${i}@dev.local`, displayName: `Sim Owner ${i}`, passwordHash: DEV_PASSWORD_HASH },
        });
        teams.push(await prisma.fantasyTeam.create({
          data: { name: TEAM_NAMES[i - 1] ?? `Team ${i}`, leagueId, ownerId: owner.id, draftOrder: i },
        }));
      }

      const rounds = rostersToRounds(ROSTER_SETTINGS);
      await prisma.draft.create({
        data: {
          leagueId,
          status: "PENDING",
          pickTimerSecs: 30,
          currentPick: 1,
          picks: {
            createMany: {
              data: generateSnakeOrder(teams.map(t => t.id), rounds).map(slot => ({
                overall: slot.overall,
                round: slot.round,
                fantasyTeamId: slot.fantasyTeamId,
              })),
            },
          },
        },
      });
      console.log(`  Created league ${leagueId} with ${NUM_TEAMS} teams.`);
    }
  }

  // 3. Auto-draft
  const draftCheck = await prisma.draft.findFirst({ where: { leagueId } });
  if (draftCheck?.status !== "COMPLETE") {
    console.log("\n--- Step: Auto-draft ---");
    await autoDraft(leagueId);
  } else {
    console.log("Draft already complete.");
  }

  // 4. Start season
  const leagueState = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId }, select: { status: true },
  });
  if (leagueState.status === "PRE_DRAFT" || leagueState.status === "DRAFTING") {
    console.log("\n--- Step: Start season ---");
    if (!DRY_RUN) await startSeason(leagueId, prisma);
    console.log("  Season started — matchup rows generated.");
  } else {
    console.log(`League status: ${leagueState.status}`);
  }

  // 5. Advance through all regular-season scoring periods
  console.log("\n--- Step: Score regular season ---");
  const FAR_FUTURE = new Date("2027-01-01").getTime();
  const { scoredWeeks } = DRY_RUN
    ? { scoredWeeks: ["(dry-run)"] }
    : await advanceSeason(leagueId, FAR_FUTURE, prisma);

  if (scoredWeeks.length > 0) {
    console.log(`  Scored ${scoredWeeks.length} week(s): weeks ${scoredWeeks.join(", ")}.`);
  } else {
    console.log("  All weeks already scored.");
  }

  // 6. Print VP standings
  console.log("\n--- Regular season VP standings ---");
  const [leagueTeams, allMatchups] = await Promise.all([
    prisma.fantasyTeam.findMany({ where: { leagueId }, select: { id: true, name: true } }),
    prisma.matchup.findMany({ where: { leagueId, isPlayoff: false } }),
  ]);
  const vpStandings = computeVpStandings(
    leagueTeams,
    allMatchups.map(m => ({
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeVP: (m as { homeVP?: number | null }).homeVP ?? null,
      awayVP: (m as { awayVP?: number | null }).awayVP ?? null,
      isPlayoff: false,
    }))
  );
  console.log("  Rank  Team                       VP    W-L-T   PF");
  for (const [i, s] of vpStandings.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}.  ${s.teamName.padEnd(26)} ${String(s.totalVP).padStart(3)}VP  ` +
      `${s.wins}-${s.losses}-${s.ties}   ${s.pointsFor.toFixed(1)}`
    );
  }

  // 7. Start playoffs
  console.log("\n--- Step: Start playoffs ---");
  const leaguePlayoff = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId }, select: { playoffStatus: true },
  });
  let playoffResult;
  if (leaguePlayoff.playoffStatus === "NOT_STARTED") {
    if (!DRY_RUN) {
      playoffResult = await startPlayoffs(leagueId, prisma);
      console.log(`  Playoffs started. ${playoffResult.totalRounds} round(s).`);
      console.log("  Seedings:");
      for (const t of playoffResult.seededTeams) {
        console.log(`    Seed ${t.seed}: ${t.teamName} (${t.points} VP)`);
      }
    } else {
      console.log("  (dry-run) Would start playoffs with top 4 teams by VP.");
    }
  } else {
    console.log(`  Playoffs already ${leaguePlayoff.playoffStatus.toLowerCase()}.`);
  }

  // 8. Score playoff rounds
  const playoffSettings = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId }, select: { playoffSettings: true },
  });
  const settings = playoffSettings.playoffSettings as { teamsInPlayoff?: number; topSeedsWithBye?: number; roundDurationPeriods?: number; higherSeedWinsTies?: boolean } | null ?? {};
  const teamsInPlayoff = settings.teamsInPlayoff ?? 4;
  const totalRounds = Math.ceil(Math.log2(teamsInPlayoff));
  const higherSeedWinsTies = settings.higherSeedWinsTies ?? true;

  console.log("\n--- Step: Score playoffs ---");
  let championId: string | null = null;

  for (let round = 1; round <= totalRounds; round++) {
    const roundLabel = round === totalRounds ? "Finals" : `Round ${round}`;
    console.log(`\n  ${roundLabel}:`);

    if (DRY_RUN) {
      console.log("  (dry-run) Would score this round.");
      continue;
    }

    const roundResults = await scorePlayoffRound(leagueId, round, higherSeedWinsTies);
    const winnerIds = roundResults.map(r => r.winnerId);

    if (round < totalRounds) {
      await populateNextRound(leagueId, round + 1, winnerIds);
    } else {
      championId = winnerIds[0] ?? null;
    }
  }

  if (!DRY_RUN) {
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { playoffStatus: "COMPLETE", status: "COMPLETE" },
    });
  }

  // 9. Print champion
  console.log("\n=== Simulation complete ===");
  if (championId) {
    const champion = leagueTeams.find(t => t.id === championId);
    const championStanding = vpStandings.find(s => s.fantasyTeamId === championId);
    console.log(`\n🏆 Champion: ${champion?.name ?? championId}`);
    if (championStanding) {
      console.log(`   Regular-season finish: ${championStanding.totalVP} VP, ` +
        `${championStanding.wins}-${championStanding.losses}-${championStanding.ties}`);
    }
  } else if (DRY_RUN) {
    console.log("(dry-run — champion would be determined after playoffs)");
  }
  console.log(`\nLeague ID: ${leagueId}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
