// scripts/seed-draft.ts
// Creates a throwaway, draft-ready league against the mock players so you can run
// a full draft locally. Idempotent-ish: deletes any prior league with the same
// name first, so you can re-run it to get a clean draft.
//
//   npm run seed          # first, to load teams + players
//   npm run seed-draft    # then this, to create the league
//
// Prints the leagueId and each team's id + draftOrder so the CLI client can join.

import { PrismaClient } from "@prisma/client";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { DEFAULT_SCORING } from "../lib/scoring";

const prisma = new PrismaClient();

const LEAGUE_NAME = "Dev Draft League";
const NUM_TEAMS = 4; // small, so a full draft finishes fast in the terminal
const PICK_TIMER_SECS = 30;

// Roster settings sum to the number of rounds. 4 rounds keeps a 4-team draft
// to 16 picks total — quick to watch end to end.
const ROSTER_SETTINGS = { forward: 2, defense: 1, goalie: 1 };

async function main() {
  // Clean any prior dev league so re-runs start fresh.
  const prior = await prisma.fantasyLeague.findFirst({
    where: { name: LEAGUE_NAME },
    include: { draft: true, teams: true },
  });
  if (prior) {
    await prisma.draftPick.deleteMany({ where: { draft: { leagueId: prior.id } } });
    await prisma.rosterEntry.deleteMany({
      where: { fantasyTeam: { leagueId: prior.id } },
    });
    if (prior.draft) await prisma.draft.delete({ where: { id: prior.draft.id } });
    await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyLeague.delete({ where: { id: prior.id } });
    console.log("Removed previous dev league.");
  }

  // A commissioner user + one owner per team.
  const commissioner = await prisma.user.upsert({
    where: { email: "commish@dev.local" },
    update: {},
    create: { email: "commish@dev.local", displayName: "Commish" },
  });

  const league = await prisma.fantasyLeague.create({
    data: {
      name: LEAGUE_NAME,
      maxTeams: NUM_TEAMS,
      status: "PRE_DRAFT",
      commissionerId: commissioner.id,
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: ROSTER_SETTINGS,
    },
  });

  const teams = [];
  for (let i = 1; i <= NUM_TEAMS; i++) {
    const owner = await prisma.user.upsert({
      where: { email: `owner${i}@dev.local` },
      update: {},
      create: { email: `owner${i}@dev.local`, displayName: `Owner ${i}` },
    });
    const team = await prisma.fantasyTeam.create({
      data: {
        name: `Team ${i}`,
        leagueId: league.id,
        ownerId: owner.id,
        draftOrder: i, // 1..N
      },
    });
    teams.push(team);
  }

  const rounds = rostersToRounds(ROSTER_SETTINGS);
  const draft = await prisma.draft.create({
    data: {
      leagueId: league.id,
      status: "PENDING",
      pickTimerSecs: PICK_TIMER_SECS,
      currentPick: 1,
    },
  });

  // Pre-seed the full pick board (playerId null until picked).
  const order = generateSnakeOrder(
    teams.map((t) => t.id),
    rounds
  );
  await prisma.draftPick.createMany({
    data: order.map((slot) => ({
      draftId: draft.id,
      overall: slot.overall,
      round: slot.round,
      fantasyTeamId: slot.fantasyTeamId,
    })),
  });

  console.log("\n=== Draft-ready league created ===");
  console.log(`leagueId: ${league.id}`);
  console.log(`rounds: ${rounds}  picks: ${order.length}  timer: ${PICK_TIMER_SECS}s`);
  console.log("\nTeams (use these to join from the CLI):");
  for (const t of teams) {
    console.log(`  draftOrder ${t.draftOrder}  ${t.name}  id=${t.id}`);
  }
  console.log("\nNext:");
  console.log("  1. npm run draft-server");
  console.log(`  2. npm run draft-cli -- --league ${league.id} --team <teamId>`);
  console.log("     (open one terminal per team; commissioner starts with --start)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
