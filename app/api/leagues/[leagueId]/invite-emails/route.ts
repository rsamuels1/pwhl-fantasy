// POST /api/leagues/[leagueId]/invite-emails
// Commissioner-only. Sends email invitations to a list of addresses.
// Accepts up to 20 addresses per request. Fires emails fire-and-forget.

import { NextRequest, NextResponse } from "next/server";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendInvite } from "@/lib/services/email-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;

  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commCheck = await apiRequireCommissioner(leagueId, auth.id);
  if (commCheck instanceof NextResponse) return commCheck;

  const body = await req.json();
  const { emails: rawEmails } = body;

  if (!Array.isArray(rawEmails)) {
    return NextResponse.json({ error: "emails must be an array" }, { status: 400 });
  }

  const emails = (rawEmails as unknown[])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e.includes("@") && e.includes("."))
    .slice(0, 20);

  if (emails.length === 0) {
    return NextResponse.json({ error: "No valid emails provided" }, { status: 400 });
  }

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });
  if (!league) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  for (const email of emails) {
    void sendInvite(email, leagueId, league.name, auth.displayName).catch(() => {});
  }

  return NextResponse.json({ sent: emails.length });
}
