import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";

export interface PlayerStats {
  id: string;
  name: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  team: string | null;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  ppp: number;
  shots: number;
  hits: number;
  blocks: number;
  wins: number;
  saves: number;
  goalsAgainst: number;
  shutouts: number;
  savePct: number | null;
}

// Cached so every keystroke search doesn't re-query the season.
let cachedSeason: string | null | undefined = undefined;
async function getLatestSeason(): Promise<string | null> {
  if (cachedSeason !== undefined) return cachedSeason;
  const row = await prisma.game.findFirst({
    where: { status: "FINAL" },
    orderBy: { startsAt: "desc" },
    select: { season: true },
  });
  cachedSeason = row?.season ?? null;
  return cachedSeason;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(params.leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? "";
  const position = url.searchParams.get("position") ?? "";

  const season = await getLatestSeason();

  // Single aggregation query — let the DB do the summing instead of
  // loading every stat line row into Node memory.
  type AggRow = {
    id: string; firstName: string; lastName: string;
    position: string; abbreviation: string | null;
    gp: bigint; goals: bigint; assists: bigint; plusMinus: bigint;
    ppp: bigint; shots: bigint; hits: bigint; blocks: bigint;
    saves: bigint; goalsAgainst: bigint; wins: bigint; shutouts: bigint;
  };

  const searchFilter = search ? Prisma.sql`AND p."lastName" ILIKE ${"%" + search + "%"}` : Prisma.empty;
  const posFilter = position ? Prisma.sql`AND p.position = ${position}::"Position"` : Prisma.empty;
  const seasonFilter = season ? Prisma.sql`AND g.season = ${season}` : Prisma.sql`AND FALSE`;

  const rows = await prisma.$queryRaw<AggRow[]>`
    SELECT
      p.id,
      p."firstName",
      p."lastName",
      p.position::text,
      t.abbreviation,
      COUNT(sl.id)                        AS gp,
      COALESCE(SUM(sl.goals), 0)          AS goals,
      COALESCE(SUM(sl.assists), 0)        AS assists,
      COALESCE(SUM(sl."plusMinus"), 0)    AS "plusMinus",
      COALESCE(SUM(sl."powerPlayPts"), 0) AS ppp,
      COALESCE(SUM(sl.shots), 0)          AS shots,
      COALESCE(SUM(sl.hits), 0)           AS hits,
      COALESCE(SUM(sl.blocks), 0)         AS blocks,
      COALESCE(SUM(sl.saves), 0)          AS saves,
      COALESCE(SUM(sl."goalsAgainst"), 0) AS "goalsAgainst",
      COALESCE(SUM(CASE WHEN sl.win THEN 1 ELSE 0 END), 0)     AS wins,
      COALESCE(SUM(CASE WHEN sl.shutout THEN 1 ELSE 0 END), 0) AS shutouts
    FROM "Player" p
    LEFT JOIN "Team" t ON t.id = p."teamId"
    LEFT JOIN "StatLine" sl ON sl."playerId" = p.id
    LEFT JOIN "Game" g ON g.id = sl."gameId" ${seasonFilter}
    WHERE p.active = true
    ${searchFilter}
    ${posFilter}
    GROUP BY p.id, p."firstName", p."lastName", p.position, t.abbreviation
    ORDER BY p.position, p."lastName"
  `;

  const result: PlayerStats[] = rows.map((r) => {
    const saves = Number(r.saves);
    const goalsAgainst = Number(r.goalsAgainst);
    const totalFaced = saves + goalsAgainst;
    const goals = Number(r.goals);
    const assists = Number(r.assists);
    return {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      position: r.position as PlayerStats["position"],
      team: r.abbreviation ?? null,
      gp: Number(r.gp),
      goals,
      assists,
      points: goals + assists,
      plusMinus: Number(r.plusMinus),
      ppp: Number(r.ppp),
      shots: Number(r.shots),
      hits: Number(r.hits),
      blocks: Number(r.blocks),
      wins: Number(r.wins),
      saves,
      goalsAgainst,
      shutouts: Number(r.shutouts),
      savePct: totalFaced > 0 ? saves / totalFaced : null,
    };
  });

  return NextResponse.json({ season, players: result });
}
