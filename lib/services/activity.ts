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
