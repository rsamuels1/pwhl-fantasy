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
import { emitEvent, type LeagueEventType } from "../services/activity";
import { trackEvent } from "../analytics";
import { logCommissionerAction, type CommissionerEventType } from "../services/audit-service";
import { createNotification } from "../services/notification-service";
import { sendOnClock } from "../services/email-service";
import { generateMagicLinkToken } from "../auth";
import { startSeason, getSeasonState } from "../season/index";

const prisma = new PrismaClient();

// One DraftRoom per league draft. Holds the engine state + connected sockets.
class DraftRoom {
  private timer: NodeJS.Timeout | null = null;
  private sockets = new Map<WebSocket, string>(); // socket -> fantasyTeamId
  private pickInFlight = false;

  constructor(
    private state: EngineState,
    private readonly timerConfig: TimerConfig,
    private readonly leagueId: string,
    private readonly commissionerTeamId: string | null,
    private readonly rosterSettings: Record<string, number>,
    private readonly leagueSeason: string,
  ) {
    // If the draft is already in progress when the room is created (e.g., after server restart),
    // reschedule the timer immediately to prevent it from hanging indefinitely.
    if (this.state.status === "IN_PROGRESS") {
      this.rescheduleTimer();
    }
  }

  private rescheduleTimer() {
    // Calculate expiration time based on current pick position.
    // Called from the constructor after a server restart so the on-clock team gets
    // a fresh pick window rather than an expired/null clock.
    const currentTeamSlot = this.state.order[this.state.currentOverall - 1];
    if (!currentTeamSlot) return;

    const isFlagged = this.state.autoFlaggedTeams.has(currentTeamSlot.fantasyTeamId);
    const timerSecs = isFlagged ? this.timerConfig.autoSecs : this.timerConfig.baseSecs;
    const expiresAt = Date.now() + timerSecs * 1000;
    this.state.expiresAt = expiresAt;
    this.scheduleTimer(expiresAt);
    // Broadcast the updated expiresAt to any sockets that are already registered.
    // After a server restart this is a no-op (no sockets yet), but it ensures that
    // any reconnect or re-join happening concurrently sees the correct clock immediately.
    this.broadcast({ type: "STATE", state: toWireState(this.state) });
  }

  private isCommissioner(ws: WebSocket): boolean {
    return (
      this.commissionerTeamId !== null &&
      this.sockets.get(ws) === this.commissionerTeamId
    );
  }

  // Determine which starting slot types still need players, using the same
  // slot-assignment priority as the NeedsPanel (position → UTIL → BENCH).
  private computeNeededSlots(
    teamPickPositions: Array<"FORWARD" | "DEFENSE" | "GOALIE">
  ): { forward: boolean; defense: boolean; goalie: boolean; util: boolean } {
    const s = this.rosterSettings;
    const filled = { forward: 0, defense: 0, goalie: 0, util: 0 };
    for (const pos of teamPickPositions) {
      if (pos === "FORWARD" && filled.forward < (s.forward ?? 0)) {
        filled.forward++;
      } else if (pos === "DEFENSE" && filled.defense < (s.defense ?? 0)) {
        filled.defense++;
      } else if (pos === "GOALIE" && filled.goalie < (s.goalie ?? 0)) {
        filled.goalie++;
      } else if (pos !== "GOALIE" && filled.util < (s.util ?? 0)) {
        filled.util++;
      }
      // else: bench — no starting slot affected
    }
    return {
      forward: filled.forward < (s.forward ?? 0),
      defense: filled.defense < (s.defense ?? 0),
      goalie: filled.goalie < (s.goalie ?? 0),
      util: filled.util < (s.util ?? 0),
    };
  }

  addSocket(ws: WebSocket, fantasyTeamId: string) {
    // Evict any existing socket for this team (duplicate tab). Last-tab-wins.
    for (const [existingWs, teamId] of this.sockets.entries()) {
      if (teamId === fantasyTeamId) {
        existingWs.close(4001, "evicted: new tab connected");
        this.removeSocket(existingWs);
        break;
      }
    }
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
      if (!this.isCommissioner(ws)) {
        this.send(ws, { type: "ERROR", code: "NOT_COMMISSIONER", message: "Only the commissioner can start the draft" });
        return;
      }
      await this.start();
      return;
    }

    if (msg.type === "LIST_AVAILABLE") {
      // When the league season has real stat-line data, restrict the pool to
      // players who actually appeared in that season. This filters out mock /
      // placeholder players (e.g. "Player0 BOS") that coexist in the DB after
      // running `npm run seed` before `npm run seed-fixture`.
      const seasonHasData = this.leagueSeason
        ? !!(await prisma.statLine.findFirst({
            where: { game: { season: this.leagueSeason } },
            select: { id: true },
          }))
        : false;
      const seasonFilter = seasonHasData
        ? { statLines: { some: { game: { season: this.leagueSeason } } } }
        : {};

      const players = await prisma.player.findMany({
        where: {
          active: true,
          id: { notIn: [...this.state.draftedPlayerIds] },
          ...seasonFilter,
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
      if (!this.isCommissioner(ws)) {
        this.send(ws, { type: "ERROR", code: "NOT_COMMISSIONER", message: "Only the commissioner can pause the draft" });
        return;
      }
      const result = reduce(this.state, { kind: "PAUSE" });
      if (result.error) {
        this.send(ws, { type: "ERROR", ...result.error });
        return;
      }
      this.state = result.state;
      await this.runEffects(result.effects);
      void this.logDraftAction("COMMISSIONER_DRAFT_PAUSED");
    }

    if (msg.type === "RESUME") {
      if (!this.isCommissioner(ws)) {
        this.send(ws, { type: "ERROR", code: "NOT_COMMISSIONER", message: "Only the commissioner can resume the draft" });
        return;
      }
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
      void this.logDraftAction("COMMISSIONER_DRAFT_RESUMED");
    }
  }

  // Fired by the server's own timer — the authoritative clock.
  // pickInFlight prevents a stale timer callback from re-entering if a pick
  // is already being processed (shouldn't happen in Node's single-threaded
  // event loop, but guards against any future async parallelism).
  private async onTimeout() {
    if (this.pickInFlight) return;
    this.pickInFlight = true;
    try {
      const slot = this.state.order[this.state.currentOverall - 1];
      const teamId = slot?.fantasyTeamId ?? "";
      const bestAvailable = await this.bestAvailablePlayerIds(teamId);
      const result = reduce(this.state, {
        kind: "TIMEOUT",
        nowMs: Date.now(),
        timerConfig: this.timerConfig,
        bestAvailable,
      });
      this.state = result.state;
      await this.runEffects(result.effects);
    } finally {
      this.pickInFlight = false;
    }
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

  private async notifyDraftStarting(): Promise<void> {
    try {
      const teams = await prisma.fantasyTeam.findMany({
        where: { leagueId: this.leagueId },
        select: { id: true, ownerId: true },
      });
      await Promise.all(
        teams.map((t) =>
          createNotification(t.ownerId, "DRAFT_STARTING", { leagueId: this.leagueId }, prisma, this.leagueId, {
            title: "Draft is starting!",
            teamId: t.id,
            actionUrl: `/draft/${this.leagueId}?team=${t.id}`,
          })
        )
      );
    } catch {
      // fire-and-forget — never block the draft
    }
  }

  private async notifyOnClock(): Promise<void> {
    try {
      const slot = this.state.order[this.state.currentOverall - 1];
      if (!slot) return;
      const team = await prisma.fantasyTeam.findUnique({
        where: { id: slot.fantasyTeamId },
        select: { ownerId: true, name: true },
      });
      if (!team) return;
      await createNotification(
        team.ownerId,
        "ON_THE_CLOCK",
        { leagueId: this.leagueId, teamName: team.name, overall: this.state.currentOverall },
        prisma,
        this.leagueId,
        {
          title: "You're on the clock",
          body: `Pick ${this.state.currentOverall} of ${this.state.order.length}`,
          teamId: slot.fantasyTeamId,
          actionUrl: `/draft/${this.leagueId}?team=${slot.fantasyTeamId}`,
        }
      );

      // Only email if the team has no active WebSocket connection (not already in the room)
      const isConnected = [...this.sockets.values()].some(
        (teamId) => teamId === slot.fantasyTeamId
      );
      if (!isConnected && process.env.EMAIL_RESEND_ENABLED === "true") {
        void (async () => {
          try {
            const owner = await prisma.user.findUnique({
              where: { id: team.ownerId },
              select: { email: true, displayName: true },
            });
            if (owner && !owner.email.endsWith("@dev.local")) {
              // Generate a magic link so clicking the email logs them into the draft room
              const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();
              await prisma.user.update({
                where: { id: team.ownerId },
                data: { magicLinkToken: tokenHash, magicLinkExpiresAt: expiresAt },
              });
              await sendOnClock(
                owner.email,
                owner.displayName,
                rawToken,
                this.leagueId,
                slot.fantasyTeamId,
                this.state.currentOverall,
                this.state.order.length
              );
            }
          } catch {}
        })();
      }
    } catch {
      // fire-and-forget — never block the draft
    }
  }

  private async logDraftAction(action: CommissionerEventType): Promise<void> {
    try {
      const league = await prisma.fantasyLeague.findUnique({
        where: { id: this.leagueId },
        select: { commissionerId: true },
      });
      if (!league) return;
      await logCommissionerAction(this.leagueId, league.commissionerId, action, {}, prisma);
    } catch {
      // fire-and-forget — never block the draft
    }
  }

  private async runEffects(effects: Effect[]) {
    for (const e of effects) {
      switch (e.kind) {
        case "PERSIST_PICK":
          await this.persistPick(e.pick);
          await this.emitDraftPickEvent(e.pick);
          break;
        case "BROADCAST_PICK":
          this.broadcast({
            type: "PICK_MADE",
            pick: e.pick,
            state: toWireState(this.state),
          });
          if (this.state.status === "IN_PROGRESS" && this.state.order[this.state.currentOverall - 1]) {
            void this.notifyOnClock();
          }
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
          if (e.status === "IN_PROGRESS") {
            try { trackEvent({ event: "draft_started", leagueId: this.leagueId }); } catch {}
            void this.notifyDraftStarting();
            void this.notifyOnClock();
          }
          break;
        case "COMPLETE":
          await prisma.draft.update({
            where: { id: this.state.draftId },
            data: { status: "COMPLETE", completedAt: new Date() },
          });
          // Auto-start season so matchup rows exist immediately
          const league = await prisma.fantasyLeague.findUnique({
            where: { id: this.leagueId },
            select: { isReplay: true },
          });
          try {
            await startSeason(this.leagueId, prisma);
            // For replay leagues, set replayCurrentDate to the first period's start
            if (league?.isReplay) {
              const state = await getSeasonState(this.leagueId, Date.now(), prisma);
              const firstPeriod = state.periods[0];
              if (firstPeriod) {
                await prisma.fantasyLeague.update({
                  where: { id: this.leagueId },
                  data: { replayCurrentDate: new Date(firstPeriod.period.startsAt) },
                });
              }
            }
          } catch (e) {
            console.error("[draft] auto-startSeason failed", e);
          }
          try { trackEvent({ event: "draft_completed", leagueId: this.leagueId }); } catch {}
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
  // P2002 (unique constraint on RosterEntry.fantasyTeamId_playerId) means the player
  // was already drafted by another team — treat as a no-op; the in-memory engine
  // already deduplicates via draftedPlayerIds, so this is a safety net only.
  private async persistPick(pick: CompletedPick) {
    try {
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
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        console.error(`[Draft] Pick ${pick.overall} skipped: player ${pick.playerId} already on a roster`);
        return;
      }
      throw e;
    }
  }

  private async emitDraftPickEvent(pick: CompletedPick) {
    const player = await prisma.player.findUnique({
      where: { id: pick.playerId },
      select: { firstName: true, lastName: true },
    });
    const team = await prisma.fantasyTeam.findUnique({
      where: { id: pick.fantasyTeamId },
      select: { name: true },
    });
    if (!player || !team) return;
    const slot = this.state.order[pick.overall - 1];
    await emitEvent(
      {
        leagueId: this.leagueId,
        teamId: pick.fantasyTeamId,
        playerId: pick.playerId,
        type: "DRAFT_PICK" as LeagueEventType,
        data: {
          description: `${team.name} drafted ${player.firstName} ${player.lastName} (Round ${slot?.round ?? "?"}, Pick ${pick.overall})`,
          playerName: `${player.firstName} ${player.lastName}`,
          teamName: team.name,
          overall: pick.overall,
          auto: pick.auto,
        },
      },
      prisma
    );
  }

  // Position-aware, value-ranked auto-pick list for the given team.
  // Tier 1: fills a position-locked unfilled slot — goalie (can't fill UTIL) or
  //         defenseman when D slots remain open (BF-020: prevents 0-defender rosters).
  // Tier 2: fills an unfilled skater starter or UTIL slot (positional overflow).
  // Tier 3: bench only (all starting slots for this position are full).
  // Within each tier: proxy FP (goals × 2 + assists × 1.5 + win × 5 + shutout × 3) desc.
  private async bestAvailablePlayerIds(teamId: string): Promise<string[]> {
    const teamPickIds = this.state.completed
      .filter((p) => p.fantasyTeamId === teamId)
      .map((p) => p.playerId);

    let teamPickPositions: Array<"FORWARD" | "DEFENSE" | "GOALIE"> = [];
    if (teamPickIds.length > 0) {
      const pickedPlayers = await prisma.player.findMany({
        where: { id: { in: teamPickIds } },
        select: { position: true },
      });
      teamPickPositions = pickedPlayers.map(
        (p) => p.position as "FORWARD" | "DEFENSE" | "GOALIE"
      );
    }

    const needed = this.computeNeededSlots(teamPickPositions);
    const draftedIds = [...this.state.draftedPlayerIds];

    const players = await prisma.player.findMany({
      where: {
        active: true,
        ...(draftedIds.length > 0 ? { id: { notIn: draftedIds } } : {}),
      },
      select: {
        id: true,
        position: true,
        statLines: {
          where: { game: { season: this.leagueSeason } },
          select: { goals: true, assists: true, win: true, shutout: true },
        },
      },
    });

    type Ranked = { id: string; tier: number; fp: number; hasSeasonData: boolean };
    const ranked: Ranked[] = players.map((p) => {
      const pos = p.position as "FORWARD" | "DEFENSE" | "GOALIE";
      const hasSeasonData = p.statLines.length > 0;
      const fp = p.statLines.reduce(
        (sum, sl) =>
          sum +
          (sl.goals ?? 0) * 2 +
          (sl.assists ?? 0) * 1.5 +
          (sl.win ? 5 : 0) +
          (sl.shutout ? 3 : 0),
        0
      );
      let tier: number;
      if (pos === "GOALIE" && needed.goalie) {
        // Tier 1a: fills the only slot goalies can occupy
        tier = 1;
      } else if (pos === "DEFENSE" && needed.defense) {
        // Tier 1b: defensemen filling open D slot — same priority as goalies (BF-020)
        // This ensures auto-drafted rosters don't end up with 0–1 defenders.
        tier = 1;
      } else if (
        (pos === "FORWARD" || pos === "DEFENSE") &&
        (needed.forward || needed.util)
      ) {
        // Tier 2: fills an unfilled skater/UTIL slot (positional overflow)
        tier = 2;
      } else {
        tier = 3;
      }
      return { id: p.id, tier, fp, hasSeasonData };
    });

    ranked.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      // Prefer players with season data over mock/placeholder players (no data)
      if (a.hasSeasonData !== b.hasSeasonData) return a.hasSeasonData ? -1 : 1;
      return b.fp - a.fp;
    });
    return ranked.map((r) => r.id);
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
  commissionerTeamId: string | null;
  rosterSettings: Record<string, number>;
  leagueSeason: string;
}> {
  const league = await prisma.fantasyLeague.findUniqueOrThrow({
    where: { id: leagueId },
    include: { draft: true, teams: true },
  });
  if (!league.draft) throw new Error("League has no draft");

  const rosterSettings = (league.rosterSettings as Record<string, number>) ?? {};
  const rounds = rostersToRounds(rosterSettings);

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

  const commissionerTeam = league.teams.find(
    (t) => t.ownerId === league.commissionerId
  );
  const commissionerTeamId = commissionerTeam?.id ?? null;
  const leagueSeason = league.season;

  return { state, timerConfig, commissionerTeamId, rosterSettings, leagueSeason };
}

// Promise-keyed so concurrent JOINs for the same league share one buildEngineState call.
const roomPromises = new Map<string, Promise<DraftRoom>>();

export function getRoom(leagueId: string): Promise<DraftRoom> {
  let p = roomPromises.get(leagueId);
  if (!p) {
    p = buildEngineState(leagueId).then(
      ({ state, timerConfig, commissionerTeamId, rosterSettings, leagueSeason }) =>
        new DraftRoom(state, timerConfig, leagueId, commissionerTeamId, rosterSettings, leagueSeason)
    );
    roomPromises.set(leagueId, p);
  }
  return p;
}

export function startDraftServer(port = 8080) {
  // Wrap in an HTTP server so Render/Railway health checks work on GET /health.
  // WebSocket upgrades are routed through the same server.
  const http = require("http") as typeof import("http");
  const httpServer = http.createServer((_req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });

  const wss = new WebSocketServer({ server: httpServer });

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

  httpServer.listen(port, () => {
    console.log(`Draft websocket server listening on :${port}`);
  });
  return wss;
}
