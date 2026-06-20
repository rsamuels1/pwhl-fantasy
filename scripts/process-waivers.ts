#!/usr/bin/env tsx
// scripts/process-waivers.ts
// Processes expired waiver entries for all IN_SEASON leagues (or a specific one).
//
// Usage:
//   npx tsx scripts/process-waivers.ts               # all IN_SEASON leagues
//   npx tsx scripts/process-waivers.ts --league <id> # specific league
//   npx tsx scripts/process-waivers.ts --dry-run     # preview without DB writes

import { PrismaClient } from "@prisma/client";
import { processWaivers, getPlayerWaiverStatus } from "../lib/services/waiver-service";

const args = process.argv.slice(2);
const leagueFlag = args.indexOf("--league");
const specificLeagueId = leagueFlag !== -1 ? args[leagueFlag + 1] : null;
const isDryRun = args.includes("--dry-run");

const prisma = new PrismaClient();

async function dryRunLeague(leagueId: string, nowMs: number): Promise<void> {
  const expiredEntries = await prisma.waiverEntry.findMany({
    where: { leagueId, expiresAt: { lte: new Date(nowMs) } },
    include: {
      player: { select: { firstName: true, lastName: true } },
    },
  });

  if (expiredEntries.length === 0) {
    console.log(`  [DRY-RUN] No expired entries.`);
    return;
  }

  for (const entry of expiredEntries) {
    const playerName = `${entry.player.firstName} ${entry.player.lastName}`;
    const claims = await prisma.waiverClaim.findMany({
      where: { leagueId, addPlayerId: entry.playerId, status: "PENDING" },
      include: { fantasyTeam: { select: { name: true } } },
      orderBy: { prioritySnapshot: "asc" },
    });

    if (claims.length === 0) {
      console.log(`  [DRY-RUN] ${playerName} — 0 claims → would expire (no award)`);
    } else {
      const winner = claims[0]!;
      const denied = claims.slice(1).map((c) => c.fantasyTeam.name).join(", ");
      console.log(
        `  [DRY-RUN] ${playerName} — ${claims.length} claim(s) → would award to "${winner.fantasyTeam.name}" (priority ${winner.prioritySnapshot})` +
          (denied ? `; denied: ${denied}` : "")
      );
    }
  }
}

async function main() {
  const nowMs = Date.now();

  let leagues: { id: string; name: string }[];

  if (specificLeagueId) {
    const league = await prisma.fantasyLeague.findUnique({
      where: { id: specificLeagueId },
      select: { id: true, name: true },
    });
    if (!league) {
      console.error(`League "${specificLeagueId}" not found.`);
      process.exit(1);
    }
    leagues = [league];
  } else {
    leagues = await prisma.fantasyLeague.findMany({
      where: { status: "IN_SEASON" },
      select: { id: true, name: true },
    });
  }

  if (leagues.length === 0) {
    console.log("No IN_SEASON leagues found.");
    return;
  }

  console.log(
    `Processing waivers for ${leagues.length} league(s)${isDryRun ? " [DRY-RUN]" : ""}…`
  );

  let totalAwarded = 0;
  let totalDenied = 0;
  let totalExpired = 0;

  for (const league of leagues) {
    console.log(`\nLeague: ${league.name} (${league.id})`);

    if (isDryRun) {
      await dryRunLeague(league.id, nowMs);
    } else {
      try {
        const result = await processWaivers(league.id, nowMs, prisma);
        console.log(
          `  Awarded: ${result.awarded}  Denied: ${result.denied}  Expired: ${result.expired}`
        );
        totalAwarded += result.awarded;
        totalDenied += result.denied;
        totalExpired += result.expired;
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (!isDryRun) {
    console.log(`\nTotal — Awarded: ${totalAwarded}  Denied: ${totalDenied}  Expired: ${totalExpired}`);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
