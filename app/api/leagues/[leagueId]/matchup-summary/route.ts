import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/services/dashboard";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(params.leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const { leagueId } = params;
  const teamId = req.nextUrl.searchParams.get("team") ?? member.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { isReplay: true, replayCurrentDate: true },
  });
  const nowMs = getReplayNow(
    { isReplay: league?.isReplay ?? false, replayCurrentDate: league?.replayCurrentDate ?? null },
    getDevNowFromRequest(req)
  );

  const data = await getDashboardData(leagueId, teamId, nowMs, prisma);
  return NextResponse.json(data);
}
