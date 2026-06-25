// Trades have moved to /team/[teamId]/trades — redirect users there
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function LeagueTradesRedirectPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};

  const user = await requireAuth(`/league/${leagueId}/trades`);

  const myTeam = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: user.id },
    select: { id: true },
  });

  const base = myTeam ? `/team/${myTeam.id}/trades` : `/dashboard`;
  const tab = sp.tab ? `?tab=${sp.tab}` : "";
  redirect(`${base}${tab}`);
}
