"use client";

import { useState, useTransition, useMemo } from "react";

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
  initialRoster: RosterPlayerRow[];
  freeAgents: FreeAgentRow[];
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

type Tab = "roster" | "freeAgents";
type SortKey = "name" | "pts" | "goals" | "assists" | "ppp" | "shots" | "hits" | "blocks" | "wins" | "savePct" | "fp";

// ── main component ────────────────────────────────────────────────────────────

export default function RosterManager({
  leagueId, teamId, teamName, maxRosterSize, initialRoster, freeAgents,
}: Props) {
  const [tab, setTab] = useState<Tab>("roster");
  const [roster, setRoster] = useState<RosterPlayerRow[]>(initialRoster);
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortAsc, setSortAsc] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<string | null>(null); // playerId being added
  const [dropForAdd, setDropForAdd] = useState<string | null>(null); // playerId to drop when roster full
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      const data = await res.json() as { roster?: RosterPlayerRow[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to add player.");
        return;
      }
      const addedFa = freeAgents.find((p) => p.playerId === addPlayerId);
      setRoster(data.roster!);
      setPendingAdd(null);
      setDropForAdd(null);
      setSuccessMsg(`${addedFa?.name ?? "Player"} added to your roster.`);
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
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      const diff = bv - av; // default desc
      return sortAsc ? -diff : diff;
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeAgents, rosterIds, posFilter, search, sortKey, sortAsc]);

  const sortedRoster = useMemo(() =>
    [...roster].sort((a, b) => (SLOT_ORDER[a.slot] ?? 99) - (SLOT_ORDER[b.slot] ?? 99)),
  [roster]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
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

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, width: "fit-content" }}>
        {([["roster", `My Roster (${roster.length}/${maxRosterSize})`], ["freeAgents", `Free Agents (${freeAgents.filter(p => !rosterIds.has(p.playerId)).length})`]] as [Tab, string][]).map(([t, label]) => (
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

      {/* ── MY ROSTER TAB ──────────────────────────────────────────────────── */}
      {tab === "roster" && (
        <div style={panel}>
          {sortedRoster.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>No players on your roster yet.</p>
          ) : (
            <>
              {/* Skaters */}
              {skaterPositions && (
                <>
                  <ColHeader isGoalie={false} />
                  {sortedRoster.filter((p) => p.position !== "GOALIE").map((p, i) => (
                    <RosterRow key={p.playerId} player={p} index={i}
                      onDrop={() => handleDrop(p.playerId)} disabled={isPending} />
                  ))}
                </>
              )}
              {/* Goalies */}
              {hasGoalies && (
                <>
                  <div style={{ marginTop: skaterPositions ? 16 : 0 }}>
                    <ColHeader isGoalie />
                  </div>
                  {sortedRoster.filter((p) => p.position === "GOALIE").map((p, i) => (
                    <RosterRow key={p.playerId} player={p} index={i}
                      onDrop={() => handleDrop(p.playerId)} disabled={isPending} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── FREE AGENTS TAB ────────────────────────────────────────────────── */}
      {tab === "freeAgents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Filters */}
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

          {/* Free agent table */}
          <div style={panel}>
            <FaColHeader
              isGoalie={posFilter === "GOALIE"}
              sortKey={sortKey} sortAsc={sortAsc}
              onSort={toggleSort}
            />
            {filteredFa.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 13, margin: "12px 0 0" }}>No players match.</p>
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
                  onConfirmAddDrop={() => {
                    if (dropForAdd) handleAdd(fa.playerId, dropForAdd);
                  }}
                  onCancel={() => { setPendingAdd(null); setDropForAdd(null); }}
                  disabled={isPending}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Roster row ─────────────────────────────────────────────────────────────────

function ColHeader({ isGoalie }: { isGoalie: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isGoalie ? "44px 1fr 80px 50px 50px 50px 60px 48px" : "44px 1fr 40px 40px 50px 50px 40px 40px 60px 48px",
      gap: 8, padding: "6px 14px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
      textTransform: "uppercase", color: "#475569",
      borderBottom: "1px solid rgba(148,163,184,0.08)",
    }}>
      <span>Slot</span>
      <span>Player</span>
      {isGoalie ? (
        <><span style={{ textAlign: "right" }}>GP</span><span style={{ textAlign: "right" }}>W</span><span style={{ textAlign: "right" }}>SV%</span><span style={{ textAlign: "right" }}>SO</span><span style={{ textAlign: "right" }}>FPts</span></>
      ) : (
        <><span style={{ textAlign: "right" }}>GP</span><span style={{ textAlign: "right" }}>G</span><span style={{ textAlign: "right" }}>A</span><span style={{ textAlign: "right" }}>PTS</span><span style={{ textAlign: "right" }}>PPP</span><span style={{ textAlign: "right" }}>SOG</span><span style={{ textAlign: "right" }}>FPts</span></>
      )}
      <span />
    </div>
  );
}

function RosterRow({ player, index, onDrop, disabled }: {
  player: RosterPlayerRow; index: number; onDrop: () => void; disabled: boolean;
}) {
  const isGoalie = player.position === "GOALIE";
  const s = player.stats;
  const cols = isGoalie
    ? "44px 1fr 80px 50px 50px 50px 60px 48px"
    : "44px 1fr 40px 40px 50px 50px 40px 40px 60px 48px";

  const fmtSvPct = (v: number | null) => v != null ? v.toFixed(3).replace(/^0/, "") : "—";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols, gap: 8,
      padding: "9px 14px", alignItems: "center",
      borderTop: index === 0 ? "none" : "1px solid rgba(148,163,184,0.05)",
      background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, textAlign: "center",
        padding: "3px 0", borderRadius: 5, width: 36,
        background: `${SLOT_COLORS[player.slot] ?? "#64748b"}20`,
        color: SLOT_COLORS[player.slot] ?? "#64748b",
      }}>
        {SLOT_LABELS[player.slot] ?? player.slot}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.name}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[player.position], flexShrink: 0 }}>
          {player.position[0]}
        </span>
        {player.teamAbbr && (
          <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{player.teamAbbr}</span>
        )}
        {!player.active && (
          <span style={{ fontSize: 10, color: "#ef4444", background: "rgba(239,68,68,0.12)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>INJ</span>
        )}
      </div>

      {isGoalie ? (
        <>
          <Num v={s ? (s as GoalieStats).gp : null} />
          <Num v={s ? (s as GoalieStats).wins : null} />
          <span style={{ textAlign: "right", fontSize: 12, color: "#94a3b8" }}>{s ? fmtSvPct((s as GoalieStats).savePct) : "—"}</span>
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
          <Num v={s ? s.fantasyPoints : null} highlight />
        </>
      )}

      <button
        onClick={onDrop}
        disabled={disabled}
        title="Drop player"
        style={{
          fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6,
          border: "1px solid rgba(248,113,113,0.3)", cursor: "pointer",
          background: "rgba(248,113,113,0.08)", color: "#f87171",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        Drop
      </button>
    </div>
  );
}

// ── Free agent column header ───────────────────────────────────────────────────

function FaColHeader({ isGoalie, sortKey, sortAsc, onSort }: {
  isGoalie: boolean; sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void;
}) {
  const cols = isGoalie
    ? "1fr 70px 70px 70px 70px 60px 80px"
    : "1fr 50px 50px 50px 60px 60px 50px 50px 80px";

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
      gap: 8, padding: "6px 14px 8px",
      borderBottom: "1px solid rgba(148,163,184,0.08)",
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#475569" }}>Player</span>
      {isGoalie ? (
        <><SortTh label="GP" k="fp" /><SortTh label="W" k="wins" /><SortTh label="SV%" k="savePct" /><SortTh label="SO" k="fp" /><SortTh label="FPts" k="fp" /></>
      ) : (
        <><SortTh label="GP" k="fp" /><SortTh label="G" k="goals" /><SortTh label="A" k="assists" /><SortTh label="PTS" k="pts" /><SortTh label="PPP" k="ppp" /><SortTh label="SOG" k="shots" /><SortTh label="FPts" k="fp" /></>
      )}
      <span />
    </div>
  );
}

// ── Free agent row ─────────────────────────────────────────────────────────────

function FaRow({ player, index, isFull, rosterPlayers, pendingAdd, dropForAdd,
  onSelectAdd, onSelectDrop, onConfirmAddDrop, onCancel, disabled }: {
  player: FreeAgentRow; index: number; isFull: boolean;
  rosterPlayers: RosterPlayerRow[]; pendingAdd: string | null; dropForAdd: string | null;
  onSelectAdd: () => void; onSelectDrop: (id: string) => void;
  onConfirmAddDrop: () => void; onCancel: () => void; disabled: boolean;
}) {
  const isGoalie = player.position === "GOALIE";
  const s = player.stats;
  const isThisPending = pendingAdd === player.playerId;
  const cols = isGoalie
    ? "1fr 70px 70px 70px 70px 60px 80px"
    : "1fr 50px 50px 50px 60px 60px 50px 50px 80px";
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
          {player.teamAbbr && (
            <span style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>{player.teamAbbr}</span>
          )}
        </div>

        {isGoalie ? (
          <>
            <Num v={s ? (s as GoalieStats).gp : null} />
            <Num v={s ? (s as GoalieStats).wins : null} />
            <span style={{ textAlign: "right", fontSize: 12, color: "#94a3b8" }}>{s ? fmtSvPct((s as GoalieStats).savePct) : "—"}</span>
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
            <Num v={s ? s.fantasyPoints : null} highlight />
          </>
        )}

        {/* Add button or cancel */}
        {isThisPending && isFull ? (
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

      {/* Drop selector (only shown when roster is full and this row is selected) */}
      {isThisPending && isFull && (
        <div style={{
          margin: "0 14px 10px", padding: "12px 14px", borderRadius: 10,
          background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>
            Roster is full. Select a player to drop:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rosterPlayers.map((rp) => (
              <label key={rp.playerId} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name={`drop-for-${player.playerId}`}
                  value={rp.playerId}
                  checked={dropForAdd === rp.playerId}
                  onChange={() => onSelectDrop(rp.playerId)}
                  style={{ accentColor: "#6366f1" }}
                />
                <span style={{ fontSize: 13, color: "#e2e8f0" }}>{rp.name}</span>
                <span style={{ fontSize: 10, color: POS_COLORS[rp.position] }}>{rp.position[0]}</span>
                <span style={{ fontSize: 10, color: "#475569" }}>{SLOT_LABELS[rp.slot]}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={onConfirmAddDrop}
              disabled={!dropForAdd || disabled}
              style={{ ...smallBtn("#6366f1"), opacity: !dropForAdd ? 0.5 : 1 }}
            >
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
    <span style={{
      textAlign: "right", fontSize: 12,
      color: highlight ? "#e2e8f0" : "#94a3b8",
      fontWeight: highlight ? 600 : 400,
    }}>
      {v == null ? "—" : typeof v === "number" && !Number.isInteger(v) ? v.toFixed(1) : v}
    </span>
  );
}

function getSortValue(fa: FreeAgentRow, key: SortKey): number {
  const s = fa.stats;
  if (!s) return -Infinity;
  if (key === "fp") return s.fantasyPoints;
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
  }
  return s.fantasyPoints;
}

function smallBtn(bg: string): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
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
