// scripts/apply-beta-migrations.ts
// Applies any SQL migration files that haven't been recorded in _prisma_migrations
// for the DB pointed to by DATABASE_URL (shell env, not .env file).
//
// Usage:
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-beta-migrations.ts

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const migrationsDir = path.resolve(__dirname, "../prisma/migrations");

  // Ensure the migrations table exists (Prisma format).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id VARCHAR(36) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
  `;
  const appliedNames = new Set(applied.map((r) => r.migration_name));

  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.existsSync(path.join(migrationsDir, d, "migration.sql")))
    .sort();

  let ran = 0;
  for (const dir of dirs) {
    if (appliedNames.has(dir)) {
      console.log(`  ✓ already applied: ${dir}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf8");
    console.log(`  → applying: ${dir}`);
    // Split on semicolons and run each statement individually —
    // $executeRawUnsafe doesn't support multi-statement strings.
    const statements = sql
      .split(/;(?:\s*\n|$)/)
      .map((s) => s.replace(/^--.*$/gm, "").trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // "already exists" is safe to skip on a per-statement basis.
        if (msg.includes("already exists")) {
          console.log(`    ↷ skipped (already exists): ${stmt.slice(0, 60)}…`);
        } else {
          throw err;
        }
      }
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
       SELECT gen_random_uuid()::text, 'manual', now(), $1, 1
       WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1)`,
      dir
    );
    console.log(`    ✓ done`);
    ran++;
  }

  console.log(`\n✓ Done — ${ran} migration(s) applied.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
