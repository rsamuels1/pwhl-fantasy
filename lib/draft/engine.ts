// lib/draft/engine.ts
// The draft state machine. Deliberately has NO websocket and NO database code —
// it's a pure reducer: (state, action) -> { state, effects }. The server layer
// (server.ts) carries out the effects (persist to DB, broadcast to clients) and
// owns the actual timer. This split is what makes the hard logic unit-testable.

import type { PickSlot } from "./snake";
import type { CompletedPick, DraftState, DraftErrorCode } from "./messages";

export interface EngineState {
  draftId: string;
  status: DraftState["status"];
  order: PickSlot[];
  currentOverall: number;
  expiresAt: number | null;
  completed: CompletedPick[];
  draftedPlayerIds: Set<string>;
  // Per-team pre-ranked queues for auto-pick. fantasyTeamId -> ordered playerIds.
  queues: Map<string, string[]>;
}

// Actions the engine understands. "TIMEOUT" is fired by the server's timer.
export type Action =
  | { kind: "START"; nowMs: number; pickTimerSecs: number }
  | {
      kind: "MAKE_PICK";
      fantasyTeamId: string;
      overall: number;
      playerId: string;
      nowMs: number;
      pickTimerSecs: number;
      playerExists: boolean;
    }
  | {
      kind: "TIMEOUT";
      nowMs: number;
      pickTimerSecs: number;
      // Ordered list of still-available players by default ranking, for fallback.
      bestAvailable: string[];
    }
  | { kind: "PAUSE" }
  | { kind: "RESUME"; nowMs: number; pickTimerSecs: number };

// Side-effects for the outer layer to perform. The engine never does IO itself.
export type Effect =
  | { kind: "PERSIST_PICK"; pick: CompletedPick }
  | { kind: "BROADCAST_PICK"; pick: CompletedPick }
  | { kind: "BROADCAST_STATE" }
  | { kind: "SCHEDULE_TIMER"; expiresAt: number }
  | { kind: "CLEAR_TIMER" }
  | { kind: "PERSIST_STATUS"; status: EngineState["status"] }
  | { kind: "COMPLETE" };

export interface EngineResult {
  state: EngineState;
  effects: Effect[];
  error?: { code: DraftErrorCode; message: string };
}

function slotFor(state: EngineState, overall: number): PickSlot | undefined {
  return state.order.find((s) => s.overall === overall);
}

// currentOverall is 1-based; order.length is the total pick count.
// When they're equal we're making the final pick. The >= guards against
// impossible out-of-bounds state without adding a separate assertion.
function isLastPick(state: EngineState): boolean {
  return state.currentOverall >= state.order.length;
}

// Apply a confirmed pick: record it, mark player taken, advance the clock.
function applyPick(
  state: EngineState,
  playerId: string,
  nowMs: number,
  pickTimerSecs: number,
  auto: boolean
): EngineResult {
  const slot = slotFor(state, state.currentOverall)!;
  const pick: CompletedPick = {
    overall: slot.overall,
    round: slot.round,
    fantasyTeamId: slot.fantasyTeamId,
    playerId,
    auto,
  };

  const drafted = new Set(state.draftedPlayerIds);
  drafted.add(playerId);

  const completed = [...state.completed, pick];
  const effects: Effect[] = [
    { kind: "PERSIST_PICK", pick },
    { kind: "BROADCAST_PICK", pick },
  ];

  if (isLastPick(state)) {
    const next: EngineState = {
      ...state,
      status: "COMPLETE",
      expiresAt: null,
      completed,
      draftedPlayerIds: drafted,
    };
    effects.push({ kind: "CLEAR_TIMER" }, { kind: "COMPLETE" });
    return { state: next, effects };
  }

  const expiresAt = nowMs + pickTimerSecs * 1000;
  const next: EngineState = {
    ...state,
    currentOverall: state.currentOverall + 1,
    expiresAt,
    completed,
    draftedPlayerIds: drafted,
  };
  effects.push({ kind: "SCHEDULE_TIMER", expiresAt });
  return { state: next, effects };
}

export function reduce(state: EngineState, action: Action): EngineResult {
  switch (action.kind) {
    case "START": {
      if (state.status !== "PENDING") {
        return {
          state,
          effects: [],
          error: { code: "DRAFT_NOT_ACTIVE", message: "Draft already started" },
        };
      }
      const expiresAt = action.nowMs + action.pickTimerSecs * 1000;
      const next: EngineState = {
        ...state,
        status: "IN_PROGRESS",
        currentOverall: 1,
        expiresAt,
      };
      return {
        state: next,
        effects: [
          { kind: "PERSIST_STATUS", status: "IN_PROGRESS" },
          { kind: "SCHEDULE_TIMER", expiresAt },
          { kind: "BROADCAST_STATE" },
        ],
      };
    }

    case "MAKE_PICK": {
      if (state.status !== "IN_PROGRESS") {
        return {
          state,
          effects: [],
          error: { code: "DRAFT_NOT_ACTIVE", message: "Draft is not active" },
        };
      }
      // Stale or out-of-turn: the overall they sent isn't the live pick.
      if (action.overall !== state.currentOverall) {
        return {
          state,
          effects: [],
          error: { code: "STALE_PICK", message: "That pick is no longer on the clock" },
        };
      }
      const slot = slotFor(state, state.currentOverall)!;
      if (slot.fantasyTeamId !== action.fantasyTeamId) {
        return {
          state,
          effects: [],
          error: { code: "NOT_YOUR_TURN", message: "It is not your turn to pick" },
        };
      }
      if (!action.playerExists) {
        return {
          state,
          effects: [],
          error: { code: "PLAYER_NOT_FOUND", message: "Unknown player" },
        };
      }
      if (state.draftedPlayerIds.has(action.playerId)) {
        return {
          state,
          effects: [],
          error: { code: "PLAYER_TAKEN", message: "Player already drafted" },
        };
      }
      return applyPick(
        state,
        action.playerId,
        action.nowMs,
        action.pickTimerSecs,
        false
      );
    }

    case "PAUSE": {
      if (state.status !== "IN_PROGRESS") {
        return {
          state,
          effects: [],
          error: { code: "DRAFT_NOT_ACTIVE", message: "Draft is not in progress" },
        };
      }
      const next: EngineState = { ...state, status: "PAUSED", expiresAt: null };
      return {
        state: next,
        effects: [
          { kind: "PERSIST_STATUS", status: "PAUSED" },
          { kind: "CLEAR_TIMER" },
          { kind: "BROADCAST_STATE" },
        ],
      };
    }

    case "RESUME": {
      if (state.status !== "PAUSED") {
        return {
          state,
          effects: [],
          error: { code: "DRAFT_NOT_ACTIVE", message: "Draft is not paused" },
        };
      }
      const expiresAt = action.nowMs + action.pickTimerSecs * 1000;
      const next: EngineState = { ...state, status: "IN_PROGRESS", expiresAt };
      return {
        state: next,
        effects: [
          { kind: "PERSIST_STATUS", status: "IN_PROGRESS" },
          { kind: "SCHEDULE_TIMER", expiresAt },
          { kind: "BROADCAST_STATE" },
        ],
      };
    }

    case "TIMEOUT": {
      if (state.status !== "IN_PROGRESS") {
        return { state, effects: [] }; // stale timer; ignore
      }
      const slot = slotFor(state, state.currentOverall)!;
      // Prefer the team's pre-ranked queue, skipping anyone already taken.
      const queue = state.queues.get(slot.fantasyTeamId) ?? [];
      const fromQueue = queue.find((id) => !state.draftedPlayerIds.has(id));
      const pickId =
        fromQueue ??
        action.bestAvailable.find((id) => !state.draftedPlayerIds.has(id));

      if (!pickId) {
        // No players left to auto-pick (shouldn't happen with a valid pool).
        return { state, effects: [] };
      }
      return applyPick(
        state,
        pickId,
        action.nowMs,
        action.pickTimerSecs,
        true
      );
    }
  }
}

export function toWireState(state: EngineState): DraftState {
  return {
    draftId: state.draftId,
    status: state.status,
    order: state.order,
    currentOverall: state.currentOverall,
    expiresAt: state.expiresAt,
    completed: state.completed,
    draftedPlayerIds: [...state.draftedPlayerIds],
  };
}
