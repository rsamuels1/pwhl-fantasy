import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendBetaInvite } from "@/lib/services/email-service";
import { logger } from "@/lib/logger";

const VALID_STATUSES = ["NONE", "INVITED", "ACCEPTED", "ACTIVE", "RENEWED"] as const;
type BetaStatus = typeof VALID_STATUSES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { betaStatus } = body as Record<string, unknown>;

  if (!VALID_STATUSES.includes(betaStatus as BetaStatus)) {
    return NextResponse.json(
      { error: "betaStatus must be one of: NONE, INVITED, ACCEPTED, ACTIVE, RENEWED" },
      { status: 400 }
    );
  }

  const updated = await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { betaStatus: betaStatus as BetaStatus },
    select: {
      betaStatus: true,
      commissioner: { select: { email: true, displayName: true } },
    },
  });

  if (betaStatus === "INVITED" && updated.commissioner?.email) {
    void sendBetaInvite(
      updated.commissioner.email,
      updated.commissioner.displayName,
      leagueId
    ).catch((err) => logger.error("sendBetaInvite failed", err));
  }

  return NextResponse.json({ betaStatus: updated.betaStatus });
}
