import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";

interface SeasonEntry {
  id: string;
  name: string;
  season: string;
  status: string;
  playoffStatus: string;
  champion?: { teamName: string; ownerName: string } | null;
}

async function walkChain(leagueId: string, depth = 0): Promise<SeasonEntry[]> {
  if (depth > 10) return [];

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      childLeagues: { select: { id: true } },
      teams: {
        include: { owner: { select: { displayName: true } } },
      },
      matchups: {
        where: { isPlayoff: true },
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, round: true },
        orderBy: { round: "desc" },
      },
    },
  });

  if (!league) return [];

  // Find champion: highest-round playoff matchup with scores
  let champion: { teamName: string; ownerName: string } | null = null;
  const finalMatchup = league.matchups[0];
  if (finalMatchup && finalMatchup.homeScore !== null && finalMatchup.awayScore !== null) {
    const winnerId =
      finalMatchup.homeScore >= finalMatchup.awayScore
        ? finalMatchup.homeTeamId
        : finalMatchup.awayTeamId;
    const winnerTeam = league.teams.find((t) => t.id === winnerId);
    if (winnerTeam) {
      champion = {
        teamName: winnerTeam.name,
        ownerName: winnerTeam.owner.displayName,
      };
    }
  }

  const entry: SeasonEntry = {
    id: league.id,
    name: league.name,
    season: league.season,
    status: league.status,
    playoffStatus: league.playoffStatus,
    champion,
  };

  if (league.childLeagues.length === 0) return [entry];

  const childEntries = await walkChain(league.childLeagues[0].id, depth + 1);
  return [entry, ...childEntries];
}

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(params.leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  // Walk to root of chain
  let rootId = params.leagueId;
  let depth = 0;
  while (depth < 10) {
    const row = await prisma.fantasyLeague.findUnique({
      where: { id: rootId },
      select: { parentLeagueId: true },
    });
    if (!row?.parentLeagueId) break;
    rootId = row.parentLeagueId;
    depth++;
  }

  const seasons = await walkChain(rootId);
  return NextResponse.json({ seasons });
}
