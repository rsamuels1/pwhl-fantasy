// tests/draft.test.ts
import { describe, it, expect } from "vitest";
import { generateSnakeOrder, rostersToRounds } from "../lib/draft/snake";
import { reduce, type EngineState } from "../lib/draft/engine";

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
  };
}

const base = { nowMs: 1000, pickTimerSecs: 90 };

describe("draft engine", () => {
  it("starts and schedules a timer", () => {
    const r = reduce(freshState(), { kind: "START", ...base });
    expect(r.state.status).toBe("IN_PROGRESS");
    expect(r.effects.some((e) => e.kind === "SCHEDULE_TIMER")).toBe(true);
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
    // Now B is on the clock (overall 2); try to take p1 again.
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
    expect(r.state.status).toBe("IN_PROGRESS"); // state unchanged
  });

  it("timeout on the last pick completes the draft", () => {
    let s = reduce(freshState(), { kind: "START", ...base }).state;
    // Make picks 1-3 manually; pick 4 (final) via timeout.
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
    expect(resumed.state.expiresAt).toBe(base.nowMs + base.pickTimerSecs * 1000);
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
    // 2 teams x 2 rounds = 4 picks total.
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
