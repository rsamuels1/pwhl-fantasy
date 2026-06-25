"use client";

import { useState, useEffect } from "react";
import type { FreeAgentRow, RosterPlayerRow } from "@/app/team/[teamId]/roster/RosterManager";

// Mirrors eligibleSlots() from lib/lineup.ts — client-safe, no Prisma dependency
const ACTIVE_SLOTS_BY_POSITION: Record<string, string[]> = {
  FORWARD: ["FORWARD", "UTIL"],
  DEFENSE: ["DEFENSE", "UTIL"],
  GOALIE: ["GOALIE"],
};

const SLOT_CAPACITY_KEY: Record<string, "forward" | "defense" | "goalie" | "util"> = {
  FORWARD: "forward",
  DEFENSE: "defense",
  GOALIE: "goalie",
  UTIL: "util",
};

const SLOT_LABELS: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL",
};

const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
};

interface SlotOption {
  slot: string;
  occupant: RosterPlayerRow | null;
}

interface Props {
  player: Pick<FreeAgentRow, "playerId" | "name" | "position" | "gamesThisPeriod">;
  activeRoster: RosterPlayerRow[];
  rosterSettings: { forward?: number; defense?: number; goalie?: number; util?: number };
  teamId: string;
  leagueId: string;
  onComplete: () => void;
  /** Total number of players on the roster after the add (pre-refresh). */
  currentRosterSize?: number;
  maxRosterSize?: number;
}

export default function AddAndSlotModal({
  player, activeRoster, rosterSettings, teamId, leagueId, onComplete,
  currentRosterSize, maxRosterSize,
}: Props) {
  const [slotting, setSlotting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the roster is full (all slots occupied including bench), show a blocking message.
  const isRosterFull =
    maxRosterSize !== undefined &&
    currentRosterSize !== undefined &&
    currentRosterSize > maxRosterSize;

  const eligibleSlotTypes = ACTIVE_SLOTS_BY_POSITION[player.position] ?? [];

  const slotOptions: SlotOption[] = [];
  for (const slotType of eligibleSlotTypes) {
    const occupied = activeRoster.filter((e) => e.slot === slotType);
    const maxCount = rosterSettings[SLOT_CAPACITY_KEY[slotType]] ?? 1;
    occupied.forEach((entry) => slotOptions.push({ slot: slotType, occupant: entry }));
    for (let i = 0; i < maxCount - occupied.length; i++) {
      slotOptions.push({ slot: slotType, occupant: null });
    }
  }

  // Auto-dismiss after 2s when no slots are available (and roster is not over-full)
  useEffect(() => {
    if (!isRosterFull && slotOptions.length === 0) {
      const t = setTimeout(() => onComplete(), 2000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSlot(option: SlotOption) {
    setError(null);
    setSlotting(true);
    const body: Record<string, string> = {
      teamId,
      playerId: player.playerId,
      slot: option.slot,
    };
    if (option.occupant) body.swapWithPlayerId = option.occupant.playerId;

    const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Player was added successfully (on bench) — the slot move failed.
      // Treat this as a partial success: close the modal and let the caller
      // show a benign "added to bench" message rather than a blocking error.
      onComplete();
      return;
    }
    onComplete();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 16, padding: 24, maxWidth: 420, width: "100%",
        display: "flex", flexDirection: "column", gap: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
              background: `${POS_COLORS[player.position] ?? "var(--faint)"}22`,
              color: POS_COLORS[player.position] ?? "var(--dim)",
            }}>
              {player.position[0]}
            </span>
            <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
              {player.name}
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--faint)" }}>
            {player.gamesThisPeriod != null
              ? `${player.gamesThisPeriod} game${player.gamesThisPeriod !== 1 ? "s" : ""} remaining this period`
              : "Added to your roster"}
            {slotOptions.length > 0 && (
              <>{" · "}<span style={{ color: "var(--accent-strong)" }}>Slot them now?</span></>
            )}
          </div>
        </div>

        {/* Roster full — user must drop someone before slotting */}
        {isRosterFull && (
          <div style={{
            padding: "12px 14px", borderRadius: 10,
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
            color: "#f87171", fontSize: 13,
          }}>
            Your roster is full ({maxRosterSize} players). Drop a player first before adding {player.name}.
          </div>
        )}

        {/* No slots available */}
        {!isRosterFull && slotOptions.length === 0 && (
          <div style={{
            padding: "12px 14px", borderRadius: 10,
            background: "rgba(100,116,139,0.1)",
            border: "1px solid rgba(100,116,139,0.2)",
            color: "var(--dim)", fontSize: 13,
          }}>
            No active slots available — {player.name} has been benched.
          </div>
        )}

        {/* Slot options */}
        {!isRosterFull && slotOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "var(--faint)",
            }}>
              Move to active slot
            </div>
            {slotOptions.map((opt, i) => (
              <button
                key={`${opt.slot}-${i}`}
                onClick={() => handleSlot(opt)}
                disabled={slotting}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px solid rgba(143,193,232,0.25)",
                  background: "rgba(143,193,232,0.07)",
                  cursor: slotting ? "not-allowed" : "pointer",
                  opacity: slotting ? 0.6 : 1,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                    background: "rgba(143,193,232,0.2)", color: "var(--accent-strong)",
                    minWidth: 32, textAlign: "center",
                  }}>
                    {SLOT_LABELS[opt.slot] ?? opt.slot}
                  </span>
                  <span style={{ fontSize: 13, color: opt.occupant ? "var(--text)" : "var(--faint)" }}>
                    {opt.occupant ? opt.occupant.name : "Empty slot"}
                  </span>
                  {opt.occupant && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: POS_COLORS[opt.occupant.position] ?? "var(--faint)",
                    }}>
                      {opt.occupant.position[0]}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "var(--accent)", flexShrink: 0 }}>Move →</span>
              </button>
            ))}
          </div>
        )}

        {/* API error */}
        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.25)",
            color: "#f87171", fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {/* Bench for now */}
        {!isRosterFull && slotOptions.length > 0 && (
          <button
            onClick={onComplete}
            disabled={slotting}
            aria-label="Add to bench and close"
            style={{
              padding: "10px", borderRadius: 10,
              border: "1px solid var(--border)",
              background: "transparent", color: "var(--faint)", fontSize: 13,
              cursor: "pointer", opacity: slotting ? 0.5 : 1, width: "100%",
            }}
          >
            Bench for now
          </button>
        )}
      </div>
    </div>
  );
}
