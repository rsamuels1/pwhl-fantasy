import { requireAuth, requireLeagueAccess } from "@/lib/auth";
import ScoreboardPageContent from "@/components/ScoreboardPageContent";

export default async function MatchupsPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/matchups`);
  const { myTeam } = await requireLeagueAccess(leagueId, user.id);
  return <ScoreboardPageContent leagueId={leagueId} myTeamId={myTeam?.id} />;
}
