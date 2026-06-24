import { requireAuth, requireTeamOwner } from "@/lib/auth";
import ScoreboardPageContent from "@/components/ScoreboardPageContent";

export default async function TeamScoreboardPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/scoreboard`);
  const team = await requireTeamOwner(teamId, user.id);
  return <ScoreboardPageContent leagueId={team.league.id} myTeamId={teamId} />;
}
