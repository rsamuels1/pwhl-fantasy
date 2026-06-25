import { requireAuth, requireLeagueAccess } from "@/lib/auth";
import BracketPageContent from "@/components/BracketPageContent";

export default async function PlayoffsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/bracket`);
  const { myTeam } = await requireLeagueAccess(leagueId, user.id);
  return <BracketPageContent leagueId={leagueId} myTeamId={myTeam?.id} userId={user.id} />;
}
