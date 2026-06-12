// scripts/replay-week.ts
// Validation script: builds a throwaway fantasy league from real 2025-26 players,
// one fantasy team per PWHL team, derives scoring periods from real game dates,
// scores the chosen week, and prints results for eyeball verification.
//
//   npm run replay-week                  # scores week 3 (default)
//   npm run replay-week -- --week 5      # scores a specific week
//   npm run replay-week -- --list        # just print all periods + game counts

import { PrismaClient } from "@prisma/client";
import { derivePeriods } from "../lib/scoring/periods";
import { computeTeamScoreDetailed } from "../lib/scoring/matchups";
import { DEFAULT_SCORING } from "../lib/scoring";

const prisma = new PrismaClient();
const SEASON = "2025-26";
const LEAGUE_NAME = "Replay Validation League";

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ── tear-down / set-up helpers ────────────────────────────────────────────────

async function teardown() {
  const prior = await prisma.fantasyLeague.findFirst({
    where: { name: LEAGUE_NAME },
    include: { teams: true, matchups: true },
  });
  if (!prior) return;
  await prisma.matchup.deleteMany({ where: { leagueId: prior.id } });
  await prisma.rosterEntry.deleteMany({ where: { fantasyTeam: { leagueId: prior.id } } });
  await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
  await prisma.fantasyLeague.delete({ where: { id: prior.id } });
}

async function buildLeague(pwhlTeams: Array<{ id: string; abbreviation: string }>) {
  const commish = await prisma.user.upsert({
    where: { email: "replay-commish@dev.local" },
    update: {},
    create: { email: "replay-commish@dev.local", displayName: "Replay Commish" },
  });

  const league = await prisma.fantasyLeague.create({
    data: {
      name: LEAGUE_NAME,
      season: SEASON,
      commissionerId: commish.id,
      maxTeams: pwhlTeams.length,
      status: "IN_SEASON",
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: { forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 },
    },
  });

  const fantasyTeams: Array<{ id: string; name: string; pwhlAbbr: string }> = [];
  for (let i = 0; i < pwhlTeams.length; i++) {
    const pwhlTeam = pwhlTeams[i];
    const owner = await prisma.user.upsert({
      where: { email: `replay-owner-${pwhlTeam.abbreviation.toLowerCase()}@dev.local` },
      update: {},
      create: {
        email: `replay-owner-${pwhlTeam.abbreviation.toLowerCase()}@dev.local`,
        displayName: `Fantasy ${pwhlTeam.abbreviation}`,
      },
    });
    const ft = await prisma.fantasyTeam.create({
      data: {
        name: `Fantasy ${pwhlTeam.abbreviation}`,
        leagueId: league.id,
        ownerId: owner.id,
        draftOrder: i + 1,
      },
    });
    fantasyTeams.push({ id: ft.id, name: ft.name, pwhlAbbr: pwhlTeam.abbreviation });

    // Roster: all active players from this PWHL team, slotted by their position.
    const players = await prisma.player.findMany({
      where: { teamId: pwhlTeam.id, active: true },
    });
    const slotMap: Record<string, "FORWARD" | "DEFENSE" | "GOALIE"> = {
      FORWARD: "FORWARD",
      DEFENSE: "DEFENSE",
      GOALIE:  "GOALIE",
    };
    await prisma.rosterEntry.createMany({
      data: players.map((p) => ({
        fantasyTeamId: ft.id,
        playerId: p.id,
        slot: slotMap[p.position],
      })),
      skipDuplicates: true,
    });
  }

  return { league, fantasyTeams };
}

// ── display helpers ───────────────────────────────────────────────────────────

function pad(s: string | number, w: number, right = false) {
  const str = String(s);
  return right ? str.padStart(w) : str.padEnd(w);
}

function fmt(n: number) {
  return n.toFixed(2);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targetWeek = Number(arg("--week") ?? 3);
  const listOnly = process.argv.includes("--list");

  // ── 1. Derive all periods from real game dates ────────────────────────────
  const gameDates = await prisma.game
    .findMany({ where: { season: SEASON }, select: { startsAt: true } })
    .then((rows) => rows.map((r) => r.startsAt));

  const periods = derivePeriods(gameDates);
  console.log(`\n${SEASON} scoring periods (${periods.length} non-empty weeks):\n`);
  console.log("  week  window                        games");
  console.log("  ────  ──────────────────────────── ─────");
  for (const p of periods) {
    const n = gameDates.filter((d) => d >= p.startsAt && d < p.endsAt).length;
    const marker = p.week === targetWeek ? "◀" : " ";
    console.log(
      `  ${pad(p.week, 4)}  ${p.startsAt.toISOString().slice(0, 10)} – ${new Date(+p.endsAt - 1).toISOString().slice(0, 10)}   ${pad(n, 3, true)}  ${marker}`
    );
  }

  if (listOnly) return;

  const period = periods.find((p) => p.week === targetWeek);
  if (!period) {
    console.error(`\nNo period found for week ${targetWeek}.`);
    process.exit(1);
  }

  // ── 2. Build throwaway league ─────────────────────────────────────────────
  console.log(`\nBuilding test league for week ${targetWeek} (${period.startsAt.toISOString().slice(0, 10)} – ${new Date(+period.endsAt - 1).toISOString().slice(0, 10)})…`);
  await teardown();

  const pwhlTeams = await prisma.team.findMany({
    where: {
      homeGames: { some: { season: SEASON } },
    },
    orderBy: { abbreviation: "asc" },
  });

  const { fantasyTeams } = await buildLeague(pwhlTeams);
  console.log(`  ${fantasyTeams.length} fantasy teams created (one per PWHL team).`);

  // Log roster sizes for a sanity check
  for (const ft of fantasyTeams) {
    const count = await prisma.rosterEntry.count({ where: { fantasyTeamId: ft.id } });
    console.log(`    ${pad(ft.name, 20)}  ${count} players`);
  }

  // ── 3. Games in this window ───────────────────────────────────────────────
  const windowGames = await prisma.game.findMany({
    where: {
      season: SEASON,
      startsAt: { gte: period.startsAt, lt: period.endsAt },
    },
    include: {
      homeTeam: { select: { abbreviation: true } },
      awayTeam: { select: { abbreviation: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  console.log(`\nGames in week ${targetWeek}:`);
  for (const g of windowGames) {
    console.log(
      `  ${g.startsAt.toISOString().slice(0, 10)}  ${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation}` +
        `  ${g.awayScore ?? "?"}–${g.homeScore ?? "?"}`
    );
  }

  // ── 4. Score each team and print matchup results ──────────────────────────
  // Pair: top half vs bottom half by alphabetical order
  const half = Math.floor(fantasyTeams.length / 2);
  const matchups = fantasyTeams.slice(0, half).map((home, i) => ({
    home,
    away: fantasyTeams[half + i],
  }));

  console.log(`\n${"═".repeat(72)}`);
  console.log(`WEEK ${targetWeek} MATCHUP RESULTS`);
  console.log(`${"═".repeat(72)}\n`);

  for (const { home, away } of matchups) {
    const [homeDetail, awayDetail] = await Promise.all([
      computeTeamScoreDetailed(home.id, period, DEFAULT_SCORING, prisma),
      computeTeamScoreDetailed(away.id, period, DEFAULT_SCORING, prisma),
    ]);

    const homeWon = homeDetail.total > awayDetail.total;
    const awayWon = awayDetail.total > homeDetail.total;

    console.log(
      `  ${pad(home.name, 22)} ${pad(fmt(homeDetail.total), 7, true)}  vs  ` +
        `${pad(fmt(awayDetail.total), 7, true)}  ${away.name}` +
        `   → ${homeWon ? home.name : awayWon ? away.name : "TIE"}`
    );

    // Top scorers for each side
    const printTop = (
      detail: Awaited<ReturnType<typeof computeTeamScoreDetailed>>,
      label: string
    ) => {
      const top = detail.players.slice(0, 5);
      if (top.length === 0) {
        console.log(`    ${label}: (no stat lines this week)`);
        return;
      }
      console.log(`    ${label} top scorers:`);
      for (const p of top) {
        console.log(
          `      ${pad(p.name, 26)} ${pad(p.position, 7)} ${pad(fmt(p.points), 6, true)} pts  (${p.gameCount} game${p.gameCount !== 1 ? "s" : ""})`
        );
      }
    };
    printTop(homeDetail, home.name);
    printTop(awayDetail, away.name);
    console.log();
  }

  console.log(`${"═".repeat(72)}`);
  console.log("\nVerification notes:");
  console.log("  • Each fantasy team = all active players from one PWHL team.");
  console.log("  • Scoring: DEFAULT_SCORING (goal=3, assist=2, shot=0.5, hit=0.25, …)");
  console.log("  • Active slots: FORWARD, DEFENSE, GOALIE (no bench).");
  console.log("  • Cross-check: sum goals×3 + assists×2 + shots×0.5 for players from");
  console.log(`    any team's real box scores from ${period.startsAt.toISOString().slice(0, 10)}–${new Date(+period.endsAt - 1).toISOString().slice(0, 10)}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
