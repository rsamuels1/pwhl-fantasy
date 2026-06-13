import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { logCommissionerAction } from "@/lib/services/audit-service";

// POST /api/leagues/[leagueId]/replay/restart
// Commissioner-only. Resets the replay day counter to the start.
// Scored matchups and league status are preserved.
export async function POST(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(params.leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  // Reset replay current date to null
  await prisma.fantasyLeague.update({
    where: { id: params.leagueId },
    data: { replayCurrentDate: null },
  });

  await logCommissionerAction(
    params.leagueId,
    auth.id,
    "COMMISSIONER_SETTINGS_CHANGED",
    { action: "replay_restart" },
    prisma
  );

  return NextResponse.json({ success: true });
}
