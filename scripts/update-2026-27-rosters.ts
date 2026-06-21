// scripts/update-2026-27-rosters.ts
// Updates 2026-27 pre-season rosters from HockeyTech after expansion draft.
// Idempotent: safe to re-run; upserts players by externalId.
//
// The expansion draft + PWHL draft occurred week of June 21, 2026.
// Pre-season rosters now reflect initial allocations; full rosters will fill
// as contracts are signed.
//
// Usage:
//   npx tsx scripts/update-2026-27-rosters.ts --dry-run   # preview changes
//   npx tsx scripts/update-2026-27-rosters.ts              # apply

import { PrismaClient } from "@prisma/client";
import { HockeytechSource } from "../lib/ingestion/hockeytech";

const prisma = new PrismaClient();
const source = new HockeytechSource();

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const season = "2026-27";

  console.log(`\nUpdating ${season} pre-season rosters from HockeyTech…`);
  if (dryRun) console.log("  (--dry-run: no changes will be written)");

  // Fetch all teams and players from HockeyTech
  const teams = await prisma.team.findMany();
  const teamByExternalId = new Map(teams.map((t) => [t.externalId, t]));

  console.log(`\nFetching ${season} players from HockeyTech…`);
  let players: Awaited<ReturnType<typeof source.fetchPlayers>> = [];
  try {
    players = await source.fetchPlayers(season);
  } catch (e) {
    console.error(`Failed to fetch players: ${(e as Error).message}`);
    process.exit(1);
  }

  console.log(`  ${players.length} players received\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let addedCount = 0;
  let removedCount = 0;

  // Track before state for each team
  const beforeCounts = new Map<string, number>();
  for (const team of teams) {
    const count = await prisma.player.count({ where: { teamId: team.id } });
    beforeCounts.set(team.id, count);
    totalBefore += count;
  }

  // Group incoming players by team
  const incomingByTeam = new Map<string, typeof players>();
  for (const p of players) {
    const teamId = p.teamExternalId ? teamByExternalId.get(p.teamExternalId)?.id : null;
    if (!teamId) continue;
    if (!incomingByTeam.has(teamId)) incomingByTeam.set(teamId, []);
    incomingByTeam.get(teamId)!.push(p);
  }

  // Upsert all players
  if (!dryRun) {
    for (const p of players) {
      const team = p.teamExternalId ? teamByExternalId.get(p.teamExternalId) : null;
      await prisma.player.upsert({
        where: { externalId: p.externalId },
        update: {
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
          jersey: p.jersey ?? null,
          teamId: team?.id ?? null,
          active: true,
        },
        create: {
          externalId: p.externalId,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
          jersey: p.jersey ?? null,
          teamId: team?.id ?? null,
        },
      });
    }
  }

  // Calculate deltas by team
  console.log("Roster updates:");
  for (const team of teams) {
    const beforeCount = beforeCounts.get(team.id) ?? 0;
    const incomingCount = incomingByTeam.get(team.id)?.length ?? 0;
    const delta = incomingCount - beforeCount;
    totalAfter += incomingCount;

    if (delta > 0) {
      addedCount += delta;
      console.log(`  ${team.abbreviation}: ${beforeCount} → ${incomingCount} (+${delta})`);
    } else if (delta < 0) {
      removedCount += Math.abs(delta);
      console.log(`  ${team.abbreviation}: ${beforeCount} → ${incomingCount} (${delta})`);
    } else if (incomingCount > 0) {
      console.log(`  ${team.abbreviation}: ${incomingCount} (no change)`);
    }
  }

  const summary = `Summary: ${totalBefore} → ${totalAfter} players (${addedCount > 0 ? `+${addedCount}` : addedCount} added, ${removedCount > 0 ? `-${removedCount}` : "0"} removed)`;
  console.log(`\n${summary}`);

  if (dryRun) {
    console.log("\n✓ Dry run complete. No changes written.");
  } else {
    console.log("\n✓ Rosters updated.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
