// PUT /api/leagues/[leagueId]/trade-settings
// Commissioner-only: update tradeReviewHours and requireCommissionerTradeApproval.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember, apiRequireCommissioner } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;
  const league = await apiRequireCommissioner(leagueId, auth.id);
  if (league instanceof NextResponse) return league;

  const body = await req.json() as {
    tradeReviewHours?: number;
    requireCommissionerTradeApproval?: boolean;
  };

  const reviewHours = Number(body.tradeReviewHours ?? 24);
  if (isNaN(reviewHours) || reviewHours < 0 || reviewHours > 168) {
    return NextResponse.json({ error: "tradeReviewHours must be between 0 and 168" }, { status: 400 });
  }

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: {
      tradeReviewHours: reviewHours,
      requireCommissionerTradeApproval: body.requireCommissionerTradeApproval ?? false,
    },
  });

  return NextResponse.json({ success: true });
}
