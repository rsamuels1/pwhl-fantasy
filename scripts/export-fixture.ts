// scripts/export-fixture.ts
// Snapshots a season's worth of DB rows into JSON fixture files under
// tests/fixtures/<season>/. Uses externalId references everywhere so the
// fixture is portable — no internal cuid PKs.
//
//   npm run export-fixture -- --season 2025-26

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const season = arg("--season");
  if (!season) {
    console.error("Usage: npm run export-fixture -- --season 2025-26");
    process.exit(1);
  }

  const dir = join(__dirname, "../tests/fixtures", season);
  mkdirSync(dir, { recursive: true });

  // ── Teams ──────────────────────────────────────────────────────────────────
  // Export all teams that appear in this season's games.
  const games = await prisma.game.findMany({
    where: { season },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const teamIds = new Set([
    ...games.map((g) => g.homeTeamId),
    ...games.map((g) => g.awayTeamId),
  ]);
  const teams = await prisma.team.findMany({
    where: { id: { in: [...teamIds] } },
    orderBy: { externalId: "asc" },
  });
  const teamsOut = teams.map(({ externalId, name, city, abbreviation }) => ({
    externalId, name, city, abbreviation,
  }));
  write(dir, "teams.json", teamsOut);
  console.log(`  teams:     ${teamsOut.length}`);

  // ── Players ────────────────────────────────────────────────────────────────
  // Export players that have at least one stat line this season.
  const statLinePlayerIds = await prisma.statLine.findMany({
    where: { game: { season } },
    select: { playerId: true },
    distinct: ["playerId"],
  });
  const playerIdSet = new Set(statLinePlayerIds.map((s) => s.playerId));
  const players = await prisma.player.findMany({
    where: { id: { in: [...playerIdSet] } },
    include: { team: { select: { externalId: true } } },
    orderBy: { externalId: "asc" },
  });
  const playersOut = players.map(({ externalId, firstName, lastName, position, jersey, team }) => ({
    externalId,
    firstName,
    lastName,
    position,
    jersey,
    teamExternalId: team?.externalId ?? null,
  }));
  write(dir, "players.json", playersOut);
  console.log(`  players:   ${playersOut.length}`);

  // ── Games ──────────────────────────────────────────────────────────────────
  const gamesOut = await prisma.game.findMany({
    where: { season },
    include: {
      homeTeam: { select: { externalId: true } },
      awayTeam: { select: { externalId: true } },
    },
    orderBy: { externalId: "asc" },
  });
  const gamesMapped = gamesOut.map(({ externalId, season: s, startsAt, status, homeScore, awayScore, homeTeam, awayTeam }) => ({
    externalId,
    season: s,
    startsAt: startsAt.toISOString(),
    status,
    homeTeamExternalId: homeTeam.externalId,
    awayTeamExternalId: awayTeam.externalId,
    homeScore,
    awayScore,
  }));
  write(dir, "games.json", gamesMapped);
  console.log(`  games:     ${gamesMapped.length}`);

  // ── Stat lines ─────────────────────────────────────────────────────────────
  const statLines = await prisma.statLine.findMany({
    where: { game: { season } },
    include: {
      player: { select: { externalId: true } },
      game:   { select: { externalId: true } },
    },
    orderBy: [{ game: { externalId: "asc" } }, { player: { externalId: "asc" } }],
  });
  const statLinesOut = statLines.map(({ player, game, goals, assists, shots, plusMinus, penaltyMinutes, powerPlayPts, hits, blocks, saves, goalsAgainst, shutout, win, timeOnIceSecs }) => ({
    playerExternalId: player.externalId,
    gameExternalId:   game.externalId,
    goals, assists, shots, plusMinus, penaltyMinutes, powerPlayPts,
    hits, blocks, saves, goalsAgainst, shutout, win, timeOnIceSecs,
  }));
  write(dir, "statlines.json", statLinesOut);
  console.log(`  stat lines: ${statLinesOut.length}`);

  console.log(`\nFixture written to tests/fixtures/${season}/`);
}

function write(dir: string, filename: string, data: unknown) {
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2) + "\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
