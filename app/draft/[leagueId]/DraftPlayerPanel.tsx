"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { styles } from "./draftStyles";
import type { DraftState, PlayerSummary } from "@/lib/draft/messages";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";
import { LIVE_SEASON } from "@/lib/constants";

export type SortKey = "points" | "goals" | "assists" | "ppp" | "shots" | "hits" | "blocks" | "wins" | "saves" | "savePct" | "shutouts" | "gp" | "goalsAgainst";

export const SKATER_COLS: { key: SortKey; label: string; tooltip?: string; mobile?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "ppp", label: "PPP", tooltip: "Power play points", mobile: true },
  { key: "shots", label: "SOG", tooltip: "Shots on goal", mobile: true },
  { key: "hits", label: "HIT", tooltip: "Hits delivered", mobile: true },
  { key: "blocks", label: "BLK", tooltip: "Shots blocked (not by the goalie)", mobile: true },
];

export const GOALIE_COLS: { key: SortKey; label: string; tooltip?: string; mobile?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "wins", label: "W" },
  { key: "saves", label: "SV", tooltip: "Saves", mobile: true },
  { key: "goalsAgainst", label: "GA", tooltip: "Goals against — goals allowed", mobile: true },
  { key: "savePct", label: "SV%", tooltip: "Save percentage — saves ÷ shots faced" },
  { key: "shutouts", label: "SO", tooltip: "Shutouts — full game, zero goals allowed", mobile: true },
];

export function PosTag({ pos }: { pos: string }) {
  return (
    <span
      style={{
        background: "rgba(143,193,232,0.6)",
        color: "var(--accent-ink)",
        borderRadius: 5,
        padding: "3px 7px",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      {pos === "FORWARD" ? "F" : pos === "DEFENSE" ? "D" : "G"}
    </span>
  );
}

export function PlayerPanel({
  draft,
  teamId,
  leagueId,
  available,
  queue,
  initialStats,
  initialStatSeason,
  onPick,
  onSearch,
  onSetQueue,
}: {
  draft: DraftState;
  teamId: string;
  leagueId: string;
  available: PlayerSummary[];
  queue: string[];
  initialStats: PlayerStats[];
  initialStatSeason: string | null;
  onPick: (playerId: string) => void;
  onSearch: (q: string) => void;
  onSetQueue: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "queue">("available");
  const [posFilter, setPosFilter] = useState<"" | "FORWARD" | "DEFENSE" | "GOALIE">("");
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [glossaryOpen, setGlossaryOpen] = useState(true);
  const [statsMap, setStatsMap] = useState<Record<string, PlayerStats>>(() =>
    Object.fromEntries(initialStats.map((s) => [s.id, s]))
  );
  const [statSeason, setStatSeason] = useState<string | null>(initialStatSeason);
  const [loadingStats, setLoadingStats] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  const onClock = draft.order.find((s) => s.overall === draft.currentOverall);
  const isMyTurn = draft.status === "IN_PROGRESS" && onClock?.fantasyTeamId === teamId;
  const drafted = new Set(draft.draftedPlayerIds);

  // Only hit the API for filtered searches — initial full list comes from SSR props.
  const fetchStats = useCallback(
    async (q: string, pos: string) => {
      fetchControllerRef.current?.abort();
      const ctrl = new AbortController();
      fetchControllerRef.current = ctrl;
      setLoadingStats(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("search", q);
        if (pos) params.set("position", pos);
        const res = await fetch(`/api/leagues/${leagueId}/draft/players?${params}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json() as { season: string | null; players: PlayerStats[] };
        setStatSeason(data.season);
        setStatsMap((prev) => {
          const next = { ...prev };
          for (const p of data.players) next[p.id] = p;
          return next;
        });
      } catch {
        // aborted or network error — ignore
      } finally {
        setLoadingStats(false);
      }
    },
    [leagueId]
  );

  // Only fetch on position filter change (not on initial mount — SSR props cover that).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchStats(search, posFilter);
  }, [posFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      onSearch(q || "");
      fetchStats(q, posFilter);
    }, 300);
  };

  const handlePosFilter = (pos: "" | "FORWARD" | "DEFENSE" | "GOALIE") => {
    setPosFilter(pos);
    if (pos === "GOALIE") setSortKey("wins");
    else setSortKey("points");
  };

  const addToQueue = (id: string) => {
    if (!queue.includes(id)) onSetQueue([...queue, id]);
  };
  const removeFromQueue = (id: string) => onSetQueue(queue.filter((q) => q !== id));
  const moveInQueue = (id: string, dir: -1 | 1) => {
    const idx = queue.indexOf(id);
    if (idx < 0) return;
    const next = [...queue];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onSetQueue(next);
  };

  const showingGoalies = posFilter === "GOALIE";
  const cols = showingGoalies ? GOALIE_COLS : SKATER_COLS;

  const rows = available
    .filter((p) => !drafted.has(p.id))
    .filter((p) => !posFilter || p.position === posFilter)
    .map((p) => ({ player: p, stats: statsMap[p.id] ?? null }))
    .sort((a, b) => {
      const av = (a.stats?.[sortKey] as number | null | undefined) ?? -1;
      const bv = (b.stats?.[sortKey] as number | null | undefined) ?? -1;
      if (sortKey === "goalsAgainst") return av - bv;
      return bv - av;
    });

  const queuedPlayers = queue
    .map((id) => available.find((p) => p.id === id))
    .filter((p): p is PlayerSummary => !!p && !drafted.has(p.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {isMyTurn && (
        <div role="alert" style={styles.yourPickBanner}>
          You&apos;re on the clock! Pick a player below. If the timer runs out, we&apos;ll auto-pick the best player still available.
        </div>
      )}

      <div style={styles.card}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {(["available", "queue"] as const).map((tab) => (
            <button
              key={tab}
              style={{ ...styles.tab, background: activeTab === tab ? "var(--accent)" : "rgba(150,160,200,0.08)", color: activeTab === tab ? "var(--accent-ink)" : "var(--muted)" }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "available" ? "Available" : `My List (${queuedPlayers.length})`}
            </button>
          ))}
        </div>

        {activeTab === "available" && (
          <>
            {/* Search + position filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" as const }}>
              <input
                style={{ ...styles.input, flex: 1, minWidth: 140 }}
                placeholder="Search by last name…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <div style={{ display: "flex", gap: 4 }}>
                {(["", "FORWARD", "DEFENSE", "GOALIE"] as const).map((pos) => (
                  <button
                    key={pos || "all"}
                    style={{ ...styles.tab, minHeight: 44, padding: "0 12px", background: posFilter === pos ? "var(--accent)" : "rgba(150,160,200,0.08)", color: posFilter === pos ? "var(--accent-ink)" : "var(--muted)" }}
                    onClick={() => handlePosFilter(pos)}
                  >
                    {pos === "" ? "All" : pos === "FORWARD" ? "F" : pos === "DEFENSE" ? "D" : "G"}
                  </button>
                ))}
              </div>
            </div>

            {statSeason && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                Stats: {statSeason} season{loadingStats ? " · loading…" : ""}
              </div>
            )}
            {statSeason && statSeason !== LIVE_SEASON && (
              <div style={{
                fontSize: 12,
                color: "var(--accent-strong)",
                background: "rgba(143,193,232,0.07)",
                border: "1px solid rgba(143,193,232,0.18)",
                borderRadius: 6,
                padding: "6px 10px",
                marginBottom: 6,
              }}>
                Stats shown are from the <strong>{statSeason} season</strong> — your scouting baseline.
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--accent-strong)", marginBottom: 8 }}>
              🏒 4 expansion teams join 2026-27 — DET · HAM · LV · SJ
            </div>

            {/* Stat glossary toggle */}
            <div style={{ marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => setGlossaryOpen((v) => !v)}
                style={{ fontSize: 11, color: "var(--accent-strong)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {glossaryOpen ? "▴ Hide" : "What do these stats mean? ▾"}
              </button>
              {glossaryOpen && (
                <div style={{
                  marginTop: 6, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(150,160,200,0.06)", border: "1px solid rgba(150,160,200,0.12)",
                  fontSize: 11, color: "var(--muted)", lineHeight: 1.7,
                }}>
                  <strong style={{ color: "var(--text)" }}>Skaters:</strong>{" "}
                  G = Goals · A = Assists · PTS = Points · PPP = Power Play Points · SOG = Shots on Goal · HIT = Hits · BLK = Blocked Shots
                  <br />
                  <strong style={{ color: "var(--text)" }}>Goalies:</strong>{" "}
                  W = Wins · SV = Saves · GA = Goals Against · SV% = Save % · SO = Shutouts
                  <br />
                  <strong style={{ color: "var(--text)" }}>Tm:</strong> Team abbreviation · FA = Free agent (no PWHL team yet)
                </div>
              )}
            </div>

            <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
              ★ Add to my list — if your clock runs out, we&apos;ll auto-pick from the top.
            </p>

            {rows.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "8px 0", fontSize: 12 }}>
                {available.length === 0 ? "Loading players…" : "No players match."}
              </p>
            ) : (
              <div className="draft-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
                <table style={{ ...styles.table, width: "100%", minWidth: 560 }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
                    <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={styles.th}>Pos</th>
                      <th style={styles.th}>Tm</th>
                      <th style={{ ...styles.th, minWidth: 130 }}>Player</th>
                      {cols.map((c) => (
                        <th
                          key={c.key}
                          className={c.mobile ? "stat-secondary" : undefined}
                          style={{ ...styles.th, textAlign: "right", cursor: "pointer", color: sortKey === c.key ? "var(--accent-strong)" : "var(--muted)", userSelect: "none" }}
                          onClick={() => setSortKey(c.key)}
                        >
                          {c.tooltip
                            ? <abbr title={c.tooltip} style={{ textDecoration: "underline dotted", textDecorationColor: "rgba(150,160,200,0.4)", textUnderlineOffset: 2, cursor: "pointer", fontStyle: "normal" }}>{c.label}</abbr>
                            : c.label
                          }{sortKey === c.key ? " ▾" : ""}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ player: p, stats: s }) => (
                      <tr key={p.id} className="draft-player-row" style={styles.playerRow}>
                        <td style={{ padding: "5px 6px" }}><PosTag pos={p.position} /></td>
                        <td style={{ padding: "5px 6px", color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }} title={p.team ? undefined : "Free agent — not currently on a PWHL roster"}>{p.team ?? "FA"}</td>
                        <td style={{ padding: "5px 6px", fontSize: 13, whiteSpace: "nowrap" }}>{p.name}</td>
                        {cols.map((c) => {
                          const val = s ? (s[c.key] as number | null) : null;
                          const display = val == null ? "—" : c.key === "savePct" ? (val as number).toFixed(3).replace(/^0/, "") : String(val);
                          return (
                            <td key={c.key} className={c.mobile ? "stat-secondary font-stats" : "font-stats"} style={{ padding: "5px 6px", textAlign: "right", fontSize: 12, color: sortKey === c.key ? "var(--text)" : "var(--muted)" }}>
                              {display}
                            </td>
                          );
                        })}
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {isMyTurn && (
                              <button style={styles.btnPick} onClick={() => onPick(p.id)} aria-label={`Draft ${p.name}`}>Pick</button>
                            )}
                            <button
                              style={styles.starBtn}
                              onClick={() => queue.includes(p.id) ? removeFromQueue(p.id) : addToQueue(p.id)}
                              title={queue.includes(p.id) ? "Remove from My List" : "Add to My List"}
                            >
                              {queue.includes(p.id)
                                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent-strong)" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "queue" && (
          <div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
              Players are auto-drafted from the top of your list when the timer expires.
            </p>
            {queuedPlayers.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12 }}>
                Nothing on your list yet. Add players from the Available tab.
              </p>
            ) : (
              <div>
                {queuedPlayers.map((p, i) => {
                  const s = statsMap[p.id];
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--muted)", minWidth: 18, fontSize: 11 }}>{i + 1}</span>
                      <PosTag pos={p.position} />
                      <span style={{ flex: 1 }}>{p.name}</span>
                      {s && p.position !== "GOALIE" && (
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>{s.points}pts</span>
                      )}
                      {s && p.position === "GOALIE" && (
                        <span style={{ color: "var(--muted)", fontSize: 11 }}>{s.wins}W</span>
                      )}
                      <span style={{ color: "var(--muted)", fontSize: 11 }} title={p.team ? undefined : "Free agent — not currently on a PWHL roster"}>{p.team ?? "FA"}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={styles.queueBtn} onClick={() => moveInQueue(p.id, -1)} disabled={i === 0} aria-label={`Move ${p.name} up in list`}>↑</button>
                        <button style={styles.queueBtn} onClick={() => moveInQueue(p.id, 1)} disabled={i === queuedPlayers.length - 1} aria-label={`Move ${p.name} down in list`}>↓</button>
                        {isMyTurn && (
                          <button style={{ ...styles.btnPick, fontSize: 11, padding: "3px 8px" }} onClick={() => onPick(p.id)} aria-label={`Draft ${p.name}`}>Pick</button>
                        )}
                        <button style={{ ...styles.queueBtn, color: "var(--red)" }} onClick={() => removeFromQueue(p.id)} aria-label={`Remove ${p.name} from list`}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
