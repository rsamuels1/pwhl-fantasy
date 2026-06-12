import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { generateSnakeOrder, rostersToRounds } from "@/lib/draft/snake";
import { scoreStatLine, type ScoringSettings } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { Position, type LineupSlot } from "@prisma/client";

const SLOT_CAPS_DEFAULT: Record<LineupSlot, number> = {
  FORWARD: 2, DEFENSE: 2, GOALIE: 1, UTIL: 1, BENCH: 6, IR: 1,
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

function getPositionNeeds(
  filled: Record<LineupSlot, number>,
  caps: Record<LineupSlot, number>
): Position[] {
  const needs: Position[] = [];
  if (filled.GOALIE < caps.GOALIE) needs.push(Position.GOALIE);
  if (filled.FORWARD < caps.FORWARD) needs.push(Position.FORWARD);
  if (filled.DEFENSE < caps.DEFENSE) needs.push(Position.DEFENSE);
  if (filled.UTIL < caps.UTIL) { needs.push(Position.FORWARD); needs.push(Position.DEFENSE); }
  needs.push(Position.FORWARD, Position.DEFENSE, Position.GOALIE);
  return needs;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { draftOrder: "asc" } },
      draft: { include: { picks: { orderBy: { overall: "asc" } } } },
    },
  });

  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });

  if (!league.isReplay && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Auto-draft is only available for replay leagues." }, { status: 403 });
  }
  if (!league.draft) {
    return NextResponse.json({ error: "No draft found. Set up the draft first." }, { status: 400 });
  }
  if (league.draft.status === "COMPLETE") {
    return NextResponse.json({ error: "Draft is already complete." }, { status: 400 });
  }
  if (league.teams.length < 2) {
    return NextResponse.json({ error: "Need at least 2 teams to draft." }, { status: 400 });
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

  const players = await prisma.player.findMany({
    where: { active: true },
    select: { id: true, position: true, firstName: true, lastName: true },
  });

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

  players.sort((a, b) => (fpByPlayer.get(b.id) ?? 0) - (fpByPlayer.get(a.id) ?? 0));

  const taken = new Set<string>();
  const teamSlotsFilled = new Map<string, Record<LineupSlot, number>>(
    teamIds.map((id) => [id, { FORWARD: 0, DEFENSE: 0, GOALIE: 0, UTIL: 0, BENCH: 0, IR: 0 }])
  );

  const draftPickUpdates: { id: string; playerId: string }[] = [];
  const rosterEntries: { playerId: string; fantasyTeamId: string; slot: LineupSlot }[] = [];

  const pickSlotMap = new Map(league.draft.picks.map((p) => [p.overall, p]));

  for (const slot of pickOrder) {
    const pick = pickSlotMap.get(slot.overall);
    if (!pick) continue;

    const filled = teamSlotsFilled.get(slot.fantasyTeamId)!;
    const positionNeeds = getPositionNeeds(filled, caps);

    let chosen: (typeof players)[number] | null = null;
    for (const pos of positionNeeds) {
      const candidate = players.find((p) => p.position === pos && !taken.has(p.id));
      if (candidate) { chosen = candidate; break; }
    }
    if (!chosen) {
      chosen = players.find((p) => !taken.has(p.id)) ?? null;
    }
    if (!chosen) break;

    taken.add(chosen.id);
    const assignedSlot = pickSlot(chosen.position as "FORWARD" | "DEFENSE" | "GOALIE", filled, caps);
    if (assignedSlot === null) continue;
    filled[assignedSlot]++;

    draftPickUpdates.push({ id: pick.id, playerId: chosen.id });
    rosterEntries.push({ playerId: chosen.id, fantasyTeamId: slot.fantasyTeamId, slot: assignedSlot });
  }

  await prisma.$transaction([
    ...draftPickUpdates.map(({ id, playerId }) =>
      prisma.draftPick.update({ where: { id }, data: { playerId, auto: false } })
    ),
    prisma.rosterEntry.createMany({ data: rosterEntries }),
    prisma.draft.update({
      where: { id: league.draft.id },
      data: { status: "COMPLETE", completedAt: new Date(), currentPick: pickOrder.length + 1 },
    }),
  ]);

  return NextResponse.json({
    message: `Auto-draft complete: ${draftPickUpdates.length} picks assigned across ${league.teams.length} teams.`,
    picksAssigned: draftPickUpdates.length,
    teamsCount: league.teams.length,
  });
}
