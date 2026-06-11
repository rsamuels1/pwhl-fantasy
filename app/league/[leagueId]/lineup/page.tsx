import { redirect } from "next/navigation";
import { requireAuth, requireLeagueMember } from "@/lib/auth";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function OldLineupPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/lineup`);
  const team = await requireLeagueMember(leagueId, user.id);
  redirect(`/team/${team.id}/lineup`);
}
