import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";

const ALLOWED_COLORS = new Set([
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#a855f7",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string; teamId: string }> }
) {
  const { leagueId, teamId } = await params;

  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  if (member.id !== teamId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { accentColor: string | null };
  if (body.accentColor !== null && !ALLOWED_COLORS.has(body.accentColor)) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 });
  }

  await prisma.fantasyTeam.update({
    where: { id: teamId },
    data: { accentColor: body.accentColor },
  });

  return NextResponse.json({ ok: true });
}
