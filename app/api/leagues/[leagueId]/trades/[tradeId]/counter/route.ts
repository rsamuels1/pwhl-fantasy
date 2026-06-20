// POST /api/leagues/[leagueId]/trades/[tradeId]/counter
// Receiving team proposes a counter-offer.
// Body: { items: TradeItemInput[], message?: string }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import {
  counterTrade,
  TradeValidationError,
  TradeNotFoundError,
  TradeTransitionError,
} from "@/lib/services/trade-service";
import type { TradeItemInput } from "@/lib/trades/engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string; tradeId: string }> }
) {
  const { leagueId, tradeId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json() as { items?: TradeItemInput[]; message?: string };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  const nowMs = getDevNowFromRequest(req);

  try {
    const counter = await counterTrade(
      tradeId,
      member.id,
      body.items,
      body.message ?? null,
      nowMs,
      prisma
    );
    return NextResponse.json({ trade: counter }, { status: 201 });
  } catch (err) {
    if (err instanceof TradeNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof TradeValidationError || err instanceof TradeTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
