import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getTradesForTeam, processExpiredTrades } from "@/lib/services/trade-service";
import { getDevNow } from "@/lib/devTime";
import TradeCenter from "@/app/league/[leagueId]/trades/TradeCenter";

interface Props {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function TeamTradesPage({ params, searchParams }: Props) {
  const { teamId } = await params;
  const sp = searchParams ? await searchParams : {};
  const tab = (sp.tab ?? "incoming") as "incoming" | "sent" | "history";

  const user = await requireAuth(`/team/${teamId}/trades`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const nowMs = await getDevNow();

  processExpiredTrades(leagueId, nowMs, prisma).catch(() => {});

  const [league, teams, myTrades] = await Promise.all([
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { name: true, commissionerId: true, status: true, playoffStatus: true, draft: { select: { status: true } } },
    }),
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true, ownerId: true },
    }),
    getTradesForTeam(leagueId, teamId, prisma),
  ]);

  if (!league) notFound();

  const allPlayerIds = [...new Set(myTrades.flatMap((t) => t.items.map((i) => i.playerId)))];
  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });

  const playerMap = Object.fromEntries(
    players.map((p) => [p.id, { name: `${p.firstName} ${p.lastName}`, position: p.position }])
  );
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const isCommissioner = user.id === league.commissionerId;
  const canPropose =
    (league.status === "IN_SEASON" || league.draft?.status === "COMPLETE") &&
    league.playoffStatus === "NOT_STARTED";

  const incomingTrades = myTrades.filter(
    (t) => t.receivingTeamId === teamId && (t.status === "PROPOSED" || t.status === "ACCEPTED")
  );
  const sentTrades = myTrades.filter(
    (t) => t.proposingTeamId === teamId && (t.status === "PROPOSED" || t.status === "COUNTERED")
  );

  // Commissioner sees pending review from their team perspective too
  const pendingReview = isCommissioner
    ? (await prisma.trade.findMany({
        where: { leagueId, status: { in: ["PENDING_REVIEW", "ACCEPTED"] } },
        include: { items: true },
      }))
    : [];

  return (
    <TradeCenter
      leagueId={leagueId}
      myTeamId={teamId}
      teamId={teamId}
      isCommissioner={isCommissioner}
      canPropose={canPropose}
      initialTab={tab}
      incomingTrades={incomingTrades}
      sentTrades={sentTrades}
      historyTrades={[]}
      pendingReview={pendingReview}
      playerMap={playerMap}
      teamMap={teamMap}
    />
  );
}
