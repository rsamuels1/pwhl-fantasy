// scripts/ingest.ts
// Imports real PWHL data from HockeyTech for a given season.
// Idempotent: safe to re-run; upserts by externalId.
//
// Usage:
//   npm run ingest -- --season 2025-26          # regular season
//   npm run ingest -- --season-id 5             # by HockeyTech season_id directly
//   npm run ingest -- --season 2025-26 --no-stats  # skip stat lines (teams/players/games only)

import { PrismaClient, type GameStatus } from "@prisma/client";
import { HockeytechSource, fetchGameStartTime } from "../lib/ingestion/hockeytech";

const prisma = new PrismaClient();
const source = new HockeytechSource();

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const season = arg("--season") ?? arg("--season-id");
  if (!season) {
    console.error("Usage: npm run ingest -- --season 2025-26");
    process.exit(1);
  }
  const noStats = process.argv.includes("--no-stats");

  console.log(`\nIngesting season "${season}" from HockeyTech…`);
  if (noStats) console.log("  (--no-stats: skipping stat lines)");

  // ── Teams ──────────────────────────────────────────────────────────────────
  console.log("\n[1/4] Fetching teams…");
  const teams = await source.fetchTeams(season);
  console.log(`  ${teams.length} teams received`);
  let upserted = 0;
  for (const t of teams) {
    // If mock seed already created a team with this abbreviation under a
    // different externalId, update it to the real ID first.
    const byAbbr = await prisma.team.findUnique({ where: { abbreviation: t.abbreviation } });
    if (byAbbr && byAbbr.externalId !== t.externalId) {
      await prisma.team.update({ where: { id: byAbbr.id }, data: { externalId: t.externalId } });
    }
    await prisma.team.upsert({
      where: { externalId: t.externalId },
      update: { name: t.name, city: t.city, abbreviation: t.abbreviation },
      create: { externalId: t.externalId, name: t.name, city: t.city, abbreviation: t.abbreviation },
    });
    upserted++;
  }
  console.log(`  ✓ ${upserted} teams upserted`);

  // ── Players ────────────────────────────────────────────────────────────────
  console.log("\n[2/4] Fetching players…");
  const players = await source.fetchPlayers(season);
  console.log(`  ${players.length} players received`);
  upserted = 0;
  for (const p of players) {
    const team = p.teamExternalId
      ? await prisma.team.findUnique({ where: { externalId: p.teamExternalId } })
      : null;
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
    upserted++;
  }
  console.log(`  ✓ ${upserted} players upserted`);

  // ── Games ──────────────────────────────────────────────────────────────────
  console.log("\n[3/4] Fetching games…");
  const games = await source.fetchGames(season);
  console.log(`  ${games.length} games received`);
  upserted = 0;
  for (const g of games) {
    const homeTeam = await prisma.team.findUnique({ where: { externalId: g.homeTeamExternalId } });
    const awayTeam = await prisma.team.findUnique({ where: { externalId: g.awayTeamExternalId } });
    if (!homeTeam || !awayTeam) {
      console.warn(`  skipping game ${g.externalId}: unknown team`);
      continue;
    }
    await prisma.game.upsert({
      where: { externalId: g.externalId },
      update: {
        status: g.status as GameStatus,
        homeScore: g.homeScore ?? null,
        awayScore: g.awayScore ?? null,
      },
      create: {
        externalId: g.externalId,
        season,
        startsAt: new Date(g.startsAt),
        status: g.status as GameStatus,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: g.homeScore ?? null,
        awayScore: g.awayScore ?? null,
      },
    });
    upserted++;
  }
  console.log(`  ✓ ${upserted} games upserted`);

  // ── Stat lines ─────────────────────────────────────────────────────────────
  if (noStats) {
    console.log("\n[4/4] Skipping stat lines (--no-stats)");
  } else {
    const finalGames = await prisma.game.findMany({
      where: { season, status: "FINAL" },
      select: { id: true, externalId: true },
    });
    console.log(`\n[4/4] Fetching stat lines for ${finalGames.length} final games…`);
    let statGames = 0, statLines = 0, errors = 0;

    for (const game of finalGames) {
      try {
        const lines = await source.fetchStatLines(game.externalId);

        for (const l of lines) {
          const player = await prisma.player.findUnique({ where: { externalId: l.playerExternalId } });
          if (!player) continue; // unknown player (e.g. an expansion team not yet in DB)

          await prisma.statLine.upsert({
            where: { playerId_gameId: { playerId: player.id, gameId: game.id } },
            update: {
              goals: l.goals,
              assists: l.assists,
              shots: l.shots,
              plusMinus: l.plusMinus,
              penaltyMinutes: l.penaltyMinutes,
              powerPlayPts: l.powerPlayPts,
              hits: l.hits,
              blocks: l.blocks,
              saves: l.saves,
              goalsAgainst: l.goalsAgainst,
              shutout: l.shutout,
              win: l.win,
              timeOnIceSecs: l.timeOnIceSecs,
            },
            create: {
              playerId: player.id,
              gameId: game.id,
              goals: l.goals,
              assists: l.assists,
              shots: l.shots,
              plusMinus: l.plusMinus,
              penaltyMinutes: l.penaltyMinutes,
              powerPlayPts: l.powerPlayPts,
              hits: l.hits,
              blocks: l.blocks,
              saves: l.saves,
              goalsAgainst: l.goalsAgainst,
              shutout: l.shutout,
              win: l.win,
              timeOnIceSecs: l.timeOnIceSecs,
            },
          });
          statLines++;
        }

        // Backfill precise startsAt from GameDateISO8601 (gameSummary was
        // already fetched above via fetchStatLines, so this is a cheap extra call)
        const iso = await fetchGameStartTime(game.externalId);
        if (iso) {
          await prisma.game.update({
            where: { id: game.id },
            data: { startsAt: new Date(iso) },
          });
        }

        statGames++;
        console.log(`  game ${statGames}/${finalGames.length} — ${statLines} lines total`);
      } catch (err) {
        errors++;
        console.warn(`\n  ✗ game ${game.externalId}: ${(err as Error).message}`);
      }
    }

    console.log(`\n  ✓ ${statLines} stat lines across ${statGames} games (${errors} errors)`);
  }

  console.log("\nDone.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
