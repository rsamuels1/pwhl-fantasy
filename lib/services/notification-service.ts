import { PrismaClient, Prisma } from "@prisma/client";

export type NotificationType = "DRAFT_STARTING" | "ON_THE_CLOCK" | "LINEUP_INCOMPLETE";

export async function createNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>,
  prisma: PrismaClient,
  leagueId?: string,
  opts?: {
    title?: string;
    teamId?: string;
    body?: string;
    actionUrl?: string;
    dedupeKey?: string;
  }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        leagueId: leagueId ?? null,
        teamId: opts?.teamId ?? null,
        type,
        title: opts?.title ?? "",
        body: opts?.body ?? null,
        actionUrl: opts?.actionUrl ?? null,
        dedupeKey: opts?.dedupeKey ?? null,
        data: data as Prisma.InputJsonValue,
      },
    });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") return; // duplicate dedupeKey — silent no-op
    throw e;
  }
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
