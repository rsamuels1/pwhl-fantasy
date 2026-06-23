"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
}

const SLOT_LABEL: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN", IR: "IR",
};
const SLOT_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#5fa98c", GOALIE: "#f59e0b",
  UTIL: "#a78bfa", BENCH: "#475569", IR: "#ef4444",
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
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(100,116,139,0.15)", color: "#64748b" }}>
        0G left
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}>
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
      background: isOver ? "rgba(99,102,241,0.12)" : isDragging ? "rgba(255,255,255,0.02)" : "transparent",
      border: isOver ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent",
      opacity: isDragging ? 0.4 : 1,
      transition: "background 0.12s, border-color 0.12s",
      minHeight: 44,
    }}>
      {/* Slot badge */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
        background: `${SLOT_COLORS[entry.slot] ?? "#475569"}18`,
        color: SLOT_COLORS[entry.slot] ?? "#475569",
        minWidth: 32, textAlign: "center", flexShrink: 0,
      }}>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.name}
          {entry.hasPlayedThisPeriod && !isLocked && (
            <span style={{ marginLeft: 5, fontSize: 9, color: "#5fa98c", fontWeight: 700 }}>✓ PLAYED</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
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
}

function DraggablePlayerRow({ entry, statsLabel: label, isActive: isActiveSlot, onDrop }: DraggableRowProps) {
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

  return (
    <div
      ref={setRef}
      style={{ position: "relative" }}
    >
      {/* Drag handle */}
      {!isLocked && (
        <span
          {...attributes}
          {...listeners}
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 20, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "grab", color: "#334155", fontSize: 14, zIndex: 1,
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
          isOver={isOver}
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
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      const res = await fetch(`/api/leagues/${leagueId}/lineup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playerId: dragged.playerId,
          slot: target.slot,
          swapWithPlayerId: target.playerId,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok || data.error) {
        // Revert optimistic update
        setRoster(initialRoster);
        setError(data.error ?? "Lineup update failed.");
        return;
      }
      setSuccess(`Swapped ${dragged.name} ↔ ${target.name}`);
      router.refresh();
    });
  }

  const draggedEntry = activeEntryId ? findEntry(activeEntryId) : null;

  const tabs: { key: StatsTab; label: string; disabled: boolean }[] = [
    { key: "season", label: "Season", disabled: false },
    { key: "thisWeek", label: thisWeekLabel ? `This week` : "This week", disabled: !thisWeekLabel },
    { key: "lastWeek", label: "Last week", disabled: !lastWeekLabel },
    { key: "projected", label: "Projected", disabled: !nextWeekLabel || !projectionsAvailable },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats tab toggle */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setStatsTab(t.key)}
            disabled={t.disabled}
            style={{
              padding: "5px 12px", borderRadius: 8, border: "none", cursor: t.disabled ? "default" : "pointer",
              fontSize: 12, fontWeight: 600,
              background: statsTab === t.key ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              color: statsTab === t.key ? "#a5b4fc" : t.disabled ? "#334155" : "#64748b",
              transition: "background 0.12s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

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

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Active starters */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px 4px", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569" }}>
              Active Starters · {activeEntries.length} slots
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: "#334155" }}>Drag ⠿ to swap</span>
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
              />
            ))}
          </div>
        </div>

        {/* Bench */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "8px 14px 4px", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569" }}>
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
              />
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedEntry && (
            <div style={{
              background: "var(--card)", border: "1px solid rgba(99,102,241,0.5)",
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
