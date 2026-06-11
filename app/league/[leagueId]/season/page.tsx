import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSeasonState } from "@/lib/season";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
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
    select: { id: true, name: true },
  });
  if (!league) notFound();

  const nowMs = await getDevNow();
  const state = await getSeasonState(leagueId, nowMs, prisma);
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <SeasonView
      leagueId={leagueId}
      initialState={state}
      isDev={isDev}
    />
  );
}
