import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { logCommissionerAction } from "@/lib/services/audit-service";

// PUT /api/leagues/[leagueId]/announcement
// Body: { announcement: string | null }
// Commissioner-only. Sets (or clears, when empty) the league announcement banner.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = (await req.json().catch(() => ({}))) as { announcement?: string | null };
  const raw = typeof body.announcement === "string" ? body.announcement.trim() : "";
  const announcement = raw.length > 0 ? raw.slice(0, 500) : null;

  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { announcement },
  });

  await logCommissionerAction(
    leagueId,
    auth.id,
    "COMMISSIONER_ANNOUNCEMENT",
    { announcement },
    prisma
  );

  return NextResponse.json({ announcement });
}
