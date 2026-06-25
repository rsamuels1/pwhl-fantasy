import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { scoreStatLine } from "@/lib/scoring";
import type { ScoringSettings } from "@/lib/scoring";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getReplayNow, resolveFixturePeriod, toFixtureNow, type BetaWeekMapping } from "@/lib/replayTime";
import { getSeasonState } from "@/lib/season";
import type { Position } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const STAT_SELECT = {
  playerId: true,
  goals: true,
  assists: true,
  shots: true,
  plusMinus: true,
  penaltyMinutes: true,
  powerPlayPts: true,
  hits: true,
  blocks: true,
  saves: true,
  goalsAgainst: true,
  shutout: true,
  win: true,
} as const;

type RawStatLine = typeof STAT_SELECT;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    const auth = await apiRequireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const user = await apiRequireLeagueMember(leagueId, auth.id);
    if (user instanceof NextResponse) return user;

    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { season: true, scoringSettings: true, isReplay: true, replayCurrentDate: true },
    });

    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

    // Get all unrostered active players
    const rosterEntries = await prisma.rosterEntry.findMany({
      where: { fantasyTeam: { leagueId } },
      select: { playerId: true },
    });
    const rosteredPlayerIds = new Set(rosterEntries.map((e) => e.playerId));

    const unrosteredPlayers = await prisma.player.findMany({
      where: {
        active: true,
        id: { notIn: Array.from(rosteredPlayerIds) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        team: { select: { id: true, abbreviation: true } },
      },
    });

    // Fetch recent stat lines for projection (last 90 days)
    const devNowMs = getDevNowFromRequest(req);
    const nowMs = getReplayNow(
      { isReplay: league.isReplay ?? false, replayCurrentDate: league.replayCurrentDate },
      devNowMs
    );
    const ninetyDaysAgo = new Date(nowMs - 90 * 24 * 60 * 60 * 1000);
    const statLines = await prisma.statLine.findMany({
      where: {
        playerId: { in: unrosteredPlayers.map((p) => p.id) },
        game: {
          season: league.season,
          startsAt: { gte: ninetyDaysAgo },
        },
      },
      select: STAT_SELECT,
      orderBy: { game: { startsAt: "desc" } },
    });

    const scoring = parseScoringSettings(league.scoringSettings);

    // Group stat lines by player, keeping only last 5
    const linesByPlayer: Record<string, typeof statLines> = {};
    for (const line of statLines) {
      if (!linesByPlayer[line.playerId]) linesByPlayer[line.playerId] = [];
      if (linesByPlayer[line.playerId].length < 5) {
        linesByPlayer[line.playerId].push(line as any);
      }
    }

    // Compute projections for each player
    const positionMap: Record<string, Position> = {};
    for (const p of unrosteredPlayers) {
      positionMap[p.id] = p.position as Position;
    }

    // Compute games remaining for each PWHL team.
    // For beta replay leagues, translate nowMs to fixture-equivalent so the query hits
    // actual Nov 2025–May 2026 game data rather than the remapped Jun 2026 display window.
    const seasonState = await getSeasonState(leagueId, nowMs, prisma);
    const displayPeriod = (
      seasonState.periods.find((p) => p.status === "ACTIVE") ??
      seasonState.periods.find((p) => p.status === "UPCOMING")
    )?.period ?? null;
    const rawLeagueSettings = league.scoringSettings as Record<string, unknown> | null;
    const betaWeekMappings = (rawLeagueSettings?.betaWeekMappings as BetaWeekMapping[] | undefined) ?? null;
    const fixturePeriodForFA = displayPeriod
      ? resolveFixturePeriod(displayPeriod, betaWeekMappings)
      : null;
    const fixtureNowForFA = fixturePeriodForFA && displayPeriod
      ? new Date(toFixtureNow(nowMs, displayPeriod, fixturePeriodForFA))
      : new Date(nowMs);
    const pwhlTeamIds = [...new Set(
      unrosteredPlayers.map((p) => p.team?.id).filter((id): id is string => !!id)
    )];
    const futureGames = await prisma.game.findMany({
      where: {
        startsAt: { gt: fixtureNowForFA },
        OR: [
          { homeTeamId: { in: pwhlTeamIds } },
          { awayTeamId: { in: pwhlTeamIds } },
        ],
      },
      select: { homeTeamId: true, awayTeamId: true },
    });
    const gamesRemainingMap = new Map<string, number>();
    for (const game of futureGames) {
      if (pwhlTeamIds.includes(game.homeTeamId)) {
        gamesRemainingMap.set(game.homeTeamId, (gamesRemainingMap.get(game.homeTeamId) ?? 0) + 1);
      }
      if (pwhlTeamIds.includes(game.awayTeamId)) {
        gamesRemainingMap.set(game.awayTeamId, (gamesRemainingMap.get(game.awayTeamId) ?? 0) + 1);
      }
    }

    const suggestions = unrosteredPlayers
      .map((player) => {
        const lines = linesByPlayer[player.id] ?? [];
        if (lines.length === 0) return null;

        const totalFp = lines.reduce(
          (sum, l) => sum + scoreStatLine(l, player.position as Position, scoring),
          0
        );
        const avgFpPerGame = Math.round((totalFp / lines.length) * 100) / 100;
        const gamesThisPeriod = player.team?.id ? (gamesRemainingMap.get(player.team.id) ?? 0) : 0;

        return {
          playerId: player.id,
          playerName: `${player.firstName} ${player.lastName}`,
          playerTeam: player.team?.abbreviation ?? null,
          position: player.position,
          projectedFp: avgFpPerGame,
          avgFpPerGame,
          gamesThisPeriod,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      // Include players regardless of games remaining — replay/historical leagues have 0 future
      // games at week boundaries, but we still want to suggest players by projected FP.
      // The auto-set lineup and manager can decide whether to start them.
      .sort((a, b) => b.projectedFp - a.projectedFp)
      .slice(0, 10);

    return NextResponse.json(suggestions);
  } catch (err) {
    console.error("FA suggestions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
