// POST /api/leagues/[leagueId]/trades/[tradeId]/reject
// Receiving team rejects the trade.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import {
  rejectTrade,
  TradeNotFoundError,
  TradeTransitionError,
} from "@/lib/services/trade-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string; tradeId: string }> }
) {
  const { leagueId, tradeId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const nowMs = getDevNowFromRequest(req);

  try {
    const trade = await rejectTrade(tradeId, member.id, nowMs, prisma);
    return NextResponse.json({ trade });
  } catch (err) {
    if (err instanceof TradeNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof TradeTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
