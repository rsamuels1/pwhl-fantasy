import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSeasonState } from "@/lib/season";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import SeasonView from "./SeasonView";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function SeasonPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/season`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, isReplay: true, replayCurrentDate: true },
  });
  if (!league) notFound();

  const nowMs = getReplayNow(league, await getDevNow());
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const isDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_SIM_DATE === "true" || league.isReplay;

  return (
    <SeasonView
      leagueId={leagueId}
      initialState={state}
      isDev={isDev}
      isReplay={league.isReplay}
      replayCurrentDate={league.replayCurrentDate?.toISOString()}
    />
  );
}
