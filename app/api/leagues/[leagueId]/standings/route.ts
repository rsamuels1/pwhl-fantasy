import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/services/standings-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const result = await getStandings(params.leagueId, prisma);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch standings";
    console.error("[standings]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
