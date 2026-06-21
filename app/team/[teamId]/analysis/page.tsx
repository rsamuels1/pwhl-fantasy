import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getTeamAnalysis } from "@/lib/services/analysis-service";
import AnalysisTab from "@/components/AnalysisTab";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";

export default async function TeamAnalysisPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/analysis`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, isReplay: true, replayCurrentDate: true },
  });
  if (!league) notFound();

  const nowMs = getReplayNow(league, await getDevNow());

  const analysis = await getTeamAnalysis(leagueId, teamId, nowMs, prisma).catch(
    (err: unknown) => {
      console.error("[analysis] getTeamAnalysis failed:", err);
      return null;
    }
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AnalysisTab analysis={analysis} />
    </div>
  );
}
