import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";

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

  const body = await req.json() as { name?: string };
  const trimmed = (body.name ?? "").trim();

  if (trimmed.length === 0) {
    return NextResponse.json({ error: "Team name cannot be empty." }, { status: 400 });
  }
  if (trimmed.length > 50) {
    return NextResponse.json({ error: "Team name must be 50 characters or fewer." }, { status: 400 });
  }

  await prisma.fantasyTeam.update({
    where: { id: teamId },
    data: { name: trimmed },
  });

  return NextResponse.json({ name: trimmed });
}
