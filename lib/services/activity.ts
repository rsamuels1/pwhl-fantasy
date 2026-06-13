import type { PrismaClient } from "@prisma/client";

export interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  createdAt: Date;
}

export type LeagueEventType =
  | "DRAFT_PICK"
  | "PLAYER_ADD"
  | "PLAYER_DROP"
  | "TRADE"
  | "PLAYOFF_QUALIFICATION"
  | "MAJOR_PERFORMANCE";

export async function getLeagueActivity(
  leagueId: string,
  limit = 10,
  prisma: PrismaClient
): Promise<ActivityEvent[]> {
  const events = await prisma.leagueEvent.findMany({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    description: (e.data as Record<string, string>)?.description ?? e.type,
    createdAt: e.createdAt,
  }));
}

export async function emitEvent(
  event: {
    leagueId: string;
    teamId?: string;
    playerId?: string;
    type: LeagueEventType;
    data: Record<string, unknown>;
  },
  prisma: PrismaClient
): Promise<void> {
  await prisma.leagueEvent.create({
    data: {
      ...event,
      data: event.data as object,
    },
  });
}

export interface EnrichedTransactionEvent {
  id: string;
  type: string;
  teamId: string | null;
  teamName: string | null;
  playerId: string | null;
  playerName: string | null;
  description: string;
  createdAt: string;
}

export async function getTransactions(
  leagueId: string,
  options: {
    teamId?: string;
    type?: string;
    before?: string;
    limit?: number;
    nowMs?: number;
    isReplay?: boolean;
  },
  prisma: PrismaClient
): Promise<{ events: EnrichedTransactionEvent[]; hasMore: boolean }> {
  const { teamId, type, before, limit = 25, nowMs, isReplay } = options;
  const take = Math.min(limit, 100) + 1; // fetch one extra to determine hasMore

  const where: Record<string, unknown> = { leagueId };
  if (teamId) where.teamId = teamId;
  if (type) where.type = { in: type.split(",") };

  const createdAtFilters: Record<string, unknown> = {};
  if (before) createdAtFilters.lt = new Date(before);
  if (isReplay && nowMs) createdAtFilters.lt = new Date(nowMs);
  if (Object.keys(createdAtFilters).length > 0) where.createdAt = createdAtFilters;

  const raw = await prisma.leagueEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });

  const hasMore = raw.length > take - 1;
  const events = raw.slice(0, take - 1);

  // Enrich with team names and player names via batch queries
  const teamIds = [...new Set(events.map((e) => e.teamId).filter((id): id is string => !!id))];
  const playerIds = [...new Set(events.map((e) => e.playerId).filter((id): id is string => !!id))];
  const [teams, players] = await Promise.all([
    teamIds.length > 0
      ? prisma.fantasyTeam.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    playerIds.length > 0
      ? prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ]);
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const playerMap = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  return {
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      teamId: e.teamId,
      teamName: e.teamId ? (teamMap.get(e.teamId) ?? null) : null,
      playerId: e.playerId,
      playerName: e.playerId ? (playerMap.get(e.playerId) ?? null) : null,
      description: ((e.data as Record<string, string>)?.description as string) ?? e.type,
      createdAt: e.createdAt.toISOString(),
    })),
    hasMore,
  };
}

