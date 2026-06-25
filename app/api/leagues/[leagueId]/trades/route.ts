// app/api/leagues/[leagueId]/trades/route.ts
// POST  — propose a trade
// GET   — list trades for the calling team (or all league trades for history)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import {
  proposeTrade,
  getTradesForTeam,
  getLeagueTrades,
  processExpiredTrades,
  TradeValidationError,
} from "@/lib/services/trade-service";
import type { TradeItemInput } from "@/lib/trades/engine";

// GET /api/leagues/[leagueId]/trades?team=<teamId>&history=1
// history=1 returns all EXECUTED/VETOED/REVERSED trades league-wide (no team filter)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const nowMs = getDevNowFromRequest(req);

  // Expire stale PROPOSED trades before listing (best-effort)
  processExpiredTrades(leagueId, nowMs, prisma).catch(() => {});

  const history = req.nextUrl.searchParams.get("history") === "1";

  if (history) {
    const trades = await getLeagueTrades(leagueId, prisma);
    const executed = trades.filter((t) => t.status === "EXECUTED" || t.status === "VETOED" || t.status === "REVERSED");
    return NextResponse.json({ trades: executed });
  }

  // Default: return trades for the calling user's team
  const teamId = req.nextUrl.searchParams.get("team") ?? member.id;
  const trades = await getTradesForTeam(leagueId, teamId, prisma);
  return NextResponse.json({ trades });
}

// POST /api/leagues/[leagueId]/trades
// Body: { receivingTeamId: string, items: TradeItemInput[], message?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json() as {
    receivingTeamId?: string;
    items?: TradeItemInput[];
    message?: string;
  };

  if (!body.receivingTeamId) {
    return NextResponse.json({ error: "receivingTeamId is required" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  const nowMs = getDevNowFromRequest(req);

  try {
    const trade = await proposeTrade(
      leagueId,
      member.id,
      body.receivingTeamId,
      body.items,
      body.message ?? null,
      nowMs,
      prisma
    );
    return NextResponse.json({ trade }, { status: 201 });
  } catch (err) {
    if (err instanceof TradeValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
