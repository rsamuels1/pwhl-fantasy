"use client";

import { useState, useCallback } from "react";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";

type SortKey = "gp" | "goals" | "assists" | "points" | "plusMinus" | "ppp" | "shots" | "hits" | "blocks" | "wins" | "saves" | "goalsAgainst" | "shutouts" | "savePct";

interface Props {
  leagueId: string;
  teamId: string;
  players: PlayerStats[];
  initialQueue: string[];
  statSeason: string | null;
}

const POSITION_ORDER = { FORWARD: 0, DEFENSE: 1, GOALIE: 2 };

export default function DraftQueueManager({
  leagueId,
  teamId,
  players,
  initialQueue,
  statSeason,
}: Props) {
  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "FORWARD" | "DEFENSE" | "GOALIE">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortAsc, setSortAsc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const saveQueue = useCallback(async (newQueue: string[]) => {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft/queue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, playerIds: newQueue }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      setSavedOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [leagueId, teamId]);

  function toggleQueue(playerId: string) {
    const newQueue = queue.includes(playerId)
      ? queue.filter((id) => id !== playerId)
      : [...queue, playerId];
    setQueue(newQueue);
    void saveQueue(newQueue);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const newQueue = [...queue];
    [newQueue[idx - 1], newQueue[idx]] = [newQueue[idx], newQueue[idx - 1]];
    setQueue(newQueue);
    void saveQueue(newQueue);
  }

  function moveDown(idx: number) {
    if (idx === queue.length - 1) return;
    const newQueue = [...queue];
    [newQueue[idx], newQueue[idx + 1]] = [newQueue[idx + 1], newQueue[idx]];
    setQueue(newQueue);
    void saveQueue(newQueue);
  }

  function removeFromQueue(playerId: string) {
    const newQueue = queue.filter((id) => id !== playerId);
    setQueue(newQueue);
    void saveQueue(newQueue);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = players
    .filter((p) => {
      if (posFilter !== "ALL" && p.position !== posFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.team ?? "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return sortAsc ? av - bv : bv - av;
    });

  const thStyle: React.CSSProperties = {
    padding: "8px 10px",
    textAlign: "left",
    color: "var(--faint)",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  const tdStyle: React.CSSProperties = {
    padding: "7px 10px",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
    whiteSpace: "nowrap",
  };

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    return (
      <th style={{ ...thStyle, color: sortKey === col ? "var(--accent-strong)" : "var(--faint)" }} onClick={() => handleSort(col)}>
        {label}{sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
      {/* Left: player table */}
      <div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 12px",
              color: "var(--text)",
              fontSize: 13,
              outline: "none",
              flex: 1,
              minWidth: 160,
            }}
          />
          {(["ALL", "FORWARD", "DEFENSE", "GOALIE"] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              style={{
                padding: "5px 10px",
                background: posFilter === pos ? "rgba(143,193,232,0.2)" : "transparent",
                border: `1px solid ${posFilter === pos ? "rgba(143,193,232,0.5)" : "var(--border)"}`,
                borderRadius: 5,
                color: posFilter === pos ? "var(--accent-strong)" : "var(--faint)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {pos === "ALL" ? "All" : pos === "FORWARD" ? "F" : pos === "DEFENSE" ? "D" : "G"}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--card)" }}>
                <th style={thStyle}>Player</th>
                <th style={thStyle}>Pos</th>
                <th style={thStyle}>Team</th>
                <SortHeader label="GP" col="gp" />
                <SortHeader label="G" col="goals" />
                <SortHeader label="A" col="assists" />
                <SortHeader label="PTS" col="points" />
                <SortHeader label="PPP" col="ppp" />
                <SortHeader label="SOG" col="shots" />
                <SortHeader label="HIT" col="hits" />
                <SortHeader label="BLK" col="blocks" />
                <SortHeader label="W" col="wins" />
                <SortHeader label="SV%" col="savePct" />
                <SortHeader label="SO" col="shutouts" />
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} style={{ ...tdStyle, color: "var(--faint)", textAlign: "center", padding: "24px" }}>
                    No players match your filter.
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const inQueue = queue.includes(p.id);
                const isGoalie = p.position === "GOALIE";
                return (
                  <tr
                    key={p.id}
                    style={{
                      background: inQueue ? "rgba(143,193,232,0.07)" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <td style={{ ...tdStyle, color: "var(--text)", fontWeight: 500 }}>{p.name}</td>
                    <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.position === "FORWARD" ? "F" : p.position === "DEFENSE" ? "D" : "G"}</td>
                    <td style={{ ...tdStyle, color: "var(--faint)" }}>{p.team ?? "—"}</td>
                    <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.gp}</td>
                    {isGoalie ? (
                      <>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.wins}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.savePct != null ? (p.savePct * 100).toFixed(1) + "%" : "—"}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.shutouts}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.goals}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.assists}</td>
                        <td style={{ ...tdStyle, color: "var(--text)", fontWeight: 600 }}>{p.points}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.ppp}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.shots}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.hits}</td>
                        <td style={{ ...tdStyle, color: "var(--dim)" }}>{p.blocks}</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                        <td style={{ ...tdStyle, color: "var(--faint)" }}>—</td>
                      </>
                    )}
                    <td style={tdStyle}>
                      <button
                        onClick={() => toggleQueue(p.id)}
                        title={inQueue ? "Remove from queue" : "Add to queue"}
                        style={{
                          background: inQueue ? "rgba(143,193,232,0.2)" : "transparent",
                          border: `1px solid ${inQueue ? "rgba(143,193,232,0.5)" : "rgba(255,255,255,0.12)"}`,
                          borderRadius: 4,
                          color: inQueue ? "var(--accent-strong)" : "var(--faint)",
                          padding: "3px 8px",
                          fontSize: 14,
                          cursor: "pointer",
                          lineHeight: 1,
                        }}
                      >
                        {inQueue ? "★" : "☆"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!statSeason && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--faint)" }}>
            No stat data available — stats will appear after prior-season data is loaded.
          </div>
        )}
      </div>

      {/* Right: queue panel */}
      <div>
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              My Queue
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {saving && <span style={{ fontSize: 11, color: "var(--faint)" }}>Saving…</span>}
              {savedOk && !saving && <span style={{ fontSize: 11, color: "#34d399" }}>Saved</span>}
              {saveError && <span style={{ fontSize: 11, color: "#f87171" }}>{saveError}</span>}
            </div>
          </div>

          {queue.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              No players queued yet.
              <br />
              <span style={{ fontSize: 12 }}>Star a player on the left to add them.</span>
            </div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {queue.map((id, idx) => {
                const p = playerMap.get(id);
                if (!p) return null;
                return (
                  <li
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--bg-raised)",
                      borderRadius: 5,
                      padding: "6px 8px",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "var(--faint)", width: 18, textAlign: "center", flexShrink: 0 }}>{idx + 1}</span>
                    <span style={{ fontSize: 12, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>
                      {p.position === "FORWARD" ? "F" : p.position === "DEFENSE" ? "D" : "G"}
                    </span>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        style={{ background: "transparent", border: "none", color: idx === 0 ? "var(--surface)" : "var(--faint)", cursor: idx === 0 ? "default" : "pointer", padding: "1px 4px", fontSize: 12, lineHeight: 1 }}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === queue.length - 1}
                        style={{ background: "transparent", border: "none", color: idx === queue.length - 1 ? "var(--surface)" : "var(--faint)", cursor: idx === queue.length - 1 ? "default" : "pointer", padding: "1px 4px", fontSize: 12, lineHeight: 1 }}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeFromQueue(id)}
                        style={{ background: "transparent", border: "none", color: "var(--faint)", cursor: "pointer", padding: "1px 4px", fontSize: 12, lineHeight: 1 }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "var(--faint)", lineHeight: 1.4 }}>
          Your queue is used for auto-picks during the live draft. Players are picked in order when it is your turn and you have not manually picked.
        </div>
      </div>
    </div>
  );
}
