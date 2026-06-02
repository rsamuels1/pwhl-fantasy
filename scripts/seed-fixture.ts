// scripts/seed-fixture.ts
// Fast, offline loader for a season fixture. Reads the JSON files written by
// export-fixture and upserts them into the DB. Idempotent; safe to re-run.
//
//   npm run seed-fixture -- --season 2025-26
//
// Typical use: after a DB reset, run this instead of the live HockeyTech
// ingest to get a full, known season back in seconds.

import { PrismaClient, type GameStatus, type Position } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function load<T>(dir: string, filename: string): T[] {
  return JSON.parse(readFileSync(join(dir, filename), "utf8")) as T[];
}

async function main() {
  const season = arg("--season");
  if (!season) {
    console.error("Usage: npm run seed-fixture -- --season 2025-26");
    process.exit(1);
  }

  const dir = join(__dirname, "../tests/fixtures", season);

  // ── Teams ──────────────────────────────────────────────────────────────────
  const teams = load<{ externalId: string; name: string; city: string; abbreviation: string }>(dir, "teams.json");
  for (const t of teams) {
    // Guard against stale mock data with the same abbreviation but wrong externalId.
    const byAbbr = await prisma.team.findUnique({ where: { abbreviation: t.abbreviation } });
    if (byAbbr && byAbbr.externalId !== t.externalId) {
      await prisma.team.update({ where: { id: byAbbr.id }, data: { externalId: t.externalId } });
    }
    await prisma.team.upsert({
      where: { externalId: t.externalId },
      update: { name: t.name, city: t.city, abbreviation: t.abbreviation },
      create: t,
    });
  }
  console.log(`  ✓ ${teams.length} teams`);

  // ── Players ────────────────────────────────────────────────────────────────
  const players = load<{ externalId: string; firstName: string; lastName: string; position: string; jersey: number | null; teamExternalId: string | null }>(dir, "players.json");
  for (const p of players) {
    const team = p.teamExternalId
      ? await prisma.team.findUnique({ where: { externalId: p.teamExternalId } })
      : null;
    await prisma.player.upsert({
      where: { externalId: p.externalId },
      update: { firstName: p.firstName, lastName: p.lastName, position: p.position as Position, jersey: p.jersey, teamId: team?.id ?? null, active: true },
      create: { externalId: p.externalId, firstName: p.firstName, lastName: p.lastName, position: p.position as Position, jersey: p.jersey, teamId: team?.id ?? null },
    });
  }
  console.log(`  ✓ ${players.length} players`);

  // ── Games ──────────────────────────────────────────────────────────────────
  const games = load<{ externalId: string; season: string; startsAt: string; status: string; homeTeamExternalId: string; awayTeamExternalId: string; homeScore: number | null; awayScore: number | null }>(dir, "games.json");
  for (const g of games) {
    const homeTeam = await prisma.team.findUniqueOrThrow({ where: { externalId: g.homeTeamExternalId } });
    const awayTeam = await prisma.team.findUniqueOrThrow({ where: { externalId: g.awayTeamExternalId } });
    await prisma.game.upsert({
      where: { externalId: g.externalId },
      update: { status: g.status as GameStatus, homeScore: g.homeScore, awayScore: g.awayScore, startsAt: new Date(g.startsAt) },
      create: { externalId: g.externalId, season: g.season, startsAt: new Date(g.startsAt), status: g.status as GameStatus, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, homeScore: g.homeScore, awayScore: g.awayScore },
    });
  }
  console.log(`  ✓ ${games.length} games`);

  // ── Stat lines ─────────────────────────────────────────────────────────────
  type StatRow = { playerExternalId: string; gameExternalId: string; goals: number; assists: number; shots: number; plusMinus: number; penaltyMinutes: number; powerPlayPts: number; hits: number; blocks: number; saves: number; goalsAgainst: number; shutout: boolean; win: boolean; timeOnIceSecs: number };
  const statLines = load<StatRow>(dir, "statlines.json");
  let inserted = 0;
  for (const l of statLines) {
    const player = await prisma.player.findUnique({ where: { externalId: l.playerExternalId } });
    const game   = await prisma.game.findUnique({ where: { externalId: l.gameExternalId } });
    if (!player || !game) continue;
    const data = { goals: l.goals, assists: l.assists, shots: l.shots, plusMinus: l.plusMinus, penaltyMinutes: l.penaltyMinutes, powerPlayPts: l.powerPlayPts, hits: l.hits, blocks: l.blocks, saves: l.saves, goalsAgainst: l.goalsAgainst, shutout: l.shutout, win: l.win, timeOnIceSecs: l.timeOnIceSecs };
    await prisma.statLine.upsert({
      where: { playerId_gameId: { playerId: player.id, gameId: game.id } },
      update: data,
      create: { playerId: player.id, gameId: game.id, ...data },
    });
    inserted++;
  }
  console.log(`  ✓ ${inserted} stat lines`);

  console.log(`\nFixture "${season}" loaded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
