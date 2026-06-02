-- CreateEnum
CREATE TYPE "Position" AS ENUM ('FORWARD', 'DEFENSE', 'GOALIE');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINAL', 'POSTPONED');

-- CreateEnum
CREATE TYPE "DraftType" AS ENUM ('SNAKE', 'AUCTION');

-- CreateEnum
CREATE TYPE "PlayoffStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "FantasyLeagueStatus" AS ENUM ('PRE_DRAFT', 'DRAFTING', 'IN_SEASON', 'COMPLETE');

-- CreateEnum
CREATE TYPE "LineupSlot" AS ENUM ('FORWARD', 'DEFENSE', 'GOALIE', 'UTIL', 'BENCH', 'IR');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETE');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "conference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "jersey" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatLine" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "plusMinus" INTEGER NOT NULL DEFAULT 0,
    "penaltyMinutes" INTEGER NOT NULL DEFAULT 0,
    "powerPlayPts" INTEGER NOT NULL DEFAULT 0,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "blocks" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "goalsAgainst" INTEGER NOT NULL DEFAULT 0,
    "shutout" BOOLEAN NOT NULL DEFAULT false,
    "win" BOOLEAN NOT NULL DEFAULT false,
    "timeOnIceSecs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyLeague" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL DEFAULT '2026-27',
    "draftType" "DraftType" NOT NULL DEFAULT 'SNAKE',
    "status" "FantasyLeagueStatus" NOT NULL DEFAULT 'PRE_DRAFT',
    "maxTeams" INTEGER NOT NULL DEFAULT 10,
    "commissionerId" TEXT NOT NULL,
    "scoringSettings" JSONB NOT NULL DEFAULT '{}',
    "rosterSettings" JSONB NOT NULL DEFAULT '{}',
    "playoffSettings" JSONB NOT NULL DEFAULT '{"teamsInPlayoff": 6, "topSeedsWithBye": 2, "roundDurationPeriods": 2, "higherSeedWinsTies": true}',
    "playoffStatus" "PlayoffStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "draftStartsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyLeague_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "draftOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slot" "LineupSlot" NOT NULL DEFAULT 'BENCH',
    "acquired" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "pickTimerSecs" INTEGER NOT NULL DEFAULT 90,
    "currentPick" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT,
    "pickedAt" TIMESTAMP(3),

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matchup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" DOUBLE PRECISION,
    "awayScore" DOUBLE PRECISION,
    "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
    "round" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_externalId_key" ON "Team"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbreviation_key" ON "Team"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Player_lastName_firstName_idx" ON "Player"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Game_externalId_key" ON "Game"("externalId");

-- CreateIndex
CREATE INDEX "Game_season_startsAt_idx" ON "Game"("season", "startsAt");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "StatLine_gameId_idx" ON "StatLine"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "StatLine_playerId_gameId_key" ON "StatLine"("playerId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FantasyLeague_status_idx" ON "FantasyLeague"("status");

-- CreateIndex
CREATE INDEX "FantasyTeam_leagueId_idx" ON "FantasyTeam"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeam_leagueId_ownerId_key" ON "FantasyTeam"("leagueId", "ownerId");

-- CreateIndex
CREATE INDEX "RosterEntry_fantasyTeamId_idx" ON "RosterEntry"("fantasyTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_fantasyTeamId_playerId_key" ON "RosterEntry"("fantasyTeamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Draft_leagueId_key" ON "Draft"("leagueId");

-- CreateIndex
CREATE INDEX "DraftPick_draftId_idx" ON "DraftPick"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_draftId_overall_key" ON "DraftPick"("draftId", "overall");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_week_idx" ON "Matchup"("leagueId", "week");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatLine" ADD CONSTRAINT "StatLine_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatLine" ADD CONSTRAINT "StatLine_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyLeague" ADD CONSTRAINT "FantasyLeague_commissionerId_fkey" FOREIGN KEY ("commissionerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeam" ADD CONSTRAINT "FantasyTeam_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "FantasyLeague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeam" ADD CONSTRAINT "FantasyTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "FantasyLeague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "FantasyLeague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "FantasyTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
