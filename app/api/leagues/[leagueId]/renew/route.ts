import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renewLeague, RenewalBlockedError } from "@/lib/services/renewal-service";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(params.leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json().catch(() => ({}));
  const overrides: { name?: string; season?: string; draftStartsAt?: Date | null } = {};
  if (typeof body.name === "string") overrides.name = body.name.trim() || undefined;
  if (typeof body.season === "string") overrides.season = body.season.trim() || undefined;
  if (body.draftStartsAt !== undefined) {
    overrides.draftStartsAt = body.draftStartsAt ? new Date(body.draftStartsAt) : null;
  }

  try {
    const { newLeagueId } = await renewLeague(params.leagueId, overrides, prisma);
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
