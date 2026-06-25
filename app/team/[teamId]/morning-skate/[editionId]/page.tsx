import { redirect } from "next/navigation";
import { requireAuth, requireTeamOwner } from "@/lib/auth";

export default async function TeamMorningSkateEditionPage({ params }: { params: Promise<{ teamId: string; editionId: string }> }) {
  const { teamId, editionId } = await params;
  const user = await requireAuth(`/team/${teamId}/morning-skate/${editionId}`);
  const team = await requireTeamOwner(teamId, user.id);
  redirect(`/league/${team.league.id}/morning-skate/${editionId}`);
}
