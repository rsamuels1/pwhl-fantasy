/**
 * DEV ONLY: Clone a handful of existing 2025-26 games into the next 7 days
 * so the lineup page has an active scoring period and shows the "games left" badge.
 *
 * Run: npx tsx scripts/seed-future-games.ts
 * Undo: npx tsx scripts/seed-future-games.ts --clear
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FUTURE_GAME_PREFIX = "dev-future-";

async function clear() {
  const deleted = await prisma.game.deleteMany({
    where: { externalId: { startsWith: FUTURE_GAME_PREFIX } },
  });
  console.log(`Deleted ${deleted.count} future dev games.`);
}

async function seed() {
  // Grab one real game per pair of teams to use as a template.
  const templates = await prisma.game.findMany({
    select: { homeTeamId: true, awayTeamId: true },
    distinct: ["homeTeamId"],
    orderBy: { startsAt: "desc" },
    take: 8,
  });

  const now = new Date();
  // Spread games across the next 6 days so the lifecycle engine sees a full week.
  const offsets = [1, 2, 3, 4, 5, 6, 3, 5]; // days from now

  const upserts = templates.map((t, i) => {
    const startsAt = new Date(now.getTime() + offsets[i] * 24 * 60 * 60 * 1000);
    startsAt.setUTCHours(19, 0, 0, 0); // 7pm UTC
    const externalId = `${FUTURE_GAME_PREFIX}${t.homeTeamId}-${t.awayTeamId}-${i}`;
    return prisma.game.upsert({
      where: { externalId },
      update: { startsAt, status: "SCHEDULED" },
      create: {
        externalId,
        season: "2025-26",
        startsAt,
        status: "SCHEDULED",
        homeTeamId: t.homeTeamId,
        awayTeamId: t.awayTeamId,
      },
    });
  });

  const results = await Promise.all(upserts);
  console.log(`Upserted ${results.length} future dev games spanning the next 6 days.`);
  console.log("Game dates:");
  results.forEach((g) =>
    console.log(`  ${g.startsAt.toISOString().slice(0, 10)}  ${g.homeTeamId.slice(-6)} vs ${g.awayTeamId.slice(-6)}  [${g.externalId}]`)
  );
  console.log("\nNow open the lineup page — each player whose team has a game this week will show a badge.");
}

const args = process.argv.slice(2);
if (args.includes("--clear")) {
  clear().finally(() => prisma.$disconnect());
} else {
  seed().finally(() => prisma.$disconnect());
}
