-- CreateEnum
CREATE TYPE "TrophyType" AS ENUM ('CHAMPION', 'BEST_RECORD', 'TOP_SCORER', 'MOST_IMPROVED', 'MOST_TRANSACTIONS');

-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "type" "TrophyType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trophy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trophy_teamId_idx" ON "Trophy"("teamId");

-- CreateIndex
CREATE INDEX "Trophy_leagueId_idx" ON "Trophy"("leagueId");

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "FantasyLeague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trophy" ADD CONSTRAINT "Trophy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
