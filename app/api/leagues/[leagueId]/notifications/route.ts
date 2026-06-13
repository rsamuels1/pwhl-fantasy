import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { apiRequireAuth, apiRequireLeagueMember } from "@/lib/auth";
import { markAllRead } from "@/lib/services/notification-service";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.id, leagueId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ notifications });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const member = await apiRequireLeagueMember(leagueId, auth.id);
  if (member instanceof NextResponse) return member;

  const body = await req.json();
  if (body.action !== "markAllRead") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await markAllRead(auth.id, leagueId, prisma);
  return NextResponse.json({ ok: true });
}
