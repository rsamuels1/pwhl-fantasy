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
}

const SLOT_LABEL: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN",
};
const SLOT_COLOR: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b", UTIL: "#a78bfa", BENCH: "#64748b",
};

function canSwap(active: LineupPlayer, bench: LineupPlayer): boolean {
  // GOALIE slot: only GOALIE players
  if (active.slot === "GOALIE") return bench.position === "GOALIE";
  // UTIL slot: skaters only (F or D)
  if (active.slot === "UTIL") return bench.position === "FORWARD" || bench.position === "DEFENSE";
  // FORWARD/DEFENSE slot: bench player must be same position (or UTIL-eligible is handled server-side)
  return bench.position === active.position;
}

export default function InlineLineupEditor({ leagueId, teamId, active, bench }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = active.find((p) => p.playerId === selectedId) ?? null;
  const zeroGameIds = new Set(active.filter((p) => p.gamesThisPeriod === 0).map((p) => p.playerId));

  function selectActive(playerId: string) {
    setSelectedId((prev) => (prev === playerId ? null : playerId));
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
          slot: benchPlayer.slot,       // ignored by swap path but required by schema
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

  const eligibleBench = selected ? bench.filter((b) => canSwap(selected, b)) : [];
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

      {/* Instruction banner when a player is selected */}
      {selected && (
        <div style={{
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 10, padding: "8px 14px", marginBottom: 8,
          fontSize: 13, color: "#a5b4fc", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>Swapping out <strong style={{ color: "#e2e8f0" }}>{selected.name}</strong> — pick a bench player below</span>
          <button
            onClick={() => setSelectedId(null)}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13 }}
          >
            ✕ Cancel
          </button>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>{error}</div>
      )}

      {/* Active starters */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Starters
      </div>
      {active.map((p) => {
        const isSelected = p.playerId === selectedId;
        const isZero = zeroGameIds.has(p.playerId);
        return (
          <div
            key={p.playerId}
            onClick={() => !isPending && selectActive(p.playerId)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 8, marginBottom: 4, cursor: "pointer",
              background: isSelected
                ? "rgba(99,102,241,0.15)"
                : isZero
                ? "rgba(251,191,36,0.06)"
                : "rgba(255,255,255,0.03)",
              border: isSelected
                ? "1px solid rgba(99,102,241,0.4)"
                : isZero
                ? "1px solid rgba(251,191,36,0.2)"
                : "1px solid transparent",
              transition: "background 0.1s",
            }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: `${SLOT_COLOR[p.slot] ?? "#64748b"}22`,
              color: SLOT_COLOR[p.slot] ?? "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>
              {SLOT_LABEL[p.slot] ?? p.slot}
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: isSelected ? 600 : 400 }}>{p.name}</span>
            {p.teamAbbr && (
              <span style={{ fontSize: 11, color: "#64748b" }}>{p.teamAbbr}</span>
            )}
            {p.gamesThisPeriod !== null && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                background: p.gamesThisPeriod === 0 ? "rgba(100,116,139,0.15)" : "rgba(99,102,241,0.15)",
                color: p.gamesThisPeriod === 0 ? "#64748b" : "#818cf8",
              }}>
                {p.gamesThisPeriod === 0 ? "0 left" : `${p.gamesThisPeriod}G`}
              </span>
            )}
          </div>
        );
      })}

      {/* Bench */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, margin: "12px 0 6px" }}>
        Bench
      </div>
      {bench.map((p) => {
        const isEligible = selected ? canSwap(selected, p) : false;
        return (
          <div
            key={p.playerId}
            onClick={() => isEligible && !isPending && doSwap(p)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 8, marginBottom: 4,
              cursor: isEligible ? "pointer" : "default",
              background: isEligible ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
              border: isEligible ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
              opacity: selected && !isEligible ? 0.4 : 1,
              transition: "background 0.1s, opacity 0.1s",
            }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: "rgba(100,116,139,0.15)", color: "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>
              BN
            </span>
            <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
            {p.teamAbbr && (
              <span style={{ fontSize: 11, color: "#64748b" }}>{p.teamAbbr}</span>
            )}
            {p.gamesThisPeriod !== null && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                background: p.gamesThisPeriod === 0 ? "rgba(100,116,139,0.15)" : "rgba(99,102,241,0.15)",
                color: p.gamesThisPeriod === 0 ? "#64748b" : "#818cf8",
              }}>
                {p.gamesThisPeriod === 0 ? "0 left" : `${p.gamesThisPeriod}G`}
              </span>
            )}
            {isEligible && (
              <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600 }}>Start ↑</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
