// POST /api/leagues/[leagueId]/trades/[tradeId]/review
// Commissioner-only: approve or veto a trade in PENDING_REVIEW.
// Body: { action: "approve" | "veto" }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember, apiRequireCommissioner } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import {
  reviewTrade,
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
  const league = await apiRequireCommissioner(leagueId, auth.id);
  if (league instanceof NextResponse) return league;

  const body = await req.json() as { action?: string };
  if (body.action !== "approve" && body.action !== "veto") {
    return NextResponse.json({ error: 'action must be "approve" or "veto"' }, { status: 400 });
  }

  const nowMs = getDevNowFromRequest(req);

  try {
    const trade = await reviewTrade(tradeId, auth.id, body.action, nowMs, prisma);
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
