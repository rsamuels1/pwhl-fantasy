/**
 * Repairs real-time Beta Replay Leagues whose scoring got permanently stuck.
 *
 * Root cause (fixed in lib/draft/server.ts): the draft-COMPLETE handler stamped
 * FantasyLeague.replayCurrentDate with a real date for every isReplay league,
 * including real-time beta leagues (betaStatus "ACTIVE"), which must keep
 * replayCurrentDate = null forever — that's the field the advance-beta-seasons
 * cron filters on (`where: { betaStatus: "ACTIVE", status: "IN_SEASON",
 * replayCurrentDate: null }`). Once stamped, a league becomes invisible to that
 * cron and never gets scored again, even though its underlying game/matchup
 * dates were computed correctly.
 *
 * This script finds any beta league still in that stuck state, resets
 * replayCurrentDate to null, and immediately calls advanceSeason() once to
 * catch up any weeks that are already past their scoring window.
 *
 * Run:  npx tsx scripts/fix-stuck-beta-leagues.ts [--dry-run] [--league <id>]
 */

import { PrismaClient } from "@prisma/client";
import { advanceSeason } from "../lib/season/index";

const isDryRun = process.argv.includes("--dry-run");
const leagueArgIdx = process.argv.indexOf("--league");
const onlyLeagueId = leagueArgIdx !== -1 ? process.argv[leagueArgIdx + 1] : null;

async function main() {
  // Accept DATABASE_URL_BETA as an override so this can be pointed at the beta
  // Neon branch without clobbering the shell's DATABASE_URL (used by dev/other tooling).
  const url = process.env.DATABASE_URL_BETA || process.env.DATABASE_URL;
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  try {
    const stuckLeagues = await prisma.fantasyLeague.findMany({
      where: {
        betaStatus: "ACTIVE",
        status: "IN_SEASON",
        replayCurrentDate: { not: null },
        ...(onlyLeagueId ? { id: onlyLeagueId } : {}),
      },
      select: { id: true, name: true, replayCurrentDate: true },
    });

    if (stuckLeagues.length === 0) {
      console.log("No stuck beta leagues found (betaStatus=ACTIVE, status=IN_SEASON, replayCurrentDate set).");
      return;
    }

    console.log(`Found ${stuckLeagues.length} stuck beta league(s):`);
    for (const l of stuckLeagues) {
      console.log(`  ${l.id} (${l.name}) — replayCurrentDate was ${l.replayCurrentDate?.toISOString()}`);
    }

    if (isDryRun) {
      console.log("\n[dry-run] No changes written.");
      return;
    }

    for (const l of stuckLeagues) {
      await prisma.fantasyLeague.update({
        where: { id: l.id },
        data: { replayCurrentDate: null },
      });
      const { scoredWeeks, playoffError } = await advanceSeason(l.id, Date.now(), prisma);
      console.log(
        `  ${l.id}: replayCurrentDate cleared, scored weeks [${scoredWeeks.join(", ") || "none pending"}]` +
          (playoffError ? ` (playoff error: ${playoffError})` : "")
      );
    }

    console.log("\nDone. These leagues will now be picked up by the daily advance-beta-seasons cron going forward.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
