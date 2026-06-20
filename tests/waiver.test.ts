import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlayerWaiverStatus,
  submitClaim,
  processWaivers,
  initializeWaiverPriority,
} from "../lib/services/waiver-service";

const NOW_MS = 1_700_000_000_000; // fixed epoch for tests

// ── helpers ──────────────────────────────────────────────────────────────────

function makePrisma(overrides: Record<string, unknown> = {}) {
  // Defaults that make most tests pass; individual tests override as needed.
  const base = {
    waiverEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    waiverClaim: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "claim-1", ...data })
      ),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    waiverPriority: {
      findUnique: vi.fn().mockResolvedValue({ priority: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    rosterEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    fantasyTeam: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    matchup: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    leagueEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Run the callback with a fresh transaction mock that mirrors base
      const tx = makePrismaTx();
      return fn(tx);
    }),
    ...overrides,
  };
  return base;
}

/** A simpler inline-transaction mock (no recursion) */
function makePrismaTx() {
  return {
    waiverEntry: {
      delete: vi.fn().mockResolvedValue({}),
    },
    waiverClaim: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    waiverPriority: {
      findMany: vi.fn().mockResolvedValue([
        { fantasyTeamId: "team-1", priority: 1 },
        { fantasyTeamId: "team-2", priority: 2 },
      ]),
      update: vi.fn().mockResolvedValue({}),
    },
    rosterEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
}

// ── getPlayerWaiverStatus ──────────────────────────────────────────────────────

describe("getPlayerWaiverStatus", () => {
  it("returns isOnWaivers: false when no entry exists", async () => {
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await getPlayerWaiverStatus("league-1", "player-1", NOW_MS, prisma as never);
    expect(result.isOnWaivers).toBe(false);
  });

  it("returns isOnWaivers: false when entry is expired", async () => {
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "entry-1",
      leagueId: "league-1",
      playerId: "player-1",
      expiresAt: new Date(NOW_MS - 1000), // already expired
    });

    const result = await getPlayerWaiverStatus("league-1", "player-1", NOW_MS, prisma as never);
    expect(result.isOnWaivers).toBe(false);
  });

  it("returns isOnWaivers: true with expiresAt when entry is active", async () => {
    const expiresAt = new Date(NOW_MS + 3_600_000); // 1h from now
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "entry-1",
      leagueId: "league-1",
      playerId: "player-1",
      expiresAt,
    });

    const result = await getPlayerWaiverStatus("league-1", "player-1", NOW_MS, prisma as never);
    expect(result.isOnWaivers).toBe(true);
    expect(result.expiresAt).toEqual(expiresAt);
  });
});

// ── submitClaim ────────────────────────────────────────────────────────────────

describe("submitClaim", () => {
  it("throws when player is not on waivers", async () => {
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      submitClaim("league-1", "team-1", "player-1", null, NOW_MS, prisma as never)
    ).rejects.toThrow("not currently on the waiver wire");
  });

  it("throws when a duplicate pending claim exists", async () => {
    const expiresAt = new Date(NOW_MS + 3_600_000);
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      expiresAt,
    });
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "claim-existing",
      status: "PENDING",
    });

    await expect(
      submitClaim("league-1", "team-1", "player-1", null, NOW_MS, prisma as never)
    ).rejects.toThrow("already have a pending claim");
  });

  it("creates a claim with the team's priority snapshot", async () => {
    const expiresAt = new Date(NOW_MS + 3_600_000);
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ expiresAt });
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.waiverPriority.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ priority: 3 });

    const { claim } = await submitClaim("league-1", "team-1", "player-1", null, NOW_MS, prisma as never);
    expect(prisma.waiverClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prioritySnapshot: 3, status: "PENDING" }),
      })
    );
    expect(claim).toBeDefined();
  });

  it("uses priority 999 when no priority row exists", async () => {
    const expiresAt = new Date(NOW_MS + 3_600_000);
    const prisma = makePrisma();
    (prisma.waiverEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ expiresAt });
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.waiverPriority.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await submitClaim("league-1", "team-1", "player-1", null, NOW_MS, prisma as never);
    expect(prisma.waiverClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prioritySnapshot: 999 }),
      })
    );
  });
});

// ── processWaivers ─────────────────────────────────────────────────────────────

describe("processWaivers", () => {
  it("returns expired count when entry has no claims", async () => {
    const prisma = makePrisma();
    (prisma.waiverEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "entry-1", leagueId: "league-1", playerId: "player-1", expiresAt: new Date(NOW_MS - 1000) },
    ]);
    // No AWARDED claim (idempotency check passes)
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // No PENDING claims
    (prisma.waiverClaim.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.waiverEntry.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await processWaivers("league-1", NOW_MS, prisma as never);
    expect(result.expired).toBe(1);
    expect(result.awarded).toBe(0);
    expect(result.denied).toBe(0);
    expect(prisma.waiverEntry.delete).toHaveBeenCalled();
  });

  it("awards the single claim when exactly one claim exists", async () => {
    const expiredEntry = {
      id: "entry-1",
      leagueId: "league-1",
      playerId: "player-1",
      expiresAt: new Date(NOW_MS - 1000),
    };
    const claim = {
      id: "claim-1",
      leagueId: "league-1",
      fantasyTeamId: "team-1",
      addPlayerId: "player-1",
      dropPlayerId: null,
      prioritySnapshot: 1,
    };

    const prisma = makePrisma();
    (prisma.waiverEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([expiredEntry]);
    // First findFirst: idempotency check (null = not yet awarded)
    // Second findFirst: inside tx for drop player
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.waiverClaim.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([claim]);

    const result = await processWaivers("league-1", NOW_MS, prisma as never);
    expect(result.awarded).toBe(1);
    expect(result.denied).toBe(0);
    // Transaction should have been called
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("awards to the lower priority number when two teams compete", async () => {
    const expiredEntry = {
      id: "entry-1",
      leagueId: "league-1",
      playerId: "player-1",
      expiresAt: new Date(NOW_MS - 1000),
    };
    // team-1 has priority 1 (first in line), team-2 has priority 2
    const claims = [
      { id: "claim-1", leagueId: "league-1", fantasyTeamId: "team-1", addPlayerId: "player-1", dropPlayerId: null, prioritySnapshot: 1 },
      { id: "claim-2", leagueId: "league-1", fantasyTeamId: "team-2", addPlayerId: "player-1", dropPlayerId: null, prioritySnapshot: 2 },
    ];

    // Capture what the transaction fn does by running the real tx mock
    const txFn = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = makePrismaTx();
      await fn(tx);
      // Verify the winning team's roster entry was created
      expect(tx.rosterEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fantasyTeamId: "team-1" }),
        })
      );
    });

    const prisma = makePrisma({ $transaction: txFn });
    (prisma.waiverEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([expiredEntry]);
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // Sorted by prioritySnapshot ASC — service does the sort, our mock returns them pre-sorted
    (prisma.waiverClaim.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(claims);

    const result = await processWaivers("league-1", NOW_MS, prisma as never);
    expect(result.awarded).toBe(1);
    expect(result.denied).toBe(1);
  });

  it("is idempotent: skips processing when claim already AWARDED", async () => {
    const expiredEntry = {
      id: "entry-1",
      leagueId: "league-1",
      playerId: "player-1",
      expiresAt: new Date(NOW_MS - 1000),
    };
    const prisma = makePrisma();
    (prisma.waiverEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([expiredEntry]);
    // Idempotency check finds an existing AWARDED claim
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "claim-already",
      status: "AWARDED",
    });

    const result = await processWaivers("league-1", NOW_MS, prisma as never);
    // Should not award again
    expect(result.awarded).toBe(0);
    // Transaction should NOT have been called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("winner moves to last priority after award", async () => {
    const expiredEntry = {
      id: "entry-1",
      leagueId: "league-1",
      playerId: "player-1",
      expiresAt: new Date(NOW_MS - 1000),
    };
    const winnerClaim = {
      id: "claim-1",
      leagueId: "league-1",
      fantasyTeamId: "team-1",
      addPlayerId: "player-1",
      dropPlayerId: null,
      prioritySnapshot: 1,
    };

    // Capture the priority updates
    const priorityUpdates: { teamId: string; priority: number }[] = [];
    const txFn = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        ...makePrismaTx(),
        waiverPriority: {
          findMany: vi.fn().mockResolvedValue([
            { fantasyTeamId: "team-1", priority: 1 },
            { fantasyTeamId: "team-2", priority: 2 },
          ]),
          update: vi.fn().mockImplementation(({ where, data }: { where: { leagueId_fantasyTeamId: { fantasyTeamId: string } }; data: { priority: number } }) => {
            priorityUpdates.push({ teamId: where.leagueId_fantasyTeamId.fantasyTeamId, priority: data.priority });
            return Promise.resolve({});
          }),
        },
      };
      return fn(tx);
    });

    const prisma = makePrisma({ $transaction: txFn });
    (prisma.waiverEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([expiredEntry]);
    (prisma.waiverClaim.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.waiverClaim.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([winnerClaim]);

    await processWaivers("league-1", NOW_MS, prisma as never);

    // team-2 should be renumbered to 1, team-1 (winner) should go to 2 (last)
    const team2Update = priorityUpdates.find((u) => u.teamId === "team-2");
    const team1Update = priorityUpdates.find((u) => u.teamId === "team-1");
    expect(team2Update?.priority).toBe(1);
    expect(team1Update?.priority).toBe(2); // moved to last (total = 2 teams)
  });
});

// ── initializeWaiverPriority ───────────────────────────────────────────────────

describe("initializeWaiverPriority", () => {
  it("assigns priority by reverse draft order when no matchups exist", async () => {
    const teams = [
      { id: "team-1", name: "Team 1", draftOrder: 1 },
      { id: "team-2", name: "Team 2", draftOrder: 2 },
      { id: "team-3", name: "Team 3", draftOrder: 3 },
    ];
    const upsertCalls: { teamId: string; priority: number }[] = [];
    const prisma = makePrisma();
    (prisma.fantasyTeam.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(teams);
    (prisma.matchup.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.waiverPriority.upsert as ReturnType<typeof vi.fn>).mockImplementation(({ create }: { create: { fantasyTeamId: string; priority: number } }) => {
      upsertCalls.push({ teamId: create.fantasyTeamId, priority: create.priority });
      return Promise.resolve({});
    });

    await initializeWaiverPriority("league-1", prisma as never);

    // Last draft pick (team-3) should get priority 1
    const t3 = upsertCalls.find((u) => u.teamId === "team-3");
    const t1 = upsertCalls.find((u) => u.teamId === "team-1");
    expect(t3?.priority).toBe(1);
    expect(t1?.priority).toBe(3); // first pick = last in line
  });
});
