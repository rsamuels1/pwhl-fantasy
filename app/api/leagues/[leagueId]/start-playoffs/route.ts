import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startPlayoffs } from "@/lib/services/playoff-service";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  try {
    const result = await startPlayoffs(leagueId, prisma);
    return NextResponse.json({ success: true, message: "Playoffs initialized successfully", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start playoffs";
    console.error("[start-playoffs]", msg);
    const status = msg.includes("already") || msg.includes("Not enough") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
