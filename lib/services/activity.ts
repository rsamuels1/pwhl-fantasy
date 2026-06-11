// lib/services/activity.ts
// Activity feed — emitting and querying LeagueEvent rows.
// Note: LeagueEvent requires `npx prisma db push && npx prisma generate` to activate.

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  if (!db.leagueEvent) return [];

  const events: Array<{
    id: string;
    type: string;
    data: unknown;
    createdAt: Date;
  }> = await db.leagueEvent.findMany({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  if (!db.leagueEvent) return;
  await db.leagueEvent.create({ data: event });
}
