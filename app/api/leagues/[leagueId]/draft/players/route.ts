import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Aggregated prior-season stats for every active player, used by the draft room
// player browser. Expensive to compute so results are cached per request in the
// server (Next.js route-handler cache). Clients should not hammer this endpoint
// on every keystroke — use it once on load plus on search change.

export interface PlayerStats {
  id: string;
  name: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  team: string | null;
  // Skater
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  ppp: number;
  shots: number;
  hits: number;
  blocks: number;
  // Goalie
  wins: number;
  saves: number;
  goalsAgainst: number;
  shutouts: number;
  savePct: number | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const { leagueId } = params;
  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? "";
  const position = url.searchParams.get("position") ?? ""; // FORWARD | DEFENSE | GOALIE | ""

  // Find the most recent completed regular season to pull stats from.
  // We look for the latest season string (e.g. "2025-26") that has any games.
  const latestSeason = await prisma.game.findFirst({
    where: { status: "FINAL" },
    orderBy: { startsAt: "desc" },
    select: { season: true },
  });

  const season = latestSeason?.season ?? null;

  const players = await prisma.player.findMany({
    where: {
      active: true,
      ...(search ? { lastName: { contains: search, mode: "insensitive" } } : {}),
      ...(position ? { position: position as "FORWARD" | "DEFENSE" | "GOALIE" } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      team: { select: { abbreviation: true } },
      statLines: season
        ? {
            where: { game: { season } },
            select: {
              goals: true,
              assists: true,
              plusMinus: true,
              powerPlayPts: true,
              shots: true,
              hits: true,
              blocks: true,
              saves: true,
              goalsAgainst: true,
              shutout: true,
              win: true,
            },
          }
        : false,
    },
    orderBy: [{ position: "asc" }, { lastName: "asc" }],
    take: 200,
  });

  const result: PlayerStats[] = players.map((p) => {
    const lines = (p.statLines ?? []) as Array<{
      goals: number; assists: number; plusMinus: number; powerPlayPts: number;
      shots: number; hits: number; blocks: number;
      saves: number; goalsAgainst: number; shutout: boolean; win: boolean;
    }>;
    const gp = lines.length;
    const goals = lines.reduce((s, l) => s + l.goals, 0);
    const assists = lines.reduce((s, l) => s + l.assists, 0);
    const saves = lines.reduce((s, l) => s + l.saves, 0);
    const goalsAgainst = lines.reduce((s, l) => s + l.goalsAgainst, 0);
    const totalFaced = saves + goalsAgainst;

    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position,
      team: p.team?.abbreviation ?? null,
      gp,
      goals,
      assists,
      points: goals + assists,
      plusMinus: lines.reduce((s, l) => s + l.plusMinus, 0),
      ppp: lines.reduce((s, l) => s + l.powerPlayPts, 0),
      shots: lines.reduce((s, l) => s + l.shots, 0),
      hits: lines.reduce((s, l) => s + l.hits, 0),
      blocks: lines.reduce((s, l) => s + l.blocks, 0),
      wins: lines.filter((l) => l.win).length,
      saves,
      goalsAgainst,
      shutouts: lines.filter((l) => l.shutout).length,
      savePct: totalFaced > 0 ? saves / totalFaced : null,
    };
  });

  return NextResponse.json({ season, players: result });
}
