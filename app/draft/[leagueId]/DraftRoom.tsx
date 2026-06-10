"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDraftSocket } from "@/hooks/useDraftSocket";
import type { DraftState, PlayerSummary } from "@/lib/draft/messages";
import type { PickSlot } from "@/lib/draft/snake";

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
// Player list + queue management
// ---------------------------------------------------------------------------

function PlayerPanel({
  draft,
  teamId,
  available,
  queue,
  onPick,
  onSearch,
  onSetQueue,
}: {
  draft: DraftState;
  teamId: string;
  available: PlayerSummary[];
  queue: string[];
  onPick: (playerId: string) => void;
  onSearch: (q: string) => void;
  onSetQueue: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "queue">("available");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClock = draft.order.find((s) => s.overall === draft.currentOverall);
  const isMyTurn = draft.status === "IN_PROGRESS" && onClock?.fantasyTeamId === teamId;
  const drafted = new Set(draft.draftedPlayerIds);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => onSearch(q || ""), 300);
  };

  const addToQueue = (id: string) => {
    if (!queue.includes(id)) {
      const next = [...queue, id];
      onSetQueue(next);
    }
  };

  const removeFromQueue = (id: string) => {
    const next = queue.filter((q) => q !== id);
    onSetQueue(next);
  };

  const moveInQueue = (id: string, dir: -1 | 1) => {
    const idx = queue.indexOf(id);
    if (idx < 0) return;
    const next = [...queue];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onSetQueue(next);
  };

  const posOrder: Record<string, number> = { FORWARD: 0, DEFENSE: 1, GOALIE: 2 };
  const availablePlayers = [...available]
    .filter((p) => !drafted.has(p.id))
    .sort((a, b) => (posOrder[a.position] ?? 9) - (posOrder[b.position] ?? 9));

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
              style={{
                ...styles.tab,
                background: activeTab === tab ? "var(--accent)" : "transparent",
                color: activeTab === tab ? "#fff" : "var(--muted)",
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "available" ? "Available" : `Queue (${queuedPlayers.length})`}
            </button>
          ))}
        </div>

        {activeTab === "available" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                style={styles.input}
                placeholder="Search players…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {availablePlayers.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "8px 0", fontSize: 12 }}>
                {available.length === 0 ? "Loading players…" : "No players match."}
              </p>
            ) : (
              <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 300px)" }}>
                <table style={{ ...styles.table, width: "100%" }}>
                  <thead>
                    <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
                      <th style={styles.th}>Pos</th>
                      <th style={styles.th}>Team</th>
                      <th style={styles.th}>Player</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {availablePlayers.map((p) => (
                      <tr key={p.id} style={styles.playerRow}>
                        <td style={{ padding: "5px 6px" }}><PosTag pos={p.position} /></td>
                        <td style={{ padding: "5px 6px", color: "var(--muted)", fontSize: 12 }}>{p.team ?? "FA"}</td>
                        <td style={{ padding: "5px 6px", fontSize: 13 }}>{p.name}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            {isMyTurn && (
                              <button style={styles.btnPick} onClick={() => onPick(p.id)}>
                                Pick
                              </button>
                            )}
                            <button
                              style={{ ...styles.btnSecondary, fontSize: 11, padding: "3px 8px" }}
                              onClick={() => addToQueue(p.id)}
                              disabled={queue.includes(p.id)}
                              title="Add to queue"
                            >
                              +Q
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
                {queuedPlayers.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <span style={{ color: "var(--muted)", minWidth: 18, fontSize: 11 }}>{i + 1}</span>
                    <PosTag pos={p.position} />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{p.team ?? "FA"}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={styles.queueBtn} onClick={() => moveInQueue(p.id, -1)} disabled={i === 0} title="Move up">↑</button>
                      <button style={styles.queueBtn} onClick={() => moveInQueue(p.id, 1)} disabled={i === queuedPlayers.length - 1} title="Move down">↓</button>
                      {isMyTurn && (
                        <button style={{ ...styles.btnPick, fontSize: 11, padding: "3px 8px" }} onClick={() => onPick(p.id)}>
                          Pick
                        </button>
                      )}
                      <button style={{ ...styles.queueBtn, color: "var(--red)" }} onClick={() => removeFromQueue(p.id)} title="Remove">✕</button>
                    </div>
                  </div>
                ))}
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
}: {
  leagueId: string;
  teamId: string;
  teamNames: Record<string, string>;
  isCommissioner: boolean;
}) {
  const { connStatus, draft, available, lastError, start, makePick, listAvailable, setQueue, pause, resume } =
    useDraftSocket(leagueId, teamId);

  const [queue, setQueueLocal] = useState<string[]>([]);

  // Build name + position lookup from the available players list
  const playerNames = useRef<Record<string, string>>({});
  const playerPositions = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const p of available) {
      playerNames.current[p.id] = p.name;
      playerPositions.current[p.id] = p.position;
    }
  }, [available]);

  // Load available players on connect and after each pick
  const prevPickCount = useRef(0);
  useEffect(() => {
    if (!draft) return;
    const count = draft.completed.length;
    if (draft.status === "IN_PROGRESS" && count !== prevPickCount.current) {
      prevPickCount.current = count;
      listAvailable();
    }
    if (draft.status === "IN_PROGRESS" && available.length === 0) {
      listAvailable();
    }
  }, [draft?.status, draft?.completed.length, available.length, listAvailable]);

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
        <div style={{ padding: "2rem", color: "var(--red)" }}>
          Could not connect to the draft server. Make sure it is running on{" "}
          <code>{process.env.NEXT_PUBLIC_DRAFT_WS_URL ?? "ws://localhost:8080"}</code>.
        </div>
      )}

      {draft && (
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

          {/* Center column: player search + queue */}
          <div style={styles.centerCol}>
            <PlayerPanel
              draft={draft}
              teamId={teamId}
              available={available}
              queue={queue}
              onPick={makePick}
              onSearch={listAvailable}
              onSetQueue={handleSetQueue}
            />
          </div>

          {/* Right column: my roster */}
          <div style={styles.rightCol}>
            <MyPicks
              draft={draft}
              myTeamId={teamId}
              playerNames={playerNames.current}
              playerPositions={playerPositions.current}
            />
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
    padding: "4px 10px",
    fontWeight: 700,
    fontSize: 12,
  },
  queueBtn: {
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 11,
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
    width: 52,
    height: 44,
    textAlign: "center" as const,
    borderRadius: 4,
    padding: "3px 2px",
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
