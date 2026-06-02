// prisma/seed/seed.ts
// Loads mock PWHL data so the app is buildable/testable before a real stats
// source exists. Implements the StatsSource interface from lib/ingestion/source.ts.

import { PrismaClient } from "@prisma/client";
import type {
  StatsSource,
  RawTeam,
  RawPlayer,
  RawGame,
  RawStatLine,
} from "../../lib/ingestion/source";

const prisma = new PrismaClient();

// All 12 teams for 2026-27 (8 existing + 4 expansion). Names for the four new
// teams are not all final — placeholders by city. Update via ingestion later.
const MOCK_TEAMS: RawTeam[] = [
  { externalId: "bos", name: "Boston Fleet", city: "Boston", abbreviation: "BOS" },
  { externalId: "min", name: "Minnesota Frost", city: "Minnesota", abbreviation: "MIN" },
  { externalId: "mtl", name: "Montréal Victoire", city: "Montréal", abbreviation: "MTL" },
  { externalId: "nyc", name: "New York Sirens", city: "New York", abbreviation: "NY" },
  { externalId: "ott", name: "Ottawa Charge", city: "Ottawa", abbreviation: "OTT" },
  { externalId: "sea", name: "Seattle Torrent", city: "Seattle", abbreviation: "SEA" },
  { externalId: "tor", name: "Toronto Sceptres", city: "Toronto", abbreviation: "TOR" },
  { externalId: "van", name: "Vancouver Goldeneyes", city: "Vancouver", abbreviation: "VAN" },
  { externalId: "det", name: "Detroit (TBD)", city: "Detroit", abbreviation: "DET" },
  { externalId: "ham", name: "Hamilton (TBD)", city: "Hamilton", abbreviation: "HAM" },
  { externalId: "lv", name: "Las Vegas (TBD)", city: "Las Vegas", abbreviation: "LV" },
  { externalId: "sj", name: "San Jose (TBD)", city: "San Jose", abbreviation: "SJ" },
];

function mockPlayers(): RawPlayer[] {
  const positions: RawPlayer["position"][] = ["FORWARD", "DEFENSE", "GOALIE"];
  const players: RawPlayer[] = [];
  for (const team of MOCK_TEAMS) {
    // 12 forwards, 6 defense, 2 goalies — a simplified roster.
    for (let i = 0; i < 20; i++) {
      const position =
        i < 12 ? positions[0] : i < 18 ? positions[1] : positions[2];
      players.push({
        externalId: `${team.externalId}-p${i}`,
        firstName: `Player${i}`,
        lastName: team.abbreviation,
        position,
        jersey: i + 1,
        teamExternalId: team.externalId,
      });
    }
  }
  return players;
}

class MockStatsSource implements StatsSource {
  async fetchTeams(_season: string): Promise<RawTeam[]> {
    return MOCK_TEAMS;
  }
  async fetchPlayers(_season: string): Promise<RawPlayer[]> {
    return mockPlayers();
  }
  async fetchGames(_season: string): Promise<RawGame[]> {
    return []; // add a few mock games as needed for scoring tests
  }
  async fetchStatLines(_gameExternalId: string): Promise<RawStatLine[]> {
    return [];
  }
}

async function main() {
  const source = new MockStatsSource();

  const teams = await source.fetchTeams("2026-27");
  for (const t of teams) {
    await prisma.team.upsert({
      where: { externalId: t.externalId },
      update: { name: t.name, city: t.city, abbreviation: t.abbreviation },
      create: { ...t },
    });
  }

  const players = await source.fetchPlayers("2026-27");
  for (const p of players) {
    const team = p.teamExternalId
      ? await prisma.team.findUnique({ where: { externalId: p.teamExternalId } })
      : null;
    await prisma.player.upsert({
      where: { externalId: p.externalId },
      update: { teamId: team?.id ?? null },
      create: {
        externalId: p.externalId,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position,
        jersey: p.jersey,
        teamId: team?.id ?? null,
      },
    });
  }

  console.log(`Seeded ${teams.length} teams and ${players.length} players.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
