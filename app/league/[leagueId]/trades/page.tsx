// app/league/[leagueId]/trades/page.tsx
// Trade Center — three tabs: Incoming, Sent, League History

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getTradesForTeam, getLeagueTrades, processExpiredTrades } from "@/lib/services/trade-service";
import { getDevNow } from "@/lib/devTime";
import TradeCenter from "./TradeCenter";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function TradesPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};
  const tab = (sp.tab ?? "incoming") as "incoming" | "sent" | "history";

  const user = await requireAuth(`/league/${leagueId}/trades`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const nowMs = await getDevNow();

  // Expire stale trades before listing (best-effort, non-blocking)
  processExpiredTrades(leagueId, nowMs, prisma).catch(() => {});

  // Load league + team data for enrichment
  const [league, teams, myTrades, leagueTrades] = await Promise.all([
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      select: { name: true, commissionerId: true, status: true, playoffStatus: true },
    }),
    prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true, ownerId: true },
    }),
    getTradesForTeam(leagueId, myTeam.id, prisma),
    getLeagueTrades(leagueId, prisma),
  ]);

  if (!league) notFound();

  // Batch-load player names for all trade items
  const allPlayerIds = [
    ...new Set([
      ...myTrades.flatMap((t) => t.items.map((i) => i.playerId)),
      ...leagueTrades.flatMap((t) => t.items.map((i) => i.playerId)),
    ]),
  ];
  const players = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });

  const playerMap = Object.fromEntries(
    players.map((p) => [p.id, { name: `${p.firstName} ${p.lastName}`, position: p.position }])
  );
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  const isCommissioner = user.id === league.commissionerId;
  const canPropose = league.status === "IN_SEASON" && league.playoffStatus === "NOT_STARTED";

  const incomingTrades = myTrades.filter(
    (t) => t.receivingTeamId === myTeam.id && (t.status === "PROPOSED" || t.status === "ACCEPTED")
  );
  const sentTrades = myTrades.filter(
    (t) => t.proposingTeamId === myTeam.id && (t.status === "PROPOSED" || t.status === "COUNTERED")
  );
  const historyTrades = leagueTrades.filter(
    (t) => t.status === "EXECUTED" || t.status === "REVERSED" || t.status === "REJECTED" || t.status === "CANCELLED" || t.status === "EXPIRED"
  );

  // Pending review trades — for commissioner
  const pendingReview = isCommissioner
    ? leagueTrades.filter((t) => t.status === "PENDING_REVIEW" || t.status === "ACCEPTED")
    : [];

  return (
    <TradeCenter
      leagueId={leagueId}
      myTeamId={myTeam.id}
      isCommissioner={isCommissioner}
      canPropose={canPropose}
      initialTab={tab}
      incomingTrades={incomingTrades}
      sentTrades={sentTrades}
      historyTrades={historyTrades}
      pendingReview={pendingReview}
      playerMap={playerMap}
      teamMap={teamMap}
    />
  );
}
