// Trade detail page

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getTrade } from "@/lib/services/trade-service";
import TradeDetailView from "./TradeDetailView";

interface Props {
  params: Promise<{ leagueId: string; tradeId: string }>;
}

export default async function TradeDetailPage({ params }: Props) {
  const { leagueId, tradeId } = await params;

  const user = await requireAuth(`/league/${leagueId}/trades/${tradeId}`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const trade = await getTrade(tradeId, leagueId, prisma);
  if (!trade) notFound();

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true, status: true, playoffStatus: true },
  });
  if (!league) notFound();

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
  });

  const playerIds = trade.items.map((i) => i.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });

  const playerMap = Object.fromEntries(
    players.map((p) => [p.id, { name: `${p.firstName} ${p.lastName}`, position: p.position }])
  );
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const isCommissioner = user.id === league.commissionerId;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/league/${leagueId}/trades`}
          style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}
        >
          ← Trade Center
        </Link>
      </div>
      <TradeDetailView
        trade={trade}
        leagueId={leagueId}
        myTeamId={myTeam.id}
        isCommissioner={isCommissioner}
        playerMap={playerMap}
        teamMap={teamMap}
        canPropose={league.status === "IN_SEASON" && league.playoffStatus === "NOT_STARTED"}
      />
    </div>
  );
}
