/**
 * Seed script for testing playoffs
 * 
 * Creates a test league with fixture data and optionally initializes playoffs.
 * Usage: npx tsx scripts/seed-playoff.ts [--init-playoffs]
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEV_PASSWORD_HASH = bcrypt.hashSync("password", 10);

async function main() {
  const initPlayoffs = process.argv.includes("--init-playoffs");

  console.log("🏒 Seeding playoff test data...");

  // Create a test user (commissioner)
  const commissioner = await prisma.user.upsert({
    where: { email: "playoff-commissioner@example.com" },
    update: { passwordHash: DEV_PASSWORD_HASH },
    create: {
      email: "playoff-commissioner@example.com",
      displayName: "Playoff Commissioner",
      passwordHash: DEV_PASSWORD_HASH,
    },
  });

  console.log(`✓ Created commissioner: ${commissioner.displayName}`);

  // Create a test league
  const league = await prisma.fantasyLeague.upsert({
    where: { id: "playoff-test-league" },
    update: {},
    create: {
      id: "playoff-test-league",
      name: "Playoff Test League",
      season: "2025-26",
      commissionerId: commissioner.id,
      maxTeams: 6,
      rosterSettings: { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 },
      playoffSettings: {
        teamsInPlayoff: 4,
        topSeedsWithBye: 0,
        roundDurationPeriods: 2,
        higherSeedWinsTies: true,
      },
    },
  });

  console.log(`✓ Created league: ${league.name}`);

  // Create 6 users (one per team, since FantasyTeam has unique constraint on (leagueId, ownerId))
  const teamUsers = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      return prisma.user.upsert({
        where: { email: `playoff-team-${i + 1}@example.com` },
        update: { passwordHash: DEV_PASSWORD_HASH },
        create: {
          email: `playoff-team-${i + 1}@example.com`,
          displayName: `Team ${i + 1} Owner`,
          passwordHash: DEV_PASSWORD_HASH,
        },
      });
    })
  );

  console.log(`✓ Created ${teamUsers.length} team owners`);

  // Create 6 fantasy teams (one per user)
  const teams = await Promise.all(
    teamUsers.map(async (owner, i) => {
      return prisma.fantasyTeam.upsert({
        where: { id: `playoff-test-team-${i + 1}` },
        update: {},
        create: {
          id: `playoff-test-team-${i + 1}`,
          name: `Team ${i + 1}`,
          leagueId: league.id,
          ownerId: owner.id,
          draftOrder: i + 1,
        },
      });
    })
  );

  console.log(`✓ Created ${teams.length} fantasy teams`);

  // Create some matchups with scores
  const baseDate = new Date("2025-01-01");
  const matchups = [
    // Week 1
    { home: 0, away: 1, homeScore: 25, awayScore: 20 },
    { home: 2, away: 3, homeScore: 30, awayScore: 28 },
    { home: 4, away: 5, homeScore: 22, awayScore: 18 },
    // Week 2
    { home: 1, away: 2, homeScore: 28, awayScore: 25 },
    { home: 3, away: 4, homeScore: 31, awayScore: 32 },
    { home: 5, away: 0, homeScore: 20, awayScore: 24 },
    // Week 3
    { home: 2, away: 0, homeScore: 26, awayScore: 23 },
    { home: 3, away: 1, homeScore: 29, awayScore: 27 },
    { home: 4, away: 5, homeScore: 25, awayScore: 21 },
  ];

  for (let weekIndex = 0; weekIndex < 3; weekIndex++) {
    const weekMatchups = matchups.slice(weekIndex * 3, (weekIndex + 1) * 3);
    const weekStart = new Date(baseDate);
    weekStart.setDate(weekStart.getDate() + weekIndex * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    for (const m of weekMatchups) {
      await prisma.matchup.upsert({
        where: {
          id: `playoff-test-matchup-${weekIndex}-${m.home}-${m.away}`,
        },
        update: {
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        },
        create: {
          id: `playoff-test-matchup-${weekIndex}-${m.home}-${m.away}`,
          leagueId: league.id,
          week: weekIndex + 1,
          startsAt: weekStart,
          endsAt: weekEnd,
          homeTeamId: teams[m.home].id,
          awayTeamId: teams[m.away].id,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          isPlayoff: false,
          round: null,
        },
      });
    }
  }

  console.log(`✓ Created ${matchups.length} test matchups with scores`);

  if (initPlayoffs) {
    // Initialize playoffs
    console.log("\n🎯 Initializing playoffs...");

    // Call the start-playoffs API endpoint
    try {
      const response = await fetch(
        `http://localhost:3000/api/leagues/${league.id}/start-playoffs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error(`✗ Failed to start playoffs: ${error.error}`);
      } else {
        const result = await response.json();
        console.log(`✓ Playoffs started successfully`);
        console.log(`  - Seeded teams: ${result.bracket.seededTeams.length}`);
        console.log(`  - Total rounds: ${result.bracket.totalRounds}`);
      }
    } catch (e) {
      console.error("Note: Could not call API (server may not be running)");
      console.log("Run 'npm run dev' to start the server and try again");
    }
  }

  console.log("\n✨ Seed complete!");
  console.log(`\nTest league ID: ${league.id}`);
  console.log("Visit: http://localhost:3000/league/playoff-test-league/bracket");

  if (!initPlayoffs) {
    console.log(
      "\nTo initialize playoffs, run: npx tsx scripts/seed-playoff.ts --init-playoffs"
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
