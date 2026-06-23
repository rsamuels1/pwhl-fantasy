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
import bcrypt from "bcryptjs";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { DEFAULT_SCORING } from "../lib/scoring";

const prisma = new PrismaClient();

const LEAGUE_NAME = "Dev Draft League";
const NUM_TEAMS = 4; // small, so a full draft finishes fast in the terminal
const PICK_TIMER_SECS = 30;

// 13-slot roster: 3F + 2D + 1G + 1 UTIL + 6 BENCH = 13 total.
// 4 teams × 13 rounds = 52 picks total.
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

const DEV_PASSWORD_HASH = bcrypt.hashSync("password", 10);

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
    await prisma.matchup.deleteMany({ where: { leagueId: prior.id } });
    await (prisma as any).waiverEntry.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
    await (prisma as any).leagueEvent.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyLeague.delete({ where: { id: prior.id } });
    console.log("Removed previous dev league.");
  }

  // The commissioner also owns team 1 (draftOrder 1), matching the real app flow
  // where the league creator always joins as a manager. This is required for the
  // draft room's isCommissioner check: myTeam.ownerId === league.commissionerId.
  const commissioner = await prisma.user.upsert({
    where: { email: "commish@dev.local" },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: { email: "commish@dev.local", displayName: "Commish", passwordHash: DEV_PASSWORD_HASH },
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
    // Team 1 is owned by the commissioner; remaining teams get separate owner accounts.
    const owner =
      i === 1
        ? commissioner
        : await prisma.user.upsert({
            where: { email: `owner${i}@dev.local` },
            update: { passwordHash: DEV_PASSWORD_HASH },
            create: { email: `owner${i}@dev.local`, displayName: `Owner ${i}`, passwordHash: DEV_PASSWORD_HASH },
          });
    const team = await prisma.fantasyTeam.create({
      data: {
        name: i === 1 ? "Commish Team" : `Team ${i}`,
        leagueId: league.id,
        ownerId: owner.id,
        draftOrder: i, // 1..N
        isBot: i !== 1, // all teams except the commissioner's are bots
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

  console.log("\nDev credentials (password: 'password'):");
  console.log("  commish@dev.local");
  for (let i = 2; i <= NUM_TEAMS; i++) console.log(`  owner${i}@dev.local`);
  console.log("\n=== Draft-ready league created ===");
  console.log(`leagueId: ${league.id}`);
  console.log(`rounds: ${rounds}  picks: ${order.length}  timer: ${PICK_TIMER_SECS}s`);
  console.log("\nTeams:");
  for (const t of teams) {
    const tag = t.draftOrder === 1 ? " ← commissioner (owns Start button)" : "";
    console.log(`  draftOrder ${t.draftOrder}  ${t.name}  id=${t.id}${tag}`);
  }
  console.log("\nBrowser draft:");
  console.log(`  Commissioner: http://localhost:3000/draft/${league.id}?team=${teams[0].id}`);
  console.log("  Press Start in the draft room to begin.\n");
  console.log("CLI draft (alternative):");
  console.log("  1. npm run draft-server");
  console.log(`  2. npm run draft-cli -- --league ${league.id} --team <teamId> --start  # commissioner`);
  console.log(`  3. npm run draft-cli -- --league ${league.id} --team <teamId>           # other teams\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
