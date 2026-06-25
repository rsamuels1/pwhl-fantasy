// scripts/update-2026-27-rosters.ts
// Updates 2026-27 pre-season rosters from HockeyTech after expansion draft.
// Idempotent: safe to re-run; upserts players by externalId.
//
// The expansion draft + PWHL draft occurred week of June 21, 2026.
// Pre-season rosters (season_id=10) reflect initial allocations; full rosters
// will fill in as contracts are signed through the summer.
//
// WHY THIS SCRIPT EXISTS SEPARATELY FROM `npm run ingest`:
// The main ingest script discovers team IDs from the schedule. season_id=10
// has no games yet, so it gets 0 team IDs and fetches nothing. This script
// bypasses schedule-based discovery and fetches rosters directly by known
// HockeyTech numeric team IDs.
//
// Usage:
//   npx tsx scripts/update-2026-27-rosters.ts --dry-run   # preview changes
//   npx tsx scripts/update-2026-27-rosters.ts              # apply
//
// Run weekly until the 2026-27 schedule is published. Once a schedule exists,
// `npm run ingest -- --season 2026-27 --no-stats` will handle it instead.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE = "https://lscluster.hockeytech.com/feed/index.php";
const API_KEY = "446521baf8c38984";
const SEASON_ID = "10"; // 2026-27 Pre-Season

// HockeyTech numeric team ID → DB externalId (from CLAUDE.md)
const HT_TEAM_MAP: Record<number, string> = {
  1: "bos",
  2: "min",
  3: "mtl",
  4: "nyc",
  5: "ott",
  6: "tor",
  8: "sea",
  9: "van",
  10: "det",
  11: "ham",
  12: "lv",
  13: "sj",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mapPosition(htPos: string): "FORWARD" | "DEFENSE" | "GOALIE" {
  const p = htPos.toUpperCase();
  if (p === "G") return "GOALIE";
  if (p.includes("D")) return "DEFENSE";
  return "FORWARD";
}

function splitName(full: string): { firstName: string; lastName: string } {
  const i = full.lastIndexOf(" ");
  if (i < 0) return { firstName: "", lastName: full };
  return { firstName: full.slice(0, i), lastName: full.slice(i + 1) };
}

interface RawPlayer {
  externalId: string;
  firstName: string;
  lastName: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  jersey?: number;
  htTeamId: number;
}

async function fetchRosterForTeam(htTeamId: number): Promise<RawPlayer[]> {
  const params = new URLSearchParams({
    key: API_KEY,
    client_code: "pwhl",
    site_id: "2",
    league_id: "1",
    lang: "en",
    feed: "statviewfeed",
    view: "roster",
    season_id: SEASON_ID,
    team_id: String(htTeamId),
  });

  const res = await fetch(`${BASE}?${params}`, {
    headers: { "User-Agent": "pwhl-fantasy-ingest/1.0" },
  });
  if (!res.ok) throw new Error(`HockeyTech HTTP ${res.status} for team ${htTeamId}`);

  let text = (await res.text()).trim();
  // Roster endpoint returns JSONP: strip outer ( )
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1);

  const data = JSON.parse(text) as {
    roster: Array<{
      sections: Array<{
        title: string;
        data?: Array<{ row: { player_id: string; name: string; position: string; tp_jersey_number: string } }>;
      }>;
    }>;
  };

  const players: RawPlayer[] = [];
  const sections = data.roster?.[0]?.sections ?? [];
  for (const sec of sections) {
    if (sec.title === "Coaches") continue;
    for (const entry of sec.data ?? []) {
      const r = entry.row;
      if (!r.player_id) continue;
      const { firstName, lastName } = splitName(r.name);
      players.push({
        externalId: r.player_id,
        firstName,
        lastName,
        position: mapPosition(r.position),
        jersey: r.tp_jersey_number ? Number(r.tp_jersey_number) : undefined,
        htTeamId,
      });
    }
  }
  return players;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(`\nUpdating 2026-27 pre-season rosters from HockeyTech (season_id=${SEASON_ID})…`);
  if (dryRun) console.log("  (--dry-run: no changes will be written)\n");
  else console.log();

  // Load DB teams for externalId → id mapping
  const dbTeams = await prisma.team.findMany({ select: { id: true, externalId: true, abbreviation: true } });
  const teamByExternalId = new Map(dbTeams.map((t) => [t.externalId, t]));

  let totalNew = 0;
  let totalMoved = 0;
  let totalUnchanged = 0;
  let totalFailed = 0;

  for (const [htTeamId, externalId] of Object.entries(HT_TEAM_MAP)) {
    const dbTeam = teamByExternalId.get(externalId);
    if (!dbTeam) {
      console.warn(`  ⚠ No DB team found for externalId="${externalId}" (HT team ${htTeamId}) — skipping`);
      continue;
    }

    let players: RawPlayer[];
    try {
      players = await fetchRosterForTeam(Number(htTeamId));
    } catch (e) {
      console.error(`  ✗ ${dbTeam.abbreviation}: fetch failed — ${(e as Error).message}`);
      totalFailed++;
      continue;
    }

    let teamNew = 0;
    let teamMoved = 0;
    let teamUnchanged = 0;

    for (const p of players) {
      const existing = await prisma.player.findUnique({ where: { externalId: p.externalId } });

      if (!existing) {
        teamNew++;
        if (!dryRun) {
          await prisma.player.create({
            data: {
              externalId: p.externalId,
              firstName: p.firstName,
              lastName: p.lastName,
              position: p.position,
              jersey: p.jersey ?? null,
              teamId: dbTeam.id,
              active: true,
            },
          });
        }
      } else if (existing.teamId !== dbTeam.id) {
        teamMoved++;
        if (!dryRun) {
          await prisma.player.update({
            where: { id: existing.id },
            data: {
              firstName: p.firstName,
              lastName: p.lastName,
              position: p.position,
              jersey: p.jersey ?? null,
              teamId: dbTeam.id,
              active: true,
            },
          });
        }
      } else {
        teamUnchanged++;
        if (!dryRun) {
          // Still update name/jersey/position in case of corrections
          await prisma.player.update({
            where: { id: existing.id },
            data: {
              firstName: p.firstName,
              lastName: p.lastName,
              position: p.position,
              jersey: p.jersey ?? null,
              active: true,
            },
          });
        }
      }
    }

    totalNew += teamNew;
    totalMoved += teamMoved;
    totalUnchanged += teamUnchanged;

    const parts = [];
    if (teamNew > 0) parts.push(`+${teamNew} new`);
    if (teamMoved > 0) parts.push(`${teamMoved} moved in`);
    if (teamUnchanged > 0) parts.push(`${teamUnchanged} unchanged`);
    console.log(`  ${dbTeam.abbreviation.padEnd(4)} ${players.length} players  ${parts.join(", ")}`);

    await sleep(120); // polite delay between team fetches
  }

  console.log(`
Summary:
  ${totalNew} new players added
  ${totalMoved} existing players moved to new team
  ${totalUnchanged} players unchanged
  ${totalFailed} teams failed to fetch`);

  if (dryRun) {
    console.log("\n✓ Dry run complete. No changes written.");
  } else {
    console.log("\n✓ Rosters updated.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
