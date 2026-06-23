import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getTransactions } from "@/lib/services/activity";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import TransactionFeed from "@/app/league/[leagueId]/transactions/TransactionFeed";

interface Props {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ team?: string; type?: string }>;
}

export default async function TeamTransactionsPage({ params, searchParams }: Props) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/transactions`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { isReplay: true, replayCurrentDate: true, name: true },
  });
  if (!league) notFound();

  const devNow = await getDevNow();
  const nowMs = getReplayNow(league, devNow);

  const sp = await searchParams;
  const initialData = await getTransactions(leagueId, {
    teamId: sp.team,
    type: sp.type,
    nowMs,
    isReplay: league.isReplay,
  }, prisma);

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <TransactionFeed
      leagueId={leagueId}
      initialEvents={initialData.events}
      initialHasMore={initialData.hasMore}
      teams={teams}
      selectedTeamId={sp.team ?? null}
      selectedType={sp.type ?? null}
      nowMs={nowMs}
    />
  );
}
