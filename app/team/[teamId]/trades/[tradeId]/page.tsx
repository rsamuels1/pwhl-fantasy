import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getTrade } from "@/lib/services/trade-service";
import TradeDetailView from "@/app/league/[leagueId]/trades/[tradeId]/TradeDetailView";

interface Props {
  params: Promise<{ teamId: string; tradeId: string }>;
}

export default async function TeamTradeDetailPage({ params }: Props) {
  const { teamId, tradeId } = await params;

  const user = await requireAuth(`/team/${teamId}/trades/${tradeId}`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

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
          href={`/team/${teamId}/trades`}
          style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}
        >
          ← Trade Center
        </Link>
      </div>
      <TradeDetailView
        trade={trade}
        leagueId={leagueId}
        myTeamId={teamId}
        teamId={teamId}
        isCommissioner={isCommissioner}
        playerMap={playerMap}
        teamMap={teamMap}
        canPropose={league.status === "IN_SEASON" && league.playoffStatus === "NOT_STARTED"}
      />
    </div>
  );
}
