// POST /api/leagues/[leagueId]/replay/advance-day
// Advances a replay league to the next game day, scoring any periods that end.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { advanceSeason } from "@/lib/season";
import {
  getGameDays,
  currentDayNumber,
  nextGameDay,
  replayDateAfterDay,
} from "@/lib/replay/gameDays";

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
    select: { isReplay: true, replayCurrentDate: true, season: true, status: true },
  });

  if (!league?.isReplay) {
    return NextResponse.json({ error: "Not a replay league." }, { status: 400 });
  }
  if (league.status !== "IN_SEASON" && league.status !== "COMPLETE") {
    return NextResponse.json({ error: "Season must be started before advancing days." }, { status: 400 });
  }

  const gameDays = await getGameDays(league.season, prisma);
  const currentMs = league.replayCurrentDate?.getTime() ?? gameDays[0]?.getTime() ?? Date.now();

  const next = nextGameDay(currentMs, gameDays);
  if (!next) {
    return NextResponse.json({ error: "Already past the last game day of the season." }, { status: 400 });
  }

  const newReplayDate = replayDateAfterDay(next);
  const newMs = newReplayDate.getTime();

  // Score any periods that ended at or before the new date
  const { scoredWeeks } = await advanceSeason(leagueId, newMs, prisma);

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { replayCurrentDate: newReplayDate },
  });

  const totalDays = gameDays.length;
  const dayNumber = currentDayNumber(newMs, gameDays);
  const hasNextDay = nextGameDay(newMs, gameDays) !== null;

  return NextResponse.json({
    dayNumber,
    totalDays,
    date: next.toISOString().slice(0, 10),
    scoredWeeks,
    hasNextDay,
    message: scoredWeeks.length > 0
      ? `Day ${dayNumber}: scored week(s) ${scoredWeeks.join(", ")}.`
      : `Day ${dayNumber}: games tallied.`,
  });
}
