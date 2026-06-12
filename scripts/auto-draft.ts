// scripts/auto-draft.ts
// Auto-drafts all teams in a pending league by directly inserting DraftPick +
// RosterEntry rows. Bypasses the WebSocket engine — useful for seeding test
// environments without running the draft server.
//
//   npm run auto-draft -- --league <leagueId>

import { PrismaClient, Position, type LineupSlot } from "@prisma/client";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { scoreStatLine, DEFAULT_SCORING, type ScoringSettings } from "../lib/scoring";
import { parseScoringSettings } from "../lib/scoring/settings";

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const SLOT_CAPS_DEFAULT: Record<LineupSlot, number> = {
  FORWARD: 3, DEFENSE: 2, GOALIE: 1, UTIL: 1, BENCH: 6, IR: 0,
};

function pickSlot(
  position: "FORWARD" | "DEFENSE" | "GOALIE",
  filled: Record<LineupSlot, number>,
  caps: Record<LineupSlot, number>
): LineupSlot | null {
  if (filled[position] < caps[position]) return position;
  if (position !== "GOALIE" && filled.UTIL < caps.UTIL) return "UTIL";
  if (filled.BENCH < caps.BENCH) return "BENCH";
  if (filled.IR < caps.IR) return "IR";
  return null;
}

async function main() {
  const leagueId = arg("--league");
  if (!leagueId) {
    console.error("Usage: npm run auto-draft -- --league <leagueId>");
    process.exit(1);
  }

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { draftOrder: "asc" } },
      draft: { include: { picks: { orderBy: { overall: "asc" } } } },
    },
  });

  if (!league) {
    console.error(`League ${leagueId} not found.`);
    process.exit(1);
  }
  if (!league.draft) {
    console.error("No draft found for this league. Run seed-replay first.");
    process.exit(1);
  }
  if (league.draft.status === "COMPLETE") {
    console.error("Draft already complete. Nothing to do.");
    process.exit(0);
  }

  const rosterSettings = (league.rosterSettings ?? {}) as Record<string, number>;
  const caps: Record<LineupSlot, number> = {
    FORWARD: rosterSettings.forward ?? SLOT_CAPS_DEFAULT.FORWARD,
    DEFENSE: rosterSettings.defense ?? SLOT_CAPS_DEFAULT.DEFENSE,
    GOALIE: rosterSettings.goalie ?? SLOT_CAPS_DEFAULT.GOALIE,
    UTIL: rosterSettings.util ?? SLOT_CAPS_DEFAULT.UTIL,
    BENCH: rosterSettings.bench ?? SLOT_CAPS_DEFAULT.BENCH,
    IR: rosterSettings.ir ?? SLOT_CAPS_DEFAULT.IR,
  };

  const rounds = rostersToRounds(rosterSettings);
  const teamIds = league.teams.map((t) => t.id);
  const pickOrder = generateSnakeOrder(teamIds, rounds);

  // Load all active players for the league's season
  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, position: true, firstName: true, lastName: true },
  });

  // Compute historical FP per player from the league's season so the snake
  // draft distributes talent evenly rather than clustering alphabetically.
  const scoringSettings: ScoringSettings = parseScoringSettings(league.scoringSettings);
  const statLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: players.map((p) => p.id) },
      game: { season: league.season },
    },
    select: {
      playerId: true,
      goals: true, assists: true, shots: true, plusMinus: true,
      penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
      saves: true, goalsAgainst: true, shutout: true, win: true,
      player: { select: { position: true } },
    },
  });

  const fpByPlayer = new Map<string, number>();
  for (const line of statLines) {
    const fp = scoreStatLine(
      {
        goals: line.goals, assists: line.assists, shots: line.shots,
        plusMinus: line.plusMinus, penaltyMinutes: line.penaltyMinutes,
        powerPlayPts: line.powerPlayPts, hits: line.hits, blocks: line.blocks,
        saves: line.saves, goalsAgainst: line.goalsAgainst,
        shutout: line.shutout, win: line.win,
      },
      line.player.position,
      scoringSettings
    );
    fpByPlayer.set(line.playerId, (fpByPlayer.get(line.playerId) ?? 0) + fp);
  }

  // Sort by FP descending so the snake draft distributes top talent evenly.
  // Players with no stats (rookies/no data) go to the bottom.
  players.sort((a, b) => (fpByPlayer.get(b.id) ?? 0) - (fpByPlayer.get(a.id) ?? 0));

  const taken = new Set<string>();
  const teamSlotsFilled = new Map<string, Record<LineupSlot, number>>(
    teamIds.map((id) => [id, { FORWARD: 0, DEFENSE: 0, GOALIE: 0, UTIL: 0, BENCH: 0, IR: 0 }])
  );

  const draftPickUpdates: { id: string; playerId: string }[] = [];
  const rosterEntries: {
    playerId: string;
    fantasyTeamId: string;
    slot: LineupSlot;
  }[] = [];

  const pickSlotMap = new Map(league.draft.picks.map((p) => [p.overall, p]));

  for (const slot of pickOrder) {
    const pick = pickSlotMap.get(slot.overall);
    if (!pick) continue;

    const filled = teamSlotsFilled.get(slot.fantasyTeamId)!;
    const position = slot.fantasyTeamId; // just to satisfy TS below

    // Find best available player for this team
    const teamPositionNeeds = getPositionNeeds(filled, caps);

    let chosen: (typeof players)[number] | null = null;
    // Try positions in priority order to fill active slots first
    for (const pos of teamPositionNeeds) {
      const candidate = players.find(
        (p) => p.position === pos && !taken.has(p.id)
      );
      if (candidate) { chosen = candidate; break; }
    }
    // Fallback: any untaken player
    if (!chosen) {
      chosen = players.find((p) => !taken.has(p.id)) ?? null;
    }

    if (!chosen) {
      console.warn(`Warning: ran out of players at pick ${slot.overall}`);
      break;
    }

    taken.add(chosen.id);
    const assignedSlot = pickSlot(chosen.position as "FORWARD" | "DEFENSE" | "GOALIE", filled, caps);
    if (assignedSlot === null) {
      console.warn(`Warning: team ${slot.fantasyTeamId} roster full at pick ${slot.overall}`);
      continue;
    }
    filled[assignedSlot]++;

    draftPickUpdates.push({ id: pick.id, playerId: chosen.id });
    rosterEntries.push({
      playerId: chosen.id,
      fantasyTeamId: slot.fantasyTeamId,
      slot: assignedSlot,
    });
  }

  // Commit everything in one transaction
  await prisma.$transaction([
    ...draftPickUpdates.map(({ id, playerId }) =>
      prisma.draftPick.update({ where: { id }, data: { playerId, auto: false } })
    ),
    prisma.rosterEntry.createMany({ data: rosterEntries }),
    prisma.draft.update({
      where: { id: league.draft!.id },
      data: { status: "COMPLETE", completedAt: new Date(), currentPick: pickOrder.length + 1 },
    }),
  ]);

  console.log(`\n✓ Auto-draft complete: ${draftPickUpdates.length} picks assigned across ${league.teams.length} teams.`);
  console.log(`Next: start the season from the admin panel.`);
  console.log(`  http://localhost:3000/league/${leagueId}/admin\n`);
}

// Returns positions in descending priority for filling active slots first.
function getPositionNeeds(
  filled: Record<LineupSlot, number>,
  caps: Record<LineupSlot, number>
): Array<Position> {
  const needs: Position[] = [];
  if (filled.GOALIE < caps.GOALIE) needs.push(Position.GOALIE);
  if (filled.FORWARD < caps.FORWARD) needs.push(Position.FORWARD);
  if (filled.DEFENSE < caps.DEFENSE) needs.push(Position.DEFENSE);
  if (filled.UTIL < caps.UTIL) { needs.push(Position.FORWARD); needs.push(Position.DEFENSE); }
  needs.push(Position.FORWARD, Position.DEFENSE, Position.GOALIE);
  return needs;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
