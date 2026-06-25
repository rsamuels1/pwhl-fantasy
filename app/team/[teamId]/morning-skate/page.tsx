import { redirect } from "next/navigation";
import { requireAuth, requireTeamOwner } from "@/lib/auth";

export default async function TeamMorningSkatePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/morning-skate`);
  const team = await requireTeamOwner(teamId, user.id);
  redirect(`/league/${team.league.id}/morning-skate`);
}
