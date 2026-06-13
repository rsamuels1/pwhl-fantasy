import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startPlayoffs, PlayoffNotStartedError } from "@/lib/services/playoff-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueId } = await params;

  try {
    const result = await startPlayoffs(leagueId, prisma);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlayoffNotStartedError) {
      return NextResponse.json({ error: "Playoffs already started or not eligible" }, { status: 409 });
    }
    const msg = err instanceof Error ? err.message : "Failed to start playoffs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
