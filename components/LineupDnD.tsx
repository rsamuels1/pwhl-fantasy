"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import MilestoneToast from "@/components/MilestoneToast";
import { computeOptimalLineup, type RosterSettings, type RosterEntryWithProjection } from "@/lib/lineup";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

export interface LineupEntry {
  entryId: string;
  playerId: string;
  name: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  teamAbbr: string | null;
  slot: string;
  lockedAt: string | null;
  hasPlayedThisPeriod: boolean;
  gamesThisPeriod: number | null;
  eligibleSlots: string[];
}

export interface LineupStats {
  gp: number;
  goals?: number;
  assists?: number;
  powerPlayPts?: number;
  shots?: number;
  hits?: number;
  blocks?: number;
  wins?: number;
  goalsAgainst?: number;
  shutouts?: number;
  savePct?: number | null;
  fantasyPoints: number;
}

type StatsTab = "season" | "thisWeek" | "lastWeek" | "projected";

interface Props {
  leagueId: string;
  teamId: string;
  initialRoster: LineupEntry[];
  seasonStats: Record<string, LineupStats | null>;
  lastWeekStats: Record<string, LineupStats | null>;
  lastWeekLabel: string | null;
  thisWeekStats: Record<string, LineupStats | null>;
  thisWeekLabel: string | null;
  projectedStats: Record<string, { projectedFp: number; games: number } | null> | undefined;
  nextWeekLabel: string | null;
  projectionsAvailable?: boolean;
  rosterSettings?: RosterSettings;
  /** When true, calls the commissioner force-move endpoint. forceMoveTeamId is the target team. */
  forceMove?: boolean;
  forceMoveTeamId?: string;
}

const SLOT_LABEL: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN", IR: "IR",
};
const SLOT_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#5fa98c", GOALIE: "#f59e0b",
  UTIL: "var(--accent-strong)", BENCH: "var(--faint)", IR: "#ef4444",
};
const BENCH_SLOTS = new Set(["BENCH", "IR"]);
const ACTIVE_SLOT_ORDER: Record<string, number> = {
  FORWARD: 0, DEFENSE: 1, GOALIE: 2, UTIL: 3,
};

function statsLabel(entry: LineupEntry, stats: LineupStats | null, tab: StatsTab, projected: { projectedFp: number; games: number } | null | undefined): string {
  if (tab === "projected") {
    if (!projected) return "—";
    return `${projected.projectedFp.toFixed(1)} FP · ${projected.games}G proj`;
  }
  if (!stats) return "—";
  if (entry.position === "GOALIE") {
    const sv = stats.savePct != null ? (stats.savePct * 100).toFixed(1) + "%" : "—";
    return `${stats.fantasyPoints.toFixed(1)} FP · ${stats.wins ?? 0}W · ${sv} SV%`;
  }
  return `${stats.fantasyPoints.toFixed(1)} FP · ${stats.goals ?? 0}G ${stats.assists ?? 0}A`;
}

function GamesLeftBadge({ count }: { count: number | null }) {
  if (count === null) return null;
  if (count === 0) {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(100,116,139,0.15)", color: "var(--faint)" }}>
        0G left
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(143,193,232,0.1)", color: "var(--accent-strong)" }}>
      {count}G left
    </span>
  );
}

interface RowProps {
  entry: LineupEntry;
  statsLabel: string;
  isOver: boolean;
  isDragging: boolean;
  isActive?: boolean;
}

function PlayerRow({ entry, statsLabel: label, isOver, isDragging, isActive = false }: RowProps) {
  const isLocked = !!entry.lockedAt;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px",
      borderRadius: 10,
      background: isOver ? "rgba(143,193,232,0.12)" : isDragging ? "var(--bg-raised)" : "transparent",
      border: isOver ? "1px solid rgba(143,193,232,0.4)" : "1px solid transparent",
      opacity: isDragging ? 0.4 : 1,
      transition: "background 0.12s, border-color 0.12s",
      minHeight: 44,
    }}>
      {/* Slot badge */}
      <span
        title={entry.slot === "UTIL" ? "Utility — any forward or defenseman" : undefined}
        style={{
          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
          background: `${SLOT_COLORS[entry.slot] ?? "var(--faint)"}18`,
          color: SLOT_COLORS[entry.slot] ?? "var(--faint)",
          minWidth: 32, textAlign: "center", flexShrink: 0,
          cursor: entry.slot === "UTIL" ? "help" : undefined,
        }}
      >
        {SLOT_LABEL[entry.slot] ?? entry.slot}
      </span>

      {/* Lock icon */}
      {isLocked ? (
        <span style={{ fontSize: 12, flexShrink: 0 }} title="Locked for this period">🔒</span>
      ) : (
        <span style={{ fontSize: 12, flexShrink: 0, color: "transparent" }}>🔒</span>
      )}

      {/* Player info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.name}
          {entry.hasPlayedThisPeriod && !isLocked && (
            <span style={{ marginLeft: 5, fontSize: 9, color: "#5fa98c", fontWeight: 700 }}>✓ PLAYED</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)" }}>
          {entry.position[0]}{entry.teamAbbr ? ` · ${entry.teamAbbr}` : ""}
          {" · "}{label}
        </div>
      </div>

      {!BENCH_SLOTS.has(entry.slot) && (
        <GamesLeftBadge count={entry.gamesThisPeriod} />
      )}
    </div>
  );
}

interface DraggableRowProps extends RowProps {
  onDrop: (targetEntryId: string) => void;
  /** Mobile tap-to-swap: is this row the currently selected player? */
  isTapSelected?: boolean;
  /** Mobile tap-to-swap: is this row a valid swap target for the selected player? */
  isTapTarget?: boolean;
  onTap?: (entryId: string) => void;
}

function DraggablePlayerRow({ entry, statsLabel: label, isActive: isActiveSlot, onDrop, isTapSelected, isTapTarget, onTap }: DraggableRowProps) {
  const isLocked = !!entry.lockedAt;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: entry.entryId,
    disabled: isLocked,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: entry.entryId });

  const setRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const tapRingStyle: React.CSSProperties = isTapSelected
    ? { outline: "2px solid var(--accent)", outlineOffset: 2, borderRadius: 10 }
    : isTapTarget
      ? { outline: "2px solid rgba(143,193,232,0.6)", outlineOffset: 2, borderRadius: 10 }
      : {};

  return (
    <div
      ref={setRef}
      style={{ position: "relative", ...tapRingStyle }}
      onClick={onTap && !isLocked ? () => onTap(entry.entryId) : undefined}
    >
      {/* Drag handle (desktop only) */}
      {!isLocked && (
        <span
          {...attributes}
          {...listeners}
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 20, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "grab", color: "var(--faint)", fontSize: 16, zIndex: 1,
          }}
          title="Drag to swap"
        >
          ⠿
        </span>
      )}
      <div style={{ paddingLeft: isLocked ? 0 : 20 }}>
        <PlayerRow
          entry={entry}
          statsLabel={label}
          isOver={isOver || (isTapTarget ?? false)}
          isDragging={isDragging}
          isActive={isActiveSlot}
        />
      </div>
    </div>
  );
}

export default function LineupDnD({
  leagueId,
  teamId,
  initialRoster,
  seasonStats,
  lastWeekStats,
  lastWeekLabel,
  thisWeekStats,
  thisWeekLabel,
  projectedStats,
  nextWeekLabel,
  projectionsAvailable = true,
  rosterSettings,
  forceMove = false,
  forceMoveTeamId,
}: Props) {
  const router = useRouter();
  const [roster, setRoster] = useState<LineupEntry[]>(initialRoster);
  const [statsTab, setStatsTab] = useState<StatsTab>(() => {
    if (thisWeekLabel) return "thisWeek";
    if (nextWeekLabel && projectionsAvailable) return "projected";
    return "season";
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLineupCompleteToast, setShowLineupCompleteToast] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mobileTab, setMobileTab] = useState<"active" | "bench">("active");
  const [isMobile, setIsMobile] = useState(false);
  // Mobile tap-to-swap: track the selected entry ID (null = nothing selected)
  const [tapSelectedId, setTapSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const activeEntries = [...roster]
    .filter((e) => !BENCH_SLOTS.has(e.slot))
    .sort((a, b) => (ACTIVE_SLOT_ORDER[a.slot] ?? 9) - (ACTIVE_SLOT_ORDER[b.slot] ?? 9));
  const benchEntries = roster.filter((e) => BENCH_SLOTS.has(e.slot));

  function getLabel(entry: LineupEntry): string {
    const proj = projectedStats?.[entry.playerId];
    switch (statsTab) {
      case "thisWeek": return statsLabel(entry, thisWeekStats[entry.playerId] ?? null, "thisWeek", proj);
      case "lastWeek": return statsLabel(entry, lastWeekStats[entry.playerId] ?? null, "lastWeek", proj);
      case "projected": return statsLabel(entry, null, "projected", proj);
      default: return statsLabel(entry, seasonStats[entry.playerId] ?? null, "season", proj);
    }
  }

  function findEntry(id: string) {
    return roster.find((e) => e.entryId === id) ?? null;
  }

  function autoSet() {
    if (!rosterSettings || forceMove) return;
    setError(null);
    setSuccess(null);

    const rosterForOptimizer: RosterEntryWithProjection[] = roster.map((p) => ({
      playerId: p.playerId,
      position: p.position,
      active: p.eligibleSlots.some((s) => s !== "BENCH" && s !== "IR"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      slot: p.slot as any,
      lockedAt: p.lockedAt,
      hasPlayedThisPeriod: p.hasPlayedThisPeriod,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eligibleSlots: p.eligibleSlots as any[],
      projectedFp: projectedStats?.[p.playerId]?.projectedFp ?? null,
      gamesThisPeriod: p.gamesThisPeriod ?? 0,
    }));

    const optimalAssignment = computeOptimalLineup(rosterForOptimizer, rosterSettings);

    let hasChanges = false;
    for (const [playerId, targetSlot] of optimalAssignment) {
      if (roster.find((p) => p.playerId === playerId)?.slot !== targetSlot) {
        hasChanges = true;
        break;
      }
    }
    if (!hasChanges) {
      setError("Your lineup is already optimal!");
      return;
    }

    const originalRoster = roster;
    const optimisticRoster = roster.map((p) => {
      const targetSlot = optimalAssignment.get(p.playerId);
      return targetSlot && targetSlot !== p.slot ? { ...p, slot: targetSlot } : p;
    });
    setRoster(optimisticRoster);

    startTransition(async () => {
      const rosterMap = new Map(optimisticRoster.map((p) => [p.playerId, p.slot]));
      const savedMap = new Map(originalRoster.map((p) => [p.playerId, p.slot]));
      const processed = new Set<string>();
      const moves: Array<{ playerId: string; slot: string; swapWithPlayerId?: string }> = [];

      for (const player of optimisticRoster) {
        if (processed.has(player.playerId)) continue;
        const prevSlot = savedMap.get(player.playerId);
        if (prevSlot === player.slot) continue;

        const swappedWith = optimisticRoster.find((p) =>
          !processed.has(p.playerId) &&
          p.playerId !== player.playerId &&
          savedMap.get(p.playerId) === player.slot &&
          rosterMap.get(p.playerId) === prevSlot
        );

        if (swappedWith) {
          moves.push({ playerId: player.playerId, slot: player.slot, swapWithPlayerId: swappedWith.playerId });
          processed.add(swappedWith.playerId);
        } else {
          moves.push({ playerId: player.playerId, slot: player.slot });
        }
        processed.add(player.playerId);
      }

      for (const move of moves) {
        const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId, ...move, source: "auto" }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setRoster(originalRoster);
          setError(data.error ?? "Auto-set failed. Please try again.");
          return;
        }
      }

      setSuccess("Lineup optimized!");
      router.refresh();
    });
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveEntryId(active.id as string);
    setError(null);
    setSuccess(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveEntryId(null);
    if (!over || active.id === over.id) return;

    const dragged = findEntry(active.id as string);
    const target = findEntry(over.id as string);
    if (!dragged || !target) return;

    // Validate eligibility for both directions
    if (!dragged.eligibleSlots.includes(target.slot)) {
      setError(`${dragged.name} can't play ${SLOT_LABEL[target.slot] ?? target.slot}.`);
      return;
    }
    if (!target.eligibleSlots.includes(dragged.slot)) {
      setError(`${target.name} can't play ${SLOT_LABEL[dragged.slot] ?? dragged.slot}.`);
      return;
    }

    // Play-lock: can't move active player to bench if already played this period
    const draggedMovesToBench = BENCH_SLOTS.has(target.slot);
    if (draggedMovesToBench && dragged.hasPlayedThisPeriod) {
      setError(`${dragged.name} has played this week and can't be benched.`);
      return;
    }

    // Optimistic update
    setRoster((prev) =>
      prev.map((e) => {
        if (e.entryId === dragged.entryId) return { ...e, slot: target.slot };
        if (e.entryId === target.entryId) return { ...e, slot: dragged.slot };
        return e;
      })
    );

    startTransition(async () => {
      const targetTeamId = forceMove ? (forceMoveTeamId ?? teamId) : teamId;
      const url = forceMove
        ? `/api/leagues/${leagueId}/commissioner/force-move`
        : `/api/leagues/${leagueId}/lineup`;
      const method = forceMove ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: targetTeamId,
          playerId: dragged.playerId,
          slot: target.slot,
          swapWithPlayerId: target.playerId,
        }),
      });
      const data = await res.json() as { error?: string; milestoneTriggered?: "lineup_complete" | null };
      if (!res.ok || data.error) {
        // Revert optimistic update
        setRoster(initialRoster);
        setError(data.error ?? "Lineup update failed.");
        return;
      }
      setSuccess(`Swapped ${dragged.name} ↔ ${target.name}`);
      if (data.milestoneTriggered === "lineup_complete") setShowLineupCompleteToast(true);
      router.refresh();
    });
  }

  const draggedEntry = activeEntryId ? findEntry(activeEntryId) : null;

  // ── Mobile tap-to-swap ────────────────────────────────────────────────────
  // On mobile (≤640px), tapping a player selects it; tapping a valid target swaps.

  function isTapSwapTarget(targetEntryId: string): boolean {
    if (!tapSelectedId || !isMobile) return false;
    const selected = findEntry(tapSelectedId);
    const target = findEntry(targetEntryId);
    if (!selected || !target || selected.entryId === target.entryId) return false;
    // Both direction eligibility must pass
    if (!selected.eligibleSlots.includes(target.slot)) return false;
    if (!target.eligibleSlots.includes(selected.slot)) return false;
    // Play-lock: can't move active player to bench if already played
    if (BENCH_SLOTS.has(target.slot) && selected.hasPlayedThisPeriod) return false;
    return true;
  }

  function handleTap(tappedEntryId: string) {
    if (!isMobile) return;
    setError(null);
    setSuccess(null);

    if (!tapSelectedId) {
      // First tap: select this player
      setTapSelectedId(tappedEntryId);
      return;
    }

    if (tapSelectedId === tappedEntryId) {
      // Tap same player: deselect
      setTapSelectedId(null);
      return;
    }

    // Second tap: attempt swap
    const selected = findEntry(tapSelectedId);
    const target = findEntry(tappedEntryId);
    setTapSelectedId(null);

    if (!selected || !target) return;

    // Validate eligibility for both directions
    if (!selected.eligibleSlots.includes(target.slot)) {
      setError(`${selected.name} can't play ${SLOT_LABEL[target.slot] ?? target.slot}.`);
      return;
    }
    if (!target.eligibleSlots.includes(selected.slot)) {
      setError(`${target.name} can't play ${SLOT_LABEL[selected.slot] ?? selected.slot}.`);
      return;
    }
    if (BENCH_SLOTS.has(target.slot) && selected.hasPlayedThisPeriod) {
      setError(`${selected.name} has played this week and can't be benched.`);
      return;
    }

    // Optimistic update
    setRoster((prev) =>
      prev.map((e) => {
        if (e.entryId === selected.entryId) return { ...e, slot: target.slot };
        if (e.entryId === target.entryId) return { ...e, slot: selected.slot };
        return e;
      })
    );

    startTransition(async () => {
      const targetTeamId = forceMove ? (forceMoveTeamId ?? teamId) : teamId;
      const url = forceMove
        ? `/api/leagues/${leagueId}/commissioner/force-move`
        : `/api/leagues/${leagueId}/lineup`;
      const method = forceMove ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: targetTeamId,
          playerId: selected.playerId,
          slot: target.slot,
          swapWithPlayerId: target.playerId,
        }),
      });
      const data = await res.json() as { error?: string; milestoneTriggered?: "lineup_complete" | null };
      if (!res.ok || data.error) {
        setRoster(initialRoster);
        setError(data.error ?? "Lineup update failed.");
        return;
      }
      setSuccess(`Swapped ${selected.name} ↔ ${target.name}`);
      if (data.milestoneTriggered === "lineup_complete") setShowLineupCompleteToast(true);
      router.refresh();
    });
  }

  const tabs: { key: StatsTab; label: string; disabled: boolean }[] = [
    { key: "season", label: "Season", disabled: false },
    { key: "thisWeek", label: thisWeekLabel ? `This week` : "This week", disabled: !thisWeekLabel },
    { key: "lastWeek", label: "Last week", disabled: !lastWeekLabel },
    { key: "projected", label: "Projected", disabled: !nextWeekLabel || !projectionsAvailable },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Lineup-complete milestone toast */}
      {showLineupCompleteToast && (
        <MilestoneToast
          milestoneKey={`milestone-lineup-${leagueId}`}
          message="Lineup set — all starters locked in!"
        />
      )}

      {/* Commissioner mode badge */}
      {forceMove && (
        <div style={{
          padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          color: "#e3c989",
        }}>
          ⚙ Commissioner view — lineup changes here apply directly to this team.
        </div>
      )}

      {/* Stats tab toggle + auto-set */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => !t.disabled && setStatsTab(t.key)}
              disabled={t.disabled}
              style={{
                padding: "5px 12px", borderRadius: 8, border: "none", cursor: t.disabled ? "default" : "pointer",
                fontSize: 12, fontWeight: 600,
                background: statsTab === t.key ? "rgba(143,193,232,0.2)" : "var(--surface)",
                color: statsTab === t.key ? "var(--accent-strong)" : t.disabled ? "var(--faint)" : "var(--faint)",
                transition: "background 0.12s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {!forceMove && rosterSettings && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <button
              onClick={autoSet}
              disabled={isPending}
              style={{
                padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: isPending ? "var(--surface)" : "rgba(143,193,232,0.15)",
                border: "1px solid rgba(143,193,232,0.3)",
                color: isPending ? "var(--faint)" : "var(--accent-strong)",
                cursor: isPending ? "default" : "pointer",
                transition: "background 0.12s",
                minHeight: 32,
              }}
            >
              {isPending ? "Saving…" : "Auto-set lineup"}
            </button>
            <span style={{ fontSize: 10, color: "var(--faint)", whiteSpace: "nowrap" }}>
              Best players by projections
            </span>
          </div>
        )}
      </div>

      {/* Discovery hint */}
      {!forceMove && (
        <div style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.4 }}>
          {isMobile
            ? <>Tap a player to select, then tap another to swap positions.</>
            : <>Drag <span style={{ fontFamily: "monospace", fontSize: 13, verticalAlign: "middle" }}>⠿</span> to move a player between Active and Bench slots.</>
          }
          {rosterSettings && <> Or tap <strong style={{ color: "var(--dim)" }}>Auto-set lineup</strong> to let us pick.</>}
        </div>
      )}
      {/* Mobile selection state: show cancel hint when a player is selected */}
      {isMobile && tapSelectedId && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: "rgba(143,193,232,0.12)", border: "1px solid rgba(143,193,232,0.3)",
          color: "var(--accent-strong)",
        }}>
          <span>{findEntry(tapSelectedId)?.name ?? ""} selected — tap a valid slot to swap</span>
          <button
            onClick={() => setTapSelectedId(null)}
            style={{ border: "none", background: "none", color: "var(--faint)", cursor: "pointer", fontSize: 13, padding: "0 4px" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Feedback */}
      {(error || success) && (
        <div style={{
          padding: "8px 14px", borderRadius: 8, fontSize: 13,
          background: error ? "rgba(209,139,127,0.1)" : "rgba(95,169,140,0.1)",
          border: `1px solid ${error ? "rgba(209,139,127,0.25)" : "rgba(95,169,140,0.25)"}`,
          color: error ? "#d18b7f" : "#5fa98c",
        }}>
          {error ?? success}
        </div>
      )}

      {/* Mobile tab bar — only at ≤640px */}
      {isMobile && (
        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 2 }}>
          {(["active", "bench"] as const).map((tab) => {
            const count = tab === "active" ? activeEntries.length : benchEntries.length;
            const isSelected = mobileTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 700,
                  background: isSelected ? "rgba(143,193,232,0.15)" : "var(--surface)",
                  color: isSelected ? "var(--accent-strong)" : "var(--faint)",
                  borderBottom: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                {tab === "active" ? `Active · ${count}` : `Bench · ${count}`}
              </button>
            );
          })}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Active starters — always rendered in DOM for DnD; hidden on mobile when bench tab active */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden",
          display: isMobile && mobileTab === "bench" && !activeEntryId ? "none" : undefined,
        }}>
          <div style={{ padding: "8px 14px 4px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>
              Active Starters · {activeEntries.length} slots
            </span>
            {!isMobile && <span style={{ marginLeft: 8, fontSize: 11, color: "#334155" }}>Drag ⠿ to swap</span>}
          </div>
          <div style={{ padding: "6px 0" }}>
            {activeEntries.map((entry) => (
              <DraggablePlayerRow
                key={entry.entryId}
                entry={entry}
                statsLabel={getLabel(entry)}
                isOver={false}
                isDragging={entry.entryId === activeEntryId}
                isActive
                onDrop={() => {}}
                isTapSelected={isMobile && tapSelectedId === entry.entryId}
                isTapTarget={isMobile && isTapSwapTarget(entry.entryId)}
                onTap={isMobile ? handleTap : undefined}
              />
            ))}
          </div>
        </div>

        {/* Bench — always rendered in DOM for DnD; hidden on mobile when active tab selected */}
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden",
          display: isMobile && mobileTab === "active" && !activeEntryId ? "none" : undefined,
        }}>
          <div style={{ padding: "8px 14px 4px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>
              Bench · {benchEntries.length} slots
            </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {benchEntries.map((entry) => (
              <DraggablePlayerRow
                key={entry.entryId}
                entry={entry}
                statsLabel={getLabel(entry)}
                isOver={false}
                isDragging={entry.entryId === activeEntryId}
                isActive={false}
                onDrop={() => {}}
                isTapSelected={isMobile && tapSelectedId === entry.entryId}
                isTapTarget={isMobile && isTapSwapTarget(entry.entryId)}
                onTap={isMobile ? handleTap : undefined}
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedEntry && (
            <div style={{
              background: "var(--card)", border: "1px solid rgba(143,193,232,0.5)",
              borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: "grabbing",
              opacity: 0.95,
            }}>
              <div style={{ paddingLeft: 14 }}>
                <PlayerRow
                  entry={draggedEntry}
                  statsLabel={getLabel(draggedEntry)}
                  isOver={false}
                  isDragging={false}
                />
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
