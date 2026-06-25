// scripts/purge-mock-players.ts
// Removes mock-seeded players (externalId like "bos-p0", "min-p5", etc.) and
// all records that reference them. Safe to re-run — idempotent.
//
//   npx tsx scripts/purge-mock-players.ts
//   npx tsx scripts/purge-mock-players.ts --dry-run

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dry = process.argv.includes("--dry-run");

// Mock externalIds are always "{abbr}-p{n}" where n is a small integer.
const MOCK_PATTERN = /^[a-z]+-p\d+$/;

async function main() {
  const mocks = await prisma.player.findMany({
    where: { externalId: { contains: "-p" } },
    select: { id: true, externalId: true, firstName: true, lastName: true },
  });

  // Double-check the regex so we don't accidentally catch real players.
  const targets = mocks.filter((p) => MOCK_PATTERN.test(p.externalId));

  if (targets.length === 0) {
    console.log("No mock players found — nothing to do.");
    return;
  }

  console.log(`Found ${targets.length} mock player(s)${dry ? " (dry-run)" : ""}:`);
  for (const p of targets) {
    console.log(`  ${p.externalId}  ${p.firstName} ${p.lastName}`);
  }

  if (dry) {
    console.log("\nDry-run complete. Re-run without --dry-run to delete.");
    return;
  }

  const ids = targets.map((p) => p.id);

  // Delete dependent records in the right order (child-first).
  const statLines    = await prisma.statLine.deleteMany({ where: { playerId: { in: ids } } });
  const draftPicks   = await prisma.draftPick.deleteMany({ where: { playerId: { in: ids } } });
  const rosterEntries = await prisma.rosterEntry.deleteMany({ where: { playerId: { in: ids } } });
  const waiverEntries = await prisma.waiverEntry.deleteMany({ where: { playerId: { in: ids } } });
  const players      = await prisma.player.deleteMany({ where: { id: { in: ids } } });

  console.log(`\nDeleted:`);
  console.log(`  ${statLines.count} stat line(s)`);
  console.log(`  ${draftPicks.count} draft pick(s)`);
  console.log(`  ${rosterEntries.count} roster entr(ies)`);
  console.log(`  ${waiverEntries.count} waiver entr(ies)`);
  console.log(`  ${players.count} player(s)`);
  console.log("\nDone. Mock players purged.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
