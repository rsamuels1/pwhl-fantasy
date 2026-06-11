import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startPlayoffs } from "@/lib/services/playoff-service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const result = await startPlayoffs(params.leagueId, prisma);
    return NextResponse.json({ success: true, message: "Playoffs initialized successfully", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to start playoffs";
    console.error("[start-playoffs]", msg);
    const status = msg.includes("already") || msg.includes("Not enough") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
