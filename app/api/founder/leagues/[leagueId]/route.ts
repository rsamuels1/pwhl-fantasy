import { NextRequest, NextResponse } from "next/server";
import { apiRequireFounder } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await apiRequireFounder(req);
  if (auth instanceof NextResponse) return auth;

  const { leagueId } = await params;

  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId }, select: { id: true } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  // Delete in FK-safe order (children before parents)
  await prisma.$transaction([
    // Trade items before trades
    prisma.tradeItem.deleteMany({ where: { trade: { leagueId } } }),
    prisma.trade.deleteMany({ where: { leagueId } }),
    // Waiver children before parents
    prisma.waiverClaim.deleteMany({ where: { leagueId } }),
    prisma.waiverEntry.deleteMany({ where: { leagueId } }),
    prisma.waiverPriority.deleteMany({ where: { leagueId } }),
    // Draft picks before draft
    prisma.draftPick.deleteMany({ where: { draft: { leagueId } } }),
    prisma.draft.deleteMany({ where: { leagueId } }),
    // Roster entries before teams
    prisma.rosterEntry.deleteMany({ where: { fantasyTeam: { leagueId } } }),
    // Matchups
    prisma.matchup.deleteMany({ where: { leagueId } }),
    // Teams
    prisma.fantasyTeam.deleteMany({ where: { leagueId } }),
    // League-scoped notifications and events
    prisma.notification.deleteMany({ where: { leagueId } }),
    prisma.notificationPreference.deleteMany({ where: { leagueId } }),
    prisma.leagueEvent.deleteMany({ where: { leagueId } }),
    // Feedback
    prisma.feedbackSubmission.deleteMany({ where: { leagueId } }),
    // Finally the league itself
    prisma.fantasyLeague.delete({ where: { id: leagueId } }),
  ]);

  return NextResponse.json({ deleted: true });
}
