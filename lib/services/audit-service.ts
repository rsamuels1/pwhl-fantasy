import { PrismaClient, EventType } from "@prisma/client";

export type CommissionerEventType =
  | "COMMISSIONER_FORCE_MOVE"
  | "COMMISSIONER_UNDO_TRANSACTION"
  | "COMMISSIONER_REPLACE_MANAGER"
  | "COMMISSIONER_DRAFT_PAUSED"
  | "COMMISSIONER_DRAFT_RESUMED"
  | "COMMISSIONER_ANNOUNCEMENT"
  | "COMMISSIONER_SETTINGS_CHANGED";

export async function logCommissionerAction(
  leagueId: string,
  commissionerId: string,
  action: CommissionerEventType,
  data: Record<string, unknown>,
  prisma: PrismaClient
): Promise<void> {
  await prisma.leagueEvent.create({
    data: {
      leagueId,
      type: action as EventType,
      data: {
        timestamp: new Date().toISOString(),
        commissionerId,
        action,
        ...data,
      },
    },
  });
}
