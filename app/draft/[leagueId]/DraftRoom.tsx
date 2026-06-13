"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import React from "react";

function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}
import { useDraftSocket } from "@/hooks/useDraftSocket";
import type { DraftState, PlayerSummary } from "@/lib/draft/messages";
import type { PickSlot } from "@/lib/draft/snake";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function TopBar({
  leagueId,
  teamId,
  teamNames,
  draft,
  connStatus,
  isCommissioner,
  onStart,
  onPause,
  onResume,
}: {
  leagueId: string;
  teamId: string;
  teamNames: Record<string, string>;
  draft: DraftState | null;
  connStatus: string;
  isCommissioner: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const onClockTeamId =
    draft?.status === "IN_PROGRESS"
      ? draft.order.find((s) => s.overall === draft.currentOverall)?.fantasyTeamId
      : null;
  const isMyTurn = onClockTeamId === teamId;

  return (
    <header style={styles.topBar}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>PWHL Fantasy Draft</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {teamNames[teamId] ?? `…${teamId.slice(-6)}`}
        </span>
        {onClockTeamId && draft?.status === "IN_PROGRESS" && (
          <span style={{ fontSize: 12, color: isMyTurn ? "var(--green)" : "var(--muted)" }}>
            {isMyTurn ? "Your pick!" : `On clock: ${teamNames[onClockTeamId] ?? "…" + onClockTeamId.slice(-6)}`}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {draft?.status === "IN_PROGRESS" && (
          <Clock expiresAt={draft.expiresAt} isMyTurn={isMyTurn} />
        )}

        {isCommissioner && draft?.status === "PENDING" && (
          <button style={styles.btnPrimary} onClick={onStart}>
            Start Draft
          </button>
        )}
        {isCommissioner && draft?.status === "IN_PROGRESS" && (
          <button style={styles.btnSecondary} onClick={onPause}>
            Pause
          </button>
        )}
        {isCommissioner && draft?.status === "PAUSED" && (
          <button style={styles.btnPrimary} onClick={onResume}>
            Resume
          </button>
        )}

        <StatusBadge status={draft?.status ?? null} conn={connStatus} />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Countdown clock
// ---------------------------------------------------------------------------

function Clock({ expiresAt, isMyTurn }: { expiresAt: number | null; isMyTurn: boolean }) {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    if (expiresAt == null) { setSecs(null); return; }
    const tick = () => setSecs(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (secs == null) return null;
  const warn = secs <= 10;
  return (
    <div
      style={{
        ...styles.clock,
        color: warn ? "var(--clock-warn)" : isMyTurn ? "var(--green)" : "var(--text)",
        borderColor: warn ? "var(--clock-warn)" : isMyTurn ? "var(--green)" : "var(--border)",
      }}
    >
      {secs}s
    </div>
  );
}

function StatusBadge({ status, conn }: { status: string | null; conn: string }) {
  const dot = conn === "open" ? "var(--green)" : conn === "error" ? "var(--red)" : "var(--muted)";
  const label = status ?? conn;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
      <span style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
        {label?.replace("_", " ")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Snake pick board
// ---------------------------------------------------------------------------

function PickBoard({
  draft,
  myTeamId,
  teamNames,
  playerNames,
}: {
  draft: DraftState;
  myTeamId: string;
  teamNames: Record<string, string>;
  playerNames: Record<string, string>;
}) {
  const rounds = new Map<number, PickSlot[]>();
  for (const slot of draft.order) {
    const r = rounds.get(slot.round) ?? [];
    r.push(slot);
    rounds.set(slot.round, r);
  }

  const pickByOverall = new Map(draft.completed.map((p) => [p.overall, p]));

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Pick Board</div>
      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <tbody>
            {[...rounds.entries()].map(([round, slots]) => (
              <tr key={round}>
                <td style={styles.roundLabel}>R{round}</td>
                {slots.map((slot) => {
                  const pick = pickByOverall.get(slot.overall);
                  const isOnClock =
                    slot.overall === draft.currentOverall && draft.status === "IN_PROGRESS";
                  const isMe = slot.fantasyTeamId === myTeamId;
                  const shortTeam = teamNames[slot.fantasyTeamId]?.split(" ").map((w) => w[0]).join("") ?? "?";
                  const playerLabel = pick
                    ? playerNames[pick.playerId] ?? `…${pick.playerId.slice(-5)}`
                    : null;

                  return (
                    <td
                      key={slot.overall}
                      style={{
                        ...styles.pickCell,
                        background: isOnClock
                          ? "var(--accent)"
                          : pick
                          ? isMe
                            ? "rgba(34,197,94,0.15)"
                            : "var(--surface)"
                          : "transparent",
                        border: `1px solid ${isOnClock ? "var(--accent)" : isMe ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                        opacity: pick && !isMe ? 0.65 : 1,
                      }}
                      title={
                        pick
                          ? `#${pick.overall} ${teamNames[pick.fantasyTeamId] ?? pick.fantasyTeamId}: ${playerNames[pick.playerId] ?? pick.playerId}${pick.auto ? " (auto)" : ""}`
                          : `#${slot.overall} — ${teamNames[slot.fantasyTeamId] ?? slot.fantasyTeamId}`
                      }
                    >
                      <div style={{ fontSize: 9, color: isOnClock ? "#fff" : "var(--muted)" }}>
                        #{slot.overall}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: isMe ? 700 : 400, color: isOnClock ? "#fff" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 46 }}>
                        {playerLabel
                          ? playerLabel.split(" ").slice(-1)[0]
                          : isOnClock
                          ? "⏱"
                          : isMe
                          ? shortTeam
                          : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent picks feed
// ---------------------------------------------------------------------------

function RecentPicks({
  draft,
  teamNames,
  playerNames,
}: {
  draft: DraftState;
  teamNames: Record<string, string>;
  playerNames: Record<string, string>;
}) {
  const recent = [...draft.completed].reverse().slice(0, 10);
  if (recent.length === 0) return null;
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Recent Picks</div>
      <div>
        {recent.map((p) => (
          <div key={p.overall} style={styles.recentRow}>
            <span style={{ color: "var(--muted)", minWidth: 28, fontSize: 11 }}>#{p.overall}</span>
            <span style={{ color: "var(--muted)", minWidth: 20, fontSize: 11 }}>R{p.round}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {playerNames[p.playerId] ?? `…${p.playerId.slice(-8)}`}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
              {teamNames[p.fantasyTeamId]?.split(" ").slice(0, 2).join(" ") ?? `…${p.fantasyTeamId.slice(-6)}`}
            </span>
            {p.auto && (
              <span style={{ color: "var(--clock-warn)", fontSize: 10, marginLeft: 4 }}>auto</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Picks panel
// ---------------------------------------------------------------------------

function MyPicks({
  draft,
  myTeamId,
  playerNames,
  playerPositions,
}: {
  draft: DraftState;
  myTeamId: string;
  playerNames: Record<string, string>;
  playerPositions: Record<string, string>;
}) {
  const myPicks = draft.completed.filter((p) => p.fantasyTeamId === myTeamId);

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>My Roster ({myPicks.length})</div>
      {myPicks.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 12 }}>No picks yet.</p>
      ) : (
        <div>
          {myPicks.map((p) => {
            const pos = playerPositions[p.playerId];
            return (
              <div key={p.overall} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)", minWidth: 28, fontSize: 11 }}>#{p.overall}</span>
                {pos && <PosTag pos={pos} />}
                <span style={{ flex: 1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {playerNames[p.playerId] ?? `…${p.playerId.slice(-8)}`}
                </span>
                {p.auto && <span style={{ color: "var(--clock-warn)", fontSize: 10 }}>auto</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster needs panel
// ---------------------------------------------------------------------------

const SLOT_LABELS: Record<string, string> = {
  forward: "Forward",
  defense: "Defense",
  goalie: "Goalie",
  util: "Util",
  bench: "Bench",
  ir: "IR",
};

// Simulate slot assignment from drafted picks, matching the same priority order
// used by seed scripts: natural position → util (skaters only) → bench.
function simulateSlotFill(
  picks: Array<{ playerId: string }>,
  positions: Record<string, string>,
  settings: Record<string, number>
): Record<string, number> {
  const caps = { ...settings };
  const filled: Record<string, number> = Object.fromEntries(
    Object.keys(caps).map((k) => [k, 0])
  );
  for (const pick of picks) {
    const pos = positions[pick.playerId]?.toLowerCase() ?? "";
    if (pos === "forward" && (filled.forward ?? 0) < (caps.forward ?? 0)) {
      filled.forward = (filled.forward ?? 0) + 1;
    } else if (pos === "defense" && (filled.defense ?? 0) < (caps.defense ?? 0)) {
      filled.defense = (filled.defense ?? 0) + 1;
    } else if (pos === "goalie" && (filled.goalie ?? 0) < (caps.goalie ?? 0)) {
      filled.goalie = (filled.goalie ?? 0) + 1;
    } else if (pos !== "goalie" && (filled.util ?? 0) < (caps.util ?? 0)) {
      filled.util = (filled.util ?? 0) + 1;
    } else {
      filled.bench = (filled.bench ?? 0) + 1;
    }
  }
  return filled;
}

function TeamSpreadPanel({
  draft,
  myTeamId,
  playerTeams,
}: {
  draft: DraftState;
  myTeamId: string;
  playerTeams: Record<string, string | null>;
}) {
  const myPicks = draft.completed.filter((p) => p.fantasyTeamId === myTeamId);
  const counts: Record<string, number> = {};
  for (const pick of myPicks) {
    const team = playerTeams[pick.playerId] ?? "—";
    counts[team] = (counts[team] ?? 0) + 1;
  }
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Team Spread</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>No picks yet</div>
      ) : (
        rows.map(([team, count]) => {
          const color = count >= 4 ? "var(--clock-warn)" : count === 3 ? "#f59e0b" : "var(--text)";
          return (
            <div key={team} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ flex: 1, color: "var(--text)" }}>{team}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color }}>{count}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function NeedsPanel({
  draft,
  myTeamId,
  rosterSettings,
  playerPositions,
}: {
  draft: DraftState;
  myTeamId: string;
  rosterSettings: Record<string, number>;
  playerPositions: Record<string, string>;
}) {
  const myPicks = draft.completed.filter((p) => p.fantasyTeamId === myTeamId);

  const filled = simulateSlotFill(myPicks, playerPositions, rosterSettings);

  // Draft rounds exclude IR (filled from waivers post-draft).
  const draftSlots = Object.entries(rosterSettings)
    .filter(([k]) => k !== "ir")
    .reduce((s, [, n]) => s + n, 0);
  const totalDrafted = myPicks.length;

  const draftableSlots = Object.entries(rosterSettings).filter(([k]) => k !== "ir");

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Roster Needs</div>
      <div style={{ marginBottom: 8, fontSize: 12, color: "var(--muted)" }}>
        {totalDrafted} / {draftSlots} picks made
      </div>
      {draftableSlots.map(([slot, need]) => {
        const have = filled[slot] ?? 0;
        const remaining = Math.max(0, need - have);
        const done = remaining === 0;
        return (
          <div key={slot} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
            <span style={{ flex: 1, color: done ? "var(--muted)" : "var(--text)" }}>
              {SLOT_LABELS[slot] ?? slot}
            </span>
            <span style={{
              color: done ? "var(--green)" : remaining <= 1 ? "var(--clock-warn)" : "var(--text)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}>
              {have}/{need}
            </span>
            {done && <span style={{ fontSize: 10, color: "var(--green)" }}>✓</span>}
          </div>
        );
      })}
      {(rosterSettings.ir ?? 0) > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
          +{rosterSettings.ir} IR slot{rosterSettings.ir > 1 ? "s" : ""} (fill from waivers)
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player list + stats + queue management
// ---------------------------------------------------------------------------

type SortKey = "points" | "goals" | "assists" | "ppp" | "shots" | "hits" | "blocks" | "wins" | "saves" | "savePct" | "shutouts" | "gp" | "goalsAgainst";

const SKATER_COLS: { key: SortKey; label: string; mobile?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "ppp", label: "PPP", mobile: true },
  { key: "shots", label: "SOG", mobile: true },
  { key: "hits", label: "HIT", mobile: true },
  { key: "blocks", label: "BLK", mobile: true },
];

const GOALIE_COLS: { key: SortKey; label: string; mobile?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "wins", label: "W" },
  { key: "saves", label: "SV", mobile: true },
  { key: "goalsAgainst", label: "GA", mobile: true },
  { key: "savePct", label: "SV%" },
  { key: "shutouts", label: "SO", mobile: true },
];

function PlayerPanel({
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
    // Reset sort to something sensible for the position
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

  // Merge available players with stats, apply position filter, sort
  const showingGoalies = posFilter === "GOALIE";
  const cols = showingGoalies ? GOALIE_COLS : SKATER_COLS;

  const rows = available
    .filter((p) => !drafted.has(p.id))
    .filter((p) => !posFilter || p.position === posFilter)
    .map((p) => ({ player: p, stats: statsMap[p.id] ?? null }))
    .sort((a, b) => {
      const av = (a.stats?.[sortKey] as number | null | undefined) ?? -1;
      const bv = (b.stats?.[sortKey] as number | null | undefined) ?? -1;
      // For GA lower is better; for everything else higher is better
      if (sortKey === "goalsAgainst") return av - bv;
      return bv - av;
    });

  const queuedPlayers = queue
    .map((id) => available.find((p) => p.id === id))
    .filter((p): p is PlayerSummary => !!p && !drafted.has(p.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {isMyTurn && (
        <div style={styles.yourPickBanner}>
          Your pick — select a player or your next queued player will be auto-drafted
        </div>
      )}

      <div style={styles.card}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {(["available", "queue"] as const).map((tab) => (
            <button
              key={tab}
              style={{ ...styles.tab, background: activeTab === tab ? "var(--accent)" : "transparent", color: activeTab === tab ? "#fff" : "var(--muted)" }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "available" ? "Available" : `Queue (${queuedPlayers.length})`}
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
                    style={{ ...styles.tab, minHeight: 44, padding: "0 12px", background: posFilter === pos ? "var(--accent)" : "transparent", color: posFilter === pos ? "#fff" : "var(--muted)" }}
                    onClick={() => handlePosFilter(pos)}
                  >
                    {pos === "" ? "All" : pos === "FORWARD" ? "F" : pos === "DEFENSE" ? "D" : "G"}
                  </button>
                ))}
              </div>
            </div>

            {statSeason && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
                Stats: {statSeason} season{loadingStats ? " · loading…" : ""}
              </div>
            )}

            {rows.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "8px 0", fontSize: 12 }}>
                {available.length === 0 ? "Loading players…" : "No players match."}
              </p>
            ) : (
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
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
                          title={`Sort by ${c.label}`}
                        >
                          {c.label}{sortKey === c.key ? " ▾" : ""}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ player: p, stats: s }) => (
                      <tr key={p.id} style={styles.playerRow}>
                        <td style={{ padding: "5px 6px" }}><PosTag pos={p.position} /></td>
                        <td style={{ padding: "5px 6px", color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{p.team ?? "FA"}</td>
                        <td style={{ padding: "5px 6px", fontSize: 13, whiteSpace: "nowrap" }}>{p.name}</td>
                        {cols.map((c) => {
                          const val = s ? (s[c.key] as number | null) : null;
                          const display = val == null ? "—" : c.key === "savePct" ? (val as number).toFixed(3).replace(/^0/, "") : String(val);
                          return (
                            <td key={c.key} className={c.mobile ? "stat-secondary" : undefined} style={{ padding: "5px 6px", textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: sortKey === c.key ? "var(--text)" : "var(--muted)" }}>
                              {display}
                            </td>
                          );
                        })}
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {isMyTurn && (
                              <button style={styles.btnPick} onClick={() => onPick(p.id)}>Pick</button>
                            )}
                            <button
                              style={styles.starBtn}
                              onClick={() => queue.includes(p.id) ? removeFromQueue(p.id) : addToQueue(p.id)}
                              title={queue.includes(p.id) ? "Remove from queue" : "Add to queue"}
                            >
                              {queue.includes(p.id) ? "★" : "☆"}
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
              Players are auto-drafted from the top of your queue when the timer expires.
            </p>
            {queuedPlayers.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12 }}>
                No players queued. Add some from the Available tab.
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
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{p.team ?? "FA"}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button style={styles.queueBtn} onClick={() => moveInQueue(p.id, -1)} disabled={i === 0}>↑</button>
                        <button style={styles.queueBtn} onClick={() => moveInQueue(p.id, 1)} disabled={i === queuedPlayers.length - 1}>↓</button>
                        {isMyTurn && (
                          <button style={{ ...styles.btnPick, fontSize: 11, padding: "3px 8px" }} onClick={() => onPick(p.id)}>Pick</button>
                        )}
                        <button style={{ ...styles.queueBtn, color: "var(--red)" }} onClick={() => removeFromQueue(p.id)}>✕</button>
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

function PosTag({ pos }: { pos: string }) {
  const colors: Record<string, string> = {
    FORWARD: "#3b82f6",
    DEFENSE: "#8b5cf6",
    GOALIE: "#f59e0b",
  };
  return (
    <span
      style={{
        background: colors[pos] ?? "#64748b",
        color: "#fff",
        borderRadius: 3,
        padding: "1px 5px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
      }}
    >
      {pos === "FORWARD" ? "F" : pos === "DEFENSE" ? "D" : "G"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function DraftRoom({
  leagueId,
  teamId,
  teamNames,
  isCommissioner,
  initialStats,
  statSeason,
  rosterSettings,
}: {
  leagueId: string;
  teamId: string;
  teamNames: Record<string, string>;
  isCommissioner: boolean;
  rosterSettings: Record<string, number>;
  initialStats: PlayerStats[];
  statSeason: string | null;
}) {
  const { connStatus, draft, available, lastError, start, makePick, listAvailable, setQueue, pause, resume } =
    useDraftSocket(leagueId, teamId);

  const isMobile = useIsMobile(900);
  const [mobileTab, setMobileTab] = useState<"pick" | "board" | "needs">("pick");
  const [queue, setQueueLocal] = useState<string[]>([]);

  // Seed name + position lookup from SSR stats so all players are known immediately,
  // then keep it current as the WebSocket AVAILABLE messages arrive.
  const playerNames = useRef<Record<string, string>>(
    Object.fromEntries(initialStats.map((s) => [s.id, s.name]))
  );
  const playerPositions = useRef<Record<string, string>>(
    Object.fromEntries(initialStats.map((s) => [s.id, s.position]))
  );
  const playerTeams = useRef<Record<string, string | null>>(
    Object.fromEntries(initialStats.map((s) => [s.id, s.team ?? null]))
  );
  useEffect(() => {
    for (const p of available) {
      playerNames.current[p.id] = p.name;
      playerPositions.current[p.id] = p.position;
      playerTeams.current[p.id] = p.team ?? null;
    }
  }, [available]);

  // Preload players as soon as draft state arrives (even before start),
  // then refresh after each pick so the list stays current.
  const prevPickCount = useRef(-1);
  useEffect(() => {
    if (!draft) return;
    const count = draft.completed.length;
    if (count !== prevPickCount.current) {
      prevPickCount.current = count;
      listAvailable();
    }
  }, [draft?.completed.length, listAvailable]);

  const handleSetQueue = useCallback(
    (ids: string[]) => {
      setQueueLocal(ids);
      setQueue(ids);
    },
    [setQueue]
  );

  return (
    <div style={styles.root}>
      <TopBar
        leagueId={leagueId}
        teamId={teamId}
        teamNames={teamNames}
        draft={draft}
        connStatus={connStatus}
        isCommissioner={isCommissioner}
        onStart={start}
        onPause={pause}
        onResume={resume}
      />

      {lastError && (
        <div style={styles.errorBanner}>
          {lastError.code}: {lastError.message}
        </div>
      )}

      {draft?.status === "COMPLETE" && (
        <div style={styles.completeBanner}>
          Draft complete — {draft.completed.length} picks made.{" "}
          <a href={`/league/${leagueId}`} style={{ color: "var(--green)", textDecoration: "underline" }}>
            View league
          </a>
        </div>
      )}

      {draft?.status === "PAUSED" && (
        <div style={styles.pausedBanner}>
          Draft paused{isCommissioner ? " — press Resume to continue" : " — waiting for commissioner"}.
        </div>
      )}

      {!draft && connStatus === "connecting" && (
        <div style={{ padding: "2rem", color: "var(--muted)" }}>Connecting…</div>
      )}

      {!draft && connStatus === "error" && (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--red)" }}>Could not connect to draft</p>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
            Check your internet connection and refresh. If the problem continues, contact your commissioner.
          </p>
        </div>
      )}

      {draft && isMobile && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Mobile tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            {(["pick", "board", "needs"] as const).map((tab) => (
              <button
                key={tab}
                style={{
                  flex: 1, minHeight: 44, border: "none", background: "transparent",
                  borderBottom: mobileTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  color: mobileTab === tab ? "var(--text)" : "var(--muted)",
                  fontWeight: mobileTab === tab ? 700 : 500, fontSize: 13, cursor: "pointer",
                }}
                onClick={() => setMobileTab(tab)}
              >
                {tab === "pick" ? "Pick" : tab === "board" ? "Board" : "Needs"}
              </button>
            ))}
          </div>

          {/* Active panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {mobileTab === "pick" && (
              <PlayerPanel
                draft={draft}
                teamId={teamId}
                leagueId={leagueId}
                available={available}
                queue={queue}
                initialStats={initialStats}
                initialStatSeason={statSeason}
                onPick={makePick}
                onSearch={listAvailable}
                onSetQueue={handleSetQueue}
              />
            )}
            {mobileTab === "board" && (
              <>
                <PickBoard
                  draft={draft}
                  myTeamId={teamId}
                  teamNames={teamNames}
                  playerNames={playerNames.current}
                />
                <div style={{ marginTop: 12 }}>
                  <RecentPicks
                    draft={draft}
                    teamNames={teamNames}
                    playerNames={playerNames.current}
                  />
                </div>
              </>
            )}
            {mobileTab === "needs" && (
              <>
                <NeedsPanel
                  draft={draft}
                  myTeamId={teamId}
                  rosterSettings={rosterSettings}
                  playerPositions={playerPositions.current}
                />
                <div style={{ marginTop: 12 }}>
                  <TeamSpreadPanel
                    draft={draft}
                    myTeamId={teamId}
                    playerTeams={playerTeams.current}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <MyPicks
                    draft={draft}
                    myTeamId={teamId}
                    playerNames={playerNames.current}
                    playerPositions={playerPositions.current}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {draft && !isMobile && (
        <div style={styles.body}>
          {/* Left column: pick board + recent picks */}
          <div style={styles.leftCol}>
            <PickBoard
              draft={draft}
              myTeamId={teamId}
              teamNames={teamNames}
              playerNames={playerNames.current}
            />
            <RecentPicks
              draft={draft}
              teamNames={teamNames}
              playerNames={playerNames.current}
            />
          </div>

          {/* Center column: player search + stats + queue */}
          <div style={styles.centerCol}>
            <PlayerPanel
              draft={draft}
              teamId={teamId}
              leagueId={leagueId}
              available={available}
              queue={queue}
              initialStats={initialStats}
              initialStatSeason={statSeason}
              onPick={makePick}
              onSearch={listAvailable}
              onSetQueue={handleSetQueue}
            />
          </div>

          {/* Right column: my roster + needs */}
          <div style={styles.rightCol}>
            <NeedsPanel
              draft={draft}
              myTeamId={teamId}
              rosterSettings={rosterSettings}
              playerPositions={playerPositions.current}
            />
            <div style={{ marginTop: 12 }}>
              <TeamSpreadPanel
                draft={draft}
                myTeamId={teamId}
                playerTeams={playerTeams.current}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <MyPicks
                draft={draft}
                myTeamId={teamId}
                playerNames={playerNames.current}
                playerPositions={playerPositions.current}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    height: 52,
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    gap: 12,
  },
  clock: {
    fontSize: 22,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    border: "2px solid",
    borderRadius: 8,
    padding: "2px 10px",
    minWidth: 58,
    textAlign: "center" as const,
    transition: "color 0.3s, border-color 0.3s",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "7px 16px",
    fontWeight: 600,
    fontSize: 13,
  },
  btnSecondary: {
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
  },
  btnPick: {
    background: "var(--green)",
    color: "#000",
    border: "none",
    borderRadius: 5,
    minHeight: 44,
    padding: "0 14px",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer" as const,
  },
  queueBtn: {
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    minHeight: 44,
    minWidth: 44,
    fontSize: 11,
    cursor: "pointer" as const,
  },
  starBtn: {
    background: "transparent",
    border: "none",
    minHeight: 44,
    minWidth: 44,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    fontSize: 15,
    lineHeight: 1,
    color: "var(--accent-strong)",
    cursor: "pointer" as const,
  },
  tab: {
    border: "none",
    borderRadius: 5,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer" as const,
  },
  body: {
    flex: 1,
    display: "flex",
    gap: 0,
    overflow: "hidden",
  },
  leftCol: {
    width: 320,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    padding: 14,
    borderRight: "1px solid var(--border)",
    overflowY: "auto" as const,
  },
  centerCol: {
    flex: 1,
    padding: 14,
    overflowY: "auto" as const,
    borderRight: "1px solid var(--border)",
  },
  rightCol: {
    width: 220,
    flexShrink: 0,
    padding: 14,
    overflowY: "auto" as const,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "12px 14px",
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    color: "var(--muted)",
    marginBottom: 10,
  },
  table: {
    borderCollapse: "collapse" as const,
    width: "100%",
  },
  th: {
    textAlign: "left" as const,
    padding: "4px 6px",
    fontWeight: 500,
  },
  roundLabel: {
    fontSize: 11,
    color: "var(--muted)",
    paddingRight: 8,
    whiteSpace: "nowrap" as const,
    fontWeight: 600,
  },
  pickCell: {
    width: 48,
    height: 38,
    textAlign: "center" as const,
    borderRadius: 4,
    padding: "2px 2px",
    cursor: "default",
  },
  recentRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 0",
    borderBottom: "1px solid var(--border)",
    fontSize: 12,
  },
  playerRow: {
    borderBottom: "1px solid var(--border)",
  },
  yourPickBanner: {
    background: "var(--accent)",
    color: "#fff",
    borderRadius: 6,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 13,
    textAlign: "center" as const,
  },
  errorBanner: {
    background: "#450a0a",
    color: "var(--red)",
    padding: "8px 20px",
    fontSize: 13,
    borderBottom: "1px solid var(--red)",
  },
  completeBanner: {
    background: "#052e16",
    color: "var(--green)",
    padding: "8px 20px",
    fontSize: 13,
    borderBottom: "1px solid var(--green)",
  },
  pausedBanner: {
    background: "rgba(249,115,22,0.12)",
    color: "var(--clock-warn)",
    padding: "8px 20px",
    fontSize: 13,
    borderBottom: "1px solid var(--clock-warn)",
  },
  input: {
    flex: 1,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "6px 10px",
    color: "var(--text)",
    outline: "none",
    width: "100%",
  },
} as const;
