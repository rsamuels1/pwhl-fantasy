import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getTransactions } from "@/lib/services/activity";
import { getDevNowFromRequest } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";

// GET /api/leagues/[leagueId]/transactions
// Query params: teamId, type, before, limit
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const before = searchParams.get("before") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 25;

  // Replay guard
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { isReplay: true, replayCurrentDate: true },
  });
  const devNow = getDevNowFromRequest(req);
  const nowMs = getReplayNow(
    { isReplay: league?.isReplay ?? false, replayCurrentDate: league?.replayCurrentDate ?? null },
    devNow
  );

  const result = await getTransactions(leagueId, {
    teamId,
    type,
    before,
    limit,
    nowMs,
    isReplay: league?.isReplay ?? false,
  }, prisma);

  return NextResponse.json(result);
}
