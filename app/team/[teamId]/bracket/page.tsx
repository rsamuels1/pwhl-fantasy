import { requireAuth, requireTeamOwner } from "@/lib/auth";
import BracketPageContent from "@/components/BracketPageContent";

export default async function TeamBracketPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/bracket`);
  const team = await requireTeamOwner(teamId, user.id);
  return <BracketPageContent leagueId={team.league.id} myTeamId={teamId} userId={user.id} />;
}
