// lib/draft/server.ts
// The IO layer. Owns the websocket connections, the real setTimeout-based clock,
// and database persistence. All decisions are delegated to the pure engine in
// engine.ts — this file only performs the effects the engine returns.
//
// Transport note: this uses the `ws` library for a standalone Node server. If you
// prefer a hosted realtime service (Pusher/Ably/Supabase Realtime), keep the
// engine + DraftRoom logic identical and swap only `broadcast` and the socket
// plumbing. That's the payoff of keeping the engine IO-free.

import { WebSocketServer, WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import { generateSnakeOrder, rostersToRounds } from "./snake";
import { reduce, toWireState, deriveAutoState, type EngineState, type Effect, type TimerConfig } from "./engine";
import type { ClientMessage, ServerMessage, CompletedPick } from "./messages";

const prisma = new PrismaClient();

// One DraftRoom per league draft. Holds the engine state + connected sockets.
class DraftRoom {
  private timer: NodeJS.Timeout | null = null;
  private sockets = new Map<WebSocket, string>(); // socket -> fantasyTeamId

  constructor(
    private state: EngineState,
    private readonly timerConfig: TimerConfig
  ) {}

  addSocket(ws: WebSocket, fantasyTeamId: string) {
    this.sockets.set(ws, fantasyTeamId);
    this.send(ws, { type: "STATE", state: toWireState(this.state) });
  }

  removeSocket(ws: WebSocket) {
    this.sockets.delete(ws);
  }

  async handle(ws: WebSocket, msg: ClientMessage) {
    if (msg.type === "JOIN") {
      this.addSocket(ws, msg.fantasyTeamId);
      return;
    }

    if (msg.type === "SET_QUEUE") {
      const teamId = this.sockets.get(ws);
      if (teamId) this.state.queues.set(teamId, msg.playerIds);
      return;
    }

    if (msg.type === "START") {
      await this.start();
      return;
    }

    if (msg.type === "LIST_AVAILABLE") {
      const players = await prisma.player.findMany({
        where: {
          active: true,
          id: { notIn: [...this.state.draftedPlayerIds] },
          ...(msg.search
            ? { lastName: { contains: msg.search, mode: "insensitive" } }
            : {}),
        },
        include: { team: true },
        orderBy: [{ position: "asc" }, { lastName: "asc" }],
      });
      this.send(ws, {
        type: "AVAILABLE",
        players: players.map((p) => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          position: p.position,
          team: p.team?.abbreviation ?? null,
        })),
      });
      return;
    }

    if (msg.type === "MAKE_PICK") {
      const teamId = this.sockets.get(ws);
      if (!teamId) return;
      const playerExists =
        (await prisma.player.count({ where: { id: msg.playerId } })) > 0;
      const result = reduce(this.state, {
        kind: "MAKE_PICK",
        fantasyTeamId: teamId,
        overall: msg.overall,
        playerId: msg.playerId,
        nowMs: Date.now(),
        timerConfig: this.timerConfig,
        playerExists,
      });
      if (result.error) {
        this.send(ws, { type: "ERROR", ...result.error });
        return;
      }
      this.state = result.state;
      await this.runEffects(result.effects);
    }

    if (msg.type === "PAUSE") {
      const result = reduce(this.state, { kind: "PAUSE" });
      if (result.error) {
        this.send(ws, { type: "ERROR", ...result.error });
        return;
      }
      this.state = result.state;
      await this.runEffects(result.effects);
    }

    if (msg.type === "RESUME") {
      const result = reduce(this.state, {
        kind: "RESUME",
        nowMs: Date.now(),
        timerConfig: this.timerConfig,
      });
      if (result.error) {
        this.send(ws, { type: "ERROR", ...result.error });
        return;
      }
      this.state = result.state;
      await this.runEffects(result.effects);
    }
  }

  // Fired by the server's own timer — the authoritative clock.
  private async onTimeout() {
    const bestAvailable = await this.bestAvailablePlayerIds();
    const result = reduce(this.state, {
      kind: "TIMEOUT",
      nowMs: Date.now(),
      timerConfig: this.timerConfig,
      bestAvailable,
    });
    this.state = result.state;
    await this.runEffects(result.effects);
  }

  start() {
    const result = reduce(this.state, {
      kind: "START",
      nowMs: Date.now(),
      timerConfig: this.timerConfig,
    });
    this.state = result.state;
    return this.runEffects(result.effects);
  }

  private async runEffects(effects: Effect[]) {
    for (const e of effects) {
      switch (e.kind) {
        case "PERSIST_PICK":
          await this.persistPick(e.pick);
          break;
        case "BROADCAST_PICK":
          this.broadcast({
            type: "PICK_MADE",
            pick: e.pick,
            state: toWireState(this.state),
          });
          break;
        case "BROADCAST_STATE":
          this.broadcast({ type: "STATE", state: toWireState(this.state) });
          break;
        case "SCHEDULE_TIMER":
          this.scheduleTimer(e.expiresAt);
          break;
        case "CLEAR_TIMER":
          this.clearTimer();
          break;
        case "PERSIST_STATUS":
          await prisma.draft.update({
            where: { id: this.state.draftId },
            data: {
              status: e.status,
              ...(e.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
            },
          });
          break;
        case "COMPLETE":
          await prisma.draft.update({
            where: { id: this.state.draftId },
            data: { status: "COMPLETE", completedAt: new Date() },
          });
          break;
      }
    }
  }

  private scheduleTimer(expiresAt: number) {
    this.clearTimer();
    const delay = Math.max(0, expiresAt - Date.now());
    this.timer = setTimeout(() => void this.onTimeout(), delay);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // Persist the pick AND advance the draft's currentPick atomically, plus add
  // the player to the drafting team's roster. Writing immediately is what lets a
  // restart rebuild state from the DB.
  private async persistPick(pick: CompletedPick) {
    await prisma.$transaction([
      prisma.draftPick.update({
        where: {
          draftId_overall: { draftId: this.state.draftId, overall: pick.overall },
        },
        data: { playerId: pick.playerId, auto: pick.auto, pickedAt: new Date() },
      }),
      prisma.draft.update({
        where: { id: this.state.draftId },
        data: { currentPick: this.state.currentOverall },
      }),
      prisma.rosterEntry.create({
        data: {
          fantasyTeamId: pick.fantasyTeamId,
          playerId: pick.playerId,
          slot: "BENCH",
        },
      }),
    ]);
  }

  // Default auto-pick ranking. Replace with a real projection/ADP source later.
  private async bestAvailablePlayerIds(): Promise<string[]> {
    const players = await prisma.player.findMany({
      where: { active: true, id: { notIn: [...this.state.draftedPlayerIds] } },
      select: { id: true },
      take: 50,
    });
    return players.map((p) => p.id);
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    const payload = JSON.stringify(msg);
    for (const ws of this.sockets.keys()) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}

// Build (or rebuild) engine state for a league's draft from the database.
// On a cold start mid-draft this reconstructs everything from persisted picks,
// including auto-escalation state re-derived from DraftPick.auto history.
export async function buildEngineState(leagueId: string): Promise<{
  state: EngineState;
  timerConfig: TimerConfig;
}> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { draft: true, teams: true },
  });
  if (!league.draft) throw new Error("League has no draft");

  const rounds = rostersToRounds(
    (league.rosterSettings as Record<string, number>) ?? {}
  );

  const ordered = [...league.teams]
    .filter((t) => t.draftOrder != null)
    .sort((a, b) => (a.draftOrder! - b.draftOrder!))
    .map((t) => t.id);

  const order = generateSnakeOrder(ordered, rounds);

  // Replay any picks already persisted (recovery path).
  const existing = await prisma.draftPick.findMany({
    where: { draftId: league.draft.id, playerId: { not: null } },
    orderBy: { overall: "asc" },
  });
  const completed: CompletedPick[] = existing.map((p) => ({
    overall: p.overall,
    round: p.round,
    fantasyTeamId: p.fantasyTeamId,
    playerId: p.playerId!,
    auto: p.auto,
  }));
  const drafted = new Set(completed.map((c) => c.playerId));

  // Re-derive auto-escalation state from pick history — no separate persistence needed.
  const { autoPickCounts, autoFlaggedTeams } = deriveAutoState(completed);

  const status = league.draft.status as EngineState["status"];
  const currentOverall =
    completed.length > 0 ? Math.min(completed.length + 1, order.length) : 1;

  const state: EngineState = {
    draftId: league.draft.id,
    status,
    order,
    currentOverall,
    expiresAt: null,
    completed,
    draftedPlayerIds: drafted,
    queues: new Map(),
    autoPickCounts,
    autoFlaggedTeams,
  };

  const timerConfig: TimerConfig = {
    baseSecs: league.draft.pickTimerSecs,
    autoSecs: league.draft.autoPickTimerSecs,
  };

  return { state, timerConfig };
}

// Promise-keyed so concurrent JOINs for the same league share one buildEngineState call.
const roomPromises = new Map<string, Promise<DraftRoom>>();

export function getRoom(leagueId: string): Promise<DraftRoom> {
  let p = roomPromises.get(leagueId);
  if (!p) {
    p = buildEngineState(leagueId).then(
      ({ state, timerConfig }) => new DraftRoom(state, timerConfig)
    );
    roomPromises.set(leagueId, p);
  }
  return p;
}

export function startDraftServer(port = 8080) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const leagueId = url.searchParams.get("league");
    if (!leagueId) {
      ws.close(1008, "missing league id");
      return;
    }

    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const room = await getRoom(leagueId);
      await room.handle(ws, msg);
    });

    ws.on("close", async () => {
      const room = await roomPromises.get(leagueId);
      room?.removeSocket(ws);
    });
  });

  console.log(`Draft websocket server listening on :${port}`);
  return wss;
}
