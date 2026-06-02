"use client";

import { useEffect, useState, useRef } from "react";
import { useDraftSocket } from "@/hooks/useDraftSocket";
import type { DraftState, PlayerSummary } from "@/lib/draft/messages";
import type { PickSlot } from "@/lib/draft/snake";

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function TopBar({
  leagueId,
  teamId,
  draft,
  connStatus,
  onStart,
}: {
  leagueId: string;
  teamId: string;
  draft: DraftState | null;
  connStatus: string;
  onStart: () => void;
}) {
  const isMyTurn =
    draft?.status === "IN_PROGRESS" &&
    draft.order.find((s) => s.overall === draft.currentOverall)?.fantasyTeamId === teamId;

  return (
    <header style={styles.topBar}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>PWHL Fantasy Draft</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          league …{leagueId.slice(-6)}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          you: …{teamId.slice(-6)}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {draft?.status === "IN_PROGRESS" && (
          <Clock expiresAt={draft.expiresAt} isMyTurn={!!isMyTurn} />
        )}

        {draft?.status === "PENDING" && (
          <button style={styles.btnPrimary} onClick={onStart}>
            Start Draft
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
        {label}
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
}: {
  draft: DraftState;
  myTeamId: string;
}) {
  // Group slots by round
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
                  const isOnClock = slot.overall === draft.currentOverall && draft.status === "IN_PROGRESS";
                  const isMe = slot.fantasyTeamId === myTeamId;
                  return (
                    <td
                      key={slot.overall}
                      style={{
                        ...styles.pickCell,
                        background: isOnClock
                          ? "var(--accent)"
                          : pick
                          ? isMe
                            ? "#1e3a5f"
                            : "var(--surface)"
                          : "transparent",
                        border: `1px solid ${isOnClock ? "var(--accent)" : "var(--border)"}`,
                        opacity: pick && !isMe ? 0.7 : 1,
                      }}
                      title={pick ? `Pick #${pick.overall}: player …${pick.playerId.slice(-6)}${pick.auto ? " (auto)" : ""}` : `#${slot.overall}`}
                    >
                      <div style={{ fontSize: 10, color: isOnClock ? "#fff" : "var(--muted)" }}>
                        #{slot.overall}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: isMe ? 600 : 400 }}>
                        {pick
                          ? `…${pick.playerId.slice(-5)}`
                          : isOnClock
                          ? "⏱"
                          : isMe
                          ? "—"
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
// Recent picks
// ---------------------------------------------------------------------------

function RecentPicks({ draft }: { draft: DraftState }) {
  const recent = [...draft.completed].reverse().slice(0, 8);
  if (recent.length === 0) return null;
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Recent Picks</div>
      <div>
        {recent.map((p) => (
          <div key={p.overall} style={styles.recentRow}>
            <span style={{ color: "var(--muted)", minWidth: 24 }}>#{p.overall}</span>
            <span style={{ color: "var(--muted)", minWidth: 24 }}>R{p.round}</span>
            <span style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}>
              …{p.fantasyTeamId.slice(-6)}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 12 }}>
              …{p.playerId.slice(-8)}
            </span>
            {p.auto && (
              <span style={{ color: "var(--muted)", fontSize: 11 }}>auto</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player list (available players + pick button)
// ---------------------------------------------------------------------------

function PlayerPanel({
  draft,
  teamId,
  available,
  onPick,
  onSearch,
}: {
  draft: DraftState;
  teamId: string;
  available: PlayerSummary[];
  onPick: (playerId: string) => void;
  onSearch: (q: string) => void;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClock = draft.order.find((s) => s.overall === draft.currentOverall);
  const isMyTurn = draft.status === "IN_PROGRESS" && onClock?.fantasyTeamId === teamId;
  const drafted = new Set(draft.draftedPlayerIds);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => onSearch(q || ""), 300);
  };

  const posOrder: Record<string, number> = { FORWARD: 0, DEFENSE: 1, GOALIE: 2 };
  const sorted = [...available]
    .filter((p) => !drafted.has(p.id))
    .sort((a, b) => (posOrder[a.position] ?? 9) - (posOrder[b.position] ?? 9));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {isMyTurn && (
        <div style={styles.yourPickBanner}>
          ⏱ Your pick — select a player below
        </div>
      )}

      <div style={styles.card}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            style={styles.input}
            placeholder="Search by last name…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button style={styles.btnSecondary} onClick={() => onSearch(search || "")}>
            Search
          </button>
        </div>

        {sorted.length === 0 ? (
          <p style={{ color: "var(--muted)", padding: "8px 0" }}>
            {available.length === 0 ? "Press Search to load players." : "No available players match."}
          </p>
        ) : (
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
            <table style={{ ...styles.table, width: "100%" }}>
              <thead>
                <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 500 }}>Pos</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 500 }}>Team</th>
                  <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 500 }}>Player</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} style={styles.playerRow}>
                    <td style={{ padding: "5px 6px" }}>
                      <PosTag pos={p.position} />
                    </td>
                    <td style={{ padding: "5px 6px", color: "var(--muted)", fontSize: 12 }}>
                      {p.team ?? "FA"}
                    </td>
                    <td style={{ padding: "5px 6px" }}>{p.name}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      {isMyTurn && (
                        <button style={styles.btnPick} onClick={() => onPick(p.id)}>
                          Pick
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        background: colors[pos] ?? "var(--muted)",
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
}: {
  leagueId: string;
  teamId: string;
}) {
  const { connStatus, draft, available, lastError, start, makePick, listAvailable } =
    useDraftSocket(leagueId, teamId);

  // Auto-load available players when the draft goes IN_PROGRESS
  useEffect(() => {
    if (draft?.status === "IN_PROGRESS" && available.length === 0) {
      listAvailable();
    }
  }, [draft?.status, available.length, listAvailable]);

  return (
    <div style={styles.root}>
      <TopBar
        leagueId={leagueId}
        teamId={teamId}
        draft={draft}
        connStatus={connStatus}
        onStart={start}
      />

      {lastError && (
        <div style={styles.errorBanner}>
          {lastError.code}: {lastError.message}
        </div>
      )}

      {draft?.status === "COMPLETE" && (
        <div style={styles.completeBanner}>
          🏒 Draft complete — {draft.completed.length} picks made.
        </div>
      )}

      {!draft && connStatus === "connecting" && (
        <div style={{ padding: "2rem", color: "var(--muted)" }}>Connecting…</div>
      )}

      {!draft && connStatus === "error" && (
        <div style={{ padding: "2rem", color: "var(--red)" }}>
          Could not connect to the draft server. Is it running on{" "}
          <code>{process.env.NEXT_PUBLIC_DRAFT_WS_URL ?? "ws://localhost:8080"}</code>?
        </div>
      )}

      {draft && (
        <div style={styles.body}>
          {/* Left column: board + recent */}
          <div style={styles.leftCol}>
            <PickBoard draft={draft} myTeamId={teamId} />
            <RecentPicks draft={draft} />
          </div>

          {/* Right column: player search */}
          <div style={styles.rightCol}>
            <PlayerPanel
              draft={draft}
              teamId={teamId}
              available={available}
              onPick={makePick}
              onSearch={listAvailable}
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
  },
  btnSecondary: {
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "6px 12px",
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
  body: {
    flex: 1,
    display: "flex",
    gap: 0,
    overflow: "hidden",
  },
  leftCol: {
    width: 340,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    padding: 16,
    borderRight: "1px solid var(--border)",
    overflowY: "auto" as const,
  },
  rightCol: {
    flex: 1,
    padding: 16,
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
    gap: 8,
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
  input: {
    flex: 1,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "6px 10px",
    color: "var(--text)",
    outline: "none",
  },
} as const;
