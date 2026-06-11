import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBracket, PlayoffNotStartedError } from "@/lib/services/playoff-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const result = await getBracket(params.leagueId, prisma);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlayoffNotStartedError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Failed to fetch bracket";
    console.error("[bracket]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
