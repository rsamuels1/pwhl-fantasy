import { PrismaClient, Prisma } from "@prisma/client";
import { getSeasonState } from "@/lib/season";

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

// Fires LINEUP_INCOMPLETE notifications for any IN_SEASON team the user owns
// where an active starter's PWHL team has no games remaining this period.
// Deduped per period+team — safe to call on every dashboard load.
export async function checkAndEmitScheduledNotifications(
  userId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<void> {
  try {
    const teams = await prisma.fantasyTeam.findMany({
      where: { ownerId: userId, league: { status: "IN_SEASON" } },
      select: { id: true, leagueId: true },
    });

    const nowDate = new Date(nowMs);

    for (const team of teams) {
      const state = await getSeasonState(team.leagueId, nowMs, prisma);
      const period = state.activePeriod;
      if (!period) continue;

      const dedupeKey = `${period.startsAt.getTime()}-${team.id}`;
      const periodEnd = period.endsAt;

      const entries = await prisma.rosterEntry.findMany({
        where: { fantasyTeamId: team.id, slot: { notIn: ["BENCH", "IR"] } },
        select: { player: { select: { teamId: true } } },
      });

      const pwhlTeamIds = [...new Set(
        entries.map((e) => e.player.teamId).filter((id): id is string => !!id)
      )];
      if (pwhlTeamIds.length === 0) continue;

      const games = await prisma.game.findMany({
        where: {
          OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
          startsAt: { gt: nowDate, lt: periodEnd },
        },
        select: { homeTeamId: true, awayTeamId: true },
      });

      const teamsWithGames = new Set(
        games.flatMap((g) => [g.homeTeamId, g.awayTeamId]).filter((id) => pwhlTeamIds.includes(id))
      );
      if (pwhlTeamIds.every((id) => teamsWithGames.has(id))) continue;

      await createNotification(userId, "LINEUP_INCOMPLETE", {}, prisma, team.leagueId, {
        title: "Lineup action needed",
        body: "One or more of your starters won't play this week.",
        teamId: team.id,
        actionUrl: `/team/${team.id}/lineup`,
        dedupeKey,
      });
    }
  } catch {
    // fire-and-forget — never block the dashboard
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
