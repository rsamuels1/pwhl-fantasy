"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface LineupPlayer {
  playerId: string;
  name: string;
  position: string;
  slot: string;
  teamAbbr: string | null;
  gamesThisPeriod: number | null;
}

interface Props {
  leagueId: string;
  teamId: string;
  active: LineupPlayer[];
  bench: LineupPlayer[];
  rosterSettings?: { forward?: number; defense?: number; goalie?: number; util?: number };
}

const SLOT_LABEL: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN",
};
const SLOT_COLOR: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b", UTIL: "var(--accent-strong)", BENCH: "var(--faint)",
};

function canSwap(active: LineupPlayer, bench: LineupPlayer): boolean {
  // GOALIE slot: only GOALIE players
  if (active.slot === "GOALIE") return bench.position === "GOALIE";
  // UTIL slot: skaters only (F or D)
  if (active.slot === "UTIL") return bench.position === "FORWARD" || bench.position === "DEFENSE";
  // FORWARD/DEFENSE slot: bench player must be same position (or UTIL-eligible is handled server-side)
  return bench.position === active.position;
}

const SLOT_CAPACITY: Record<string, keyof NonNullable<Props["rosterSettings"]>> = {
  FORWARD: "forward", DEFENSE: "defense", GOALIE: "goalie", UTIL: "util",
};

const POSITION_ELIGIBLE_SLOTS: Record<string, string[]> = {
  FORWARD: ["FORWARD", "UTIL"],
  DEFENSE: ["DEFENSE", "UTIL"],
  GOALIE: ["GOALIE"],
};

export default function InlineLineupEditor({ leagueId, teamId, active, bench, rosterSettings }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = active.find((p) => p.playerId === selectedId) ?? null;
  const selectedBench = bench.find((p) => p.playerId === selectedBenchId) ?? null;
  const zeroGameIds = new Set(active.filter((p) => p.gamesThisPeriod === 0).map((p) => p.playerId));

  // Compute empty active slots that have no player assigned
  const emptySlots: string[] = [];
  if (rosterSettings) {
    for (const [slot, key] of Object.entries(SLOT_CAPACITY)) {
      const capacity = rosterSettings[key] ?? 0;
      const occupied = active.filter((p) => p.slot === slot).length;
      for (let i = 0; i < capacity - occupied; i++) {
        emptySlots.push(slot);
      }
    }
  }

  function selectActive(playerId: string) {
    setSelectedId((prev) => (prev === playerId ? null : playerId));
    setSelectedBenchId(null);
    setError(null);
  }

  function selectBench(playerId: string) {
    setSelectedBenchId((prev) => (prev === playerId ? null : playerId));
    setSelectedId(null);
    setError(null);
  }

  function doSwap(benchPlayer: LineupPlayer) {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playerId: selected.playerId,
          slot: benchPlayer.slot,
          swapWithPlayerId: benchPlayer.playerId,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Swap failed.");
        return;
      }
      setSelectedId(null);
      router.refresh();
    });
  }

  function doActivate(benchPlayer: LineupPlayer, targetSlot: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, playerId: benchPlayer.playerId, slot: targetSlot }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Move failed.");
        return;
      }
      setSelectedBenchId(null);
      router.refresh();
    });
  }

  const eligibleBench = selected ? bench.filter((b) => canSwap(selected, b)) : [];
  // When a bench player is selected, which empty slots can they fill?
  const eligibleEmptySlots = selectedBench
    ? emptySlots.filter((slot) => (POSITION_ELIGIBLE_SLOTS[selectedBench.position] ?? []).includes(slot))
    : [];
  const hasZeroGame = zeroGameIds.size > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Zero-games warning */}
      {hasZeroGame && (
        <div style={{
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
          borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          fontSize: 13, color: "#fbbf24",
        }}>
          ⚠ {[...zeroGameIds].map((id) => active.find((p) => p.playerId === id)?.name).filter(Boolean).join(", ")}{" "}
          {zeroGameIds.size === 1 ? "has" : "have"} no games this period — select to swap out.
        </div>
      )}

      {/* Instruction banner when an active player is selected */}
      {selected && (
        <div style={{
          background: "rgba(143,193,232,0.1)", border: "1px solid rgba(143,193,232,0.3)",
          borderRadius: 10, padding: "8px 14px", marginBottom: 8,
          fontSize: 13, color: "var(--accent-strong)", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>Swapping out <strong style={{ color: "var(--text)" }}>{selected.name}</strong> — pick a bench player below</span>
          <button
            onClick={() => setSelectedId(null)}
            style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 13 }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Instruction banner when a bench player is selected for an empty slot */}
      {selectedBench && (
        <div style={{
          background: "rgba(143,193,232,0.1)", border: "1px solid rgba(143,193,232,0.3)",
          borderRadius: 10, padding: "8px 14px", marginBottom: 8,
          fontSize: 13, color: "var(--accent-strong)", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span><strong style={{ color: "var(--text)" }}>{selectedBench.name}</strong> — tap an empty slot above to activate</span>
          <button
            onClick={() => setSelectedBenchId(null)}
            style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 13 }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>{error}</div>
      )}

      {/* Active starters */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Starters
      </div>
      {active.map((p) => {
        const isSelected = p.playerId === selectedId;
        const isZero = zeroGameIds.has(p.playerId);
        return (
          <button
            key={p.playerId}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${p.name}, ${SLOT_LABEL[p.slot] ?? p.slot} slot${isZero ? ", no games this period" : ""}${isSelected ? ", selected — pick a bench player to swap" : ""}`}
            onClick={() => !isPending && selectActive(p.playerId)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              padding: "8px 10px", borderRadius: 8, marginBottom: 4, cursor: "pointer",
              background: isSelected
                ? "rgba(143,193,232,0.15)"
                : isZero
                ? "rgba(251,191,36,0.06)"
                : "var(--bg-raised)",
              border: isSelected
                ? "1px solid rgba(143,193,232,0.4)"
                : isZero
                ? "1px solid rgba(251,191,36,0.2)"
                : "1px solid transparent",
              transition: "background 0.1s",
            }}
          >
            <span aria-hidden="true" style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: `${SLOT_COLOR[p.slot] ?? "var(--faint)"}22`,
              color: SLOT_COLOR[p.slot] ?? "var(--faint)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>
              {SLOT_LABEL[p.slot] ?? p.slot}
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: isSelected ? 600 : 400 }}>{p.name}</span>
            {p.teamAbbr && (
              <span aria-hidden="true" style={{ fontSize: 11, color: "var(--faint)" }}>{p.teamAbbr}</span>
            )}
            {p.gamesThisPeriod !== null && (
              <span aria-hidden="true" style={{
                fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                background: p.gamesThisPeriod === 0 ? "rgba(100,116,139,0.15)" : "rgba(143,193,232,0.15)",
                color: p.gamesThisPeriod === 0 ? "var(--faint)" : "var(--accent-strong)",
              }}>
                {p.gamesThisPeriod === 0 ? "0 gm" : `${p.gamesThisPeriod} gm`}
              </span>
            )}
          </button>
        );
      })}
      {/* Empty active slot placeholders — shown when roster has unfilled starting slots */}
      {emptySlots.map((slot, i) => {
        const isTarget = eligibleEmptySlots.includes(slot) && eligibleEmptySlots.indexOf(slot) === i - (emptySlots.length - eligibleEmptySlots.length);
        const isEligibleTarget = selectedBench !== null && (POSITION_ELIGIBLE_SLOTS[selectedBench.position] ?? []).includes(slot);
        return (
          <button
            key={`empty-${slot}-${i}`}
            type="button"
            disabled={!isEligibleTarget || isPending}
            aria-label={`Empty ${SLOT_LABEL[slot] ?? slot} slot${isEligibleTarget ? " — tap to activate selected bench player" : ""}`}
            onClick={() => isEligibleTarget && selectedBench && !isPending && doActivate(selectedBench, slot)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              padding: "8px 10px", borderRadius: 8, marginBottom: 4,
              cursor: isEligibleTarget ? "pointer" : "default",
              background: isEligibleTarget
                ? "rgba(143,193,232,0.08)"
                : "transparent",
              border: isEligibleTarget
                ? "1px dashed rgba(143,193,232,0.5)"
                : "1px dashed rgba(100,116,139,0.25)",
              transition: "background 0.1s",
            }}
          >
            <span aria-hidden="true" style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: `${SLOT_COLOR[slot] ?? "var(--faint)"}11`,
              color: isEligibleTarget ? (SLOT_COLOR[slot] ?? "var(--faint)") : "var(--faint)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>
              {SLOT_LABEL[slot] ?? slot}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontStyle: "italic", color: isEligibleTarget ? "var(--accent-strong)" : "var(--faint)" }}>
              {isEligibleTarget ? "Tap to activate ↑" : "Empty slot"}
            </span>
          </button>
        );
      })}

      {/* Bench */}
      {bench.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 0.5, margin: "12px 0 6px" }}>
          Bench
        </div>
      )}
      {bench.map((p) => {
        const isSwapTarget = selected ? canSwap(selected, p) : false;
        const isBenchSelected = p.playerId === selectedBenchId;
        // A bench player is selectable if there are empty slots they're eligible for (and no active player currently selected)
        const hasEligibleEmptySlot = !selected && emptySlots.some((slot) =>
          (POSITION_ELIGIBLE_SLOTS[p.position] ?? []).includes(slot)
        );
        const isClickable = isSwapTarget || hasEligibleEmptySlot || isBenchSelected;
        return (
          <button
            key={p.playerId}
            type="button"
            disabled={!isClickable || isPending}
            aria-pressed={isBenchSelected}
            aria-label={`${p.name}, bench${isSwapTarget ? " — eligible swap target, activate" : ""}${isBenchSelected ? ", selected — tap an empty slot above to activate" : ""}`}
            onClick={() => {
              if (!isClickable || isPending) return;
              if (isSwapTarget && selected) { doSwap(p); return; }
              if (hasEligibleEmptySlot || isBenchSelected) { selectBench(p.playerId); }
            }}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              padding: "8px 10px", borderRadius: 8, marginBottom: 4,
              cursor: isClickable ? "pointer" : "default",
              background: isBenchSelected
                ? "rgba(143,193,232,0.15)"
                : isSwapTarget
                ? "rgba(143,193,232,0.08)"
                : "var(--bg-raised)",
              border: isBenchSelected
                ? "1px solid rgba(143,193,232,0.4)"
                : isSwapTarget
                ? "1px solid rgba(143,193,232,0.3)"
                : "1px solid transparent",
              opacity: (selected && !isSwapTarget) || (selectedBenchId && !isBenchSelected) ? 0.4 : 1,
              transition: "background 0.1s, opacity 0.1s",
            }}
          >
            <span aria-hidden="true" style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: "rgba(100,116,139,0.15)", color: "var(--faint)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>
              BN
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: isBenchSelected ? 600 : 400 }}>{p.name}</span>
            {p.teamAbbr && (
              <span aria-hidden="true" style={{ fontSize: 11, color: "var(--faint)" }}>{p.teamAbbr}</span>
            )}
            {p.gamesThisPeriod !== null && (
              <span aria-hidden="true" style={{
                fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                background: p.gamesThisPeriod === 0 ? "rgba(100,116,139,0.15)" : "rgba(143,193,232,0.15)",
                color: p.gamesThisPeriod === 0 ? "var(--faint)" : "var(--accent-strong)",
              }}>
                {p.gamesThisPeriod === 0 ? "0 gm" : `${p.gamesThisPeriod} gm`}
              </span>
            )}
            {isSwapTarget && (
              <span aria-hidden="true" style={{ fontSize: 11, color: "var(--accent-strong)", fontWeight: 600 }}>Start ↑</span>
            )}
            {isBenchSelected && (
              <span aria-hidden="true" style={{ fontSize: 11, color: "var(--accent-strong)", fontWeight: 600 }}>Selected</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
