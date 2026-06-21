"use client";

import { useState, useTransition, useEffect } from "react";
import type { RosterSettings } from "@/lib/lineup";
import { computeOptimalLineup } from "@/lib/lineup";
import LockCountdown from "@/components/LockCountdown";

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
  nextGameStartsAt: string | null; // upcoming game today (not yet started) — for lock countdown
  eligibleSlots: SlotType[];
  gamesThisPeriod: number | null;
  hasPlayedThisPeriod: boolean;
}

export interface PlayerStatsRow {
  gp: number;
  goals: number;
  assists: number;
  shots: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayPts: number;
  hits: number;
  blocks: number;
  saves: number;
  goalsAgainst: number;
  wins: number;
  shutouts: number;
  fantasyPoints: number;
}

export interface ProjectedStatsRow {
  projectedFp: number;
  avgFpPerGame: number;
  games: number;
}

type StatsView = "projected" | "season" | "lastWeek" | "thisWeek";

interface Props {
  leagueId: string;
  teamId: string;
  teamName: string;
  leagueName: string;
  initialRoster: RosterEntryRow[];
  rosterSettings: RosterSettings;
  seasonStats: Record<string, PlayerStatsRow | null>;
  lastWeekStats: Record<string, PlayerStatsRow | null>;
  lastWeekLabel: string | null; // e.g. "Week 3 (Jan 20 – Jan 26)"
  thisWeekStats: Record<string, PlayerStatsRow | null>;
  thisWeekLabel: string | null; // e.g. "Week 4 (Dec 12 – Dec 19)"
  projectedStats?: Record<string, ProjectedStatsRow | null>;
  nextWeekLabel?: string | null;
  /** False when projection computation failed server-side — disables Auto-set button */
  projectionsAvailable?: boolean;
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
  seasonStats, lastWeekStats, lastWeekLabel, thisWeekStats, thisWeekLabel,
  projectedStats, nextWeekLabel, projectionsAvailable = true,
}: Props) {
  const [roster, setRoster] = useState<RosterEntryRow[]>(initialRoster);
  const [savedRoster, setSavedRoster] = useState<RosterEntryRow[]>(initialRoster);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasEverEdited, setHasEverEdited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [statsView, setStatsView] = useState<StatsView>(
    (nextWeekLabel && projectionsAvailable) ? "projected" : (thisWeekLabel ? "thisWeek" : "season")
  );

  const selected = selectedId ? roster.find((p) => p.playerId === selectedId) ?? null : null;
  const activeSeats = buildActiveSeats(rosterSettings);
  const benchPlayers = roster.filter((p) => p.slot === "BENCH");
  const irPlayers = roster.filter((p) => p.slot === "IR");
  const tabOptions: StatsView[] = ["projected", ...(thisWeekLabel ? ["thisWeek" as StatsView] : []), "lastWeek", "season"];

  // Detect pending changes by comparing roster to savedRoster
  const hasPendingChanges = roster.some((p) => {
    const saved = savedRoster.find((s) => s.playerId === p.playerId);
    return saved?.slot !== p.slot;
  });

  // Use beforeunload to warn if leaving with unsaved changes
  useEffect(() => {
    if (!hasPendingChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingChanges]);

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

  function getStats(playerId: string): PlayerStatsRow | null {
    if (statsView === "projected") return null;
    if (statsView === "season") return seasonStats[playerId] ?? null;
    if (statsView === "lastWeek") return lastWeekStats[playerId] ?? null;
    return thisWeekStats[playerId] ?? null;
  }

  function moveTo(targetSlot: SlotType, targetPlayerId?: string) {
    if (!selected) return;
    if (targetPlayerId === selected.playerId) { setSelectedId(null); return; }
    const newSlot = targetPlayerId
      ? roster.find((p) => p.playerId === targetPlayerId)?.slot ?? targetSlot
      : targetSlot;
    if (newSlot === selected.slot) { setSelectedId(null); return; }

    setError(null);
    setHasEverEdited(true);
    setRoster((r) => r.map((p) => {
      if (p.playerId === selected.playerId) return { ...p, slot: newSlot };
      if (targetPlayerId && p.playerId === targetPlayerId) return { ...p, slot: selected.slot };
      return p;
    }));
    setSelectedId(null);
  }

  function autoSet() {
    if (!projectionsAvailable) return;
    setError(null);
    setHasEverEdited(true);

    // Convert roster to format expected by computeOptimalLineup.
    // Pass null for projectedFp when no projection data exists so computeOptimalLineup
    // can distinguish "no projection" (null) from "projected 0 pts" and fall back to
    // games-remaining ranking when projections are universally unavailable (between weeks).
    const rosterForOptimizer = roster.map((p) => ({
      playerId: p.playerId,
      position: p.position,
      active: p.active,
      slot: p.slot,
      lockedAt: p.lockedAt,
      hasPlayedThisPeriod: p.hasPlayedThisPeriod,
      eligibleSlots: p.eligibleSlots,
      projectedFp: projectedStats?.[p.playerId]?.projectedFp ?? null,
      gamesThisPeriod: p.gamesThisPeriod ?? 0,
    }));

    const optimalAssignment = computeOptimalLineup(rosterForOptimizer, rosterSettings);

    // Check if any changes
    let hasChanges = false;
    for (const [playerId, targetSlot] of optimalAssignment) {
      const current = roster.find((p) => p.playerId === playerId)?.slot;
      if (current !== targetSlot) {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) {
      setError("Your lineup is already optimal!");
      return;
    }

    // Apply the optimal assignment to roster state
    setRoster((r) =>
      r.map((p) => {
        const targetSlot = optimalAssignment.get(p.playerId);
        return targetSlot && targetSlot !== p.slot ? { ...p, slot: targetSlot } : p;
      })
    );
  }

  async function saveLineup() {
    if (!hasPendingChanges || isSaving) return;
    setIsSaving(true);
    setError(null);

    const moves: Array<{ playerId: string; slot: SlotType; swapWithPlayerId?: string }> = [];

    // Debug: log pending changes to help diagnose BF-004
    if (process.env.NODE_ENV === "development") {
      const changes = roster.filter((p) => {
        const saved = savedRoster.find((s) => s.playerId === p.playerId);
        return saved?.slot !== p.slot;
      });
      console.log("[DEBUG LineupManager] Pending changes:", changes.map(p => ({ name: p.name, from: savedRoster.find(s => s.playerId === p.playerId)?.slot, to: p.slot })));
    }

    // Compute the diff and detect swaps
    const rosterMap = new Map(roster.map((p) => [p.playerId, p.slot]));
    const savedMap = new Map(savedRoster.map((p) => [p.playerId, p.slot]));
    const processed = new Set<string>();

    for (const player of roster) {
      if (processed.has(player.playerId)) continue;
      const prevSlot = savedMap.get(player.playerId);
      if (prevSlot === player.slot) continue;

      // Check if this is part of a swap (two players exchanging positions)
      const swappedWith = roster.find((p) =>
        !processed.has(p.playerId) &&
        p.playerId !== player.playerId &&
        savedMap.get(p.playerId) === player.slot &&
        rosterMap.get(p.playerId) === prevSlot
      );

      if (swappedWith) {
        moves.push({
          playerId: player.playerId,
          slot: player.slot,
          swapWithPlayerId: swappedWith.playerId,
        });
        processed.add(swappedWith.playerId);
      } else {
        moves.push({
          playerId: player.playerId,
          slot: player.slot,
        });
      }
      processed.add(player.playerId);
    }

    // Fire all PUT calls in sequence
    try {
      for (const move of moves) {
        const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, ...move }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setRoster(savedRoster);
          setError(data.error ?? "Failed to update lineup.");
          setIsSaving(false);
          return;
        }
      }
      // Success: update saved state and show confirmation
      setSavedRoster(roster);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setRoster(savedRoster);
      setError("An error occurred while saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function selectPlayer(playerId: string) {
    if (selectedId === playerId) { setSelectedId(null); return; }
    setSelectedId(playerId);
    setError(null);
  }

  function canMoveTo(slot: SlotType): boolean {
    if (!selected) return false;
    // Can't demote an active player who has already played this period to bench/IR
    if (
      selected.hasPlayedThisPeriod &&
      ACTIVE_SLOTS.includes(selected.slot) &&
      !ACTIVE_SLOTS.includes(slot)
    ) return false;
    return selected.eligibleSlots.includes(slot) && slot !== selected.slot;
  }

  function seatIsTarget(seatSlot: SlotType, occupant: RosterEntryRow | null): boolean {
    if (!selected) return false;
    if (occupant?.playerId === selected.playerId) return false;
    if (!occupant) return canMoveTo(seatSlot);
    // If swapping would demote the occupant from an active slot to bench (selected is on bench),
    // block it when the occupant has already played this period
    if (
      occupant.hasPlayedThisPeriod &&
      ACTIVE_SLOTS.includes(occupant.slot) &&
      !ACTIVE_SLOTS.includes(selected.slot)
    ) return false;
    return canMoveTo(seatSlot) && occupant.eligibleSlots.includes(selected.slot);
  }

  const activeCount = roster.filter((p) => ACTIVE_SLOTS.includes(p.slot)).length;

  const zeroGameStarters = roster.filter(
    (p) =>
      ACTIVE_SLOTS.includes(p.slot) &&
      p.gamesThisPeriod === 0 &&
      !p.lockedAt &&
      !p.hasPlayedThisPeriod
  );

  // Empty roster check — show contextual empty state
  if (roster.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "40px 20px", textAlign: "center", alignItems: "center", minHeight: "50vh", justifyContent: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Your roster is empty</div>
        <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>Draft players first to set your lineup.</div>
        <a href={`/league/${leagueId}`} style={{
          display: "inline-block",
          padding: "10px 20px",
          borderRadius: 8,
          background: "var(--accent)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}>
          Go to league overview →
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Zero-games warning banner */}
      {zeroGameStarters.length > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(214,169,78,0.08)",
          border: "1px solid rgba(214,169,78,0.30)",
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(214,169,78,0.16)", fontSize: 16 }}>
            ⚠️
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e3c989", marginBottom: 2 }}>
              {zeroGameStarters.length === 1
                ? "1 starter has no games left this period"
                : `${zeroGameStarters.length} starters have no games left this period`}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              {zeroGameStarters.map((p) => (
                <span key={p.playerId} style={{ color: "#e3c989", background: "rgba(214,169,78,0.12)", padding: "0px 6px", borderRadius: 4, marginRight: 4 }}>{p.name}</span>
              ))}
              — consider moving them to bench.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{teamName}</h1>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            {activeCount} active · {benchPlayers.length} bench
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Auto-set Lineup button */}
          {(() => {
            const autoSetDisabled = !projectedStats || !projectionsAvailable || isSaving;
            const autoSetTitle = !projectionsAvailable
              ? "Projections unavailable — try refreshing"
              : !projectedStats
              ? "Projections not available"
              : "Optimize lineup by projected points";
            return (
              <button
                onClick={() => autoSet()}
                disabled={autoSetDisabled}
                title={autoSetTitle}
                style={{
                  minHeight: 36, padding: "0 14px", borderRadius: 8, border: "none", cursor: !autoSetDisabled ? "pointer" : "default",
                  fontSize: 12, fontWeight: 700,
                  background: !autoSetDisabled ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                  color: !autoSetDisabled ? "#d8b4fe" : "#64748b",
                  transition: "background 0.2s, color 0.2s",
                  opacity: autoSetDisabled ? 0.5 : 1,
                }}
              >
                Auto-set
              </button>
            );
          })()}

          {/* Save Lineup button */}
          <button
            onClick={() => saveLineup()}
            disabled={!hasPendingChanges || isSaving}
            style={{
              minHeight: 36, padding: "0 14px", borderRadius: 8, border: "none", cursor: hasPendingChanges && !isSaving ? "pointer" : "default",
              fontSize: 12, fontWeight: 700,
              background: justSaved ? "rgba(52,211,153,0.15)" : hasPendingChanges && !isSaving ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
              color: justSaved ? "#34d399" : hasPendingChanges && !isSaving ? "#a5b4fc" : "#64748b",
              transition: "background 0.2s, color 0.2s",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {justSaved ? "✓ Lineup saved" : `Save Lineup${hasPendingChanges ? ` (${roster.filter((p) => savedRoster.find((s) => s.playerId === p.playerId)?.slot !== p.slot).length} changes)` : ""}`}
          </button>

          {/* Stats view toggle */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3 }}>
            {tabOptions.map((view) => {
              const label = view === "projected" ? "Matchup Proj" : view === "season" ? "Season" : view === "lastWeek" ? "Last week" : "This week";
              const disabled = (view === "thisWeek" && !thisWeekLabel) || (view === "projected" && (!nextWeekLabel || !projectionsAvailable));
              return (
                <button
                  key={view}
                  onClick={() => !disabled && setStatsView(view)}
                  disabled={disabled}
                  style={{
                    minHeight: 36, padding: "0 12px", borderRadius: 6, border: "none", cursor: disabled ? "default" : "pointer", fontSize: 12, fontWeight: 600,
                    background: statsView === view ? "rgba(99,102,241,0.3)" : "transparent",
                    color: disabled ? "#334155" : statsView === view ? "#a5b4fc" : "#64748b",
                    transition: "background 0.1s, color 0.1s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(statsView === "projected" && nextWeekLabel) && (
        <div style={{ fontSize: 12, color: "#64748b" }}>Matchup projections for {nextWeekLabel} · rolling 5-game avg × scheduled games</div>
      )}
      {(statsView === "lastWeek" && lastWeekLabel) && (
        <div style={{ fontSize: 12, color: "#64748b" }}>{lastWeekLabel}</div>
      )}
      {(statsView === "thisWeek" && thisWeekLabel) && (
        <div style={{ fontSize: 12, color: "#64748b" }}>{thisWeekLabel}</div>
      )}

      {/* Entry-state instruction tip */}
      {!hasEverEdited && !selected && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.15)",
          fontSize: 12, color: "#94a3b8",
        }}>
          Tap a player to select them, then tap where to move them — changes save when you press Save Lineup.
        </div>
      )}

      {selected && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
          fontSize: 13, color: "#c9b6ff",
        }}>
          <strong style={{ color: "var(--text)" }}>{selected.name}</strong> selected —
          click a highlighted slot to move them, or click them again to cancel.
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 13, color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="lineup-grid">

        {/* LEFT: Active slots */}
        <div style={panel}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span className="section-accent" />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--dim)", textTransform: "uppercase" }}>Active</span>
          </div>

          {/* Starter total bar — projected view only — MOVED TO TOP */}
          {statsView === "projected" && projectedStats && (() => {
            const starterTotal = seatedActive.reduce((sum, { player }) => {
              if (!player) return sum;
              return sum + (projectedStats[player.playerId]?.projectedFp ?? 0);
            }, 0);
            const worstStarterProj = seatedActive.reduce((min, { player, slot }) => {
              if (!player || slot === "GOALIE") return min;
              const fp = projectedStats[player.playerId]?.projectedFp ?? 0;
              return fp < min.fp ? { name: player.name, fp, slot: player.slot, eligibleSlots: player.eligibleSlots } : min;
            }, { name: "", fp: Infinity, slot: "FORWARD" as SlotType, eligibleSlots: [] as SlotType[] });
            const benchUpgrade = benchPlayers.reduce<{ name: string; fp: number } | null>((best, p) => {
              const fp = projectedStats[p.playerId]?.projectedFp ?? 0;
              if (fp <= worstStarterProj.fp) return best;
              // Only suggest if bench player can play the worst starter's slot
              if (!p.eligibleSlots.includes(worstStarterProj.slot)) return best;
              // Only suggest if bench player has games remaining this period
              if ((p.gamesThisPeriod ?? 1) === 0) return best;
              if (!best || fp > best.fp) return { name: p.name, fp };
              return best;
            }, null);
            return (
              <div style={{
                marginBottom: 12, padding: "8px 12px", borderRadius: 8,
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
                display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
              }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Starters projected:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{starterTotal.toFixed(1)} pts</span>
                {benchUpgrade && (
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    · Consider starting <span style={{ color: "#a5b4fc" }}>{benchUpgrade.name}</span> ({benchUpgrade.fp.toFixed(1)} proj) over {worstStarterProj.name}
                  </span>
                )}
              </div>
            );
          })()}

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
                    gap: 10, alignItems: "start",
                    minHeight: 44, padding: "9px 12px", borderRadius: 10,
                    border: `1px solid ${isTarget ? "var(--accent-border)" : isSelected ? "var(--accent-border)" : "var(--border)"}`,
                    background: isTarget
                      ? "var(--accent-dim)"
                      : isSelected
                      ? "var(--accent-dim)"
                      : "rgba(255,255,255,0.02)",
                    cursor: (player && !player.lockedAt) || isTarget ? "pointer" : "default",
                    transition: "background 0.1s, border-color 0.1s",
                    outline: isSelected ? "2px solid var(--accent)" : isTarget ? "1px solid var(--accent-border)" : "none",
                    outlineOffset: isSelected ? "2px" : "0",
                  }}
                >
                  <div style={{ paddingTop: 2 }}>
                    <SlotBadge slot={slot} />
                  </div>
                  {player ? (
                    <PlayerInfo player={player} isSelected={isSelected} stats={getStats(player.playerId)} statsView={statsView} projectedStats={projectedStats} />
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span className="section-accent" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--dim)", textTransform: "uppercase" }}>Bench</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {benchPlayers.length === 0 && (
                <span style={{ color: "#475569", fontSize: 13, fontStyle: "italic" }}>Empty</span>
              )}
              {benchPlayers.map((player) => {
                const isSelected = player.playerId === selectedId;
                const isTarget = selected && selected.playerId !== player.playerId
                  && player.eligibleSlots.includes(selected.slot)
                  && !(selected.hasPlayedThisPeriod && ACTIVE_SLOTS.includes(selected.slot));
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
                      gap: 10, alignItems: "start",
                      minHeight: 44, padding: "9px 12px", borderRadius: 10,
                      border: `1px solid ${isTarget ? "var(--accent-border)" : isSelected ? "var(--accent-border)" : "var(--border)"}`,
                      background: isTarget
                        ? "var(--accent-dim)"
                        : isSelected
                        ? "var(--accent-dim)"
                        : "rgba(150,160,200,0.02)",
                      cursor: "pointer",
                      transition: "background 0.1s, border-color 0.1s",
                      outline: isSelected ? "2px solid var(--accent)" : "none",
                      outlineOffset: isSelected ? "2px" : "0",
                    }}
                  >
                    <div style={{ paddingTop: 2 }}>
                      <SlotBadge slot="BENCH" />
                    </div>
                    <PlayerInfo player={player} isSelected={isSelected} stats={getStats(player.playerId)} statsView={statsView} projectedStats={projectedStats} />
                  </div>
                );
              })}
            </div>
          </div>

          {(rosterSettings.ir ?? 0) > 0 && (
            <div style={panel}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span className="section-accent" />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", color: "var(--dim)", textTransform: "uppercase" }}>IR</span>
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
                        gap: 10, alignItems: "start",
                        padding: "9px 12px", borderRadius: 10,
                        border: `1px solid ${isSelected ? "rgba(99,102,241,0.4)" : "rgba(239,68,68,0.15)"}`,
                        background: isSelected ? "rgba(99,102,241,0.08)" : "rgba(239,68,68,0.05)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ paddingTop: 2 }}>
                        <SlotBadge slot="IR" />
                      </div>
                      <PlayerInfo player={player} isSelected={isSelected} stats={getStats(player.playerId)} statsView={statsView} projectedStats={projectedStats} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <button
          onClick={() => setSelectedId(null)}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", minHeight: 44, padding: "0 12px" }}
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

function PlayerInfo({
  player, isSelected, stats, statsView, projectedStats,
}: {
  player: RosterEntryRow;
  isSelected: boolean;
  stats: PlayerStatsRow | null;
  statsView: StatsView;
  projectedStats?: Record<string, ProjectedStatsRow | null>;
}) {
  const proj = statsView === "projected" ? (projectedStats?.[player.playerId] ?? null) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      {/* Name row */}
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
        {player.nextGameStartsAt && !player.lockedAt && (
          <LockCountdown startsAt={player.nextGameStartsAt} />
        )}
        {player.lockedAt && (
          <span title={`Locked — game started ${new Date(player.lockedAt).toLocaleTimeString()}`} style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>
        )}
        {player.hasPlayedThisPeriod && ACTIVE_SLOTS.includes(player.slot) && !player.lockedAt && (
          <span
            title="Already played this period — cannot be moved to bench"
            style={{
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              padding: "1px 5px", borderRadius: 4,
              background: "rgba(52,211,153,0.1)",
              color: "#34d399",
            }}
          >
            ✓ Played
          </span>
        )}
        {player.gamesThisPeriod !== null && !player.lockedAt && (
          <span
            className="font-stats"
            title={player.position === "GOALIE" ? "Team games left this period (goalie may not start every game)" : "Games left this period"}
            style={{
              fontSize: 10, fontWeight: 600, flexShrink: 0,
              padding: "1px 5px", borderRadius: 4,
              background: player.gamesThisPeriod === 0 ? "rgba(100,116,139,0.15)" : "var(--accent-dim)",
              border: player.gamesThisPeriod === 0 ? "none" : "1px solid var(--accent-border)",
              color: player.gamesThisPeriod === 0 ? "var(--faint)" : "#c9b6ff",
            }}
          >
            {player.gamesThisPeriod === 0 ? "0 left" : `${player.gamesThisPeriod}G left`}
          </span>
        )}
      </div>

      {/* Stats row */}
      {statsView === "projected" ? (
        proj ? (
          <ProjectedStats proj={proj} />
        ) : (
          <span style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>No recent data</span>
        )
      ) : stats ? (
        player.position === "GOALIE" ? (
          <GoalieStats stats={stats} />
        ) : (
          <SkaterStats stats={stats} />
        )
      ) : (
        <span style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>
          {statsView === "lastWeek" ? "No games last week" : statsView === "thisWeek" ? "No games yet this week" : "No prior-season data"}
        </span>
      )}
    </div>
  );
}

function ProjectedStats({ proj }: { proj: ProjectedStatsRow }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <div style={{ position: "relative" }}>
        <StatCell
          label="Proj FP"
          value={proj.projectedFp.toFixed(1)}
          highlight
          gold
          title="Projected fantasy points for this scoring period"
        />
      </div>
      <div style={{ position: "relative" }}>
        <StatCell
          label="Avg FP/G"
          value={proj.avgFpPerGame.toFixed(1)}
          title="Rolling 5-game fantasy points per game average"
        />
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 26 }} title="Projected games for this scoring period">
          <span style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 0.5 }}>Games</span>
          <span style={{
            fontSize: 12, fontWeight: 400,
            color: "var(--muted)",
          }}>×{proj.games}</span>
        </div>
      </div>
    </div>
  );
}

function SkaterStats({ stats }: { stats: PlayerStatsRow }) {
  const pts = stats.goals + stats.assists;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <StatCell label="GP" value={stats.gp} />
      <StatCell label="G" value={stats.goals} />
      <StatCell label="A" value={stats.assists} />
      <StatCell label="PTS" value={pts} highlight />
      <StatCell label="PPP" value={stats.powerPlayPts} />
      <StatCell label="SOG" value={stats.shots} className="stat-secondary" />
      <StatCell label="HIT" value={stats.hits} className="stat-secondary" />
      <StatCell label="BLK" value={stats.blocks} className="stat-secondary" />
      <StatCell label="FP" value={stats.fantasyPoints.toFixed(1)} highlight gold />
    </div>
  );
}

function GoalieStats({ stats }: { stats: PlayerStatsRow }) {
  const svPct = stats.saves + stats.goalsAgainst > 0
    ? (stats.saves / (stats.saves + stats.goalsAgainst)).toFixed(3).replace(/^0/, "")
    : "—";
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <StatCell label="GP" value={stats.gp} />
      <StatCell label="W" value={stats.wins} highlight />
      <StatCell label="SV" value={stats.saves} className="stat-secondary" />
      <StatCell label="GA" value={stats.goalsAgainst} className="stat-secondary" />
      <StatCell label="SV%" value={svPct} />
      <StatCell label="SO" value={stats.shutouts} className="stat-secondary" />
      <StatCell label="FP" value={stats.fantasyPoints.toFixed(1)} highlight gold />
    </div>
  );
}

function StatCell({ label, value, highlight = false, gold = false, className, title }: {
  label: string; value: string | number; highlight?: boolean; gold?: boolean; className?: string; title?: string;
}) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 26 }} title={title}>
      <span style={{ fontSize: 9, color: "var(--faint)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <span className={gold || highlight ? "font-stats" : undefined} style={{
        fontSize: 12, fontWeight: highlight ? 700 : 400,
        color: gold ? "#fbbf24" : highlight ? "var(--text)" : "var(--muted)",
      }}>{value}</span>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 16,
};
