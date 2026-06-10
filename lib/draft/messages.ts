// lib/draft/messages.ts
// The wire contract between draft server and clients.
//
// Clients send exactly ONE kind of intent: "I want to pick this player."
// (Plus lightweight queue/connection messages.) Everything else — whose turn it
// is, the clock, auto-picks — is decided by the server and pushed down as state.

import type { PickSlot } from "./snake";

// ---- Client -> Server ----

export type ClientMessage =
  | { type: "JOIN"; fantasyTeamId: string }
  | { type: "START" } // commissioner kicks off the draft
  | { type: "MAKE_PICK"; overall: number; playerId: string }
  | { type: "LIST_AVAILABLE"; search?: string } // ask for draftable players
  | { type: "SET_QUEUE"; playerIds: string[] } // pre-ranked auto-pick fallback
  | { type: "PAUSE" } // commissioner pauses the draft
  | { type: "RESUME" }; // commissioner resumes after a pause

// ---- Server -> Client ----

// A made pick, as broadcast to everyone.
export interface CompletedPick {
  overall: number;
  round: number;
  fantasyTeamId: string;
  playerId: string;
  auto: boolean; // true if the server auto-picked on timeout
}

// The full draft state. The server sends this on JOIN and after every change,
// so a client can render purely from it — no client-side derivation of turns.
export interface DraftState {
  draftId: string;
  status: "PENDING" | "IN_PROGRESS" | "PAUSED" | "COMPLETE";
  order: PickSlot[]; // the complete snake board
  currentOverall: number; // which pick is on the clock
  // Absolute epoch ms when the current pick auto-resolves. Clients derive their
  // countdown from this; they never run the authoritative clock.
  expiresAt: number | null;
  completed: CompletedPick[];
  draftedPlayerIds: string[];
  // Auto-escalation state — re-derived from pick history, broadcast so clients can render correctly.
  autoPickCounts: Record<string, number>; // consecutive auto picks per team
  autoFlaggedTeams: string[];             // teams currently on the reduced clock
}

export type ServerMessage =
  | { type: "STATE"; state: DraftState }
  | { type: "PICK_MADE"; pick: CompletedPick; state: DraftState }
  | { type: "AVAILABLE"; players: PlayerSummary[] }
  | { type: "ERROR"; code: DraftErrorCode; message: string };

export interface PlayerSummary {
  id: string;
  name: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  team: string | null; // PWHL team abbreviation
}

export type DraftErrorCode =
  | "NOT_YOUR_TURN"
  | "PLAYER_TAKEN"
  | "PLAYER_NOT_FOUND"
  | "DRAFT_NOT_ACTIVE"
  | "STALE_PICK"; // the overall they sent isn't the current pick anymore
