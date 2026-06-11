import { redirect } from "next/navigation";
import { requireAuth, requireLeagueMember } from "@/lib/auth";

export default async function OldMatchupPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const { leagueId } = params;
  const user = await requireAuth(`/league/${leagueId}/matchup`);
  const team = await requireLeagueMember(leagueId, user.id);
  redirect(`/team/${team.id}/matchup`);
}
