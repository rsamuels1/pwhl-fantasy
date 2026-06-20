import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireCommissioner } from "@/lib/auth";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getLeagueActivity, type ActivityEvent } from "@/lib/services/activity";
import GMCommandCenter from "@/components/sim/GMCommandCenter";

interface Props {
  params: Promise<{ leagueId: string }>;
}

type SimPhase = "PRE_SEASON" | "SETUP" | "RECAP" | "SEASON_COMPLETE" | "PLAYOFFS";

export default async function SimPage({ params }: Props) {
  const { leagueId } = await params;
  const user = await requireAuth(`/league/${leagueId}/sim`);
  const league = await requireCommissioner(leagueId, user.id);

  if (!league.isReplay) {
    notFound();
  }

  const nowMs = getReplayNow(league, await getDevNow());
  const state = await getSeasonState(leagueId, nowMs, prisma);

  // Derive the current phase
  let phase: SimPhase;

  if (league.playoffStatus === "IN_PROGRESS") {
    phase = "PLAYOFFS";
  } else if (state.lifecycleStatus === "COMPLETE") {
    phase = "SEASON_COMPLETE";
  } else {
    const active = state.periods.find((p) => p.status === "ACTIVE");
    const upcoming = state.periods.find((p) => p.status === "UPCOMING");
    const lastScored = [...state.periods].reverse().find((p) => p.status === "COMPLETE");

    if (active) {
      phase = "SETUP";
    } else if (lastScored && upcoming && !active) {
      phase = "RECAP";
    } else if (!lastScored && upcoming) {
      phase = "PRE_SEASON";
    } else {
      phase = "PRE_SEASON";
    }
  }

  // Fetch commissioner's team for the roster
  const commTeam = await prisma.fantasyTeam.findFirst({
    where: { leagueId, ownerId: user.id },
    select: { id: true, name: true },
  });

  // Fetch activity feed
  const activity = await getLeagueActivity(leagueId, 10, prisma);

  // Fetch last scored matchup if RECAP phase
  let lastMatchup = null;
  if (phase === "RECAP" && commTeam) {
    lastMatchup = await prisma.matchup.findFirst({
      where: {
        leagueId,
        OR: [{ homeTeamId: commTeam.id }, { awayTeamId: commTeam.id }],
        homeScore: { not: null },
        isPlayoff: false,
      },
      orderBy: { week: "desc" },
      select: {
        week: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    });
  }

  const nextPeriod =
    phase === "RECAP"
      ? state.periods.find((p) => p.status === "UPCOMING")?.period
      : state.activePeriod ?? undefined;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <GMCommandCenter
          phase={phase}
          leagueId={leagueId}
          league={league}
          state={state}
          commTeamId={commTeam?.id}
          commTeamName={commTeam?.name}
          lastMatchup={lastMatchup}
          nextPeriod={nextPeriod}
          activity={activity}
        />
      </div>
    </div>
  );
}
