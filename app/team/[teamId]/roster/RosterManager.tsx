"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import AddAndSlotModal from "@/components/AddAndSlotModal";
import WaiverWirePanel from "@/components/WaiverWirePanel";

export type Position = "FORWARD" | "DEFENSE" | "GOALIE";

export interface RosterPlayerRow {
  entryId: string;
  playerId: string;
  name: string;
  position: Position;
  teamAbbr: string | null;
  slot: string;
  active: boolean;
  acquired: string;
  stats: SkaterStats | GoalieStats | null;
}

export interface FreeAgentRow {
  playerId: string;
  name: string;
  position: Position;
  teamAbbr: string | null;
  stats: SkaterStats | GoalieStats | null;
  pwhlTeamId?: string | null;
  gamesThisPeriod?: number | null;
  isLocked?: boolean;
  isOnWaivers?: boolean;
}

export interface SkaterStats {
  gp: number; goals: number; assists: number; points: number;
  plusMinus: number; ppp: number; shots: number; hits: number; blocks: number;
  fantasyPoints: number;
}

export interface GoalieStats {
  gp: number; wins: number; saves: number; goalsAgainst: number;
  savePct: number | null; shutouts: number; fantasyPoints: number;
}

interface Props {
  leagueId: string;
  teamId: string;
  teamName: string;
  maxRosterSize: number;
  rosterSettings: { forward?: number; defense?: number; goalie?: number; util?: number };
  initialRoster: RosterPlayerRow[];
  freeAgents: FreeAgentRow[];
  allTeams: { id: string; name: string }[];
  viewTeamId: string;
  viewTeamName: string;
  viewRoster: RosterPlayerRow[];
  isOwnRoster: boolean;
}

// ── constants ─────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "UTIL", BENCH: "BN", IR: "IR",
};
const SLOT_ORDER: Record<string, number> = {
  FORWARD: 0, DEFENSE: 1, GOALIE: 2, UTIL: 3, BENCH: 4, IR: 5,
};
const SLOT_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
  UTIL: "#a78bfa", BENCH: "#64748b", IR: "#ef4444",
};
const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "#34d399", GOALIE: "#f59e0b",
};

type Tab = "roster" | "freeAgents" | "waiverWire";
type ViewMode = "cards" | "table";
type SortKey = "name" | "pts" | "goals" | "assists" | "ppp" | "shots" | "hits" | "blocks" | "wins" | "savePct" | "goalsAgainst" | "fp" | "gamesThisPeriod" | "gp" | "shutouts";

// ── main component ────────────────────────────────────────────────────────────

export default function RosterManager({
  leagueId, teamId, teamName, maxRosterSize, rosterSettings,
  initialRoster, freeAgents,
  allTeams, viewTeamId, viewTeamName, viewRoster, isOwnRoster,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roster");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [roster, setRoster] = useState<RosterPlayerRow[]>(initialRoster);
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // FA sort
  const [faSortKey, setFaSortKey] = useState<SortKey>("fp");
  const [faSortAsc, setFaSortAsc] = useState(false);

  // Roster sort (applied in table mode)
  const [rosterSortKey, setRosterSortKey] = useState<SortKey>("fp");
  const [rosterSortAsc, setRosterSortAsc] = useState(false);

  const [pendingAdd, setPendingAdd] = useState<string | null>(null);
  const [dropForAdd, setDropForAdd] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [slottingPlayer, setSlottingPlayer] = useState<FreeAgentRow | null>(null);

  const isFull = roster.length >= maxRosterSize;

  // ── add player ──────────────────────────────────────────────────────────────
  async function handleAdd(addPlayerId: string, dropPlayerId?: string) {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/waiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, addPlayerId, dropPlayerId }),
      });
      const data = await res.json() as { roster?: RosterPlayerRow[]; error?: string; onWaivers?: boolean };
      if (!res.ok || data.error) {
        if (data.onWaivers) {
          // Player is on waivers — redirect manager to the waiver wire tab
          setError("This player is on waivers — use the Waiver Wire tab to submit a claim.");
          setTab("waiverWire");
        } else {
          setError(data.error ?? "Failed to add player.");
        }
        return;
      }
      const addedFa = freeAgents.find((p) => p.playerId === addPlayerId);
      setPendingAdd(null);
      setDropForAdd(null);
      setSuccessMsg(`${addedFa?.name ?? "Player"} added to your roster.`);
      // Show Add & Slot modal for unlocked players; locked players go straight to bench
      if (addedFa && !addedFa.isLocked) {
        setSlottingPlayer(addedFa);
      } else {
        router.refresh();
      }
    });
  }

  // ── drop player ─────────────────────────────────────────────────────────────
  async function handleDrop(dropPlayerId: string) {
    setError(null);
    setSuccessMsg(null);
    const player = roster.find((p) => p.playerId === dropPlayerId);
    startTransition(async () => {
      const res = await fetch(`/api/leagues/${leagueId}/waiver`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, dropPlayerId }),
      });
      const data = await res.json() as { dropped?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to drop player.");
        return;
      }
      setRoster((prev) => prev.filter((p) => p.playerId !== dropPlayerId));
      setSuccessMsg(`${player?.name ?? "Player"} dropped.`);
      router.refresh();
    });
  }

  // ── free agent filtering + sorting ──────────────────────────────────────────
  const rosterIds = new Set(roster.map((p) => p.playerId));

  const filteredFa = useMemo(() => {
    let list = freeAgents.filter((p) => !rosterIds.has(p.playerId));
    if (posFilter !== "ALL") list = list.filter((p) => p.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const av = getSortValue(a, faSortKey);
      const bv = getSortValue(b, faSortKey);
      const diff = bv - av;
      return faSortAsc ? -diff : diff;
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeAgents, rosterIds, posFilter, search, faSortKey, faSortAsc]);

  // Displayed roster — when viewing another team use viewRoster, else own
  const displayRoster = isOwnRoster ? roster : viewRoster;

  const sortedRoster = useMemo(() => {
    const base = [...displayRoster].sort((a, b) => (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99));
    if (viewMode !== "table") return base;
    // In table mode, sort within each position group by selected stat
    const skaters = base.filter((p) => p.position !== "GOALIE");
    const goalies = base.filter((p) => p.position === "GOALIE");
    const sortGroup = (group: RosterPlayerRow[]) =>
      [...group].sort((a, b) => {
        const av = getRosterSortValue(a, rosterSortKey);
        const bv = getRosterSortValue(b, rosterSortKey);
        const diff = bv - av;
        return rosterSortAsc ? -diff : diff;
      });
    return [...sortGroup(skaters), ...sortGroup(goalies)];
  }, [displayRoster, viewMode, rosterSortKey, rosterSortAsc]);

  function toggleFaSort(key: SortKey) {
    if (faSortKey === key) setFaSortAsc((v) => !v);
    else { setFaSortKey(key); setFaSortAsc(false); }
  }

  function toggleRosterSort(key: SortKey) {
    if (rosterSortKey === key) setRosterSortAsc((v) => !v);
    else { setRosterSortKey(key); setRosterSortAsc(false); }
  }

  const skaterPositions = sortedRoster.some((p) => p.position !== "GOALIE");
  const hasGoalies = sortedRoster.some((p) => p.position === "GOALIE");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Feedback strip */}
      {(error || successMsg) && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, fontSize: 13,
          background: error ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
          border: `1px solid ${error ? "rgba(248,113,113,0.25)" : "rgba(52,211,153,0.25)"}`,
          color: error ? "#f87171" : "#6ee7b7",
        }}>
          {error ?? successMsg}
        </div>
      )}

      {/* ── Team selector ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
          Viewing:
        </label>
        <select
          value={viewTeamId}
          onChange={(e) => router.push(`?view=${e.target.value}`)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.18)",
            borderRadius: 8, color: "#e2e8f0", padding: "6px 10px", fontSize: 13,
            cursor: "pointer", outline: "none",
          }}
        >
          {allTeams.map((t) => (
            <option key={t.id} value={t.id} style={{ background: "#1e293b" }}>
              {t.name}{t.id === teamId ? " (My Team)" : ""}
            </option>
          ))}
        </select>
        {!isOwnRoster && (
          <button
            onClick={() => router.push("?")}
            style={{
              fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8,
              border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer",
              background: "rgba(99,102,241,0.1)", color: "#a5b4fc",
            }}
          >
            ← My Team
          </button>
        )}
      </div>

      {/* ── Own-team tabs (hidden when viewing another team) ── */}
      {isOwnRoster && (
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, width: "fit-content", flexWrap: "wrap" }}>
          {([
            ["roster", `${teamName} (${roster.length}/${maxRosterSize})`],
            ["freeAgents", `Free Agents (${freeAgents.filter(p => !rosterIds.has(p.playerId)).length})`],
            ["waiverWire", "Waiver Wire"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              background: tab === t ? "rgba(99,102,241,0.3)" : "transparent",
              color: tab === t ? "#a5b4fc" : "#64748b",
            }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── ROSTER TAB (own team) or read-only view (other team) ── */}
      {(isOwnRoster ? tab === "roster" : true) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Header row: team info + view toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            {!isOwnRoster && (
              <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>
                {viewTeamName}
                <span style={{ marginLeft: 8, fontSize: 12, color: "#475569", fontWeight: 400 }}>
                  {viewRoster.length} players · read-only
                </span>
              </div>
            )}
            <div style={{ marginLeft: isOwnRoster ? "auto" : undefined, display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 2 }}>
              {(["table", "cards"] as ViewMode[]).map((m) => (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: viewMode === m ? "rgba(99,102,241,0.3)" : "transparent",
                  color: viewMode === m ? "#a5b4fc" : "#64748b",
                }}>
                  {m === "table" ? "≡ Table" : "⊞ Cards"}
                </button>
              ))}
            </div>
          </div>

          {sortedRoster.length === 0 ? (
            <div style={panel}>
              <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>No players on this roster yet.</p>
            </div>
          ) : viewMode === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
              {sortedRoster.map((p) => (
                <PlayerCard
                  key={p.playerId}
                  player={p}
                  onDrop={isOwnRoster ? () => handleDrop(p.playerId) : undefined}
                  disabled={isPending}
                />
              ))}
            </div>
          ) : (
            <div style={panel}>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <>
                  {skaterPositions && (
                    <>
                      <ColHeader
                        isGoalie={false} readonly={!isOwnRoster}
                        sortKey={rosterSortKey} sortAsc={rosterSortAsc} onSort={toggleRosterSort}
                      />
                      {sortedRoster.filter((p) => p.position !== "GOALIE").map((p, i) => (
                        <RosterRow
                          key={p.playerId} player={p} index={i} readonly={!isOwnRoster}
                          onDrop={() => handleDrop(p.playerId)} disabled={isPending}
                        />
                      ))}
                    </>
                  )}
                  {hasGoalies && (
                    <>
                      <div style={{ marginTop: skaterPositions ? 16 : 0 }}>
                        <ColHeader
                          isGoalie readonly={!isOwnRoster}
                          sortKey={rosterSortKey} sortAsc={rosterSortAsc} onSort={toggleRosterSort}
                        />
                      </div>
                      {sortedRoster.filter((p) => p.position === "GOALIE").map((p, i) => (
                        <RosterRow
                          key={p.playerId} player={p} index={i} readonly={!isOwnRoster}
                          onDrop={() => handleDrop(p.playerId)} disabled={isPending}
                        />
                      ))}
                    </>
                  )}
                </>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add & Slot modal ── */}
      {slottingPlayer && (
        <AddAndSlotModal
          player={slottingPlayer}
          activeRoster={roster.filter((e) => e.slot !== "BENCH" && e.slot !== "IR")}
          rosterSettings={rosterSettings}
          teamId={teamId}
          leagueId={leagueId}
          onComplete={() => { setSlottingPlayer(null); router.refresh(); }}
          currentRosterSize={roster.length + 1}
          maxRosterSize={maxRosterSize}
        />
      )}

      {/* ── WAIVER WIRE TAB (own team only) ── */}
      {isOwnRoster && tab === "waiverWire" && (
        <WaiverWirePanel
          leagueId={leagueId}
          teamId={teamId}
          rosterPlayers={roster.map((r) => ({ entryId: r.entryId, playerId: r.playerId, name: r.name, slot: r.slot }))}
        />
      )}

      {/* ── FREE AGENTS TAB (own team only) ── */}
      {isOwnRoster && tab === "freeAgents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search players…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)",
                borderRadius: 8, color: "#e2e8f0", padding: "7px 12px", fontSize: 13,
                minWidth: 180, outline: "none",
              }}
            />
            {(["ALL", "FORWARD", "DEFENSE", "GOALIE"] as const).map((pos) => (
              <button key={pos} onClick={() => setPosFilter(pos)} style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: posFilter === pos ? `${POS_COLORS[pos] ?? "#6366f1"}22` : "rgba(255,255,255,0.05)",
                color: posFilter === pos ? (POS_COLORS[pos] ?? "#a5b4fc") : "#64748b",
                outline: posFilter === pos ? `1px solid ${POS_COLORS[pos] ?? "#6366f1"}44` : "none",
              }}>
                {pos === "ALL" ? "All" : pos === "FORWARD" ? "F" : pos === "DEFENSE" ? "D" : "G"}
              </button>
            ))}
            {isFull && (
              <span style={{ fontSize: 12, color: "#f59e0b", marginLeft: "auto" }}>
                Roster full — select a player to drop when adding
              </span>
            )}
          </div>

          <div style={{ ...panel, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <FaColHeader
              isGoalie={posFilter === "GOALIE"}
              sortKey={faSortKey} sortAsc={faSortAsc}
              onSort={toggleFaSort}
            />
            {filteredFa.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 13, margin: "12px 0 0 14px" }}>No players match.</p>
            ) : (
              filteredFa.map((fa, i) => (
                <FaRow
                  key={fa.playerId}
                  player={fa}
                  index={i}
                  isFull={isFull}
                  rosterPlayers={roster}
                  pendingAdd={pendingAdd}
                  dropForAdd={dropForAdd}
                  onSelectAdd={() => {
                    setError(null);
                    setPendingAdd(fa.playerId);
                    setDropForAdd(null);
                    if (!isFull) handleAdd(fa.playerId);
                  }}
                  onSelectDrop={(dropId) => setDropForAdd(dropId)}
                  onConfirmAddDrop={() => { if (dropForAdd) handleAdd(fa.playerId, dropForAdd); }}
                  onCancel={() => { setPendingAdd(null); setDropForAdd(null); }}
                  disabled={isPending}
                  onSwitchToWaivers={() => setTab("waiverWire")}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Player card (card view) ───────────────────────────────────────────────────

function PlayerCard({ player, onDrop, disabled }: {
  player: RosterPlayerRow; onDrop?: () => void; disabled: boolean;
}) {
  const isGoalie = player.position === "GOALIE";
  const s = player.stats;
  const fmtSvPct = (v: number | null) => v != null ? v.toFixed(3).replace(/^0/, "") : "—";

  const chips = isGoalie
    ? [
        { label: "W",   val: s ? String((s as GoalieStats).wins) : "—" },
        { label: "SV%", val: s ? fmtSvPct((s as GoalieStats).savePct) : "—" },
        { label: "SO",  val: s ? String((s as GoalieStats).shutouts) : "—" },
      ]
    : [
        { label: "G",   val: s ? String((s as SkaterStats).goals) : "—" },
        { label: "A",   val: s ? String((s as SkaterStats).assists) : "—" },
        { label: "PTS", val: s ? String((s as SkaterStats).points) : "—" },
      ];

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)",
      borderRadius: 16, padding: "14px 14px 12px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: `${POS_COLORS[player.position]}20`, color: POS_COLORS[player.position] }}>
          {player.position[0]}
        </span>
        {player.teamAbbr && <span style={{ fontSize: 11, color: "#64748b" }}>{player.teamAbbr}</span>}
        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: `${SLOT_COLORS[player.slot] ?? "#64748b"}20`, color: SLOT_COLORS[player.slot] ?? "#64748b" }}>
          {SLOT_LABELS[player.slot] ?? player.slot}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", lineHeight: 1.3 }}>
        {player.name}
        {!player.active && <span style={{ marginLeft: 6, fontSize: 9, color: "#ef4444", background: "rgba(239,68,68,0.12)", padding: "1px 4px", borderRadius: 3 }}>INJ</span>}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#6366f1", lineHeight: 1 }}>{s ? s.fantasyPoints.toFixed(1) : "—"}</div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>fantasy pts</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {chips.map((c) => (
          <span key={c.label} style={{ fontSize: 11, padding: "3px 7px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
            <span style={{ color: "#64748b", fontSize: 10 }}>{c.label} </span>{c.val}
          </span>
        ))}
      </div>
      {onDrop && (
        <button onClick={onDrop} disabled={disabled} style={{ fontSize: 11, fontWeight: 600, minHeight: 44, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer", background: "rgba(248,113,113,0.06)", color: "#f87171", opacity: disabled ? 0.5 : 1, marginTop: "auto" }}>
          Drop
        </button>
      )}
    </div>
  );
}

// ── Roster table column header ────────────────────────────────────────────────

function ColHeader({ isGoalie, readonly, sortKey, sortAsc, onSort }: {
  isGoalie: boolean; readonly: boolean;
  sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void;
}) {
  // Slot(44) | Player(1fr) | GP(36) | stats... | FPts(60) | [Drop(48)]
  const skaterCols = readonly
    ? "44px minmax(80px,1fr) 36px 36px 36px 46px 46px 36px 36px 36px 60px"
    : "44px minmax(80px,1fr) 36px 36px 36px 46px 46px 36px 36px 36px 60px 48px";
  const goalieCols = readonly
    ? "44px minmax(80px,1fr) 46px 46px 60px 50px 46px 60px"
    : "44px minmax(80px,1fr) 46px 46px 60px 50px 46px 60px 48px";
  const cols = isGoalie ? goalieCols : skaterCols;

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button onClick={() => onSort(k)} style={{
        background: "none", border: "none", cursor: "pointer", textAlign: "right",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
        color: active ? "#a5b4fc" : "#475569", padding: 0,
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3,
      }}>
        {label}{active ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    );
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols,
      gap: 8, padding: "6px 14px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
      textTransform: "uppercase", color: "#475569",
      borderBottom: "1px solid rgba(148,163,184,0.08)",
    }}>
      <span>Slot</span>
      <span>Player</span>
      {isGoalie ? (
        <>
          <SortTh label="GP" k="gp" />
          <SortTh label="W" k="wins" />
          <SortTh label="SV%" k="savePct" />
          <SortTh label="GA" k="goalsAgainst" />
          <SortTh label="SO" k="shutouts" />
          <SortTh label="FPts" k="fp" />
        </>
      ) : (
        <>
          <SortTh label="GP" k="gp" />
          <SortTh label="G" k="goals" />
          <SortTh label="A" k="assists" />
          <SortTh label="PTS" k="pts" />
          <SortTh label="PPP" k="ppp" />
          <SortTh label="SOG" k="shots" />
          <SortTh label="HIT" k="hits" />
          <SortTh label="BLK" k="blocks" />
          <SortTh label="FPts" k="fp" />
        </>
      )}
      {!readonly && <span />}
    </div>
  );
}

// ── Roster row ────────────────────────────────────────────────────────────────

function RosterRow({ player, index, readonly, onDrop, disabled }: {
  player: RosterPlayerRow; index: number; readonly: boolean; onDrop: () => void; disabled: boolean;
}) {
  const isGoalie = player.position === "GOALIE";
  const s = player.stats;
  const skaterCols = readonly
    ? "44px minmax(80px,1fr) 36px 36px 36px 46px 46px 36px 36px 36px 60px"
    : "44px minmax(80px,1fr) 36px 36px 36px 46px 46px 36px 36px 36px 60px 48px";
  const goalieCols = readonly
    ? "44px minmax(80px,1fr) 46px 46px 60px 50px 46px 60px"
    : "44px minmax(80px,1fr) 46px 46px 60px 50px 46px 60px 48px";
  const cols = isGoalie ? goalieCols : skaterCols;
  const fmtSvPct = (v: number | null) => v != null ? v.toFixed(3).replace(/^0/, "") : "—";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols, gap: 8,
      padding: "9px 14px", alignItems: "center",
      borderTop: index === 0 ? "none" : "1px solid rgba(148,163,184,0.05)",
      background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", padding: "3px 0", borderRadius: 5, width: 36, background: `${SLOT_COLORS[player.slot] ?? "#64748b"}20`, color: SLOT_COLORS[player.slot] ?? "#64748b" }}>
        {SLOT_LABELS[player.slot] ?? player.slot}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.name}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[player.position], flexShrink: 0 }}>
          {player.position[0]}
        </span>
        {player.teamAbbr && <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{player.teamAbbr}</span>}
        {!player.active && <span style={{ fontSize: 10, color: "#ef4444", background: "rgba(239,68,68,0.12)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>INJ</span>}
      </div>

      {isGoalie ? (
        <>
          <Num v={s ? (s as GoalieStats).gp : null} />
          <Num v={s ? (s as GoalieStats).wins : null} />
          <span style={{ textAlign: "right", fontSize: 12, color: "#94a3b8" }}>{s ? fmtSvPct((s as GoalieStats).savePct) : "—"}</span>
          <Num v={s ? (s as GoalieStats).goalsAgainst : null} />
          <Num v={s ? (s as GoalieStats).shutouts : null} />
          <Num v={s ? s.fantasyPoints : null} highlight />
        </>
      ) : (
        <>
          <Num v={s ? (s as SkaterStats).gp : null} />
          <Num v={s ? (s as SkaterStats).goals : null} />
          <Num v={s ? (s as SkaterStats).assists : null} />
          <Num v={s ? (s as SkaterStats).points : null} highlight />
          <Num v={s ? (s as SkaterStats).ppp : null} />
          <Num v={s ? (s as SkaterStats).shots : null} />
          <Num v={s ? (s as SkaterStats).hits : null} />
          <Num v={s ? (s as SkaterStats).blocks : null} />
          <Num v={s ? s.fantasyPoints : null} highlight />
        </>
      )}

      {!readonly && (
        <button onClick={onDrop} disabled={disabled} title="Drop player" style={{ fontSize: 11, fontWeight: 600, minHeight: 44, padding: "0 12px", borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer", background: "rgba(248,113,113,0.08)", color: "#f87171", opacity: disabled ? 0.5 : 1 }}>
          Drop
        </button>
      )}
    </div>
  );
}

// ── Free agent column header ───────────────────────────────────────────────────

function FaColHeader({ isGoalie, sortKey, sortAsc, onSort }: {
  isGoalie: boolean; sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void;
}) {
  const cols = isGoalie
    ? "minmax(80px,1fr) 40px 50px 50px 60px 50px 50px 60px 80px"
    : "minmax(80px,1fr) 40px 36px 36px 36px 46px 46px 36px 36px 60px 80px 80px";

  function SortTh({ label, k, title }: { label: string; k: SortKey; title?: string }) {
    const active = sortKey === k;
    return (
      <button onClick={() => onSort(k)} title={title} style={{
        background: "none", border: "none", cursor: "pointer", textAlign: "right",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
        color: active ? "#a5b4fc" : "#475569", padding: 0,
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3,
      }}>
        {label}{active ? (sortAsc ? " ↑" : " ↓") : ""}
      </button>
    );
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols,
      gap: 8, padding: "6px 14px 8px",
      borderBottom: "1px solid rgba(148,163,184,0.08)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569" }}>Player</span>
      <SortTh label="Wk" k="gamesThisPeriod" title="Games remaining this period" />
      {isGoalie ? (
        <>
          <SortTh label="GP" k="gp" />
          <SortTh label="W" k="wins" />
          <SortTh label="SV%" k="savePct" />
          <SortTh label="GA" k="goalsAgainst" />
          <SortTh label="SO" k="shutouts" />
          <SortTh label="FPts" k="fp" />
        </>
      ) : (
        <>
          <SortTh label="GP" k="gp" />
          <SortTh label="G" k="goals" />
          <SortTh label="A" k="assists" />
          <SortTh label="PTS" k="pts" />
          <SortTh label="PPP" k="ppp" />
          <SortTh label="SOG" k="shots" />
          <SortTh label="HIT" k="hits" />
          <SortTh label="BLK" k="blocks" />
          <SortTh label="FPts" k="fp" />
        </>
      )}
      <span />
    </div>
  );
}

// ── Free agent row ─────────────────────────────────────────────────────────────

function FaRow({ player, index, isFull, rosterPlayers, pendingAdd, dropForAdd,
  onSelectAdd, onSelectDrop, onConfirmAddDrop, onCancel, disabled, onSwitchToWaivers }: {
  player: FreeAgentRow; index: number; isFull: boolean;
  rosterPlayers: RosterPlayerRow[]; pendingAdd: string | null; dropForAdd: string | null;
  onSelectAdd: () => void; onSelectDrop: (id: string) => void;
  onConfirmAddDrop: () => void; onCancel: () => void; disabled: boolean;
  onSwitchToWaivers?: () => void;
}) {
  const isGoalie = player.position === "GOALIE";
  const s = player.stats;
  const isThisPending = pendingAdd === player.playerId;
  const cols = isGoalie
    ? "minmax(80px,1fr) 40px 50px 50px 60px 50px 50px 60px 80px"
    : "minmax(80px,1fr) 40px 36px 36px 36px 46px 46px 36px 36px 60px 80px 80px";
  const fmtSvPct = (v: number | null) => v != null ? v.toFixed(3).replace(/^0/, "") : "—";

  return (
    <div style={{ borderTop: index === 0 ? "none" : "1px solid rgba(148,163,184,0.05)" }}>
      <div style={{
        display: "grid", gridTemplateColumns: cols, gap: 8,
        padding: "9px 14px", alignItems: "center",
        background: isThisPending ? "rgba(99,102,241,0.06)" : index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {player.name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[player.position], flexShrink: 0 }}>
            {player.position[0]}
          </span>
          {player.teamAbbr && <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{player.teamAbbr}</span>}
          {player.isOnWaivers && (
            <span title="Player is on waivers — submit a claim from the Waiver Wire tab" style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: "rgba(100,116,139,0.2)", color: "#64748b", flexShrink: 0 }}>
              On Waivers
            </span>
          )}
        </div>

        {/* Games remaining this period badge */}
        {player.gamesThisPeriod != null ? (
          <span style={{
            fontSize: 11, fontWeight: 700, textAlign: "center",
            padding: "2px 6px", borderRadius: 10,
            background: player.gamesThisPeriod > 0 ? "rgba(99,102,241,0.2)" : "rgba(100,116,139,0.15)",
            color: player.gamesThisPeriod > 0 ? "#a5b4fc" : "#475569",
          }}>
            {player.gamesThisPeriod}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>—</span>
        )}

        {isGoalie ? (
          <>
            <Num v={s ? (s as GoalieStats).gp : null} />
            <Num v={s ? (s as GoalieStats).wins : null} />
            <span style={{ textAlign: "right", fontSize: 12, color: "#94a3b8" }}>{s ? fmtSvPct((s as GoalieStats).savePct) : "—"}</span>
            <Num v={s ? (s as GoalieStats).goalsAgainst : null} />
            <Num v={s ? (s as GoalieStats).shutouts : null} />
            <Num v={s ? s.fantasyPoints : null} highlight />
          </>
        ) : (
          <>
            <Num v={s ? (s as SkaterStats).gp : null} />
            <Num v={s ? (s as SkaterStats).goals : null} />
            <Num v={s ? (s as SkaterStats).assists : null} />
            <Num v={s ? (s as SkaterStats).points : null} highlight />
            <Num v={s ? (s as SkaterStats).ppp : null} />
            <Num v={s ? (s as SkaterStats).shots : null} />
            <Num v={s ? (s as SkaterStats).hits : null} />
            <Num v={s ? (s as SkaterStats).blocks : null} />
            <Num v={s ? s.fantasyPoints : null} highlight />
          </>
        )}

        {player.isOnWaivers ? (
          <button
            onClick={onSwitchToWaivers}
            title="Player is on waivers — submit a claim from the Waiver Wire tab"
            style={{ ...smallBtn("#64748b"), fontSize: 10 }}
          >
            Claim
          </button>
        ) : isThisPending && isFull ? (
          <button onClick={onCancel} style={smallBtn("#64748b")}>Cancel</button>
        ) : (
          <button
            onClick={onSelectAdd}
            disabled={disabled || (!!pendingAdd && !isThisPending)}
            style={smallBtn("#6366f1")}
          >
            Add
          </button>
        )}
      </div>

      {isThisPending && isFull && (
        <div style={{ margin: "0 14px 10px", padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>
            Roster is full. Select a player to drop:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rosterPlayers.map((rp) => (
              <label key={rp.playerId} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="radio" name={`drop-for-${player.playerId}`} value={rp.playerId} checked={dropForAdd === rp.playerId} onChange={() => onSelectDrop(rp.playerId)} style={{ accentColor: "#6366f1" }} />
                <span style={{ fontSize: 13, color: "#e2e8f0" }}>{rp.name}</span>
                <span style={{ fontSize: 10, color: POS_COLORS[rp.position] }}>{rp.position[0]}</span>
                <span style={{ fontSize: 10, color: "#475569" }}>{SLOT_LABELS[rp.slot]}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={onConfirmAddDrop} disabled={!dropForAdd || disabled} style={{ ...smallBtn("#6366f1"), opacity: !dropForAdd ? 0.5 : 1 }}>
              Confirm Add / Drop
            </button>
            <button onClick={onCancel} style={smallBtn("#64748b")}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function Num({ v, highlight }: { v: number | null | undefined; highlight?: boolean }) {
  return (
    <span style={{ textAlign: "right", fontSize: 12, color: highlight ? "#e2e8f0" : "#94a3b8", fontWeight: highlight ? 600 : 400 }}>
      {v == null ? "—" : typeof v === "number" && !Number.isInteger(v) ? v.toFixed(1) : v}
    </span>
  );
}

function getSortValue(fa: FreeAgentRow, key: SortKey): number {
  if (key === "gamesThisPeriod") return fa.gamesThisPeriod ?? -1;
  const s = fa.stats;
  if (!s) return -Infinity;
  if (key === "fp") return s.fantasyPoints;
  if (key === "gp") return s.gp ?? 0;
  if ("points" in s) {
    const sk = s as SkaterStats;
    if (key === "pts") return sk.points;
    if (key === "goals") return sk.goals;
    if (key === "assists") return sk.assists;
    if (key === "ppp") return sk.ppp;
    if (key === "shots") return sk.shots;
    if (key === "hits") return sk.hits;
    if (key === "blocks") return sk.blocks;
  }
  if ("wins" in s) {
    const gk = s as GoalieStats;
    if (key === "wins") return gk.wins;
    if (key === "savePct") return gk.savePct ?? -1;
    if (key === "goalsAgainst") return gk.goalsAgainst;
    if (key === "shutouts") return gk.shutouts ?? 0;
  }
  return s.fantasyPoints;
}

function getRosterSortValue(p: RosterPlayerRow, key: SortKey): number {
  const s = p.stats;
  if (!s) return -Infinity;
  return getSortValue({ playerId: p.playerId, name: p.name, position: p.position, teamAbbr: p.teamAbbr, stats: s }, key);
}

function smallBtn(bg: string): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 600, minHeight: 44, padding: "0 12px", borderRadius: 6,
    border: "none", cursor: "pointer", background: `${bg}30`,
    color: bg === "#64748b" ? "#94a3b8" : "#a5b4fc",
    outline: `1px solid ${bg}50`, whiteSpace: "nowrap",
  };
}

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(148,163,184,0.1)",
  borderRadius: 14, overflow: "hidden",
};
