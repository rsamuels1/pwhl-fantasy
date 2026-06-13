-- Add VP scoring columns to Matchup
ALTER TABLE "Matchup" ADD COLUMN IF NOT EXISTS "homeVP" INTEGER;
ALTER TABLE "Matchup" ADD COLUMN IF NOT EXISTS "awayVP" INTEGER;

-- Add scoringMode to FantasyLeague (if not already present from schema push)
ALTER TABLE "FantasyLeague" ADD COLUMN IF NOT EXISTS "scoringMode" TEXT NOT NULL DEFAULT 'VP';
