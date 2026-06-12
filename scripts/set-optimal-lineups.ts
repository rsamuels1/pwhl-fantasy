// scripts/set-optimal-lineups.ts
// For every non-commissioner team in the dev league, sets the optimal lineup
// for the current/upcoming scoring period: maximises games-remaining by putting
// players with the most upcoming games this period into active slots.
//
// Also accepts --rebalance to redistribute players across teams so each team
// has a healthy mix of PWHL clubs (avoids one team owning all MIN players, etc.)
//
// Usage:
//   npx tsx scripts/set-optimal-lineups.ts
//   npx tsx scripts/set-optimal-lineups.ts --league <id>
//   npx tsx scripts/set-optimal-lineups.ts --rebalance

import { PrismaClient, type LineupSlot, type Position } from "@prisma/client";
import { getSeasonState } from "../lib/season";
import { rostersToRounds } from "../lib/draft/snake";

const prisma = new PrismaClient();

const LEAGUE_NAME = "Dev Draft League";
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

// Slots that count as "active" (not bench/IR), in fill-priority order.
const ACTIVE_SLOTS: LineupSlot[] = ["FORWARD", "FORWARD", "FORWARD", "DEFENSE", "DEFENSE", "GOALIE", "UTIL"];

// Which positions can fill each active slot (mirrors eligibleSlots in lib/lineup.ts).
const SLOT_ELIGIBLE: Record<string, Position[]> = {
  FORWARD:  ["FORWARD"],
  DEFENSE:  ["DEFENSE"],
  GOALIE:   ["GOALIE"],
  UTIL:     ["FORWARD", "DEFENSE"],
};

async function main() {
  const args = process.argv.slice(2);
  const rebalance = args.includes("--rebalance");
  const leagueIdx = args.indexOf("--league");
  const leagueIdArg = leagueIdx !== -1 ? args[leagueIdx + 1] : null;

  const league = leagueIdArg
    ? await prisma.fantasyLeague.findUnique({ where: { id: leagueIdArg } })
    : await prisma.fantasyLeague.findFirst({ where: { name: LEAGUE_NAME } });

  if (!league) {
    console.error(`League not found. Run npm run seed-draft first.`);
    process.exit(1);
  }

  console.log(`League: ${league.name} (${league.id})`);

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId: league.id },
    include: {
      roster: {
        include: {
          player: { include: { team: { select: { id: true, abbreviation: true } } } },
        },
      },
    },
    orderBy: { draftOrder: "asc" },
  });

  // Skip team 1 (commissioner's team) — don't touch the human player's lineup.
  const botTeams = teams.filter((t) => t.draftOrder !== 1);

  if (rebalance) {
    await rebalanceRosters(teams);
    // Re-fetch after rebalance.
    const refreshed = await prisma.fantasyTeam.findMany({
      where: { leagueId: league.id },
      include: {
        roster: {
          include: {
            player: { include: { team: { select: { id: true, abbreviation: true } } } },
          },
        },
      },
      orderBy: { draftOrder: "asc" },
    });
    botTeams.splice(0, botTeams.length, ...refreshed.filter((t) => t.draftOrder !== 1));
  }

  // Determine the period to optimise for.
  const nowMs = Date.now();
  const seasonState = await getSeasonState(league.id, nowMs, prisma);
  const displayPeriod =
    seasonState.periods.find((p) => p.status === "ACTIVE")?.period ??
    seasonState.periods.find((p) => p.status === "UPCOMING")?.period ??
    null;

  if (!displayPeriod) {
    console.log("No active or upcoming period found — setting lineups by season FP instead.");
  } else {
    console.log(`Optimising for period: Week ${displayPeriod.week} (${displayPeriod.startsAt.toDateString()} – ${displayPeriod.endsAt.toDateString()})`);
  }

  // Build a games-remaining map for every PWHL team.
  const allPwhlTeamIds = [
    ...new Set(
      teams.flatMap((t) =>
        t.roster.map((e) => e.player.team?.id).filter((id): id is string => !!id)
      )
    ),
  ];

  const now = new Date(nowMs);
  const remainingGames = displayPeriod
    ? await prisma.game.findMany({
        where: {
          startsAt: { gt: now, lt: displayPeriod.endsAt },
          OR: [
            { homeTeamId: { in: allPwhlTeamIds } },
            { awayTeamId: { in: allPwhlTeamIds } },
          ],
        },
        select: { homeTeamId: true, awayTeamId: true },
      })
    : [];

  const gamesPerTeam = new Map<string, number>();
  for (const g of remainingGames) {
    gamesPerTeam.set(g.homeTeamId, (gamesPerTeam.get(g.homeTeamId) ?? 0) + 1);
    gamesPerTeam.set(g.awayTeamId, (gamesPerTeam.get(g.awayTeamId) ?? 0) + 1);
  }

  // Set optimal lineup for each bot team.
  for (const team of botTeams) {
    await setOptimalLineup(team, gamesPerTeam);
  }

  console.log("\nDone.");
}

type TeamWithRoster = Awaited<ReturnType<typeof prisma.fantasyTeam.findMany>>[number] & {
  roster: Array<{
    playerId: string;
    slot: LineupSlot;
    player: {
      position: string;
      active: boolean;
      team: { id: string; abbreviation: string } | null;
    };
  }>;
};

async function setOptimalLineup(
  team: TeamWithRoster,
  gamesPerTeam: Map<string, number>
) {
  const players = team.roster
    .filter((e) => e.player.active)
    .map((e) => ({
      playerId: e.playerId,
      position: e.player.position as Position,
      pwhlTeamId: e.player.team?.id ?? null,
      abbr: e.player.team?.abbreviation ?? "?",
      games: gamesPerTeam.get(e.player.team?.id ?? "") ?? 0,
    }))
    // Sort descending by games remaining so we greedily fill the best players first.
    .sort((a, b) => b.games - a.games);

  // Greedily assign players to active slots.
  const assignments = new Map<string, LineupSlot>(); // playerId → slot
  const slotCounts: Record<string, number> = {};

  for (const slotType of ACTIVE_SLOTS) {
    const eligible = SLOT_ELIGIBLE[slotType];
    // Pick the highest-games player who fits this slot and isn't already assigned.
    const pick = players.find(
      (p) =>
        eligible.includes(p.position) &&
        !assignments.has(p.playerId)
    );
    if (pick) {
      assignments.set(pick.playerId, slotType as LineupSlot);
      slotCounts[slotType] = (slotCounts[slotType] ?? 0) + 1;
    }
  }

  // Everyone not in an active slot goes to BENCH (or IR if inactive — handled by filter above).
  for (const e of team.roster) {
    if (!assignments.has(e.playerId)) {
      assignments.set(e.playerId, e.player.active ? "BENCH" : "IR");
    }
  }

  // Apply in a single transaction.
  const updates = [...assignments.entries()].map(([playerId, slot]) =>
    prisma.rosterEntry.update({
      where: { fantasyTeamId_playerId: { fantasyTeamId: team.id, playerId } },
      data: { slot },
    })
  );
  await prisma.$transaction(updates);

  const activeAssignments = [...assignments.entries()].filter(
    ([, s]) => !["BENCH", "IR"].includes(s)
  );
  const summary = activeAssignments.map(([pid, slot]) => {
    const p = players.find((x) => x.playerId === pid);
    return `${slot}:${p?.abbr ?? "?"}(${p?.games ?? 0}G)`;
  });
  console.log(`  ${team.name}: ${summary.join("  ")}`);
}

// Rebalance: redistribute players so each team has a roughly even spread of PWHL clubs.
// Pulls all active players in the league's season who aren't on the commissioner's team,
// then deals them round-robin across bot teams sorted by PWHL club.
async function rebalanceRosters(teams: TeamWithRoster[]) {
  console.log("\nRebalancing rosters...");

  const commishTeam = teams.find((t) => t.draftOrder === 1)!;
  const botTeams = teams.filter((t) => t.draftOrder !== 1);
  const botTeamIds = botTeams.map((t) => t.id);
  const commishPlayerIds = new Set(commishTeam.roster.map((e) => e.playerId));

  // Pull all active players in the DB (same pool the draft used), excluding the commish's picks.
  const allPlayers = await prisma.player.findMany({
    where: { active: true },
    include: { team: { select: { id: true, abbreviation: true } } },
  });

  const available = allPlayers.filter((p) => !commishPlayerIds.has(p.id));

  // Build position buckets, sorted by club so each team gets a spread of clubs.
  const byClub = (pos: string) =>
    available
      .filter((p) => p.position === pos)
      .sort((a, b) => (a.team?.abbreviation ?? "").localeCompare(b.team?.abbreviation ?? ""));

  const forwards  = byClub("FORWARD");
  const defense   = byClub("DEFENSE");
  const goalies   = byClub("GOALIE");

  const n = botTeams.length;

  // Per-team quota: 4F + 3D + 1G + 4 bench (mix of F/D), total = 12 draft rounds.
  // We deal round-robin so adjacent picks go to different teams, maximising club spread.
  const pool: typeof available = [
    ...forwards.splice(0, n * 4),  // 4 forwards per team
    ...defense.splice(0, n * 3),   // 3 defense per team
    ...goalies.splice(0, n * 1),   // 1 goalie per team
    // Fill remaining bench spots from whoever's left, preferring forwards.
    ...[...forwards, ...defense].slice(0, n * 4),
  ];

  const assignments: Array<{ playerId: string; fantasyTeamId: string }> = [];
  pool.forEach((player, i) => {
    const teamIdx = i % botTeams.length;
    assignments.push({ playerId: player.id, fantasyTeamId: botTeams[teamIdx].id });
  });

  // Atomic: delete old bot entries and create new ones in one transaction.
  await prisma.$transaction([
    prisma.rosterEntry.deleteMany({ where: { fantasyTeamId: { in: botTeamIds } } }),
    prisma.rosterEntry.createMany({
      data: assignments.map(({ playerId, fantasyTeamId }) => ({
        fantasyTeamId,
        playerId,
        slot: "BENCH" as LineupSlot,
        acquired: new Date(),
      })),
    }),
  ]);

  console.log(
    `  Assigned ${pool.length} players across ${botTeams.length} teams (${pool.length / botTeams.length} each).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
