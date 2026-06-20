// app/api/leagues/[leagueId]/waivers/process/route.ts
// Commissioner-only endpoint to manually trigger waiver processing.
// Production: cron calls this. Founder console also exposes a button.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { getDevNowFromRequest } from "@/lib/devTime";
import { processWaivers } from "@/lib/services/waiver-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const nowMs = getDevNowFromRequest(req);
  const result = await processWaivers(leagueId, nowMs, prisma);

  return NextResponse.json(result);
}
