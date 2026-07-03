// One-shot script: converts the scoringMode column from TEXT to the ScoringMode enum.
// Run against the beta DB after apply-beta-migrations has already created the enum type.
//
//   DATABASE_URL="postgresql://..." npx tsx scripts/fix-scoring-mode-column.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking scoringMode column type...");

  const rows = await prisma.$queryRaw<{ data_type: string }[]>`
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'FantasyLeague' AND column_name = 'scoringMode'
  `;

  if (!rows.length) {
    console.error("Column not found — wrong DB?");
    process.exit(1);
  }

  const type = rows[0].data_type;
  console.log(`  Current type: ${type}`);

  if (type === "USER-DEFINED") {
    console.log("  Already an enum — nothing to do.");
    return;
  }

  console.log("  Converting TEXT → ScoringMode enum...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "FantasyLeague" ALTER COLUMN "scoringMode" DROP DEFAULT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FantasyLeague" ALTER COLUMN "scoringMode" TYPE "ScoringMode" USING "scoringMode"::"ScoringMode"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FantasyLeague" ALTER COLUMN "scoringMode" SET DEFAULT 'H2H'::"ScoringMode"`);
  console.log("  ✓ Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
