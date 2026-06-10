import { describe, it, expect } from "vitest";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { reduce, deriveAutoState, type EngineState } from "../lib/draft/engine";
import type { TimerConfig } from "../lib/draft/engine";

describe("generateSnakeOrder", () => {
  it("alternates direction each round", () => {
    const order = generateSnakeOrder(["A", "B", "C"], 2);
    expect(order.map((s) => s.fantasyTeamId)).toEqual([
      "A", "B", "C", // round 1 forward
      "C", "B", "A", // round 2 reverse
    ]);
  });

  it("numbers picks 1..N*R", () => {
    const order = generateSnakeOrder(["A", "B"], 3);
    expect(order.map((s) => s.overall)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(order[5].round).toBe(3);
  });

  it("throws on zero teams", () => {
    expect(() => generateSnakeOrder([], 5)).toThrow();
  });
});

describe("rostersToRounds", () => {
  it("sums all slot types", () => {
    expect(rostersToRounds({ forward: 3, defense: 2, goalie: 1, bench: 4 })).toBe(10);
  });
  it("throws when empty", () => {
    expect(() => rostersToRounds({})).toThrow();
  });
});

const timerConfig: TimerConfig = { baseSecs: 30, autoSecs: 10 };
const base = { nowMs: 1000, timerConfig };

function freshState(): EngineState {
  return {
    draftId: "d1",
    status: "PENDING",
    order: generateSnakeOrder(["A", "B"], 2),
    currentOverall: 1,
    expiresAt: null,
    completed: [],
    draftedPlayerIds: new Set(),
    queues: new Map(),
    autoPickCounts: new Map(),
    autoFlaggedTeams: new Set(),
  };
}

describe("draft engine", () => {
  it("starts and schedules a timer", () => {
    const r = reduce(freshState(), { kind: "START", ...base });
    expect(r.state.status).toBe("IN_PROGRESS");
    expect(r.effects.some((e) => e.kind === "SCHEDULE_TIMER")).toBe(true);
  });

  it("start schedules for baseSecs when team not flagged", () => {
    const r = reduce(freshState(), { kind: "START", ...base });
    const timer = r.effects.find((e) => e.kind === "SCHEDULE_TIMER") as { kind: "SCHEDULE_TIMER"; expiresAt: number };
    expect(timer.expiresAt).toBe(base.nowMs + timerConfig.baseSecs * 1000);
  });

  it("accepts a valid pick and advances the clock", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, {
      kind: "MAKE_PICK",
      fantasyTeamId: "A",
      overall: 1,
      playerId: "p1",
      playerExists: true,
      ...base,
    });
    expect(r.error).toBeUndefined();
    expect(r.state.currentOverall).toBe(2);
    expect(r.state.draftedPlayerIds.has("p1")).toBe(true);
    expect(r.effects.some((e) => e.kind === "PERSIST_PICK")).toBe(true);
  });

  it("rejects a pick from the wrong team", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, {
      kind: "MAKE_PICK",
      fantasyTeamId: "B", // A is on the clock
      overall: 1,
      playerId: "p1",
      playerExists: true,
      ...base,
    });
    expect(r.error?.code).toBe("NOT_YOUR_TURN");
    expect(r.state.currentOverall).toBe(1);
  });

  it("rejects an already-drafted player", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    s = reduce(s, {
      kind: "MAKE_PICK", fantasyTeamId: "A", overall: 1, playerId: "p1",
      playerExists: true, ...base,
    }).state;
    const r = reduce(s, {
      kind: "MAKE_PICK", fantasyTeamId: "B", overall: 2, playerId: "p1",
      playerExists: true, ...base,
    });
    expect(r.error?.code).toBe("PLAYER_TAKEN");
  });

  it("rejects a stale pick number", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, {
      kind: "MAKE_PICK", fantasyTeamId: "A", overall: 5, playerId: "p1",
      playerExists: true, ...base,
    });
    expect(r.error?.code).toBe("STALE_PICK");
  });

  it("auto-picks from the team queue on timeout", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    s.queues.set("A", ["q1", "q2"]);
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["x1"], ...base });
    const pick = r.state.completed[0];
    expect(pick.playerId).toBe("q1"); // queue beats bestAvailable
    expect(pick.auto).toBe(true);
    expect(r.state.currentOverall).toBe(2);
  });

  it("falls back to best available when queue is empty", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["x1"], ...base });
    expect(r.state.completed[0].playerId).toBe("x1");
  });

  it("rejects a second START", () => {
    const s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, { kind: "START", ...base });
    expect(r.error?.code).toBe("DRAFT_NOT_ACTIVE");
    expect(r.state.status).toBe("IN_PROGRESS");
  });

  it("timeout on the last pick completes the draft", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const turnOrder = ["A", "B", "B"];
    ["p1", "p2", "p3"].forEach((pid, i) => {
      s = reduce(s, {
        kind: "MAKE_PICK", fantasyTeamId: turnOrder[i], overall: i + 1,
        playerId: pid, playerExists: true, ...base,
      }).state;
    });
    expect(s.currentOverall).toBe(4);
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p4"], ...base });
    expect(r.state.status).toBe("COMPLETE");
    expect(r.effects.some((e) => e.kind === "COMPLETE")).toBe(true);
  });

  it("pauses and resumes the draft", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const paused = reduce(s, { kind: "PAUSE" });
    expect(paused.state.status).toBe("PAUSED");
    expect(paused.state.expiresAt).toBeNull();
    expect(paused.effects.some((e) => e.kind === "CLEAR_TIMER")).toBe(true);

    const resumed = reduce(paused.state, { kind: "RESUME", ...base });
    expect(resumed.state.status).toBe("IN_PROGRESS");
    // Team A (not flagged) gets baseSecs on resume.
    expect(resumed.state.expiresAt).toBe(base.nowMs + timerConfig.baseSecs * 1000);
    expect(resumed.effects.some((e) => e.kind === "SCHEDULE_TIMER")).toBe(true);
  });

  it("rejects a pick while paused", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    s = reduce(s, { kind: "PAUSE" }).state;
    const r = reduce(s, {
      kind: "MAKE_PICK", fantasyTeamId: "A", overall: 1,
      playerId: "p1", playerExists: true, ...base,
    });
    expect(r.error?.code).toBe("DRAFT_NOT_ACTIVE");
  });

  it("completes after the final pick", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const ids = ["p1", "p2", "p3", "p4"];
    const turnOrder = ["A", "B", "B", "A"]; // snake
    for (let i = 0; i < 4; i++) {
      s = reduce(s, {
        kind: "MAKE_PICK", fantasyTeamId: turnOrder[i], overall: i + 1,
        playerId: ids[i], playerExists: true, ...base,
      }).state;
    }
    expect(s.status).toBe("COMPLETE");
    expect(s.completed).toHaveLength(4);
  });
});

// ── Auto-escalation ───────────────────────────────────────────────────────────

describe("auto-escalation", () => {
  // Use a 4-pick draft: A, B, B, A (snake with 2 teams, 2 rounds)
  // Timeouts are easy to trigger — we just send TIMEOUT actions.

  it("manual pick keeps counter at 0 and timer at baseSecs", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, {
      kind: "MAKE_PICK", fantasyTeamId: "A", overall: 1,
      playerId: "p1", playerExists: true, ...base,
    });
    expect(r.state.autoPickCounts.get("A") ?? 0).toBe(0);
    expect(r.state.autoFlaggedTeams.has("A")).toBe(false);
    // Next pick is B's — B not flagged, so timer = baseSecs.
    const timer = r.effects.find((e) => e.kind === "SCHEDULE_TIMER") as { kind: "SCHEDULE_TIMER"; expiresAt: number };
    expect(timer.expiresAt).toBe(base.nowMs + timerConfig.baseSecs * 1000);
  });

  it("first timeout increments counter to 1 — not yet flagged", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p1"], ...base });
    expect(r.state.autoPickCounts.get("A")).toBe(1);
    expect(r.state.autoFlaggedTeams.has("A")).toBe(false);
  });

  it("second consecutive timeout sets auto flag", () => {
    // A times out on pick 1 (overall 1), then B picks, then A times out again on pick 4.
    // Snake order: A(1), B(2), B(3), A(4)
    // For simplicity use a 3-round 2-team board so A gets picks 1, 4, 5.
    const order = generateSnakeOrder(["A", "B"], 3); // 6 picks: A B B A A B
    let s: EngineState = {
      ...freshState(),
      order,
    };
    s = reduce(s, { kind: "START", ...base }).state;
    // Pick 1 (A): timeout
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p1"], ...base }).state;
    expect(s.autoPickCounts.get("A")).toBe(1);
    // Pick 2 (B): manual
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 2, playerId: "p2", playerExists: true, ...base }).state;
    // Pick 3 (B): manual
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 3, playerId: "p3", playerExists: true, ...base }).state;
    // Pick 4 (A): timeout — 2nd consecutive auto for A
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p4"], ...base });
    expect(r.state.autoPickCounts.get("A")).toBe(2);
    expect(r.state.autoFlaggedTeams.has("A")).toBe(true);
  });

  it("flagged team gets autoSecs timer", () => {
    const order = generateSnakeOrder(["A", "B"], 3);
    let s: EngineState = { ...freshState(), order };
    s = reduce(s, { kind: "START", ...base }).state;
    // Two consecutive timeouts for A (picks 1 and 4).
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p1"], ...base }).state; // A auto-pick 1
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 2, playerId: "p2", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 3, playerId: "p3", playerExists: true, ...base }).state;
    // Pick 4 is A's second consecutive auto — after this, pick 5 is A's and should get autoSecs.
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p4"], ...base }); // A now flagged
    expect(r.state.autoFlaggedTeams.has("A")).toBe(true);
    // Pick 5 is A again (snake: A B B A A B). The scheduled timer should be autoSecs.
    const timer = r.effects.find((e) => e.kind === "SCHEDULE_TIMER") as { kind: "SCHEDULE_TIMER"; expiresAt: number } | undefined;
    expect(timer?.expiresAt).toBe(base.nowMs + timerConfig.autoSecs * 1000);
  });

  it("manual pick during 10s window clears flag and restores baseSecs", () => {
    const order = generateSnakeOrder(["A", "B"], 3);
    let s: EngineState = { ...freshState(), order };
    s = reduce(s, { kind: "START", ...base }).state;
    // Flag A via two auto-picks.
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p1"], ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 2, playerId: "p2", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 3, playerId: "p3", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p4"], ...base }).state; // A flagged after this
    expect(s.autoFlaggedTeams.has("A")).toBe(true);

    // Pick 5 (A, flagged): A makes a manual pick within the 10s window.
    const r = reduce(s, {
      kind: "MAKE_PICK", fantasyTeamId: "A", overall: 5, playerId: "p5", playerExists: true, ...base,
    });
    expect(r.error).toBeUndefined();
    expect(r.state.autoFlaggedTeams.has("A")).toBe(false);
    expect(r.state.autoPickCounts.get("A")).toBe(0);
    // Pick 6 is B (not flagged) — timer should be baseSecs.
    const timer = r.effects.find((e) => e.kind === "SCHEDULE_TIMER") as { kind: "SCHEDULE_TIMER"; expiresAt: number } | undefined;
    expect(timer?.expiresAt).toBe(base.nowMs + timerConfig.baseSecs * 1000);
  });

  it("flagged team staying flagged after another timeout continues at autoSecs", () => {
    const order = generateSnakeOrder(["A", "B"], 3);
    let s: EngineState = { ...freshState(), order };
    s = reduce(s, { kind: "START", ...base }).state;
    // Two autos to flag A.
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p1"], ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 2, playerId: "p2", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 3, playerId: "p3", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p4"], ...base }).state; // A flagged
    // Pick 5 (A flagged): third consecutive auto.
    const r = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p5"], ...base });
    expect(r.state.autoFlaggedTeams.has("A")).toBe(true);
    expect((r.state.autoPickCounts.get("A") ?? 0)).toBeGreaterThanOrEqual(3);
    // Counter keeps climbing but A stays flagged.
  });

  it("resume with a flagged team gives autoSecs clock", () => {
    const order = generateSnakeOrder(["A", "B"], 3);
    let s: EngineState = { ...freshState(), order };
    s = reduce(s, { kind: "START", ...base }).state;
    // Flag A.
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p1"], ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 2, playerId: "p2", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "MAKE_PICK", fantasyTeamId: "B", overall: 3, playerId: "p3", playerExists: true, ...base }).state;
    s = reduce(s, { kind: "TIMEOUT", bestAvailable: ["p4"], ...base }).state; // A flagged, now on pick 5 (A)
    // Pause, then resume — A is still on the clock and still flagged.
    s = reduce(s, { kind: "PAUSE" }).state;
    const r = reduce(s, { kind: "RESUME", ...base });
    expect(r.state.expiresAt).toBe(base.nowMs + timerConfig.autoSecs * 1000);
  });
});

// ── deriveAutoState (restart survival) ───────────────────────────────────────

describe("deriveAutoState", () => {
  it("returns empty state for no picks", () => {
    const { autoPickCounts, autoFlaggedTeams } = deriveAutoState([]);
    expect(autoPickCounts.size).toBe(0);
    expect(autoFlaggedTeams.size).toBe(0);
  });

  it("flag is set after two consecutive autos and survives rebuild", () => {
    const picks = [
      { overall: 1, round: 1, fantasyTeamId: "A", playerId: "p1", auto: true },
      { overall: 2, round: 1, fantasyTeamId: "B", playerId: "p2", auto: false },
      { overall: 3, round: 2, fantasyTeamId: "B", playerId: "p3", auto: false },
      { overall: 4, round: 2, fantasyTeamId: "A", playerId: "p4", auto: true },
    ];
    const { autoPickCounts, autoFlaggedTeams } = deriveAutoState(picks);
    expect(autoPickCounts.get("A")).toBe(2);
    expect(autoFlaggedTeams.has("A")).toBe(true);
    expect(autoPickCounts.get("B") ?? 0).toBe(0);
    expect(autoFlaggedTeams.has("B")).toBe(false);
  });

  it("manual pick after autos clears the flag", () => {
    const picks = [
      { overall: 1, round: 1, fantasyTeamId: "A", playerId: "p1", auto: true },
      { overall: 2, round: 1, fantasyTeamId: "B", playerId: "p2", auto: false },
      { overall: 3, round: 2, fantasyTeamId: "B", playerId: "p3", auto: false },
      { overall: 4, round: 2, fantasyTeamId: "A", playerId: "p4", auto: true }, // flagged
      { overall: 5, round: 3, fantasyTeamId: "A", playerId: "p5", auto: false }, // manual clears
    ];
    const { autoPickCounts, autoFlaggedTeams } = deriveAutoState(picks);
    expect(autoPickCounts.get("A")).toBe(0);
    expect(autoFlaggedTeams.has("A")).toBe(false);
  });

  it("counter increments monotonically through consecutive autos", () => {
    const picks = [
      { overall: 1, round: 1, fantasyTeamId: "A", playerId: "p1", auto: true },
      { overall: 4, round: 2, fantasyTeamId: "A", playerId: "p4", auto: true },
      { overall: 5, round: 3, fantasyTeamId: "A", playerId: "p5", auto: true },
    ];
    const { autoPickCounts } = deriveAutoState(picks);
    expect(autoPickCounts.get("A")).toBe(3);
  });
});
