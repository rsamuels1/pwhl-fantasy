import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getTeamAnalysis } from "@/lib/services/analysis-service";
import { getDevNowFromRequest } from "@/lib/devTime";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(params.leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const teamId = req.nextUrl.searchParams.get("team");
  if (!teamId) {
    return NextResponse.json({ error: "Missing team parameter" }, { status: 400 });
  }

  // Verify the requested team belongs to this league.
  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, leagueId: params.leagueId },
    select: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found in this league" }, { status: 404 });
  }

  const nowMs = getDevNowFromRequest(req);

  try {
    const analysis = await getTeamAnalysis(params.leagueId, teamId, nowMs, prisma);
    return NextResponse.json(analysis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to compute team analysis";
    console.error("[analysis]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
