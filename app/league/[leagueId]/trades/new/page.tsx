// app/league/[leagueId]/trades/new/page.tsx
// Propose Trade flow — pick team, select players from each roster, add message, submit.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getTrade } from "@/lib/services/trade-service";
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
    select: { status: true, playoffStatus: true, name: true },
  });
  if (!league) notFound();

  if (league.status !== "IN_SEASON" || league.playoffStatus !== "NOT_STARTED") {
    redirect(`/league/${leagueId}/trades`);
  }

  // Load all teams except mine
  const otherTeams = await prisma.fantasyTeam.findMany({
    where: { leagueId, id: { not: myTeam.id } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Load my roster with player details
  const myRoster = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId: myTeam.id },
    include: {
      player: {
        select: { id: true, firstName: true, lastName: true, position: true, active: true },
      },
    },
    orderBy: { acquired: "asc" },
  });

  // Pre-select receiving team from query param or counterOf trade
  let preselectedTeamId = sp.team ?? null;
  let counterOf: { id: string; proposingTeamId: string; receivingTeamId: string; items: Array<{ playerId: string; fromTeamId: string; toTeamId: string }> } | null = null;

  if (sp.counterOf) {
    counterOf = await getTrade(sp.counterOf, leagueId, prisma);
    if (counterOf) {
      // For a counter, the receiving team is the original proposer
      preselectedTeamId = counterOf.proposingTeamId;
    }
  }

  // Load all rosters for the league (keyed by teamId) to show other team's players
  const allRosters = await prisma.rosterEntry.findMany({
    where: { fantasyTeam: { leagueId } },
    include: {
      player: {
        select: { id: true, firstName: true, lastName: true, position: true, active: true },
      },
    },
  });

  const rostersByTeam: Record<string, Array<{
    playerId: string; name: string; position: string; active: boolean;
  }>> = {};
  for (const entry of allRosters) {
    if (!rostersByTeam[entry.fantasyTeamId]) rostersByTeam[entry.fantasyTeamId] = [];
    rostersByTeam[entry.fantasyTeamId].push({
      playerId: entry.playerId,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position,
      active: entry.player.active,
    });
  }

  const myRosterItems = myRoster.map((e) => ({
    playerId: e.playerId,
    name: `${e.player.firstName} ${e.player.lastName}`,
    position: e.player.position,
    active: e.player.active,
  }));

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
        otherTeams={otherTeams}
        myRoster={myRosterItems}
        rostersByTeam={rostersByTeam}
        preselectedTeamId={preselectedTeamId}
        counterOfId={sp.counterOf ?? null}
      />
    </div>
  );
}
