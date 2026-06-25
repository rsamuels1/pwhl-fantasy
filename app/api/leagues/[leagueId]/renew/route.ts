import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renewLeague, RenewalBlockedError } from "@/lib/services/renewal-service";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { createNotification } from "@/lib/services/notification-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json().catch(() => ({}));
  const overrides: { name?: string; season?: string; draftStartsAt?: Date | null } = {};
  if (typeof body.name === "string") overrides.name = body.name.trim() || undefined;
  if (typeof body.season === "string") overrides.season = body.season.trim() || undefined;
  if (body.draftStartsAt !== undefined) {
    overrides.draftStartsAt = body.draftStartsAt ? new Date(body.draftStartsAt) : null;
  }

  try {
    const { newLeagueId } = await renewLeague(leagueId, overrides, prisma);

    // Notify all non-commissioner team owners that a new season is ready to join.
    void (async () => {
      try {
        const teams = await prisma.fantasyTeam.findMany({
          where: { leagueId, ownerId: { not: auth.id } },
          select: { ownerId: true, id: true },
        });
        const league = await prisma.fantasyLeague.findUnique({
          where: { id: leagueId },
          select: { name: true },
        });
        const leagueName = league?.name ?? "Your league";
        await Promise.all(
          teams.map((t) =>
            createNotification(t.ownerId, "SEASON_RENEWED", {}, prisma, newLeagueId, {
              title: `${leagueName} — new season ready`,
              body: "Your league has renewed. Join to keep your spot.",
              actionUrl: `/invite/${newLeagueId}`,
              dedupeKey: `season-renewed-${newLeagueId}-${t.ownerId}`,
            })
          )
        );
      } catch (e) {
        console.error("[renew] notifications failed (non-fatal):", e);
      }
    })();

    return NextResponse.json({
      newLeagueId,
      redirectTo: `/league/${newLeagueId}/admin?renewed=1`,
    });
  } catch (err) {
    if (err instanceof RenewalBlockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[renew]", err);
    return NextResponse.json({ error: "Failed to renew league" }, { status: 500 });
  }
}
