import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotification, markAllRead } from "../lib/services/notification-service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "n1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
}

describe("notification-service", () => {
  it("createNotification writes a row with correct fields", async () => {
    const prisma = makePrisma();
    await createNotification("user1", "ON_THE_CLOCK", { teamName: "Stars" }, prisma as never, "league1", {
      title: "You're on the clock",
      body: "Pick 3 of 13",
      teamId: "team1",
      actionUrl: "/draft/league1?team=team1",
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user1",
        leagueId: "league1",
        teamId: "team1",
        type: "ON_THE_CLOCK",
        title: "You're on the clock",
        body: "Pick 3 of 13",
        actionUrl: "/draft/league1?team=team1",
        dedupeKey: null,
        data: { teamName: "Stars" },
      },
    });
  });

  it("createNotification works without leagueId", async () => {
    const prisma = makePrisma();
    await createNotification("user2", "LINEUP_INCOMPLETE", {}, prisma as never);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user2",
        leagueId: null,
        teamId: null,
        type: "LINEUP_INCOMPLETE",
        title: "",
        body: null,
        actionUrl: null,
        dedupeKey: null,
        data: {},
      },
    });
  });

  it("markAllRead calls updateMany with correct where clause", async () => {
    const prisma = makePrisma();
    await markAllRead("user1", "league1", prisma as never);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user1", leagueId: "league1", readAt: null },
      data: expect.objectContaining({ readAt: expect.any(Date) }),
    });
  });
});
