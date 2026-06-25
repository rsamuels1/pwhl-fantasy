/**
 * Reset "Beta Agent Test 1" (beta-agent-t-i4or) so it runs in real-time
 * starting 48 hours after the draft ended.
 *
 * The agent test fast-forwarded replayCurrentDate to Nov 22, 2025 and left
 * all matchup dates at 2025-26 fixture dates. This script:
 *
 *  1. Reads current matchup dates (fixture windows, per week)
 *  2. Remaps them to real calendar dates starting 48h after draftCompletedAt
 *  3. Stores betaWeekMappings in scoringSettings so scoreVpWeek can translate
 *     remapped dates back to fixture dates when scoring
 *  4. Sets replayCurrentDate = null so getReplayNow falls back to real time
 *
 * Run:  npx tsx scripts/reset-beta-agent-league.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const LEAGUE_ID = "beta-agent-t-i4or";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const prisma = new PrismaClient();
  try {
    const league = await prisma.fantasyLeague.findUniqueOrThrow({
      where: { id: LEAGUE_ID },
      include: { draft: true },
    });

    if (!league.draft?.completedAt) {
      throw new Error("Draft not complete — cannot determine kickoff time.");
    }

    const draftEndMs = league.draft.completedAt.getTime();
    const kickoffMs = draftEndMs + 2 * 24 * 60 * 60 * 1000; // +48h
    console.log(`Draft ended:   ${league.draft.completedAt.toISOString()}`);
    console.log(`Week 1 starts: ${new Date(kickoffMs).toISOString()}`);

    // Get distinct weeks with their current fixture-window dates
    const matchupRows = await prisma.matchup.findMany({
      where: { leagueId: LEAGUE_ID, isPlayoff: false },
      select: { id: true, week: true, startsAt: true, endsAt: true },
      orderBy: { week: "asc" },
    });

    // De-duplicate by week to build the mapping
    const byWeek = new Map<number, { fixtureStart: Date; fixtureEnd: Date }>();
    for (const m of matchupRows) {
      if (!byWeek.has(m.week)) {
        byWeek.set(m.week, { fixtureStart: m.startsAt, fixtureEnd: m.endsAt });
      }
    }

    const weeks = [...byWeek.keys()].sort((a, b) => a - b);
    console.log(`\nRemapping ${weeks.length} weeks:`);

    const betaWeekMappings: { week: number; fixtureStart: string; fixtureEnd: string }[] = [];
    const weekRemaps = new Map<number, { remappedStart: Date; remappedEnd: Date }>();

    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      const fixture = byWeek.get(week)!;
      const remappedStart = new Date(kickoffMs + i * WEEK_MS);
      const remappedEnd = new Date(kickoffMs + (i + 1) * WEEK_MS);

      betaWeekMappings.push({
        week,
        fixtureStart: fixture.fixtureStart.toISOString(),
        fixtureEnd: fixture.fixtureEnd.toISOString(),
      });
      weekRemaps.set(week, { remappedStart, remappedEnd });

      console.log(
        `  Week ${String(week).padStart(2)}: ` +
          `fixture ${fixture.fixtureStart.toISOString().slice(0, 10)} → ` +
          `${fixture.fixtureEnd.toISOString().slice(0, 10)}  →  ` +
          `real ${remappedStart.toISOString().slice(0, 10)} → ` +
          `${remappedEnd.toISOString().slice(0, 10)}`
      );
    }

    const currentSettings = (league.scoringSettings ?? {}) as Record<string, unknown>;
    const newSettings = { ...currentSettings, betaWeekMappings };

    if (isDryRun) {
      console.log("\n[dry-run] No changes written.");
      return;
    }

    // Update all matchup dates in a transaction
    await prisma.$transaction(async (tx) => {
      for (const m of matchupRows) {
        const remap = weekRemaps.get(m.week);
        if (!remap) continue;
        await tx.matchup.update({
          where: { id: m.id },
          data: { startsAt: remap.remappedStart, endsAt: remap.remappedEnd },
        });
      }

      await tx.fantasyLeague.update({
        where: { id: LEAGUE_ID },
        data: {
          replayCurrentDate: null,
          scoringSettings: newSettings as object,
        },
      });
    });

    console.log("\nReset complete:");
    console.log("  - All matchup dates shifted to real calendar");
    console.log("  - betaWeekMappings added to scoringSettings");
    console.log("  - replayCurrentDate = null (uses real time)");
    console.log(`  - Week 1 is UPCOMING until ${new Date(kickoffMs).toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
