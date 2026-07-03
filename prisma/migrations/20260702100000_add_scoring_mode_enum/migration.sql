-- Migration: add_scoring_mode_enum
-- Converts scoringMode from TEXT to a proper PostgreSQL enum type.
-- The column was added as TEXT in baseline_schema; the Prisma client now
-- expects a ScoringMode enum type, which was only created via db push on
-- staging but never captured in a migration file.

DO $$ BEGIN
  CREATE TYPE "ScoringMode" AS ENUM ('VP', 'H2H', 'VTF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FantasyLeague" ALTER COLUMN "scoringMode" DROP DEFAULT;

ALTER TABLE "FantasyLeague"
  ALTER COLUMN "scoringMode" TYPE "ScoringMode"
  USING "scoringMode"::"ScoringMode";

ALTER TABLE "FantasyLeague"
  ALTER COLUMN "scoringMode" SET DEFAULT 'H2H'::"ScoringMode";
