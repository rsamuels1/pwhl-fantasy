import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSeasonState, advanceSeason } from "@/lib/season";
import { pendingWeeks } from "@/lib/season/lifecycle";

const FAR_FUTURE = new Date("2027-06-01").getTime();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueId } = await params;
  const { action } = await req.json().catch(() => ({ action: "scoreNextWeek" }));

  const nowMs = action === "scoreAll"
    ? FAR_FUTURE
    : await (async () => {
        // For scoreNextWeek, find the first pending period and score just that one.
        const state = await getSeasonState(leagueId, FAR_FUTURE, prisma);
        const due = pendingWeeks(state);
        if (due.length === 0) return FAR_FUTURE;
        return due[0].endsAt.getTime() + 60_000;
      })();

  const { scoredWeeks } = await advanceSeason(leagueId, nowMs, prisma);

  const message =
    scoredWeeks.length > 0
      ? `Scored week${scoredWeeks.length > 1 ? "s" : ""} ${scoredWeeks.join(", ")}`
      : "No pending weeks to score";

  return NextResponse.json({ message, periodsScored: scoredWeeks });
}
