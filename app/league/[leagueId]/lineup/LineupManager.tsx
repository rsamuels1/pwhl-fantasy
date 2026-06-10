"use client";

import { useState, useTransition } from "react";
import type { RosterSettings } from "@/lib/lineup";

export type SlotType = "FORWARD" | "DEFENSE" | "GOALIE" | "UTIL" | "BENCH" | "IR";

export interface RosterEntryRow {
  id: string;
  playerId: string;
  name: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  teamAbbr: string | null;
  active: boolean;
  slot: SlotType;
  lockedAt: string | null;
  eligibleSlots: SlotType[];
}

interface Props {
  leagueId: string;
  teamId: string;
  teamName: string;
  leagueName: string;
  initialRoster: RosterEntryRow[];
  rosterSettings: RosterSettings;
}

const ACTIVE_SLOTS: SlotType[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL"];

const SLOT_LABELS: Record<SlotType, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN", IR: "IR",
};

const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
};

const SLOT_COLORS: Record<SlotType, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
  UTIL: "#a78bfa", BENCH: "#64748b", IR: "#ef4444",
};

function buildActiveSeats(settings: RosterSettings): Array<{ slot: SlotType; index: number }> {
  const result: Array<{ slot: SlotType; index: number }> = [];
  for (const slot of ACTIVE_SLOTS) {
    const count = settings[slot.toLowerCase() as keyof RosterSettings] ?? 0;
    for (let i = 0; i < count; i++) result.push({ slot, index: i });
  }
  return result;
}

export default function LineupManager({
  leagueId, teamId, teamName, initialRoster, rosterSettings,
}: Props) {
  const [roster, setRoster] = useState<RosterEntryRow[]>(initialRoster);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = selectedId ? roster.find((p) => p.playerId === selectedId) ?? null : null;
  const activeSeats = buildActiveSeats(rosterSettings);
  const benchPlayers = roster.filter((p) => p.slot === "BENCH");
  const irPlayers = roster.filter((p) => p.slot === "IR");

  // Map each active seat to its occupying player (fill in order per slot type).
  const seatedActive: Array<{ slot: SlotType; index: number; player: RosterEntryRow | null }> = (() => {
    const bySlot: Record<string, RosterEntryRow[]> = {};
    for (const p of roster) {
      if (!ACTIVE_SLOTS.includes(p.slot)) continue;
      bySlot[p.slot] = bySlot[p.slot] ?? [];
      bySlot[p.slot].push(p);
    }
    const counts: Record<string, number> = {};
    return activeSeats.map(({ slot, index }) => {
      counts[slot] = counts[slot] ?? 0;
      const player = bySlot[slot]?.[counts[slot]] ?? null;
      counts[slot]++;
      return { slot, index, player };
    });
  })();

  async function moveTo(targetSlot: SlotType, targetPlayerId?: string) {
    if (!selected) return;
    // If clicking the same player or same slot, deselect.
    if (targetPlayerId === selected.playerId) { setSelectedId(null); return; }
    const newSlot = targetPlayerId
      ? roster.find((p) => p.playerId === targetPlayerId)?.slot ?? targetSlot
      : targetSlot;
    if (newSlot === selected.slot) { setSelectedId(null); return; }

    setError(null);
    const prev = roster;
    // Optimistic: move selected player to new slot; if swapping with another player, move them to selected's old slot.
    setRoster((r) => r.map((p) => {
      if (p.playerId === selected.playerId) return { ...p, slot: newSlot };
      if (targetPlayerId && p.playerId === targetPlayerId) return { ...p, slot: selected.slot };
      return p;
    }));
    setSelectedId(null);

    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, playerId: selected.playerId, slot: newSlot }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setRoster(prev);
        setError(data.error ?? "Failed to update lineup.");
      }
    });
  }

  function selectPlayer(playerId: string) {
    if (selectedId === playerId) { setSelectedId(null); return; }
    setSelectedId(playerId);
    setError(null);
  }

  // Can the selected player move to this slot?
  function canMoveTo(slot: SlotType): boolean {
    if (!selected) return false;
    return selected.eligibleSlots.includes(slot) && slot !== selected.slot;
  }

  // Is this specific seat a valid drop target for the selected player?
  function seatIsTarget(seatSlot: SlotType, occupant: RosterEntryRow | null): boolean {
    if (!selected) return false;
    if (occupant?.playerId === selected.playerId) return false;
    // Empty seat: can we fill this slot type?
    if (!occupant) return canMoveTo(seatSlot);
    // Occupied seat: is a swap valid? (selected can go to seatSlot AND occupant can go to selected.slot)
    return canMoveTo(seatSlot) && occupant.eligibleSlots.includes(selected.slot);
  }

  const activeCount = roster.filter((p) => ACTIVE_SLOTS.includes(p.slot)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{teamName}</h1>
        <span style={{ color: "#64748b", fontSize: 13 }}>
          {activeCount} active · {benchPlayers.length} bench
          {isPending && <span style={{ marginLeft: 10, color: "#60a5fa" }}>Saving…</span>}
        </span>
      </div>

      {selected && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
          fontSize: 13, color: "#a5b4fc",
        }}>
          <strong style={{ color: "#e2e8f0" }}>{selected.name}</strong> selected —
          click a highlighted slot to move them, or click them again to cancel.
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>

        {/* LEFT: Active slots */}
        <div style={panel}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>
            Active
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {seatedActive.map(({ slot, index, player }) => {
              const isTarget = seatIsTarget(slot, player);
              const isSelected = player?.playerId === selectedId;
              return (
                <div
                  key={`${slot}-${index}`}
                  onClick={() => {
                    if (isTarget && selected) {
                      moveTo(slot, player?.playerId);
                    } else if (player && !player.lockedAt) {
                      selectPlayer(player.playerId);
                    } else if (isTarget) {
                      moveTo(slot);
                    }
                  }}
                  style={{
                    display: "grid", gridTemplateColumns: "36px 1fr",
                    gap: 10, alignItems: "center",
                    padding: "9px 12px", borderRadius: 10,
                    border: `1px solid ${isTarget ? "rgba(99,102,241,0.5)" : isSelected ? "rgba(99,102,241,0.4)" : "rgba(148,163,184,0.1)"}`,
                    background: isTarget
                      ? "rgba(99,102,241,0.12)"
                      : isSelected
                      ? "rgba(99,102,241,0.08)"
                      : "rgba(255,255,255,0.04)",
                    cursor: (player && !player.lockedAt) || isTarget ? "pointer" : "default",
                    transition: "background 0.1s, border-color 0.1s",
                    outline: isTarget ? "1px solid rgba(99,102,241,0.3)" : "none",
                  }}
                >
                  <SlotBadge slot={slot} />
                  {player ? (
                    <PlayerInfo player={player} isSelected={isSelected} />
                  ) : (
                    <span style={{ color: isTarget ? "#a5b4fc" : "#475569", fontSize: 13, fontStyle: isTarget ? "normal" : "italic" }}>
                      {isTarget ? "Move here" : "Empty"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Bench + IR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={panel}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>
              Bench
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {benchPlayers.length === 0 && (
                <span style={{ color: "#475569", fontSize: 13, fontStyle: "italic" }}>Empty</span>
              )}
              {benchPlayers.map((player) => {
                const isSelected = player.playerId === selectedId;
                const isTarget = selected && selected.playerId !== player.playerId
                  && player.eligibleSlots.includes(selected.slot);
                return (
                  <div
                    key={player.playerId}
                    onClick={() => {
                      if (isTarget && selected) {
                        moveTo(player.slot, player.playerId);
                      } else {
                        selectPlayer(player.playerId);
                      }
                    }}
                    style={{
                      display: "grid", gridTemplateColumns: "36px 1fr",
                      gap: 10, alignItems: "center",
                      padding: "9px 12px", borderRadius: 10,
                      border: `1px solid ${isTarget ? "rgba(99,102,241,0.5)" : isSelected ? "rgba(99,102,241,0.4)" : "rgba(148,163,184,0.08)"}`,
                      background: isTarget
                        ? "rgba(99,102,241,0.1)"
                        : isSelected
                        ? "rgba(99,102,241,0.08)"
                        : "rgba(0,0,0,0.12)",
                      cursor: "pointer",
                      transition: "background 0.1s, border-color 0.1s",
                    }}
                  >
                    <SlotBadge slot="BENCH" />
                    <PlayerInfo player={player} isSelected={isSelected} />
                  </div>
                );
              })}
            </div>
          </div>

          {(rosterSettings.ir ?? 0) > 0 && (
            <div style={panel}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", textTransform: "uppercase", marginBottom: 12 }}>
                IR
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {irPlayers.length === 0 && (
                  <span style={{ color: "#475569", fontSize: 13, fontStyle: "italic" }}>Empty — IR for inactive players only</span>
                )}
                {irPlayers.map((player) => {
                  const isSelected = player.playerId === selectedId;
                  return (
                    <div
                      key={player.playerId}
                      onClick={() => selectPlayer(player.playerId)}
                      style={{
                        display: "grid", gridTemplateColumns: "36px 1fr",
                        gap: 10, alignItems: "center",
                        padding: "9px 12px", borderRadius: 10,
                        border: `1px solid ${isSelected ? "rgba(99,102,241,0.4)" : "rgba(239,68,68,0.15)"}`,
                        background: isSelected ? "rgba(99,102,241,0.08)" : "rgba(239,68,68,0.05)",
                        cursor: "pointer",
                      }}
                    >
                      <SlotBadge slot="IR" />
                      <PlayerInfo player={player} isSelected={isSelected} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deselect hint */}
      {selected && (
        <button
          onClick={() => setSelectedId(null)}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          ✕ Cancel selection
        </button>
      )}
    </div>
  );
}

function SlotBadge({ slot }: { slot: SlotType }) {
  const color = SLOT_COLORS[slot];
  const isActive = ACTIVE_SLOTS.includes(slot);
  return (
    <span style={{
      display: "inline-block", textAlign: "center",
      fontSize: 11, fontWeight: 700, padding: "3px 5px", borderRadius: 6,
      background: isActive ? `${color}22` : "rgba(148,163,184,0.08)",
      color: isActive ? color : "#64748b",
      minWidth: 28,
    }}>
      {SLOT_LABELS[slot]}
    </span>
  );
}

function PlayerInfo({ player, isSelected }: { player: RosterEntryRow; isSelected: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
      <span style={{
        fontWeight: 600, fontSize: 14,
        color: isSelected ? "#e2e8f0" : "#cbd5e1",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {player.name}
      </span>
      <span style={{ fontSize: 11, color: POS_COLORS[player.position], flexShrink: 0 }}>
        {player.position[0]}
      </span>
      {player.teamAbbr && (
        <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>{player.teamAbbr}</span>
      )}
      {!player.active && (
        <span style={{ fontSize: 10, color: "#ef4444", background: "rgba(239,68,68,0.12)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>
          INJ
        </span>
      )}
      {player.lockedAt && (
        <span title={`Locked — game started ${new Date(player.lockedAt).toLocaleTimeString()}`} style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148,163,184,0.1)",
  borderRadius: 14,
  padding: 16,
};
