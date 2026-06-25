// Redirects to /team/[teamId]/trades/new
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ team?: string; counterOf?: string }>;
}

export default async function LeagueNewTradeRedirectPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};

  const user = await requireAuth(`/league/${leagueId}/trades/new`);

  const myTeam = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: user.id },
    select: { id: true },
  });

  if (!myTeam) redirect(`/dashboard`);

  const query = new URLSearchParams();
  if (sp.team) query.set("team", sp.team);
  if (sp.counterOf) query.set("counterOf", sp.counterOf);
  const qs = query.toString() ? `?${query.toString()}` : "";
  redirect(`/team/${myTeam.id}/trades/new${qs}`);
}
