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
}

const WS_BASE =
  process.env.NEXT_PUBLIC_DRAFT_WS_URL ?? "ws://localhost:8080";

export function useDraftSocket(leagueId: string, teamId: string): DraftSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("connecting");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [available, setAvailable] = useState<PlayerSummary[]>([]);
  const [lastError, setLastError] = useState<{ code: string; message: string } | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}?league=${leagueId}`);
    wsRef.current = ws;
    setConnStatus("connecting");

    ws.onopen = () => {
      setConnStatus("open");
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
          setLastError({ code: msg.code, message: msg.message });
          break;
      }
    };

    ws.onclose = () => setConnStatus("closed");
    ws.onerror = () => setConnStatus("error");

    return () => {
      ws.close();
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

  return { connStatus, draft, available, lastError, start, makePick, listAvailable, setQueue };
}
