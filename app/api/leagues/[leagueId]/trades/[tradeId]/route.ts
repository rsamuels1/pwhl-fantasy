// app/api/leagues/[leagueId]/trades/[tradeId]/route.ts
// GET — fetch a single trade by ID

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getTrade } from "@/lib/services/trade-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string; tradeId: string }> }
) {
  const { leagueId, tradeId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const trade = await getTrade(tradeId, leagueId, prisma);
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  return NextResponse.json({ trade });
}
