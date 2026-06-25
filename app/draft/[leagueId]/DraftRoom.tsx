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
import { DraftSkeleton } from "./DraftSkeleton";
import type { DraftState, PlayerSummary } from "@/lib/draft/messages";
import type { PickSlot } from "@/lib/draft/snake";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";

// ---------------------------------------------------------------------------
// Evicted overlay
// ---------------------------------------------------------------------------

function EvictedOverlay() {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10000,
    }}>
      <div style={{
        background: "var(--surface)",
        borderRadius: 8,
        padding: 32,
        textAlign: "center",
        maxWidth: 400,
      }}>
        <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          You opened the draft in another tab
        </p>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Switch to that tab to continue drafting.
        </p>
      </div>
    </div>
  );
}

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
        <span style={{ fontWeight: 700, fontSize: 15 }}>PWHL GM — Draft Room</span>
        <span style={{ color: "var(--dim)", fontSize: 12 }}>
          {teamNames[teamId] ?? `…${teamId.slice(-6)}`}
        </span>
        {onClockTeamId && draft?.status === "IN_PROGRESS" && (
          <div style={{
            display: "flex", flexDirection: "column",
            borderLeft: "3px solid rgba(143,193,232,0.30)",
            paddingLeft: 12,
          }}>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)", fontWeight: 700 }}>
              On the clock
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: isMyTurn ? "var(--accent-strong)" : "var(--text)", lineHeight: 1.15 }}>
              {isMyTurn ? "Your pick!" : (teamNames[onClockTeamId] ?? "…" + onClockTeamId.slice(-6))}
            </span>
            <span className="font-stats" style={{ fontSize: 11, color: "var(--faint)" }}>
              Pick {draft.currentOverall} of {draft.order.length}
            </span>
          </div>
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
  const maxSecsRef = useRef<number | null>(null);

  useEffect(() => {
    if (expiresAt == null) { setSecs(null); maxSecsRef.current = null; return; }
    maxSecsRef.current = null; // reset for new pick
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      if (maxSecsRef.current === null || remaining > maxSecsRef.current) {
        maxSecsRef.current = remaining;
      }
      setSecs(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (secs == null) return null;
  const warn = secs <= 10;
  const pct = maxSecsRef.current ? Math.max(0, Math.min(100, Math.round((secs / maxSecsRef.current) * 100))) : 100;
  const numColor = warn ? "var(--clock-warn)" : isMyTurn ? "var(--accent-strong)" : "var(--muted)";
  const barColor = warn ? "var(--clock-warn)" : isMyTurn ? "var(--accent)" : "rgba(143,193,232,0.3)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div className="font-stats" style={{
        fontSize: 54, fontWeight: 700, lineHeight: 0.9,
        color: numColor, fontVariantNumeric: "tabular-nums",
        transition: "color 0.3s",
      }}>
        {secs}
      </div>
      <div style={{ width: 128, height: 4, borderRadius: 2, background: "rgba(150,160,200,0.15)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 2,
          background: `linear-gradient(90deg, ${barColor}, ${warn ? "var(--red)" : "var(--accent-strong)"})`,
          transition: "width 0.5s linear, background 0.3s",
        }} />
      </div>
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
      <div style={styles.cardTitle}><span className="section-accent" />Pick Board</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
        Pick order reverses each round (snake draft) — so every team gets an early pick.
      </div>
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
                          ? "var(--accent-dim)"
                          : pick
                          ? isMe
                            ? "var(--card)"
                            : "var(--card)"
                          : "rgba(150,160,200,0.03)",
                        border: isOnClock
                          ? "2px solid var(--accent)"
                          : pick
                          ? "1px solid var(--border)"
                          : "1px solid rgba(150,160,200,0.07)",
                        boxShadow: isOnClock ? "0 0 10px var(--accent-glow)" : "none",
                        opacity: pick && !isMe ? 0.65 : 1,
                      }}
                      title={
                        pick
                          ? `#${pick.overall} ${teamNames[pick.fantasyTeamId] ?? pick.fantasyTeamId}: ${playerNames[pick.playerId] ?? pick.playerId}${pick.auto ? " (auto)" : ""}`
                          : `#${slot.overall} — ${teamNames[slot.fantasyTeamId] ?? slot.fantasyTeamId}`
                      }
                    >
                      <div className="font-stats" style={{ fontSize: 9, color: isOnClock ? "var(--accent-strong)" : "var(--faint)" }}>
                        #{slot.overall}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: isMe ? 700 : 400, color: isOnClock ? "var(--text)" : pick ? "var(--text)" : "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 46 }}>
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
      <div style={styles.cardTitle}><span className="section-accent" />Recent Picks</div>
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
      <div style={styles.cardTitle}><span className="section-accent" />Your Picks ({myPicks.length})</div>
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
  util: "Flex (any skater)",
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
      <div style={styles.cardTitle}><span className="section-accent" />Team Spread</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, lineHeight: 1.5 }}>
        High concentration from one team increases injury/absence risk.
        <br />
        <span style={{ color: "var(--green)" }}>Green</span> = 1–2 players (fine) · <span style={{ color: "var(--amber)" }}>Amber</span> = 3 players (some risk) · <span style={{ color: "var(--clock-warn)" }}>Red</span> = 4+ players (high risk)
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>No picks yet</div>
      ) : (
        rows.map(([team, count]) => {
          const isHigh = count >= 4;
          const isMid = count === 3;
          const barColor = isHigh ? "var(--clock-warn)" : isMid ? "var(--amber)" : "var(--green)";
          const barBg = isHigh ? "rgba(249,115,22,0.18)" : isMid ? "rgba(245,201,123,0.14)" : "rgba(81,216,138,0.12)";
          const countColor = isHigh ? "var(--clock-warn)" : isMid ? "var(--amber)" : "var(--text)";
          const maxCount = rows[0][1];
          const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
          return (
            <div key={team} style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 3 }}>
                <span style={{ flex: 1, color: "var(--text)" }}>{team}</span>
                <span className="font-stats" style={{ fontWeight: 700, color: countColor }}>{count}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.3s", boxShadow: `0 0 4px ${barBg}` }} />
              </div>
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
      <div style={styles.cardTitle}><span className="section-accent" />Roster Needs</div>
      <div style={{ marginBottom: 8, fontSize: 12, color: "var(--muted)" }}>
        {totalDrafted} / {draftSlots} picks made
      </div>
      {draftableSlots.map(([slot, need]) => {
        const have = filled[slot] ?? 0;
        const remaining = Math.max(0, need - have);
        const done = remaining === 0;
        const critical = !done && remaining <= 1;
        const pct = need > 0 ? Math.min(100, Math.round((have / need) * 100)) : 0;
        const barColor = done ? "var(--green)" : have > 0 ? "var(--accent-strong)" : "var(--gold)";
        const rowBg = done
          ? "rgba(81,216,138,0.07)"
          : critical
          ? "rgba(245,201,123,0.06)"
          : "rgba(150,160,200,0.03)";
        const countColor = done ? "var(--green)" : critical ? "var(--gold)" : "var(--muted)";
        return (
          <div key={slot} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: rowBg, fontSize: 12 }}>
              <span className="font-stats" style={{ flex: 1, fontSize: 14, fontWeight: 600, color: done ? "var(--green)" : critical ? "var(--gold)" : "var(--text)" }}>
                {SLOT_LABELS[slot] ?? slot}
              </span>
              <span style={{ color: countColor, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
                {have}/{need}
              </span>
              {done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              )}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(150,160,200,0.10)", overflow: "hidden", marginTop: 3, marginLeft: 10, marginRight: 10 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
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

const SKATER_COLS: { key: SortKey; label: string; tooltip?: string; mobile?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "goals", label: "G" },
  { key: "assists", label: "A" },
  { key: "points", label: "PTS" },
  { key: "ppp", label: "PPP", tooltip: "Power play points", mobile: true },
  { key: "shots", label: "SOG", tooltip: "Shots on goal", mobile: true },
  { key: "hits", label: "HIT", tooltip: "Hits delivered", mobile: true },
  { key: "blocks", label: "BLK", tooltip: "Shots blocked (not by the goalie)", mobile: true },
];

const GOALIE_COLS: { key: SortKey; label: string; tooltip?: string; mobile?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "wins", label: "W" },
  { key: "saves", label: "SV", tooltip: "Saves", mobile: true },
  { key: "goalsAgainst", label: "GA", tooltip: "Goals against — goals allowed", mobile: true },
  { key: "savePct", label: "SV%", tooltip: "Save percentage — saves ÷ shots faced" },
  { key: "shutouts", label: "SO", tooltip: "Shutouts — full game, zero goals allowed", mobile: true },
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
            {statSeason && statSeason !== "2026-27" && (
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
              ★ Add to my list — if your clock runs out, we'll auto-pick from the top.
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

function PosTag({ pos }: { pos: string }) {
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
  firstWeekStartDate,
}: {
  leagueId: string;
  teamId: string;
  teamNames: Record<string, string>;
  isCommissioner: boolean;
  rosterSettings: Record<string, number>;
  initialStats: PlayerStats[];
  statSeason: string | null;
  firstWeekStartDate: string | null;
}) {
  // Single socket for the whole room — previously two calls (root + content) caused
  // each to JOIN as the same team, they evicted each other, triggering the eviction overlay.
  const socket = useDraftSocket(leagueId, teamId);

  if (socket.evicted) {
    return <EvictedOverlay />;
  }

  return (
    <DraftRoomContent
      leagueId={leagueId}
      teamId={teamId}
      teamNames={teamNames}
      isCommissioner={isCommissioner}
      initialStats={initialStats}
      statSeason={statSeason}
      rosterSettings={rosterSettings}
      socket={socket}
      firstWeekStartDate={firstWeekStartDate}
    />
  );
}

function DraftRoomContent({
  leagueId,
  teamId,
  teamNames,
  isCommissioner,
  initialStats,
  statSeason,
  rosterSettings,
  socket,
  firstWeekStartDate,
}: {
  leagueId: string;
  teamId: string;
  teamNames: Record<string, string>;
  isCommissioner: boolean;
  rosterSettings: Record<string, number>;
  initialStats: PlayerStats[];
  statSeason: string | null;
  socket: ReturnType<typeof useDraftSocket>;
  firstWeekStartDate: string | null;
}) {
  const { connStatus, timedOut, draft, available, lastError, start, makePick, listAvailable, setQueue, pause, resume } =
    socket;

  const isMobile = useIsMobile(900);
  const [mobileTab, setMobileTab] = useState<"pick" | "board" | "needs">("pick");
  const [queue, setQueueLocal] = useState<string[]>([]);
  const [visibleError, setVisibleError] = useState<{ code: string; message: string } | null>(null);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (lastError) {
      setVisibleError(lastError);
      const timer = setTimeout(() => {
        setVisibleError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [lastError]);

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

      {visibleError && (
        <div style={styles.errorBannerContainer}>
          <div style={styles.errorBanner}>
            {visibleError.message}
          </div>
          <button
            onClick={() => setVisibleError(null)}
            style={styles.errorDismiss}
            title="Dismiss"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {draft?.status === "COMPLETE" && (
        <div style={{ ...styles.completeBanner, display: "block", padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            🎉 Draft complete — {draft.completed.length} picks made
          </div>
          {firstWeekStartDate && (
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              Week 1 kicks off{" "}
              <strong style={{ color: "var(--text)" }}>
                {new Date(firstWeekStartDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </strong>
              {" "}— set your lineup before then.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href={`/team/${teamId}/lineup`}
              style={{
                display: "inline-block", padding: "8px 18px", borderRadius: 8,
                background: "var(--accent)", color: "var(--accent-ink)",
                fontWeight: 700, fontSize: 13, textDecoration: "none",
              }}
            >
              Set your lineup →
            </a>
            <a
              href={`/league/${leagueId}`}
              style={{
                display: "inline-block", padding: "8px 18px", borderRadius: 8,
                background: "var(--surface)", color: "var(--text)",
                fontWeight: 600, fontSize: 13, textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            >
              View league
            </a>
          </div>
        </div>
      )}

      {draft?.status === "PAUSED" && (
        <div style={styles.pausedBanner}>
          Draft paused{isCommissioner ? " — press Resume to continue" : " — waiting for commissioner"}.
        </div>
      )}

      {draft?.status === "PENDING" && (
        <div style={styles.pendingBanner}>
          <div style={{ flex: 1 }}>
            {isCommissioner ? (
              <span>Press <strong>Start</strong> when everyone is ready. ~{Object.keys(teamNames).length} teams will draft in snake order, ~30 seconds per pick.</span>
            ) : (
              <span>Waiting for <strong>{teamNames[draft.order[0]?.fantasyTeamId] || "commissioner"}</strong> to start. You'll get ~30 seconds per pick — star players now so you're ready.</span>
            )}
          </div>
        </div>
      )}

      {!draft && connStatus === "connecting" && !timedOut && (
        <DraftSkeleton isMobile={isMobile} />
      )}

      {!draft && (connStatus === "error" || timedOut) && (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--red)" }}>
            {timedOut ? "Draft server is taking too long to respond" : "Could not connect to draft"}
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
            {timedOut
              ? "The draft server may be starting up. Refresh in a moment, or ask your commissioner to check the server status."
              : "Check your internet connection and refresh. If the problem continues, contact your commissioner."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, cursor: "pointer" }}
          >
            Refresh
          </button>
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
          <div className="draft-scroll" style={styles.leftCol}>
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
          <div className="draft-scroll" style={styles.rightCol}>
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
    padding: "0 24px",
    height: 52,
    background: "rgba(10,14,26,0.92)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    position: "sticky" as const,
    top: 0,
    zIndex: 50,
    gap: 12,
  },
  clock: {
    fontSize: 22,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    fontFamily: "var(--font-stats)",
    border: "2px solid",
    borderRadius: 8,
    padding: "2px 10px",
    minWidth: 58,
    textAlign: "center" as const,
    transition: "color 0.3s, border-color 0.3s",
  },
  btnPrimary: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "none",
    borderRadius: 6,
    padding: "7px 16px",
    fontWeight: 600,
    fontSize: 13,
  },
  btnSecondary: {
    background: "rgba(150,160,200,0.08)",
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
    color: "var(--accent)",
    cursor: "pointer" as const,
  },
  tab: {
    border: "none",
    borderRadius: 999,
    padding: "5px 14px",
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
    width: 300,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    padding: "20px 16px 24px",
    borderRight: "1px solid var(--border)",
    overflowY: "auto" as const,
    // applied as className="draft-scroll" on the element
  },
  centerCol: {
    flex: 1,
    padding: "20px 20px 24px",
    overflowY: "auto" as const,
    borderRight: "1px solid var(--border)",
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 16,
    minWidth: 0,
  },
  rightCol: {
    width: 260,
    flexShrink: 0,
    padding: "20px 16px 24px",
    overflowY: "auto" as const,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 16,
  },
  card: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "18px 20px",
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
    color: "var(--muted)",
    marginBottom: 16,
  },
  table: {
    borderCollapse: "collapse" as const,
    width: "100%",
  },
  th: {
    textAlign: "left" as const,
    padding: "4px 6px",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.06em",
    color: "var(--faint)",
    textTransform: "uppercase" as const,
  },
  roundLabel: {
    fontSize: 11,
    color: "var(--dim)",
    paddingRight: 8,
    whiteSpace: "nowrap" as const,
    fontWeight: 600,
    fontFamily: "var(--font-stats)",
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
    padding: "10px 12px",
    borderRadius: 8,
    background: "rgba(150,160,200,0.04)",
    marginBottom: 4,
    fontSize: 12,
  },
  playerRow: {
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
  },
  yourPickBanner: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    borderRadius: 6,
    padding: "8px 14px",
    fontWeight: 600,
    fontSize: 13,
    textAlign: "center" as const,
  },
  errorBannerContainer: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 12,
    background: "rgba(120, 40, 40, 0.6)",
    color: "var(--red)",
    padding: "10px 20px",
    fontSize: 13,
    borderBottom: "1px solid rgba(248, 113, 113, 0.4)",
  },
  errorBanner: {
    flex: 1,
  },
  errorDismiss: {
    background: "transparent",
    border: "none",
    color: "var(--red)",
    fontSize: 18,
    cursor: "pointer" as const,
    padding: 0,
    lineHeight: 1,
    width: 28,
    height: 28,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: 0.7,
    transition: "opacity 0.2s",
  },
  completeBanner: {
    background: "rgba(81,216,138,0.08)",
    color: "var(--green)",
    padding: "8px 20px",
    fontSize: 13,
    borderBottom: "1px solid rgba(81,216,138,0.2)",
  },
  pendingBanner: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 12,
    background: "var(--accent-dim)",
    color: "var(--accent-strong)",
    padding: "10px 20px",
    fontSize: 13,
    borderBottom: "1px solid var(--accent-border)",
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
    background: "rgba(150,160,200,0.06)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "6px 10px",
    color: "var(--text)",
    outline: "none",
    width: "100%",
  },
} as const;
