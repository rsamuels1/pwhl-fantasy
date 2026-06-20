// scripts/seed-replay.ts
// Creates a replay-ready fantasy league using the 2025-26 historical season.
// Run after `npm run seed-fixture -- --season 2025-26`.
//
//   npm run seed-replay
//
// Prints leagueId + team IDs so you can run `npm run auto-draft -- --league <id>`.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SCORING } from "../lib/scoring";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";

const DEV_PASSWORD_HASH = bcrypt.hashSync("password", 10);

const prisma = new PrismaClient();

const LEAGUE_NAME = "Replay League 2025-26";
const NUM_TEAMS = 8;
const ROSTER_SETTINGS = { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 };

const TEAM_NAMES = [
  "Northern Lights",
  "Ice Wolves",
  "Hat Trick Heroes",
  "Puck Royals",
  "Rink Renegades",
  "Power Play FC",
  "Slapshot Squad",
  "The Breakaway",
];

async function main() {
  // Verify fixture is loaded
  const fixtureGame = await prisma.game.findFirst({ where: { season: "2025-26" } });
  if (!fixtureGame) {
    console.error(
      "ERROR: No 2025-26 games found. Load the fixture first:\n" +
      "  npm run seed-fixture -- --season 2025-26"
    );
    process.exit(1);
  }

  // Clean any prior league with the same name
  const prior = await prisma.fantasyLeague.findFirst({ where: { name: LEAGUE_NAME } });
  if (prior) {
    await prisma.draftPick.deleteMany({ where: { draft: { leagueId: prior.id } } });
    await prisma.rosterEntry.deleteMany({ where: { fantasyTeam: { leagueId: prior.id } } });
    await prisma.draft.deleteMany({ where: { leagueId: prior.id } });
    await prisma.matchup.deleteMany({ where: { leagueId: prior.id } });
    await (prisma as any).waiverPriority.deleteMany({ where: { fantasyTeam: { leagueId: prior.id } } });
    await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
    await (prisma as any).leagueEvent.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyLeague.delete({ where: { id: prior.id } });
    console.log("Removed previous replay league.");
  }

  // Replay league uses its own users so they don't cross-contaminate
  // other dev leagues. Log in as replay-commish@dev.local to go straight
  // to the replay league without hitting the multi-team dashboard.
  const commissioner = await prisma.user.upsert({
    where: { email: "replay-commish@dev.local" },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: { email: "replay-commish@dev.local", displayName: "Replay Commish", passwordHash: DEV_PASSWORD_HASH },
  });

  const league = await prisma.fantasyLeague.create({
    data: {
      name: LEAGUE_NAME,
      season: "2025-26",
      maxTeams: NUM_TEAMS + 2, // room for late joiners
      status: "PRE_DRAFT",
      commissionerId: commissioner.id,
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: ROSTER_SETTINGS,
      draftStartsAt: new Date(),
      isReplay: true,
      // Day 0: one day before the first game of the 2025-26 season (Nov 22, 2025).
      // Advance forward one game day at a time from the admin panel.
      replayCurrentDate: new Date("2025-11-21T00:00:00Z"),
      scoringMode: "VP",
    },
  });

  const teams = [];
  for (let i = 1; i <= NUM_TEAMS; i++) {
    const owner =
      i === 1
        ? commissioner
        : await prisma.user.upsert({
            where: { email: `replay-owner${i}@dev.local` },
            update: { passwordHash: DEV_PASSWORD_HASH },
            create: { email: `replay-owner${i}@dev.local`, displayName: `Replay Owner ${i}`, passwordHash: DEV_PASSWORD_HASH },
          });
    const team = await prisma.fantasyTeam.create({
      data: {
        name: TEAM_NAMES[i - 1] ?? `Team ${i}`,
        leagueId: league.id,
        ownerId: owner.id,
        draftOrder: i,
      },
    });
    teams.push(team);
  }

  const rounds = rostersToRounds(ROSTER_SETTINGS);
  await prisma.draft.create({
    data: {
      leagueId: league.id,
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

  console.log("\n=== Replay league created ===");
  console.log(`leagueId: ${league.id}`);
  console.log(`season: 2025-26  teams: ${NUM_TEAMS}  rounds: ${rounds}`);
  console.log("\nTeams:");
  for (const t of teams) {
    console.log(`  ${t.draftOrder}.  ${t.name}  (id=${t.id})`);
  }
  console.log("\n--- Login ---");
  console.log(`  Email: replay-commish@dev.local  (use this — NOT commish@dev.local)`);
  console.log("\n--- Next steps ---");
  console.log(`  1. Auto-draft:  use the "Auto-draft all teams" button in the admin panel`);
  console.log(`     (or CLI: npm run auto-draft -- --league ${league.id})`);
  console.log(`  2. Start season: admin panel → Season management → "Start season"`);
  console.log(`     http://localhost:3000/league/${league.id}/admin`);
  console.log(`  3. Advance day-by-day from the "Day N → Next day" bar at the top`);
  console.log(`     of any league page (visible to the commissioner when in-season)`);
  console.log(`     Or advance multiple weeks via CLI:`);
  console.log(`     npm run advance-replay -- --league ${league.id} --weeks 4\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
