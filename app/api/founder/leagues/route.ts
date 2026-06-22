import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const leagues = await prisma.fantasyLeague.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      season: true,
      status: true,
      playoffStatus: true,
      isReplay: true,
      betaStatus: true,
      maxTeams: true,
      commissioner: { select: { email: true, displayName: true } },
      _count: { select: { teams: true } },
      draft: { select: { status: true, currentPick: true } },
    },
  });

  return NextResponse.json({ leagues });
}
