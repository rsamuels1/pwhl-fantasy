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
import { styles } from "./draftStyles";
import { PickBoard } from "./DraftPickBoard";
import { PlayerPanel, PosTag } from "./DraftPlayerPanel";
import { NeedsPanel, TeamSpreadPanel } from "./DraftNeedsPanel";
import type { DraftState, PlayerSummary } from "@/lib/draft/messages";
import type { PlayerStats } from "@/app/api/leagues/[leagueId]/draft/players/route";
import { LIVE_SEASON } from "@/lib/constants";

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
  const warnAnnouncedRef = useRef(false);
  const [warnAnnounce, setWarnAnnounce] = useState("");

  useEffect(() => {
    if (expiresAt == null) { setSecs(null); maxSecsRef.current = null; return; }
    maxSecsRef.current = null; // reset for new pick
    warnAnnouncedRef.current = false;
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      if (maxSecsRef.current === null || remaining > maxSecsRef.current) {
        maxSecsRef.current = remaining;
      }
      // Announce the 10-second warning once, not on every tick
      if (remaining <= 10 && !warnAnnouncedRef.current) {
        warnAnnouncedRef.current = true;
        setWarnAnnounce("");
        requestAnimationFrame(() => setWarnAnnounce("10 seconds remaining to make your pick"));
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
      {/* Single assertive announcement at the 10s threshold only */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="visually-hidden">{warnAnnounce}</div>
      <div
        role="timer"
        aria-label={`${secs} seconds remaining`}
        className="font-stats"
        style={{
          fontSize: 54, fontWeight: 700, lineHeight: 0.9,
          color: numColor, fontVariantNumeric: "tabular-nums",
          transition: "color 0.3s",
        }}
      >
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
      <div role="log" aria-live="polite" aria-label="Draft picks" aria-relevant="additions">
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

// PlayerPanel, PosTag, SortKey, SKATER_COLS, GOALIE_COLS → DraftPlayerPanel.tsx



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

