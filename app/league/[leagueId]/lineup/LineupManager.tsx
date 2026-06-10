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

// Build the ordered list of slot "seats" from rosterSettings.
// Returns [{slot, index}] in display order: active slots first, then bench, then IR.
function buildSlotSeats(settings: RosterSettings): Array<{ slot: SlotType; index: number }> {
  const order: SlotType[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL", "BENCH", "IR"];
  const result: Array<{ slot: SlotType; index: number }> = [];
  for (const slot of order) {
    const key = slot.toLowerCase() as keyof RosterSettings;
    const count = settings[key] ?? 0;
    for (let i = 0; i < count; i++) result.push({ slot, index: i });
  }
  return result;
}

const SLOT_LABELS: Record<SlotType, string> = {
  FORWARD: "F",
  DEFENSE: "D",
  GOALIE: "G",
  UTIL: "UTIL",
  BENCH: "BN",
  IR: "IR",
};

const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa",
  DEFENSE: "#34d399",
  GOALIE: "#f59e0b",
};

export default function LineupManager({
  leagueId, teamId, teamName, initialRoster, rosterSettings,
}: Props) {
  const [roster, setRoster] = useState<RosterEntryRow[]>(initialRoster);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const seats = buildSlotSeats(rosterSettings);

  // Find the player assigned to a given seat (slot + index).
  // Since multiple seats can share a slot, we fill them in order of roster.
  function getSeatedRoster(): Array<{ slot: SlotType; index: number; player: RosterEntryRow | null }> {
    // Group players by slot
    const bySlot: Record<string, RosterEntryRow[]> = {};
    for (const p of roster) {
      bySlot[p.slot] = bySlot[p.slot] ?? [];
      bySlot[p.slot].push(p);
    }
    const counts: Record<string, number> = {};
    return seats.map(({ slot, index }) => {
      counts[slot] = counts[slot] ?? 0;
      const player = bySlot[slot]?.[counts[slot]] ?? null;
      counts[slot]++;
      return { slot, index, player };
    });
  }

  async function movePlayer(playerId: string, newSlot: SlotType) {
    const player = roster.find((p) => p.playerId === playerId);
    if (!player || player.slot === newSlot) return;

    // Optimistic update
    const prev = roster;
    setRoster((r) => r.map((p) => p.playerId === playerId ? { ...p, slot: newSlot } : p));
    setErrors((e) => { const n = { ...e }; delete n[playerId]; return n; });

    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, playerId, slot: newSlot }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setRoster(prev);
        setErrors((e) => ({ ...e, [playerId]: data.error ?? "Failed to update lineup." }));
      }
    });
  }

  const seated = getSeatedRoster();
  const activeSlots: SlotType[] = ["FORWARD", "DEFENSE", "GOALIE", "UTIL"];
  const activePlayers = roster.filter((p) => activeSlots.includes(p.slot));
  const benchPlayers = roster.filter((p) => p.slot === "BENCH");
  const irPlayers = roster.filter((p) => p.slot === "IR");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>{teamName} — Lineup</h1>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>
            {activePlayers.length} active · {benchPlayers.length} bench · {irPlayers.length} IR
            {isPending && <span style={{ marginLeft: 8, color: "#60a5fa" }}>Saving…</span>}
          </p>
        </div>
      </div>

      {/* Active + Bench table */}
      <div style={panel}>
        <h2 style={{ fontSize: 15, marginBottom: 14, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Active Roster</h2>
        <div style={{ display: "grid", gap: 6 }}>
          {seated.filter(({ slot }) => slot !== "IR").map(({ slot, index, player }) => (
            <SeatRow
              key={`${slot}-${index}`}
              slot={slot}
              player={player}
              roster={roster}
              rosterSettings={rosterSettings}
              error={player ? errors[player.playerId] : undefined}
              onMove={movePlayer}
            />
          ))}
        </div>
      </div>

      {/* IR */}
      {(rosterSettings.ir ?? 0) > 0 && (
        <div style={panel}>
          <h2 style={{ fontSize: 15, marginBottom: 14, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Injured Reserve</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {seated.filter(({ slot }) => slot === "IR").map(({ slot, index, player }) => (
              <SeatRow
                key={`IR-${index}`}
                slot={slot}
                player={player}
                roster={roster}
                rosterSettings={rosterSettings}
                error={player ? errors[player.playerId] : undefined}
                onMove={movePlayer}
              />
            ))}
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
            IR slots are only available for inactive players.
          </p>
        </div>
      )}
    </div>
  );
}

interface SeatRowProps {
  slot: SlotType;
  player: RosterEntryRow | null;
  roster: RosterEntryRow[];
  rosterSettings: RosterSettings;
  error?: string;
  onMove: (playerId: string, slot: SlotType) => void;
}

function SeatRow({ slot, player, roster, error, onMove }: SeatRowProps) {
  const isActive = !["BENCH", "IR"].includes(slot);
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr auto",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          background: isActive ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.15)",
          border: `1px solid ${isActive ? "rgba(148,163,184,0.1)" : "rgba(148,163,184,0.06)"}`,
          borderRadius: 10,
        }}
      >
        {/* Slot badge */}
        <span
          style={{
            fontSize: 11, fontWeight: 700, textAlign: "center",
            padding: "2px 5px", borderRadius: 6,
            background: isActive ? "rgba(96,165,250,0.15)" : "rgba(148,163,184,0.1)",
            color: isActive ? "#60a5fa" : "#64748b",
          }}
        >
          {SLOT_LABELS[slot]}
        </span>

        {/* Player info */}
        {player ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {player.name}
              </span>
              <span style={{ fontSize: 11, color: POS_COLORS[player.position] ?? "#94a3b8", flexShrink: 0 }}>
                {player.position[0]}
              </span>
              {player.teamAbbr && (
                <span style={{ fontSize: 11, color: "#64748b", flexShrink: 0 }}>{player.teamAbbr}</span>
              )}
              {!player.active && (
                <span style={{ fontSize: 10, color: "#ef4444", background: "rgba(239,68,68,0.12)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>
                  INJ
                </span>
              )}
              {player.lockedAt && (
                <span title={`Game started ${new Date(player.lockedAt).toLocaleTimeString()}`} style={{ fontSize: 12, flexShrink: 0 }}>
                  🔒
                </span>
              )}
            </div>
          </div>
        ) : (
          <span style={{ color: "#475569", fontSize: 13, fontStyle: "italic" }}>Empty</span>
        )}

        {/* Slot selector */}
        {player && (
          <select
            value={player.slot}
            disabled={!!player.lockedAt && !["BENCH"].includes(player.slot)}
            onChange={(e) => onMove(player.playerId, e.target.value as SlotType)}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
              padding: "4px 8px",
              cursor: player.lockedAt && !["BENCH"].includes(player.slot) ? "not-allowed" : "pointer",
            }}
          >
            {player.eligibleSlots.map((s) => (
              <option key={s} value={s}>{SLOT_LABELS[s]}</option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p style={{ margin: "3px 0 0 52px", fontSize: 12, color: "#f87171" }}>{error}</p>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 16,
  padding: 20,
};
