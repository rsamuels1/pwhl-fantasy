// lib/replay/gameDays.ts
// Pure helpers for day-number navigation in replay leagues.
// A "game day" is any UTC calendar day that has at least one game.
// replayCurrentDate always equals midnight UTC of the day AFTER the last completed game day.

import type { PrismaClient } from "@prisma/client";

export async function getGameDays(season: string, prisma: PrismaClient): Promise<Date[]> {
  const games = await prisma.game.findMany({
    where: { season },
    select: { startsAt: true },
    orderBy: { startsAt: "asc" },
  });
  const seen = new Set<string>();
  const days: Date[] = [];
  for (const g of games) {
    const key = g.startsAt.toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (!seen.has(key)) {
      seen.add(key);
      days.push(new Date(key + "T00:00:00.000Z"));
    }
  }
  return days;
}

// How many game days have been fully completed (start-of-day < replayCurrentDate)
export function currentDayNumber(replayMs: number, gameDays: Date[]): number {
  return gameDays.filter((d) => d.getTime() < replayMs).length;
}

// The next game day to play (first game day where start-of-day >= replayCurrentDate)
export function nextGameDay(replayMs: number, gameDays: Date[]): Date | null {
  return gameDays.find((d) => d.getTime() >= replayMs) ?? null;
}

// replayCurrentDate to store after completing a game day = start of next calendar day
export function replayDateAfterDay(gameDay: Date): Date {
  return new Date(gameDay.getTime() + 86_400_000);
}

// The most recently completed game day (for "today's" FP delta)
export function prevGameDay(replayMs: number, gameDays: Date[]): Date | null {
  const past = gameDays.filter((d) => d.getTime() < replayMs);
  return past.length > 0 ? past[past.length - 1] : null;
}
