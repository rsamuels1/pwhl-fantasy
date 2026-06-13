// tests/draft-server.test.ts
// Server-layer behaviors for the draft: state rebuild, queue persistence,
// stale-pick guards, commissioner resolution, and auto-pick stall detection.
//
// B3 and B5 are pure engine tests — no DB required, always run.
// B1, B2, B4 test logic extracted from buildEngineState — pure functions derived
// from what the DB would return, so they also run without a live connection.

import { describe, it, expect } from "vitest";
import { reduce, deriveAutoState, type EngineState } from "../lib/draft/engine";
import { generateSnakeOrder } from "../lib/draft/snake";
import type { CompletedPick } from "../lib/draft/messages";

const timerConfig = { baseSecs: 30, autoSecs: 10 };

function inProgressState(overrides: Partial<EngineState> = {}): EngineState {
  const order = generateSnakeOrder(["teamA", "teamB"], 2); // 4 picks total
  return {
    draftId: "draft1",
    status: "IN_PROGRESS",
    order,
    currentOverall: 1,
    expiresAt: Date.now() + 30_000,
    completed: [],
    draftedPlayerIds: new Set(),
    queues: new Map(),
    autoPickCounts: new Map(),
    autoFlaggedTeams: new Set(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// B1. State rebuild: deriveAutoState correctly reconstructs escalation flags
// ---------------------------------------------------------------------------

describe("B1 — state rebuild from pick history", () => {
  it("computes currentOverall as completed.length + 1", () => {
    const picks: CompletedPick[] = [
      { overall: 1, round: 1, fantasyTeamId: "teamA", playerId: "p1", auto: false },
      { overall: 2, round: 1, fantasyTeamId: "teamB", playerId: "p2", auto: false },
      { overall: 3, round: 2, fantasyTeamId: "teamB", playerId: "p3", auto: false },
    ];
    // This mirrors how buildEngineState computes currentOverall
    const order = generateSnakeOrder(["teamA", "teamB"], 3);
    const currentOverall = Math.min(picks.length + 1, order.length);
    expect(currentOverall).toBe(4);
  });

  it("reconstructs draftedPlayerIds from completed picks", () => {
    const picks: CompletedPick[] = [
      { overall: 1, round: 1, fantasyTeamId: "teamA", playerId: "p1", auto: false },
      { overall: 2, round: 1, fantasyTeamId: "teamB", playerId: "p2", auto: true },
    ];
    const drafted = new Set(picks.map((c) => c.playerId));
    expect(drafted.has("p1")).toBe(true);
    expect(drafted.has("p2")).toBe(true);
    expect(drafted.size).toBe(2);
  });

  it("deriveAutoState tracks consecutive auto picks and flags at 2", () => {
    const picks: CompletedPick[] = [
      { overall: 1, round: 1, fantasyTeamId: "teamA", playerId: "p1", auto: false },
      { overall: 2, round: 1, fantasyTeamId: "teamB", playerId: "p2", auto: true },  // B: 1 auto
      { overall: 3, round: 2, fantasyTeamId: "teamB", playerId: "p3", auto: true },  // B: 2 → flagged
      { overall: 4, round: 2, fantasyTeamId: "teamA", playerId: "p4", auto: false },
    ];
    const { autoPickCounts, autoFlaggedTeams } = deriveAutoState(picks);
    expect(autoPickCounts.get("teamB")).toBe(2);
    expect(autoFlaggedTeams.has("teamB")).toBe(true);
    expect(autoPickCounts.get("teamA") ?? 0).toBe(0);
    expect(autoFlaggedTeams.has("teamA")).toBe(false);
  });

  it("manual pick clears the flag", () => {
    const picks: CompletedPick[] = [
      { overall: 1, round: 1, fantasyTeamId: "teamA", playerId: "p1", auto: true },
      { overall: 2, round: 1, fantasyTeamId: "teamB", playerId: "p2", auto: false },
      { overall: 3, round: 2, fantasyTeamId: "teamB", playerId: "p3", auto: true },
      { overall: 4, round: 2, fantasyTeamId: "teamA", playerId: "p4", auto: true }, // A: 2 → flagged
      { overall: 5, round: 3, fantasyTeamId: "teamA", playerId: "p5", auto: false }, // A: manual → cleared
    ];
    const { autoPickCounts, autoFlaggedTeams } = deriveAutoState(picks);
    expect(autoFlaggedTeams.has("teamA")).toBe(false);
    expect(autoPickCounts.get("teamA") ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B2. Queue persistence: round-trip through JSON serialization
// ---------------------------------------------------------------------------

describe("B2 — queue persistence round-trip", () => {
  it("serializes and deserializes queue map correctly", () => {
    const queues = new Map<string, string[]>([
      ["teamA", ["player1", "player2", "player3"]],
      ["teamB", ["player4", "player5"]],
    ]);

    // This mirrors the SET_QUEUE persist step in server.ts
    const serialized: Record<string, string[]> = {};
    for (const [tid, pids] of queues) serialized[tid] = pids;
    const json = JSON.stringify(serialized);

    // This mirrors the buildEngineState rehydration step
    const rawQueueData = JSON.parse(json) as Record<string, string[]> | null;
    const rehydrated = new Map<string, string[]>();
    if (rawQueueData && typeof rawQueueData === "object") {
      for (const [tid, pids] of Object.entries(rawQueueData)) {
        if (Array.isArray(pids)) rehydrated.set(tid, pids as string[]);
      }
    }

    expect(rehydrated.get("teamA")).toEqual(["player1", "player2", "player3"]);
    expect(rehydrated.get("teamB")).toEqual(["player4", "player5"]);
  });

  it("handles null queueData gracefully (no prior queue set)", () => {
    const rawQueueData = null as Record<string, string[]> | null;
    const queues = new Map<string, string[]>();
    if (rawQueueData && typeof rawQueueData === "object") {
      for (const [tid, pids] of Object.entries(rawQueueData)) {
        if (Array.isArray(pids)) queues.set(tid, pids as string[]);
      }
    }
    expect(queues.size).toBe(0);
  });

  it("queue players appear in auto-pick resolution when rehydrated", () => {
    const order = generateSnakeOrder(["teamA", "teamB"], 2);
    const state = inProgressState({
      order,
      currentOverall: 2, // teamB's turn
      completed: [
        { overall: 1, round: 1, fantasyTeamId: "teamA", playerId: "p1", auto: false },
      ],
      draftedPlayerIds: new Set(["p1"]),
      queues: new Map([["teamB", ["queued-player", "backup-player"]]]),
    });

    const result = reduce(state, {
      kind: "TIMEOUT",
      nowMs: Date.now(),
      timerConfig,
      bestAvailable: ["other-player"],
    });

    // Queue player takes priority over bestAvailable
    const pick = result.effects.find((e) => e.kind === "PERSIST_PICK") as
      | { kind: "PERSIST_PICK"; pick: CompletedPick }
      | undefined;
    expect(pick?.pick.playerId).toBe("queued-player");
    expect(pick?.pick.auto).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B3. Duplicate-tab STALE_PICK guard (pure engine test)
// ---------------------------------------------------------------------------

describe("B3 — duplicate-tab stale pick protection", () => {
  it("rejects a pick at the previous overall with STALE_PICK", () => {
    const order = generateSnakeOrder(["teamA", "teamB"], 4);
    const state = inProgressState({ order, currentOverall: 5 });

    // First pick succeeds — advances to overall 6
    const first = reduce(state, {
      kind: "MAKE_PICK",
      fantasyTeamId: order[4].fantasyTeamId,
      overall: 5,
      playerId: "playerX",
      playerExists: true,
      nowMs: Date.now(),
      timerConfig,
    });
    expect(first.error).toBeUndefined();
    expect(first.state.currentOverall).toBe(6);

    // Second tab sends the same overall=5 pick — must be rejected
    const stale = reduce(first.state, {
      kind: "MAKE_PICK",
      fantasyTeamId: order[4].fantasyTeamId,
      overall: 5,
      playerId: "playerY",
      playerExists: true,
      nowMs: Date.now(),
      timerConfig,
    });
    expect(stale.error?.code).toBe("STALE_PICK");
    expect(stale.effects).toHaveLength(0);
    expect(stale.state.currentOverall).toBe(6); // unchanged
  });

  it("two picks for the same player — second is PLAYER_TAKEN not STALE_PICK", () => {
    const order = generateSnakeOrder(["teamA", "teamB"], 4);
    const state = inProgressState({ order, currentOverall: 1 });

    const first = reduce(state, {
      kind: "MAKE_PICK",
      fantasyTeamId: "teamA",
      overall: 1,
      playerId: "sharedPlayer",
      playerExists: true,
      nowMs: Date.now(),
      timerConfig,
    });
    expect(first.error).toBeUndefined();

    // teamB picks the same player on overall 2
    const dupe = reduce(first.state, {
      kind: "MAKE_PICK",
      fantasyTeamId: "teamB",
      overall: 2,
      playerId: "sharedPlayer",
      playerExists: true,
      nowMs: Date.now(),
      timerConfig,
    });
    expect(dupe.error?.code).toBe("PLAYER_TAKEN");
  });
});

// ---------------------------------------------------------------------------
// B4. Commissioner resolution from league + teams data
// ---------------------------------------------------------------------------

describe("B4 — commissioner team resolution", () => {
  it("resolves commissionerTeamId from commissionerId matching ownerId", () => {
    const commissionerId = "user-commissioner";
    const teams = [
      { id: "team1", ownerId: "user-owner2", draftOrder: 2 },
      { id: "team2", ownerId: commissionerId, draftOrder: 1 },
      { id: "team3", ownerId: "user-owner3", draftOrder: 3 },
    ];

    // This mirrors the logic in buildEngineState
    const commissionerTeam = teams.find((t) => t.ownerId === commissionerId);
    const commissionerTeamId = commissionerTeam?.id ?? null;

    expect(commissionerTeamId).toBe("team2");
  });

  it("returns null when no team is owned by the commissioner", () => {
    const commissionerId = "user-commissioner";
    const teams = [
      { id: "team1", ownerId: "user-other", draftOrder: 1 },
    ];

    const commissionerTeam = teams.find((t) => t.ownerId === commissionerId);
    const commissionerTeamId = commissionerTeam?.id ?? null;

    expect(commissionerTeamId).toBeNull();
  });

  it("draft order sort produces correct snake sequence", () => {
    const teams = [
      { id: "team3", ownerId: "u3", draftOrder: 3 },
      { id: "team1", ownerId: "u1", draftOrder: 1 },
      { id: "team2", ownerId: "u2", draftOrder: 2 },
    ];

    // This mirrors the sort in buildEngineState
    const ordered = [...teams]
      .filter((t) => t.draftOrder != null)
      .sort((a, b) => a.draftOrder! - b.draftOrder!)
      .map((t) => t.id);

    expect(ordered).toEqual(["team1", "team2", "team3"]);

    const snake = generateSnakeOrder(ordered, 2);
    // Round 1: team1, team2, team3; Round 2: team3, team2, team1
    expect(snake.map((s) => s.fantasyTeamId)).toEqual([
      "team1", "team2", "team3",
      "team3", "team2", "team1",
    ]);
  });
});

// ---------------------------------------------------------------------------
// B5. Auto-pick stall detection (pure engine test)
// ---------------------------------------------------------------------------

describe("B5 — auto-pick stall detection", () => {
  it("TIMEOUT returns empty effects when queue is empty and bestAvailable is empty", () => {
    const state = inProgressState({ currentOverall: 1 });

    const result = reduce(state, {
      kind: "TIMEOUT",
      nowMs: Date.now(),
      timerConfig,
      bestAvailable: [], // nothing to pick
    });

    // Engine returns no effects — server.ts stall-detection branch must handle this
    expect(result.effects).toHaveLength(0);
    expect(result.state.status).toBe("IN_PROGRESS"); // draft not self-paused by engine
  });

  it("TIMEOUT returns empty effects when all bestAvailable players are already drafted", () => {
    const state = inProgressState({
      currentOverall: 2,
      draftedPlayerIds: new Set(["p1", "p2", "p3"]),
    });

    const result = reduce(state, {
      kind: "TIMEOUT",
      nowMs: Date.now(),
      timerConfig,
      bestAvailable: ["p1", "p2", "p3"], // all drafted
    });

    expect(result.effects).toHaveLength(0);
  });

  it("TIMEOUT uses queue over bestAvailable when queue player is available", () => {
    const state = inProgressState({
      currentOverall: 1,
      queues: new Map([["teamA", ["priority-player"]]]),
    });

    const result = reduce(state, {
      kind: "TIMEOUT",
      nowMs: Date.now(),
      timerConfig,
      bestAvailable: ["fallback-player"],
    });

    const pick = result.effects.find((e) => e.kind === "PERSIST_PICK") as
      | { kind: "PERSIST_PICK"; pick: CompletedPick }
      | undefined;
    expect(pick?.pick.playerId).toBe("priority-player");
  });

  it("TIMEOUT is ignored when draft is not IN_PROGRESS", () => {
    const state = inProgressState({ status: "PAUSED" });

    const result = reduce(state, {
      kind: "TIMEOUT",
      nowMs: Date.now(),
      timerConfig,
      bestAvailable: ["any-player"],
    });

    expect(result.effects).toHaveLength(0);
  });
});
