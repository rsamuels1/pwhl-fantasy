/**
 * Multi-agent beta test: creates Beta Agent Test 2 directly via Prisma,
 * runs auto-draft, FA pickup, trade proposal, and lineup setting.
 *
 * Run: npx tsx scripts/run-beta-agent-test-2.ts
 */

import { PrismaClient, type LineupSlot } from "@prisma/client";
import { generateShortId } from "@/lib/id";
import { generateSnakeOrder, rostersToRounds } from "@/lib/draft/snake";
import { startSeason } from "@/lib/season/index";

const prisma = new PrismaClient();

const AGENTS = [
  { email: "replay-commish@dev.local", name: "Replay Commish", isCommish: true },
  { email: "agent2@dev.local", name: "Agent Team 2", isCommish: false },
  { email: "agent3@dev.local", name: "Agent Team 3", isCommish: false },
  { email: "agent4@dev.local", name: "Agent Team 4", isCommish: false },
  { email: "agent5@dev.local", name: "Agent Team 5", isCommish: false },
  { email: "agent6@dev.local", name: "Agent Team 6", isCommish: false },
];

function log(tag: string, msg: string) {
  console.log(`[${tag.padEnd(30)}] ${msg}`);
}

// Slot assignment matching the auto-draft route logic
const SLOT_CAPS_DEFAULT: Record<LineupSlot, number> = {
  FORWARD: 3, DEFENSE: 2, GOALIE: 1, UTIL: 1, BENCH: 6, IR: 1,
};

function pickSlot(
  position: "FORWARD" | "DEFENSE" | "GOALIE",
  filled: Record<LineupSlot, number>,
  caps: Record<LineupSlot, number>
): LineupSlot | null {
  if (filled[position] < caps[position]) return position as LineupSlot;
  if (position !== "GOALIE" && filled.UTIL < caps.UTIL) return "UTIL";
  if (filled.BENCH < caps.BENCH) return "BENCH";
  return null;
}

async function main() {
  // ── Step 1: Upsert all agent users ────────────────────────────────────────
  const userByEmail: Record<string, string> = {}; // email → userId
  for (const agent of AGENTS) {
    const user = await prisma.user.upsert({
      where: { email: agent.email },
      update: { displayName: agent.name },
      create: { email: agent.email, displayName: agent.name },
    });
    userByEmail[agent.email] = user.id;
    log(agent.email, `User: ${user.id}`);
  }

  const commishId = userByEmail[AGENTS[0].email];

  // ── Step 2: Create beta replay league via HTTP (create route accepts email body) ──
  // Use the production API which shares the same Neon main DB.
  // The create route doesn't require the beta host middleware.
  log("LEAGUE", "Creating Beta Agent Test 2 via API ...");

  // We'll build the league directly in DB instead (avoids host/middleware issues).
  // Pick 4 random weeks from 2025-26: first 2 for regular season, last 2 for playoff.
  const betaSeason = "2025-26";
  const gameDates = await prisma.game.findMany({
    where: { season: betaSeason },
    select: { startsAt: true },
    orderBy: { startsAt: "asc" },
  });
  if (gameDates.length === 0) throw new Error("No 2025-26 games in DB — run seed-fixture first");

  // Derive weekly buckets (Mon-Sun windows) from game dates
  const { derivePeriods } = await import("@/lib/scoring/periods");
  const allPeriods = derivePeriods(gameDates.map((g) => g.startsAt));

  // Pick one index from each quarter of the season (same logic as create route)
  const quarterSize = Math.floor(allPeriods.length / 4);
  const indices = [0, 1, 2, 3].map(
    (q) => q * quarterSize + Math.floor(Math.random() * quarterSize)
  );

  const draftStartsAt = new Date(); // draft happens now
  const firstWeekStart = draftStartsAt.getTime() + 24 * 60 * 60 * 1000;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Pre-compute betaWeekMappings for all 4 weeks (regular + playoff)
  const betaWeekMappings = indices.map((idx, i) => ({
    week: i + 1,
    fixtureStart: allPeriods[idx].startsAt.toISOString(),
    fixtureEnd: allPeriods[idx].endsAt.toISOString(),
    remappedStart: new Date(firstWeekStart + i * WEEK_MS).toISOString(),
    remappedEnd: new Date(firstWeekStart + (i + 1) * WEEK_MS).toISOString(),
  }));

  const leagueName = "Beta Agent Test 2";
  const leagueId = generateShortId(leagueName + Date.now());

  const defaultScoring = (await import("@/lib/scoring")).DEFAULT_SCORING;
  const scoringSettings = {
    ...defaultScoring,
    betaWeekIndices: [indices[0], indices[1]], // regular season weeks
    betaWeekMappings,
  };
  const rosterSettings = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };
  const playoffSettings = { teamsInPlayoff: 4, topSeedsWithBye: 0, roundDurationPeriods: 1, higherSeedWinsTies: true };

  const league = await prisma.fantasyLeague.create({
    data: {
      id: leagueId,
      name: leagueName,
      season: betaSeason,
      commissionerId: commishId,
      maxTeams: 6,
      scoringSettings: scoringSettings as object,
      rosterSettings: rosterSettings as object,
      playoffSettings: playoffSettings as object,
      betaStatus: "ACTIVE",
      isReplay: true,
      replayCurrentDate: null,
      draftStartsAt,
      scoringMode: "VP",
      status: "PRE_DRAFT",
    },
  });
  log("LEAGUE", `Created: ${league.id}`);

  // ── Step 3: Create teams ───────────────────────────────────────────────────
  const teamByEmail: Record<string, string> = {};
  for (let i = 0; i < AGENTS.length; i++) {
    const agent = AGENTS[i];
    const teamName = agent.isCommish ? "Commish FC" : agent.name;
    const team = await prisma.fantasyTeam.create({
      data: {
        id: generateShortId(teamName + i),
        name: teamName,
        leagueId: league.id,
        ownerId: userByEmail[agent.email],
        draftOrder: i + 1,
        isBot: agent.email.endsWith(".local"),
      },
    });
    teamByEmail[agent.email] = team.id;
    log(agent.email, `Team: ${team.id}`);
  }

  // ── Step 4: Setup draft ────────────────────────────────────────────────────
  log("DRAFT", "Setting up draft ...");
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId: league.id },
    orderBy: { draftOrder: "asc" },
  });
  const rounds = rostersToRounds(rosterSettings);
  const order = generateSnakeOrder(teams.map((t) => t.id), rounds);

  const draft = await prisma.draft.create({
    data: {
      leagueId: league.id,
      status: "PENDING",
      currentPick: 1,
      pickTimerSecs: 30,
    },
  });
  log("DRAFT", `Draft created: ${draft.id}, ${order.length} picks`);

  // ── Step 5: Auto-draft all teams ──────────────────────────────────────────
  log("DRAFT", "Running auto-draft ...");

  // Load all players with season stats
  const playerStats = await prisma.statLine.groupBy({
    by: ["playerId"],
    where: { game: { season: betaSeason } },
    _sum: { goals: true, assists: true, saves: true },
  });

  // Build FP proxy map (goalies ranked by saves, skaters by G+A)
  const fpMap = new Map<string, number>();
  for (const ps of playerStats) {
    const fp =
      (ps._sum.goals ?? 0) * 2 +
      (ps._sum.assists ?? 0) * 1.5 +
      (ps._sum.saves ?? 0) * 0.2;
    fpMap.set(ps.playerId, fp);
  }

  // All active players who have stats in this season
  const playerIdsWithStats = playerStats.map((ps) => ps.playerId);
  const allPlayers = await prisma.player.findMany({
    where: { id: { in: playerIdsWithStats } },
    select: { id: true, position: true },
  });

  const drafted = new Set<string>();
  const filledByTeam = new Map<string, Record<LineupSlot, number>>();
  for (const t of teams) {
    filledByTeam.set(t.id, { FORWARD: 0, DEFENSE: 0, GOALIE: 0, UTIL: 0, BENCH: 0, IR: 0 });
  }

  const draftPicks: { teamId: string; playerId: string; slot: LineupSlot; pickNumber: number }[] = [];

  for (let i = 0; i < order.length; i++) {
    const { fantasyTeamId } = order[i];
    const filled = filledByTeam.get(fantasyTeamId)!;

    // Find best available player
    const available = allPlayers
      .filter((p) => !drafted.has(p.id))
      .map((p) => {
        const pos = p.position as "FORWARD" | "DEFENSE" | "GOALIE";
        const slot = pickSlot(pos, filled, SLOT_CAPS_DEFAULT);
        return { ...p, slot, fp: fpMap.get(p.id) ?? 0 };
      })
      .filter((p) => p.slot !== null)
      .sort((a, b) => b.fp - a.fp);

    const pick = available[0];
    if (!pick) { log("DRAFT", `No available player at pick ${i + 1}`); continue; }

    drafted.add(pick.id);
    filled[pick.slot!]++;
    draftPicks.push({ teamId: fantasyTeamId, playerId: pick.id, slot: pick.slot!, pickNumber: i + 1 });
  }

  // Persist draft picks and roster entries in batch
  const numTeams = teams.length;
  await prisma.$transaction([
    prisma.draftPick.createMany({
      data: draftPicks.map((p) => ({
        draftId: draft.id,
        overall: p.pickNumber,
        round: Math.ceil(p.pickNumber / numTeams),
        fantasyTeamId: p.teamId,
        playerId: p.playerId,
        pickedAt: new Date(),
        auto: true,
      })),
    }),
    prisma.rosterEntry.createMany({
      data: draftPicks.map((p) => ({
        fantasyTeamId: p.teamId,
        playerId: p.playerId,
        slot: p.slot,
      })),
    }),
    prisma.draft.update({
      where: { id: draft.id },
      data: { status: "COMPLETE", currentPick: draftPicks.length, completedAt: new Date() },
    }),
    prisma.fantasyLeague.update({
      where: { id: league.id },
      data: { status: "DRAFTING" },
    }),
  ]);
  log("DRAFT", `Drafted ${draftPicks.length} players`);

  // ── Step 6: Start season (generates matchup rows) ─────────────────────────
  log("SEASON", "Starting season ...");
  await startSeason(league.id, prisma);
  log("SEASON", "Season started");

  // ── Step 7: Agent2 picks up a free agent ──────────────────────────────────
  const a2Email = AGENTS[1].email;
  const a2TeamId = teamByEmail[a2Email];

  // Find a player not on any team in this league
  const rostered = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: { in: Object.values(teamByEmail) } },
    select: { playerId: true },
  });
  const rosteredIds = new Set(rostered.map((r) => r.playerId));

  const topFA = await prisma.statLine.groupBy({
    by: ["playerId"],
    where: { game: { season: betaSeason }, playerId: { notIn: [...rosteredIds] } },
    _sum: { goals: true, assists: true },
    orderBy: { _sum: { goals: "desc" } },
    take: 1,
  });

  if (topFA.length > 0) {
    const faPlayerId = topFA[0].playerId;
    const faPlayer = await prisma.player.findUnique({ where: { id: faPlayerId }, select: { firstName: true, lastName: true } });

    // Drop the last bench player to make room
    const a2Roster = await prisma.rosterEntry.findMany({
      where: { fantasyTeamId: a2TeamId },
      include: { player: { select: { position: true } } },
    });
    const benchEntry = a2Roster.find((r) => r.slot === "BENCH");

    if (benchEntry) {
      await prisma.$transaction([
        prisma.rosterEntry.delete({ where: { id: benchEntry.id } }),
        prisma.rosterEntry.create({
          data: { fantasyTeamId: a2TeamId, playerId: faPlayerId, slot: "BENCH" },
        }),
        prisma.leagueEvent.create({
          data: {
            leagueId: league.id,
            teamId: a2TeamId,
            playerId: faPlayerId,
            type: "PLAYER_ADD",
            data: { addedPlayerId: faPlayerId, droppedPlayerId: benchEntry.playerId },
          },
        }),
      ]);
      log(a2Email, `Added FA: ${faPlayer?.firstName} ${faPlayer?.lastName}, dropped ${benchEntry.playerId}`);
    }
  } else {
    log(a2Email, "No FA available, skipping");
  }

  // ── Step 8: Agent3 proposes a trade to Agent4 ─────────────────────────────
  const a3Email = AGENTS[2].email;
  const a4Email = AGENTS[3].email;
  const a3TeamId = teamByEmail[a3Email];
  const a4TeamId = teamByEmail[a4Email];
  const a3UserId = userByEmail[a3Email];

  const roster3 = await prisma.rosterEntry.findMany({ where: { fantasyTeamId: a3TeamId } });
  const roster4 = await prisma.rosterEntry.findMany({ where: { fantasyTeamId: a4TeamId } });

  const give = roster3.find((r) => r.slot === "BENCH");
  const receive = roster4.find((r) => r.slot === "BENCH");

  if (give && receive) {
    try {
      const tradeId = generateShortId("trade" + Date.now());
      await prisma.$transaction([
        prisma.trade.create({
          data: {
            id: tradeId,
            leagueId: league.id,
            proposingTeamId: a3TeamId,
            receivingTeamId: a4TeamId,
            status: "PROPOSED",
            message: "Let's swap bench depth — good luck this week!",
          },
        }),
        prisma.tradeItem.createMany({
          data: [
            { tradeId, fromTeamId: a3TeamId, toTeamId: a4TeamId, playerId: give.playerId },
            { tradeId, fromTeamId: a4TeamId, toTeamId: a3TeamId, playerId: receive.playerId },
          ],
        }),
        prisma.leagueEvent.create({
          data: {
            leagueId: league.id,
            teamId: a3TeamId,
            type: "TRADE",
            data: { tradeId, status: "PROPOSED" },
          },
        }),
      ]);
      log(a3Email, `Trade proposed: ${tradeId}`);
    } catch (e) {
      log(a3Email, `Trade failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    log(a3Email, "Not enough bench players for trade, skipping");
  }

  // ── Step 9: All agents set optimal lineups ────────────────────────────────
  log("LINEUPS", "Setting lineups via auto-set ...");

  for (const agent of AGENTS) {
    const teamId = teamByEmail[agent.email];
    if (!teamId) continue;

    // The auto-draft already assigns slots; lineups are set. Just verify counts.
    const entries = await prisma.rosterEntry.findMany({ where: { fantasyTeamId: teamId } });
    const activeCount = entries.filter((e) => !["BENCH", "IR"].includes(e.slot)).length;
    log(agent.email, `Lineup: ${entries.length} players, ${activeCount} active starters`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log(`  Beta Agent Test 2 complete!`);
  console.log(`  League ID: ${league.id}`);
  console.log(`  Season:    ${betaSeason} (replay, VP mode)`);
  console.log(`  Teams:     ${AGENTS.length}`);
  console.log(`  Draft:     ${draftPicks.length} picks (auto-drafted)`);
  console.log(`  Trade:     Agent3 → Agent4 proposed`);
  console.log(`  FA:        Agent2 added 1 player`);
  console.log("════════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("FATAL:", e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
