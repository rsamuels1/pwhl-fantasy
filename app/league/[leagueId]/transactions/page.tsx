import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getTransactions } from "@/lib/services/activity";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import TransactionFeed from "./TransactionFeed";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string; type?: string }>;
}

export default async function TransactionsPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/transactions`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

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
