// scripts/seed-replay.ts
// Creates a replay-ready fantasy league using the 2025-26 historical season.
// Run after `npm run seed-fixture -- --season 2025-26`.
//
//   npm run seed-replay
//
// Prints leagueId + team IDs so you can run `npm run auto-draft -- --league <id>`.

import { PrismaClient } from "@prisma/client";
import { DEFAULT_SCORING } from "../lib/scoring";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";

const prisma = new PrismaClient();

const LEAGUE_NAME = "Replay League 2025-26";
const NUM_TEAMS = 8;
const ROSTER_SETTINGS = { forward: 2, defense: 2, goalie: 1, util: 1, bench: 6, ir: 1 };

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
    await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
    await prisma.fantasyLeague.delete({ where: { id: prior.id } });
    console.log("Removed previous replay league.");
  }

  // Upsert dev users (same as seed-draft)
  const commissioner = await prisma.user.upsert({
    where: { email: "commish@dev.local" },
    update: {},
    create: { email: "commish@dev.local", displayName: "Commish" },
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
      replayCurrentDate: new Date("2026-10-01T09:00:00Z"),
    },
  });

  const teams = [];
  for (let i = 1; i <= NUM_TEAMS; i++) {
    const owner =
      i === 1
        ? commissioner
        : await prisma.user.upsert({
            where: { email: `owner${i}@dev.local` },
            update: {},
            create: { email: `owner${i}@dev.local`, displayName: `Owner ${i}` },
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
    console.log(`  draftOrder ${t.draftOrder}  ${t.name}  id=${t.id}`);
  }
  console.log("\nNext steps:");
  console.log(`  1. Auto-draft:  npm run auto-draft -- --league ${league.id}`);
  console.log(`  2. Start season via admin panel: http://localhost:3000/league/${league.id}/admin`);
  console.log(`  3. Advance weeks from the admin panel (⏭ buttons are visible for replay leagues)`);
  console.log(`     Or via CLI:  npm run advance-replay -- --league ${league.id}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
