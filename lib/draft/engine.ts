// lib/draft/engine.ts
// The draft state machine. Deliberately has NO websocket and NO database code —
// it's a pure reducer: (state, action) -> { state, effects }. The server layer
// (server.ts) carries out the effects (persist to DB, broadcast to clients) and
// owns the actual timer. This split is what makes the hard logic unit-testable.

import type { PickSlot } from "./snake";
import type { CompletedPick, DraftState, DraftErrorCode } from "./messages";

// Timer durations come from draft settings so they're tunable per-league.
export interface TimerConfig {
  baseSecs: number; // normal pick clock
  autoSecs: number; // reduced clock for flagged (auto-escalated) teams
}

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
  // Auto-escalation: re-derived from pick history on restart, so no extra persistence needed.
  autoPickCounts: Map<string, number>; // consecutive auto picks per team (resets on manual)
  autoFlaggedTeams: Set<string>;       // teams whose clock is reduced to autoSecs
}

// Actions the engine understands. "TIMEOUT" is fired by the server's timer.
export type Action =
  | { kind: "START"; nowMs: number; timerConfig: TimerConfig }
  | {
      kind: "MAKE_PICK";
      fantasyTeamId: string;
      overall: number;
      playerId: string;
      nowMs: number;
      timerConfig: TimerConfig;
      playerExists: boolean;
    }
  | {
      kind: "TIMEOUT";
      nowMs: number;
      timerConfig: TimerConfig;
      // Ordered list of still-available players by default ranking, for fallback.
      bestAvailable: string[];
    }
  | { kind: "PAUSE" }
  | { kind: "RESUME"; nowMs: number; timerConfig: TimerConfig };

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

function isLastPick(state: EngineState): boolean {
  return state.currentOverall >= state.order.length;
}

// How many seconds the timer should run for a given team's upcoming pick.
function timerSecsFor(teamId: string, flaggedTeams: Set<string>, config: TimerConfig): number {
  return flaggedTeams.has(teamId) ? config.autoSecs : config.baseSecs;
}

// Update auto-escalation counters and flags after a pick resolves.
// Returns new copies of the Maps/Sets — engine state is treated as immutable.
function updateAutoState(
  teamId: string,
  isAuto: boolean,
  counts: Map<string, number>,
  flagged: Set<string>
): { counts: Map<string, number>; flagged: Set<string> } {
  const newCounts = new Map(counts);
  const newFlagged = new Set(flagged);

  if (isAuto) {
    const next = (newCounts.get(teamId) ?? 0) + 1;
    newCounts.set(teamId, next);
    if (next >= 2) newFlagged.add(teamId);
  } else {
    // Manual pick: clear the counter and any flag
    newCounts.set(teamId, 0);
    newFlagged.delete(teamId);
  }

  return { counts: newCounts, flagged: newFlagged };
}

// Apply a confirmed pick: record it, advance the clock, update auto state.
function applyPick(
  state: EngineState,
  playerId: string,
  nowMs: number,
  timerConfig: TimerConfig,
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

  // Update auto-escalation state for the team that just picked.
  const { counts: newCounts, flagged: newFlagged } = updateAutoState(
    slot.fantasyTeamId,
    auto,
    state.autoPickCounts,
    state.autoFlaggedTeams
  );

  if (isLastPick(state)) {
    const next: EngineState = {
      ...state,
      status: "COMPLETE",
      expiresAt: null,
      completed,
      draftedPlayerIds: drafted,
      autoPickCounts: newCounts,
      autoFlaggedTeams: newFlagged,
    };
    effects.push({ kind: "CLEAR_TIMER" }, { kind: "COMPLETE" });
    return { state: next, effects };
  }

  // Timer duration for the NEXT team on the clock.
  const nextSlot = slotFor(state, state.currentOverall + 1)!;
  const nextSecs = timerSecsFor(nextSlot.fantasyTeamId, newFlagged, timerConfig);
  const expiresAt = nowMs + nextSecs * 1000;

  const next: EngineState = {
    ...state,
    currentOverall: state.currentOverall + 1,
    expiresAt,
    completed,
    draftedPlayerIds: drafted,
    autoPickCounts: newCounts,
    autoFlaggedTeams: newFlagged,
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
      // First team on the clock — use their timer duration.
      const firstSlot = slotFor(state, 1)!;
      const firstSecs = timerSecsFor(firstSlot.fantasyTeamId, state.autoFlaggedTeams, action.timerConfig);
      const expiresAt = action.nowMs + firstSecs * 1000;
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
      return applyPick(state, action.playerId, action.nowMs, action.timerConfig, false);
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
      // Honor the current team's flag state when resuming.
      const slot = slotFor(state, state.currentOverall)!;
      const secs = timerSecsFor(slot.fantasyTeamId, state.autoFlaggedTeams, action.timerConfig);
      const expiresAt = action.nowMs + secs * 1000;
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
      const queue = state.queues.get(slot.fantasyTeamId) ?? [];
      const fromQueue = queue.find((id) => !state.draftedPlayerIds.has(id));
      const pickId =
        fromQueue ??
        action.bestAvailable.find((id) => !state.draftedPlayerIds.has(id));

      if (!pickId) {
        return { state, effects: [] };
      }
      return applyPick(state, pickId, action.nowMs, action.timerConfig, true);
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
    autoPickCounts: Object.fromEntries(state.autoPickCounts),
    autoFlaggedTeams: [...state.autoFlaggedTeams],
  };
}

// Re-derive autoPickCounts and autoFlaggedTeams from the pick history.
// Call this in buildEngineState instead of persisting these separately.
export function deriveAutoState(
  completed: CompletedPick[]
): { autoPickCounts: Map<string, number>; autoFlaggedTeams: Set<string> } {
  let counts = new Map<string, number>();
  let flagged = new Set<string>();
  for (const pick of completed) {
    ({ counts, flagged } = updateAutoState(pick.fantasyTeamId, pick.auto, counts, flagged));
  }
  return { autoPickCounts: counts, autoFlaggedTeams: flagged };
}
