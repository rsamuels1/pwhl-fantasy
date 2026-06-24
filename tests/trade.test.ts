import { describe, it, expect } from "vitest";
import {
  validateTradeProposal,
  validateTradeExecution,
  applyTrade,
  canTransitionTo,
  type TradeItemInput,
  type TradableRosterEntry,
} from "../lib/trades/engine";
import type { RosterSettings } from "../lib/lineup";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const settings: RosterSettings = {
  forward: 3,
  defense: 2,
  goalie: 1,
  util: 1,
  bench: 6,
};

function makeRoster(
  teamId: string,
  overrides: Partial<TradableRosterEntry>[] = []
): TradableRosterEntry[] {
  const defaults: TradableRosterEntry[] = [
    // 3 active forwards
    { playerId: `${teamId}-f1`, slot: "FORWARD", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-f2`, slot: "FORWARD", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-f3`, slot: "FORWARD", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    // 2 defense
    { playerId: `${teamId}-d1`, slot: "DEFENSE", position: "DEFENSE", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-d2`, slot: "DEFENSE", position: "DEFENSE", active: true, hasPlayedThisPeriod: false },
    // 1 goalie
    { playerId: `${teamId}-g1`, slot: "GOALIE", position: "GOALIE", active: true, hasPlayedThisPeriod: false },
    // 1 util
    { playerId: `${teamId}-u1`, slot: "UTIL", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    // 6 bench
    { playerId: `${teamId}-b1`, slot: "BENCH", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-b2`, slot: "BENCH", position: "DEFENSE", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-b3`, slot: "BENCH", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-b4`, slot: "BENCH", position: "FORWARD", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-b5`, slot: "BENCH", position: "GOALIE", active: true, hasPlayedThisPeriod: false },
    { playerId: `${teamId}-b6`, slot: "BENCH", position: "DEFENSE", active: true, hasPlayedThisPeriod: false },
  ];
  // Apply any overrides by playerId
  return defaults.map((p) => {
    const override = overrides.find((o) => o.playerId === p.playerId);
    return override ? { ...p, ...override } : p;
  });
}

// ── canTransitionTo ───────────────────────────────────────────────────────────

describe("canTransitionTo", () => {
  it("receiver can accept PROPOSED", () => {
    expect(canTransitionTo("PROPOSED", "ACCEPTED", "receiver")).toBe(true);
  });

  it("receiver can reject PROPOSED", () => {
    expect(canTransitionTo("PROPOSED", "REJECTED", "receiver")).toBe(true);
  });

  it("receiver can counter PROPOSED", () => {
    expect(canTransitionTo("PROPOSED", "COUNTERED", "receiver")).toBe(true);
  });

  it("proposer can cancel PROPOSED", () => {
    expect(canTransitionTo("PROPOSED", "CANCELLED", "proposer")).toBe(true);
  });

  it("proposer cannot accept their own trade", () => {
    expect(canTransitionTo("PROPOSED", "ACCEPTED", "proposer")).toBe(false);
  });

  it("proposer can move PROPOSED to PENDING_REVIEW (auto-transition for requireCommissionerTradeApproval)", () => {
    expect(canTransitionTo("PROPOSED", "PENDING_REVIEW", "proposer")).toBe(true);
  });

  it("commissioner can move PROPOSED to PENDING_REVIEW", () => {
    expect(canTransitionTo("PROPOSED", "PENDING_REVIEW", "commissioner")).toBe(true);
  });

  it("receiver cannot move PROPOSED to PENDING_REVIEW", () => {
    expect(canTransitionTo("PROPOSED", "PENDING_REVIEW", "receiver")).toBe(false);
  });

  it("commissioner can execute ACCEPTED", () => {
    expect(canTransitionTo("ACCEPTED", "EXECUTED", "commissioner")).toBe(true);
  });

  it("commissioner can veto PENDING_REVIEW", () => {
    expect(canTransitionTo("PENDING_REVIEW", "REVERSED", "commissioner")).toBe(true);
  });

  it("commissioner can approve PENDING_REVIEW", () => {
    expect(canTransitionTo("PENDING_REVIEW", "EXECUTED", "commissioner")).toBe(true);
  });

  it("no transitions from terminal states", () => {
    expect(canTransitionTo("EXECUTED", "PROPOSED", "commissioner")).toBe(false);
    expect(canTransitionTo("REJECTED", "PROPOSED", "receiver")).toBe(false);
    expect(canTransitionTo("CANCELLED", "PROPOSED", "proposer")).toBe(false);
    expect(canTransitionTo("EXPIRED", "PROPOSED", "commissioner")).toBe(false);
  });
});

// ── validateTradeProposal ────────────────────────────────────────────────────

describe("validateTradeProposal", () => {
  it("accepts a valid 1-for-1 forward trade", () => {
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");

    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];

    const result = validateTradeProposal(items, propRoster, recRoster, settings);
    expect(result.valid).toBe(true);
  });

  it("rejects empty items", () => {
    const result = validateTradeProposal([], makeRoster("A"), makeRoster("B"), settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/at least one/i);
  });

  it("rejects when proposing team sends nothing", () => {
    const items: TradeItemInput[] = [
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];
    const result = validateTradeProposal(items, makeRoster("A"), makeRoster("B"), settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/proposing team must include/i);
  });

  it("rejects when receiving team sends nothing", () => {
    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
    ];
    const result = validateTradeProposal(items, makeRoster("A"), makeRoster("B"), settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/receiving team must include/i);
  });

  it("returns STALE when a player is not on either roster", () => {
    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "GHOST-PLAYER" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];
    const result = validateTradeProposal(items, makeRoster("A"), makeRoster("B"), settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("STALE");
  });

  it("rejects play-locked player in active slot", () => {
    const propRoster = makeRoster("A", [
      { playerId: "A-f1", hasPlayedThisPeriod: true },
    ]);
    const recRoster = makeRoster("B");

    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-f1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];

    const result = validateTradeProposal(items, propRoster, recRoster, settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/active scoring period/i);
  });

  it("rejects trade that would leave proposing team over BENCH capacity", () => {
    // Team A gives 1 bench player, receives 2 bench players → BENCH over capacity
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");

    // Add an extra bench player to team B's roster
    recRoster.push({
      playerId: "B-b7",
      slot: "BENCH",
      position: "FORWARD",
      active: true,
      hasPlayedThisPeriod: false,
    });

    // A sends b1, receives b1 and b7 → net +1 on BENCH
    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b7" },
    ];

    const result = validateTradeProposal(items, propRoster, recRoster, settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/maximum/i);
  });

  it("accepts a multi-player trade that stays within capacity", () => {
    // 2-for-2 bench trade — net zero on both sides
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");

    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b2" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b2" },
    ];

    const result = validateTradeProposal(items, propRoster, recRoster, settings);
    expect(result.valid).toBe(true);
  });
});

// ── validateTradeExecution ───────────────────────────────────────────────────

describe("validateTradeExecution", () => {
  it("re-validates and catches a stale deal", () => {
    const propRoster = makeRoster("A");
    // Player A-b1 was dropped — no longer on either roster
    const modifiedPropRoster = propRoster.filter((e) => e.playerId !== "A-b1");
    const recRoster = makeRoster("B");

    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];

    const result = validateTradeExecution(items, modifiedPropRoster, recRoster, settings);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("STALE");
  });

  it("passes when trade is still valid at execution time", () => {
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");
    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];
    const result = validateTradeExecution(items, propRoster, recRoster, settings);
    expect(result.valid).toBe(true);
  });
});

// ── applyTrade ───────────────────────────────────────────────────────────────

describe("applyTrade", () => {
  it("moves players to BENCH on both teams", () => {
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");
    const items: TradeItemInput[] = [
      // A sends their active forward to B
      { fromTeamId: "A", toTeamId: "B", playerId: "A-f1" },
      // B sends their bench player to A
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
    ];

    const { proposingRoster: newProp, receivingRoster: newRec } = applyTrade(
      items,
      propRoster,
      recRoster
    );

    // A-f1 should no longer be on A's roster
    expect(newProp.some((e) => e.playerId === "A-f1")).toBe(false);
    // B-b1 should be on A's roster, on BENCH
    const bPlayer = newProp.find((e) => e.playerId === "B-b1");
    expect(bPlayer).toBeDefined();
    expect(bPlayer?.slot).toBe("BENCH");

    // B-b1 should no longer be on B's roster
    expect(newRec.some((e) => e.playerId === "B-b1")).toBe(false);
    // A-f1 should be on B's roster, on BENCH
    const aPlayer = newRec.find((e) => e.playerId === "A-f1");
    expect(aPlayer).toBeDefined();
    expect(aPlayer?.slot).toBe("BENCH");
  });

  it("correctly handles 2-for-2 trade", () => {
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");
    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b1" },
      { fromTeamId: "A", toTeamId: "B", playerId: "A-b2" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b1" },
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b2" },
    ];

    const { proposingRoster: newProp, receivingRoster: newRec } = applyTrade(
      items,
      propRoster,
      recRoster
    );

    // Roster sizes should be preserved
    expect(newProp.length).toBe(propRoster.length);
    expect(newRec.length).toBe(recRoster.length);

    // Traded players end up on BENCH on the other team
    const bPlayersOnA = newProp.filter((e) => e.playerId === "B-b1" || e.playerId === "B-b2");
    expect(bPlayersOnA.every((e) => e.slot === "BENCH")).toBe(true);

    const aPlayersOnB = newRec.filter((e) => e.playerId === "A-b1" || e.playerId === "A-b2");
    expect(aPlayersOnB.every((e) => e.slot === "BENCH")).toBe(true);
  });

  it("preserves position metadata on traded players", () => {
    const propRoster = makeRoster("A");
    const recRoster = makeRoster("B");
    const items: TradeItemInput[] = [
      { fromTeamId: "A", toTeamId: "B", playerId: "A-g1" }, // goalie
      { fromTeamId: "B", toTeamId: "A", playerId: "B-b5" }, // goalie on bench
    ];

    const { proposingRoster: newProp, receivingRoster: newRec } = applyTrade(
      items,
      propRoster,
      recRoster
    );

    const goalieOnB = newRec.find((e) => e.playerId === "A-g1");
    expect(goalieOnB?.position).toBe("GOALIE");
    expect(goalieOnB?.slot).toBe("BENCH");
  });
});
