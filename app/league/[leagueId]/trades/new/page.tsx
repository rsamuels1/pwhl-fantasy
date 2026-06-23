// app/league/[leagueId]/trades/new/page.tsx

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getTrade } from "@/lib/services/trade-service";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { scoreStatLine, type StatLineInput } from "@/lib/scoring";
import { Position } from "@prisma/client";
import ProposeTrade from "./ProposeTrade";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ team?: string; counterOf?: string }>;
}

export default async function NewTradePage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const sp = searchParams ? await searchParams : {};

  const user = await requireAuth(`/league/${leagueId}/trades/new`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { status: true, playoffStatus: true, name: true, season: true, scoringSettings: true },
  });
  if (!league) notFound();

  if (league.playoffStatus !== "NOT_STARTED") {
    redirect(`/league/${leagueId}/trades`);
  }

  const scoringSettings = parseScoringSettings(league.scoringSettings);

  // Load all roster entries for the league with player + team info
  const allRosters = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { leagueId } },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, position: true, active: true } },
      fantasyTeam: { select: { id: true, name: true } },
    },
  });

  // Aggregate FP for every rostered player from this season's stat lines
  const rosterPlayerIds = allRosters.map((e) => e.playerId);
  // Build a playerId → position map for scoring
  const positionByPlayer: Record<string, Position> = {};
  for (const entry of allRosters) {
    positionByPlayer[entry.playerId] = entry.player.position;
  }

  const statLines = await prisma.statLine.findMany({
    where: {
      playerId: { in: rosterPlayerIds },
      game: { season: league.season },
    },
    select: {
      playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
      penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
      saves: true, goalsAgainst: true, shutout: true, win: true,
    },
  });

  // Sum FP per player
  const fpByPlayer: Record<string, number> = {};
  for (const sl of statLines) {
    const position = positionByPlayer[sl.playerId] ?? Position.FORWARD;
    const fp = scoreStatLine(sl as StatLineInput, position, scoringSettings);
    fpByPlayer[sl.playerId] = (fpByPlayer[sl.playerId] ?? 0) + fp;
  }

  // Build my roster
  const myRoster = allRosters
    .filter((e) => e.fantasyTeamId === myTeam.id)
    .map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      active: e.player.active,
      fp: Math.round((fpByPlayer[e.playerId] ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.fp - a.fp);

  // Build flat list of all other league players
  const leaguePlayers = allRosters
    .filter((e) => e.fantasyTeamId !== myTeam.id)
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

  // Pre-select receiving team from query param or counterOf trade
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
          href={`/league/${leagueId}/trades`}
          style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}
        >
          ← Trade Center
        </Link>
      </div>
      <ProposeTrade
        leagueId={leagueId}
        myTeamId={myTeam.id}
        myTeamName={myTeam.name}
        myRoster={myRoster}
        leaguePlayers={leaguePlayers}
        preselectedTeamId={preselectedTeamId}
        counterOfId={sp.counterOf ?? null}
      />
    </div>
  );
}
