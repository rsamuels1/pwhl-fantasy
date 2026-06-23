import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { getTrade } from "@/lib/services/trade-service";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { scoreStatLine, type StatLineInput } from "@/lib/scoring";
import { Position } from "@prisma/client";
import ProposeTrade from "@/app/league/[leagueId]/trades/new/ProposeTrade";

interface Props {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ team?: string; counterOf?: string }>;
}

export default async function TeamNewTradePage({ params, searchParams }: Props) {
  const { teamId } = await params;
  const sp = searchParams ? await searchParams : {};

  const user = await requireAuth(`/team/${teamId}/trades/new`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { status: true, playoffStatus: true, name: true, season: true, scoringSettings: true },
  });
  if (!league) notFound();

  if (league.playoffStatus !== "NOT_STARTED") {
    redirect(`/team/${teamId}/trades`);
  }

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  const allRosters = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { leagueId } },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, position: true, active: true } },
      fantasyTeam: { select: { id: true, name: true } },
    },
  });

  const rosterPlayerIds = allRosters.map((e) => e.playerId);
  const positionByPlayer: Record<string, Position> = {};
  for (const entry of allRosters) {
    positionByPlayer[entry.playerId] = entry.player.position;
  }

  const statLines = await prisma.statLine.findMany({
    where: { playerId: { in: rosterPlayerIds }, game: { season: league.season } },
    select: {
      playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
      penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
      saves: true, goalsAgainst: true, shutout: true, win: true,
    },
  });

  const fpByPlayer: Record<string, number> = {};
  for (const sl of statLines) {
    const position = positionByPlayer[sl.playerId] ?? Position.FORWARD;
    const fp = scoreStatLine(sl as StatLineInput, position, scoringSettings);
    fpByPlayer[sl.playerId] = (fpByPlayer[sl.playerId] ?? 0) + fp;
  }

  const myRoster = allRosters
    .filter((e) => e.fantasyTeamId === teamId)
    .map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      active: e.player.active,
      fp: Math.round((fpByPlayer[e.playerId] ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.fp - a.fp);

  const leaguePlayers = allRosters
    .filter((e) => e.fantasyTeamId !== teamId)
    .map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      active: e.player.active,
      teamId: e.fantasyTeam.id,
      teamName: e.fantasyTeam.name,
      fp: Math.round((fpByPlayer[e.playerId] ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.fp - a.fp);

  let preselectedTeamId = sp.team ?? null;
  let counterOf: { id: string; proposingTeamId: string; receivingTeamId: string; items: Array<{ playerId: string; fromTeamId: string; toTeamId: string }> } | null = null;

  if (sp.counterOf) {
    counterOf = await getTrade(sp.counterOf, leagueId, prisma);
    if (counterOf) {
      preselectedTeamId = counterOf.proposingTeamId;
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/team/${teamId}/trades`}
          style={{ color: "var(--dim)", textDecoration: "none", fontSize: 13 }}
        >
          ← Trade Center
        </Link>
      </div>
      <ProposeTrade
        leagueId={leagueId}
        myTeamId={teamId}
        myTeamName={team.name}
        myRoster={myRoster}
        leaguePlayers={leaguePlayers}
        preselectedTeamId={preselectedTeamId}
        counterOfId={sp.counterOf ?? null}
        teamId={teamId}
      />
    </div>
  );
}
