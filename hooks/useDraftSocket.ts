"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  DraftState,
  PlayerSummary,
  ServerMessage,
} from "@/lib/draft/messages";

export type ConnStatus = "connecting" | "open" | "closed" | "error";

const CONNECT_TIMEOUT_MS = 12_000;

export interface DraftSocket {
  connStatus: ConnStatus;
  timedOut: boolean;
  draft: DraftState | null;
  available: PlayerSummary[];
  lastError: { code: string; message: string } | null;
  evicted: boolean;
  start: () => void;
  makePick: (playerId: string) => void;
  listAvailable: (search?: string) => void;
  setQueue: (playerIds: string[]) => void;
  pause: () => void;
  resume: () => void;
}

const WS_BASE =
  process.env.NEXT_PUBLIC_DRAFT_WS_URL ?? "ws://localhost:8080";

export function useDraftSocket(leagueId: string, teamId: string): DraftSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [available, setAvailable] = useState<PlayerSummary[]>([]);
  const [lastError, setLastError] = useState<{ code: string; message: string } | null>(null);
  const [evicted, setEvicted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Reconnection state — all refs so the closures inside connect() always read
  // the current values without needing to be re-created.
  const shouldReconnectRef = useRef(true);
  const reconnectDelayRef = useRef(1000); // ms; doubles each attempt, caps at 30 000
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptedAfter4001Ref = useRef(false); // prevents infinite loop on hard-refresh

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    // Reset state when leagueId/teamId changes.
    setEvicted(false);
    setTimedOut(false);
    shouldReconnectRef.current = true;
    reconnectDelayRef.current = 1000;
    reconnectAttemptedAfter4001Ref.current = false;

    function scheduleReconnect() {
      if (!shouldReconnectRef.current) return;
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30_000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }

    function connect() {
      const ws = new WebSocket(`${WS_BASE}?league=${leagueId}`);
      wsRef.current = ws;
      setConnStatus("connecting");

      // Surface a friendly error if the server doesn't respond within 12 seconds.
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        if (wsRef.current === ws && ws.readyState !== WebSocket.OPEN) {
          setTimedOut(true);
          ws.close();
        }
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        // Guard: ignore callbacks from sockets superseded by a newer connect() call.
        // React Strict Mode mounts effects twice, which can create two sockets; only
        // the one that most recently set wsRef.current is the live connection.
        if (wsRef.current !== ws) { ws.close(); return; }
        if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null; }
        setTimedOut(false);
        setConnStatus("open");
        reconnectDelayRef.current = 1000; // reset backoff on success
        ws.send(JSON.stringify({ type: "JOIN", fantasyTeamId: teamId } satisfies ClientMessage));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (wsRef.current !== ws) return; // stale socket
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }
        switch (msg.type) {
          case "STATE":
            setDraft(msg.state);
            break;
          case "PICK_MADE":
            setDraft(msg.state);
            break;
          case "AVAILABLE":
            setAvailable(msg.players);
            break;
          case "ERROR":
            console.error("Draft server error:", msg.code, msg.message);
            setLastError({ code: msg.code, message: msg.message });
            break;
        }
      };

      ws.onclose = (event: CloseEvent) => {
        // If this socket has been superseded, ignore its close entirely — the active
        // socket manages its own lifecycle. Without this guard, Strict Mode's double-
        // mount causes the first socket's 4001 to schedule a reconnect that evicts the
        // already-live second socket, producing a false eviction overlay.
        if (wsRef.current !== ws) return;
        if (event.code === 4001) {
          // Evicted by server (duplicate tab). If this is a second 4001 in quick succession,
          // the reconnect is in an eviction loop (stale socket evicting the new connection).
          // Render EvictedOverlay and stop. First 4001 → silent reconnect attempt.
          if (reconnectAttemptedAfter4001Ref.current) {
            setEvicted(true);
            return;
          }
          reconnectAttemptedAfter4001Ref.current = true;
          // Attempt one silent reconnect 500ms later in case this was a stale socket.
          reconnectTimerRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) {
              connect();
            }
          }, 500);
        } else {
          setConnStatus("closed");
          scheduleReconnect();
        }
      };

      // onerror always fires immediately before onclose — let onclose schedule the reconnect.
      ws.onerror = () => {
        if (wsRef.current !== ws) return; // stale socket
        setConnStatus("error");
      };
    }

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [leagueId, teamId]);

  const start = useCallback(() => send({ type: "START" }), [send]);

  const makePick = useCallback(
    (playerId: string) => {
      if (!draft) return;
      send({ type: "MAKE_PICK", overall: draft.currentOverall, playerId });
      setLastError(null);
    },
    [send, draft]
  );

  const listAvailable = useCallback(
    (search?: string) => send({ type: "LIST_AVAILABLE", search }),
    [send]
  );

  const setQueue = useCallback(
    (playerIds: string[]) => send({ type: "SET_QUEUE", playerIds }),
    [send]
  );

  const pause = useCallback(() => send({ type: "PAUSE" }), [send]);
  const resume = useCallback(() => send({ type: "RESUME" }), [send]);

  return { connStatus, timedOut, draft, available, lastError, evicted, start, makePick, listAvailable, setQueue, pause, resume };
}
