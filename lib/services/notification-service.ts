import { PrismaClient, Prisma } from "@prisma/client";

export type NotificationType = "DRAFT_STARTING" | "ON_THE_CLOCK" | "LINEUP_INCOMPLETE";

export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>,
  prisma: PrismaClient,
  leagueId?: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      leagueId: leagueId ?? null,
      type,
      data: data as Prisma.InputJsonValue,
    },
  });
}

export async function markAllRead(
  userId: string,
  leagueId: string,
  prisma: PrismaClient
): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, leagueId, readAt: null },
    data: { readAt: new Date() },
  });
}
