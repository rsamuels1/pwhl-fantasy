import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { eligibleSlots, lockTime } from "@/lib/lineup";
import type { RosterSettings } from "@/lib/lineup";
import LineupManager from "./LineupManager";
import type { RosterEntryRow } from "./LineupManager";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
}

export default async function LineupPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { team: teamId } = await searchParams;

  // If no team specified, show a team picker
  if (!teamId) {
    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (!teams.length) notFound();
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Set Lineup</h1>
        <p style={{ color: "#94a3b8", marginBottom: 16 }}>Choose a team to manage:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {teams.map((t) => (
            <a
              key={t.id}
              href={`/league/${leagueId}/lineup?team=${t.id}`}
              style={{
                display: "block", padding: "12px 16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(148,163,184,0.14)",
                borderRadius: 12, color: "#e2e8f0", textDecoration: "none",
              }}
            >
              {t.name}
            </a>
          ))}
        </div>
      </div>
    );
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [team, todayGames] = await Promise.all([
    prisma.fantasyTeam.findFirst({
      where: { id: teamId, leagueId },
      include: {
        roster: {
          include: {
            player: {
              include: { team: { select: { id: true, abbreviation: true } } },
            },
          },
          orderBy: { acquired: "asc" },
        },
        league: { select: { rosterSettings: true, name: true } },
      },
    }),
    prisma.game.findMany({
      where: { startsAt: { gte: todayStart, lte: new Date() } },
      select: { homeTeamId: true, awayTeamId: true, startsAt: true },
    }),
  ]);

  if (!team) notFound();

  const settings = (team.league.rosterSettings ?? {}) as RosterSettings;

  const roster: RosterEntryRow[] = team.roster.map((entry) => {
    const pTeamId = entry.player.team?.id ?? null;
    const locked = lockTime(pTeamId, todayGames);
    return {
      id: entry.id,
      playerId: entry.playerId,
      name: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position as "FORWARD" | "DEFENSE" | "GOALIE",
      teamAbbr: entry.player.team?.abbreviation ?? null,
      active: entry.player.active,
      slot: entry.slot as RosterEntryRow["slot"],
      lockedAt: locked?.toISOString() ?? null,
      eligibleSlots: eligibleSlots(entry.player.position as "FORWARD" | "DEFENSE" | "GOALIE", entry.player.active) as RosterEntryRow["slot"][],
    };
  });

  return (
    <LineupManager
      leagueId={leagueId}
      teamId={teamId}
      teamName={team.name}
      leagueName={team.league.name}
      initialRoster={roster}
      rosterSettings={settings}
    />
  );
}
