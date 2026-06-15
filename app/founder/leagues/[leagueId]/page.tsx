import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStandings } from "@/lib/services/standings-service";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { LeagueDetailTabs } from "./LeagueDetailTabs";
import Link from "next/link";

interface Props {
  params: Promise<{ leagueId: string }>;
}

export default async function FounderLeagueDetail({ params }: Props) {
  const { leagueId } = await params;

  const [league, nowMs] = await Promise.all([
    prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      include: {
        commissioner: { select: { email: true, displayName: true } },
        teams: {
          orderBy: { draftOrder: "asc" },
          include: { owner: { select: { email: true } } },
        },
        draft: {
          include: {
            picks: {
              orderBy: { overall: "asc" },
              include: {
                fantasyTeam: { select: { name: true } },
                player: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    }),
    getDevNow(),
  ]);

  if (!league) notFound();

  const [standingsResult, seasonState] = await Promise.all([
    getStandings(leagueId, prisma).catch(() => null),
    getSeasonState(leagueId, nowMs, prisma).catch(() => null),
  ]);

  let parsedScoring = null;
  try {
    parsedScoring = parseScoringSettings(league.scoringSettings);
  } catch {}

  const draftInfo = league.draft
    ? {
        status: league.draft.status,
        currentPick: league.draft.currentPick,
        startedAt: league.draft.startedAt?.toISOString() ?? null,
        completedAt: league.draft.completedAt?.toISOString() ?? null,
        totalPicks: league.draft.picks.length,
        picks: league.draft.picks.map((p) => ({
          overall: p.overall,
          round: p.round,
          auto: p.auto ?? false,
          fantasyTeamId: p.fantasyTeamId,
          teamName: p.fantasyTeam?.name ?? "—",
          playerName: p.player ? `${p.player.firstName} ${p.player.lastName}` : "—",
        })),
      }
    : null;

  return (
    <div style={{ maxWidth: "960px" }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/founder/leagues" style={{ color: "#666", fontSize: "0.82rem" }}>← Leagues</Link>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#ccc" }}>{league.name}</h1>
        <span style={{ color: "#555", fontSize: "0.82rem" }}>{league.season}</span>
        <a href={`/league/${leagueId}/admin`} target="_blank" style={{ marginLeft: "auto", color: "#64b5f6", fontSize: "0.8rem" }}>
          Commissioner Admin ↗
        </a>
      </div>

      <LeagueDetailTabs
        leagueId={leagueId}
        league={{
          name: league.name,
          season: league.season,
          status: league.status,
          draftType: league.draftType,
          scoringMode: (league as { scoringMode?: string | null }).scoringMode ?? "VP",
          maxTeams: league.maxTeams,
          isReplay: league.isReplay ?? false,
          playoffStatus: league.playoffStatus,
          betaStatus: league.betaStatus,
          scoringSettings: parsedScoring as { skater: Record<string, number>; goalie: Record<string, number> } | null,
          rosterSettings: league.rosterSettings as Record<string, number> | null,
          playoffSettings: league.playoffSettings as Record<string, unknown> | null,
          commissioner: league.commissioner,
        }}
        standings={standingsResult?.standings ?? []}
        seasonState={
          seasonState
            ? {
                lifecycleStatus: seasonState.lifecycleStatus,
                completedWeeks: seasonState.completedWeeks,
                totalWeeks: seasonState.totalWeeks,
                activePeriodWeek: seasonState.activePeriod?.week ?? null,
                periods: seasonState.periods.map((p) => ({
                  week: p.period.week,
                  startsAt: p.period.startsAt.toISOString(),
                  endsAt: p.period.endsAt.toISOString(),
                  status: p.status,
                })),
              }
            : null
        }
        draft={draftInfo}
        teams={league.teams.map((t) => ({ id: t.id, name: t.name, owner: t.owner }))}
      />
    </div>
  );
}
