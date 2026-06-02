// scripts/replay-week-vtf.ts
// Validation script for vs-the-field (VTF) weekly scoring.
//
// Builds a 10-team fantasy league seeded with real 2025-26 players via a
// simulated snake draft ranked by actual fantasy production, generates
// all-vs-all matchup periods, scores the target week, and prints each team's
// weekly total and W-L-T record against the field.
//
//   npm run replay-week-vtf                  # score week 9 (default — most games)
//   npm run replay-week-vtf -- --week 5
//   npm run replay-week-vtf -- --list        # print period table only

import { PrismaClient, type LineupSlot } from "@prisma/client";
import { derivePeriods } from "../lib/scoring/periods";
import {
  computeTeamScoreDetailed,
  generateVtfMatchups,
  scoreVtfWeek,
} from "../lib/scoring/matchups";
import { DEFAULT_SCORING, scoreStatLine } from "../lib/scoring";

const prisma = new PrismaClient();
const SEASON = "2025-26";
const LEAGUE_NAME = "VTF Validation League";
const NUM_TEAMS = 10;

// Roster slot caps: 6F + 4D + 2G + 1 UTIL + 4 BENCH + 1 IR = 18
const SLOT_CAPS: Record<LineupSlot, number> = {
  FORWARD: 6,
  DEFENSE: 4,
  GOALIE: 2,
  UTIL: 1,
  BENCH: 4,
  IR: 1,
};
const ACTIVE_SLOTS: LineupSlot[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL"];

function arg(f: string) {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ── roster slot assignment ─────────────────────────────────────────────────────

// Given the current slot fill-counts and a player's position, pick the best slot.
function pickSlot(
  position: "FORWARD" | "DEFENSE" | "GOALIE",
  filled: Record<LineupSlot, number>
): LineupSlot | null {
  // 1. Natural position slot
  if (filled[position] < SLOT_CAPS[position]) return position;
  // 2. UTIL (any skater — not goalies per Yahoo convention)
  if (position !== "GOALIE" && filled.UTIL < SLOT_CAPS.UTIL) return "UTIL";
  // 3. Bench
  if (filled.BENCH < SLOT_CAPS.BENCH) return "BENCH";
  // 4. IR
  if (filled.IR < SLOT_CAPS.IR) return "IR";
  return null; // roster full
}

// ── teardown / build ──────────────────────────────────────────────────────────

async function teardown() {
  const prior = await prisma.fantasyLeague.findFirst({
    where: { name: LEAGUE_NAME },
    select: { id: true },
  });
  if (!prior) return;
  await prisma.matchup.deleteMany({ where: { leagueId: prior.id } });
  await prisma.rosterEntry.deleteMany({ where: { fantasyTeam: { leagueId: prior.id } } });
  await prisma.fantasyTeam.deleteMany({ where: { leagueId: prior.id } });
  await prisma.fantasyLeague.delete({ where: { id: prior.id } });
}

async function buildLeague() {
  const commish = await prisma.user.upsert({
    where: { email: "vtf-commish@dev.local" },
    update: {},
    create: { email: "vtf-commish@dev.local", displayName: "VTF Commish" },
  });

  const league = await prisma.fantasyLeague.create({
    data: {
      name: LEAGUE_NAME,
      season: SEASON,
      commissionerId: commish.id,
      maxTeams: NUM_TEAMS,
      status: "IN_SEASON",
      scoringSettings: DEFAULT_SCORING as object,
      rosterSettings: SLOT_CAPS,
    },
  });

  // Create NUM_TEAMS fantasy teams with owner users.
  const fantasyTeams: Array<{ id: string; name: string }> = [];
  for (let i = 1; i <= NUM_TEAMS; i++) {
    const owner = await prisma.user.upsert({
      where: { email: `vtf-owner${i}@dev.local` },
      update: {},
      create: { email: `vtf-owner${i}@dev.local`, displayName: `Manager ${i}` },
    });
    const ft = await prisma.fantasyTeam.create({
      data: {
        name: `Team ${i}`,
        leagueId: league.id,
        ownerId: owner.id,
        draftOrder: i,
      },
    });
    fantasyTeams.push({ id: ft.id, name: ft.name });
  }

  return { league, fantasyTeams };
}

// ── snake draft from real player pool ─────────────────────────────────────────

async function snakeDraft(fantasyTeams: Array<{ id: string; name: string }>) {
  // Rank all players who have stat lines in the season by their total fantasy
  // points — this is our "ADP" proxy for the snake.
  const players = await prisma.player.findMany({
    where: {
      active: true,
      statLines: { some: { game: { season: SEASON } } },
    },
    include: {
      statLines: {
        where: { game: { season: SEASON } },
        include: { player: { select: { position: true } } },
      },
    },
  });

  // Compute each player's total fantasy points for this season.
  const ranked = players
    .map((p) => {
      const total = p.statLines.reduce(
        (sum, sl) =>
          sum +
          scoreStatLine(
            {
              goals: sl.goals, assists: sl.assists, shots: sl.shots,
              plusMinus: sl.plusMinus, penaltyMinutes: sl.penaltyMinutes,
              powerPlayPts: sl.powerPlayPts, hits: sl.hits, blocks: sl.blocks,
              saves: sl.saves, goalsAgainst: sl.goalsAgainst,
              shutout: sl.shutout, win: sl.win,
            },
            p.position,
            DEFAULT_SCORING
          ),
        0
      );
      return { id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, total };
    })
    .sort((a, b) => b.total - a.total);

  const n = fantasyTeams.length;
  const rounds = Object.values(SLOT_CAPS).reduce((s, c) => s + c, 0); // 18

  // Track slot fill-counts per team.
  const filled: Map<string, Record<LineupSlot, number>> = new Map(
    fantasyTeams.map(({ id }) => [
      id,
      { FORWARD: 0, DEFENSE: 0, GOALIE: 0, UTIL: 0, BENCH: 0, IR: 0 },
    ])
  );

  let pickIdx = 0;
  const assigned = new Set<string>(); // player ids already drafted

  for (let round = 0; round < rounds; round++) {
    // Snake: odd rounds forward, even rounds reverse.
    const order =
      round % 2 === 0
        ? fantasyTeams
        : [...fantasyTeams].reverse();

    for (const team of order) {
      const teamFilled = filled.get(team.id)!;
      // Find the next available player that fits a slot on this team.
      let picked: (typeof ranked)[0] | undefined;
      for (let i = pickIdx; i < ranked.length; i++) {
        const candidate = ranked[i];
        if (assigned.has(candidate.id)) continue;
        const slot = pickSlot(candidate.position, teamFilled);
        if (slot === null) continue; // roster full for this position
        picked = candidate;
        assigned.add(candidate.id);
        // Advance pickIdx past already-assigned players for next search.
        if (i === pickIdx) pickIdx++;
        const slot2 = pickSlot(candidate.position, teamFilled);
        if (slot2) {
          teamFilled[slot2]++;
          await prisma.rosterEntry.create({
            data: { fantasyTeamId: team.id, playerId: candidate.id, slot: slot2 },
          });
        }
        break;
      }
      if (!picked) break; // player pool exhausted
    }
  }
}

// ── display ───────────────────────────────────────────────────────────────────

function pad(s: string | number, w: number, right = false) {
  const str = String(s);
  return right ? str.padStart(w) : str.padEnd(w);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targetWeek = Number(arg("--week") ?? 9); // week 9 has 8 games — good variety
  const listOnly = process.argv.includes("--list");

  // Derive periods.
  const gameDates = await prisma.game
    .findMany({ where: { season: SEASON }, select: { startsAt: true } })
    .then((rows) => rows.map((r) => r.startsAt));
  const periods = derivePeriods(gameDates);

  console.log(`\n${SEASON} scoring periods (${periods.length} non-empty weeks):\n`);
  console.log("  week  window                       games");
  console.log("  ────  ────────────────────────────  ────");
  for (const p of periods) {
    const n = gameDates.filter((d) => d >= p.startsAt && d < p.endsAt).length;
    const arrow = p.week === targetWeek ? " ◀" : "";
    console.log(
      `  ${pad(p.week, 4)}  ${p.startsAt.toISOString().slice(0, 10)} – ` +
        `${new Date(+p.endsAt - 1).toISOString().slice(0, 10)}   ${pad(n, 3, true)}${arrow}`
    );
  }
  if (listOnly) return;

  const period = periods.find((p) => p.week === targetWeek);
  if (!period) {
    console.error(`\nNo period for week ${targetWeek}.`);
    process.exit(1);
  }

  // ── Setup ───────────────────────────────────────────────────────────────────
  console.log(`\nSetting up ${NUM_TEAMS}-team VTF league for week ${targetWeek}…`);
  await teardown();
  const { league, fantasyTeams } = await buildLeague();

  process.stdout.write("  Running snake draft… ");
  await snakeDraft(fantasyTeams);
  console.log("done.");

  // Print roster sizes to confirm draft worked.
  for (const ft of fantasyTeams) {
    const counts = await prisma.rosterEntry.groupBy({
      by: ["slot"],
      where: { fantasyTeamId: ft.id },
      _count: { slot: true },
    });
    const active = counts
      .filter((c) => ACTIVE_SLOTS.includes(c.slot))
      .reduce((s, c) => s + c._count.slot, 0);
    const total = counts.reduce((s, c) => s + c._count.slot, 0);
    process.stdout.write(`    ${pad(ft.name, 8)}  ${active} active / ${total} total\n`);
  }

  // ── Generate VTF matchup rows ───────────────────────────────────────────────
  console.log("\nGenerating VTF matchups… ");
  await generateVtfMatchups(league.id, SEASON, prisma);
  const pairsPerWeek = (NUM_TEAMS * (NUM_TEAMS - 1)) / 2;
  console.log(`  ${pairsPerWeek} matchup rows per week × ${periods.length} weeks = ${pairsPerWeek * periods.length} total`);

  // ── Games in target window ──────────────────────────────────────────────────
  const windowGames = await prisma.game.findMany({
    where: { season: SEASON, startsAt: { gte: period.startsAt, lt: period.endsAt } },
    include: {
      homeTeam: { select: { abbreviation: true } },
      awayTeam: { select: { abbreviation: true } },
    },
    orderBy: { startsAt: "asc" },
  });
  console.log(
    `\nGames in week ${targetWeek} (${period.startsAt.toISOString().slice(0, 10)} – ` +
      `${new Date(+period.endsAt - 1).toISOString().slice(0, 10)}):`
  );
  for (const g of windowGames) {
    console.log(
      `  ${g.startsAt.toISOString().slice(0, 10)}  ${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation}  ${g.awayScore ?? "?"}–${g.homeScore ?? "?"}`
    );
  }

  // ── Score the week ──────────────────────────────────────────────────────────
  console.log("\nScoring week…");
  const results = await scoreVtfWeek(league.id, targetWeek, period, prisma);

  // Load team names for display.
  const teamNames = new Map(fantasyTeams.map((t) => [t.id, t.name]));

  // Sort by wins desc, then score desc.
  const sorted = [...results.entries()]
    .map(([id, r]) => ({ id, name: teamNames.get(id) ?? id, ...r }))
    .sort((a, b) => b.wins - a.wins || b.score - a.score);

  // ── Weekly results table ────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(68)}`);
  console.log(`WEEK ${targetWeek} VS-THE-FIELD RESULTS  (${NUM_TEAMS - 1} opponents each)`);
  console.log(`${"═".repeat(68)}`);
  console.log(
    `  ${"Team".padEnd(10)}  ${"Score".padStart(7)}  ${"W- L- T".padStart(9)}  Top scorer`
  );
  console.log(`  ${"─".repeat(65)}`);

  for (const row of sorted) {
    const detail = await computeTeamScoreDetailed(row.id, period, DEFAULT_SCORING, prisma);
    const top = detail.players[0];
    const topStr = top
      ? `${top.name} (${top.points.toFixed(2)})`
      : "(no production)";
    const record = `${row.wins}-${row.losses}-${row.ties}`;
    console.log(
      `  ${pad(row.name, 10)}  ${pad(row.score.toFixed(2), 7, true)}  ` +
        `${pad(record, 9, true)}  ${topStr}`
    );
  }

  console.log(`\n${"─".repeat(68)}`);
  const scores = sorted.map((r) => r.score);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  console.log(
    `  League avg: ${mean.toFixed(2)}  High: ${max.toFixed(2)}  Low: ${min.toFixed(2)}  Spread: ${(max - min).toFixed(2)}`
  );

  // ── Detailed breakdown for the top two teams ────────────────────────────────
  console.log(`\n${"═".repeat(68)}`);
  console.log("TOP-TWO TEAM BREAKDOWNS");
  console.log(`${"═".repeat(68)}`);
  for (const row of sorted.slice(0, 2)) {
    const detail = await computeTeamScoreDetailed(row.id, period, DEFAULT_SCORING, prisma);
    console.log(
      `\n${row.name}  ${row.score.toFixed(2)} pts  (${row.wins}-${row.losses}-${row.ties})`
    );
    console.log(`  ${"Player".padEnd(28)} ${"Pos".padEnd(8)} ${"Pts".padStart(6)}  ${"GP".padStart(3)}`);
    console.log(`  ${"─".repeat(50)}`);
    for (const p of detail.players) {
      console.log(
        `  ${pad(p.name, 28)} ${pad(p.position, 8)} ${pad(p.points.toFixed(2), 6, true)}  ${pad(p.gameCount, 3, true)}`
      );
    }
  }

  console.log(`\n${"═".repeat(68)}`);
  console.log("\nVerification notes:");
  console.log("  • Active slots: 6F + 4D + 2G + 1 UTIL = 13 active per team.");
  console.log("  • Draft order: snake by 2025-26 season fantasy points (highest first).");
  console.log("  • Scoring: DEFAULT_SCORING — goal 3, assist 2, shot 0.5, hit 0.25,");
  console.log("    block 0.25, +/- 1, PPpt 0.5; goalie win 4, save 0.2, GA -1, SO 3.");
  console.log("  • Weekly record = W-L-T vs all 9 other teams on that week's totals.");
  console.log("  • Matchup rows: each pair has homeScore/awayScore cached for recompute.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
