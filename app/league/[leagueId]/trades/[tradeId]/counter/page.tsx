// Redirects to /team/[teamId]/trades/new?counterOf=[tradeId]
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface Props {
  params: Promise<{ leagueId: string; tradeId: string }>;
}

export default async function LeagueCounterRedirectPage({ params }: Props) {
  const { leagueId, tradeId } = await params;

  const user = await requireAuth(`/league/${leagueId}/trades/${tradeId}/counter`);

  const myTeam = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: user.id },
    select: { id: true },
  });

  if (!myTeam) redirect(`/dashboard`);
  redirect(`/team/${myTeam.id}/trades/new?counterOf=${tradeId}`);
}
