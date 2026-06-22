// app/team/[teamId]/draft-prep/page.tsx
// Pre-draft player rankings page. Accessible when league.status === "PRE_DRAFT".
// Lets managers star/queue players before the live draft starts.
// The queue is stored in Draft.queueData and is picked up automatically when the draft room opens.

import { notFound } from "next/navigation";
import { requireAuth, requireTeamOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPriorSeason } from "@/lib/season/index";
import DraftQueueManager from "./DraftQueueManager";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";

interface Props {
  params: Promise<{ teamId: string }>;
}

type AggRow = {
  id: string; firstName: string; lastName: string;
  position: string; abbreviation: string | null;
  gp: bigint; goals: bigint; assists: bigint; plusMinus: bigint;
  ppp: bigint; shots: bigint; hits: bigint; blocks: bigint;
  saves: bigint; goalsAgainst: bigint; wins: bigint; shutouts: bigint;
};

export default async function DraftPrepPage({ params }: Props) {
  const { teamId } = await params;

  const user = await requireAuth(`/team/${teamId}/draft-prep`);
  const team = await requireTeamOwner(teamId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: team.league.id },
    select: {
      id: true,
      status: true,
      season: true,
      isReplay: true,
      scoringMode: true,
    },
  });

  if (!league || league.status !== "PRE_DRAFT") {
    notFound();
  }

  // For replay/beta leagues, show stats from the prior season so managers draft on
  // last year's performance, not the season they're replaying.
  const statSeason = league.isReplay && league.season
    ? getPriorSeason(league.season)
    : league.season;

  const [rows, draft] = await Promise.all([
    statSeason
      ? prisma.$queryRaw<AggRow[]>`
          SELECT
            p.id,
            p."firstName",
            p."lastName",
            p.position::text,
            t.abbreviation,
            COUNT(sl.id)                        AS gp,
            COALESCE(SUM(sl.goals), 0)          AS goals,
            COALESCE(SUM(sl.assists), 0)        AS assists,
            COALESCE(SUM(sl."plusMinus"), 0)    AS "plusMinus",
            COALESCE(SUM(sl."powerPlayPts"), 0) AS ppp,
            COALESCE(SUM(sl.shots), 0)          AS shots,
            COALESCE(SUM(sl.hits), 0)           AS hits,
            COALESCE(SUM(sl.blocks), 0)         AS blocks,
            COALESCE(SUM(sl.saves), 0)          AS saves,
            COALESCE(SUM(sl."goalsAgainst"), 0) AS "goalsAgainst",
            COALESCE(SUM(CASE WHEN sl.win THEN 1 ELSE 0 END), 0)     AS wins,
            COALESCE(SUM(CASE WHEN sl.shutout THEN 1 ELSE 0 END), 0) AS shutouts
          FROM "Player" p
          LEFT JOIN "Team" t ON t.id = p."teamId"
          LEFT JOIN "StatLine" sl ON sl."playerId" = p.id
          LEFT JOIN "Game" g ON g.id = sl."gameId" AND g.season = ${statSeason}
          WHERE p.active = true
          GROUP BY p.id, p."firstName", p."lastName", p.position, t.abbreviation
          ORDER BY p.position, p."lastName"
        `
      : Promise.resolve<AggRow[]>([]),
    prisma.draft.findFirst({
      where: { leagueId: league.id },
      select: { id: true, queueData: true },
    }),
  ]);

  const players: PlayerStats[] = rows.map((r) => {
    const saves = Number(r.saves);
    const goalsAgainst = Number(r.goalsAgainst);
    const totalFaced = saves + goalsAgainst;
    const goals = Number(r.goals);
    const assists = Number(r.assists);
    return {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      position: r.position as PlayerStats["position"],
      team: r.abbreviation ?? null,
      gp: Number(r.gp),
      goals,
      assists,
      points: goals + assists,
      plusMinus: Number(r.plusMinus),
      ppp: Number(r.ppp),
      shots: Number(r.shots),
      hits: Number(r.hits),
      blocks: Number(r.blocks),
      wins: Number(r.wins),
      saves,
      goalsAgainst,
      shutouts: Number(r.shutouts),
      savePct: totalFaced > 0 ? saves / totalFaced : null,
    };
  });

  const queueData = (draft?.queueData ?? {}) as Record<string, string[]>;
  const initialQueue = queueData[teamId] ?? [];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 4 }}>Draft Queue</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Star players to add them to your queue. Your queue is used for auto-picks during the live draft.
          {statSeason && (
            <> Stats from the <strong style={{ color: "#94a3b8" }}>{statSeason}</strong> season.</>
          )}
        </p>
      </div>

      <DraftQueueManager
        leagueId={league.id}
        teamId={teamId}
        players={players}
        initialQueue={initialQueue}
        statSeason={statSeason}
      />
    </div>
  );
}
