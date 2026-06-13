"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  DraftState,
  PlayerSummary,
  ServerMessage,
} from "@/lib/draft/messages";

export type ConnStatus = "connecting" | "open" | "closed" | "error";

export interface DraftSocket {
  connStatus: ConnStatus;
  draft: DraftState | null;
  available: PlayerSummary[];
  lastError: { code: string; message: string } | null;
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

  // Reconnection state — all refs so the closures inside connect() always read
  // the current values without needing to be re-created.
  const shouldReconnectRef = useRef(true);
  const reconnectDelayRef = useRef(1000); // ms; doubles each attempt, caps at 30 000
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    // Reset reconnect state when leagueId/teamId changes.
    shouldReconnectRef.current = true;
    reconnectDelayRef.current = 1000;

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

      ws.onopen = () => {
        setConnStatus("open");
        reconnectDelayRef.current = 1000; // reset backoff on success
        ws.send(JSON.stringify({ type: "JOIN", fantasyTeamId: teamId } satisfies ClientMessage));
      };

      ws.onmessage = (event: MessageEvent) => {
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

      ws.onclose = () => {
        setConnStatus("closed");
        scheduleReconnect();
      };

      // onerror always fires immediately before onclose — let onclose schedule the reconnect.
      ws.onerror = () => {
        setConnStatus("error");
      };
    }

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
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

  return { connStatus, draft, available, lastError, start, makePick, listAvailable, setQueue, pause, resume };
}
