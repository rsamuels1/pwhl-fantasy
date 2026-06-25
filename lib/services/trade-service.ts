// lib/services/trade-service.ts
// Trade system service layer: orchestrates Prisma + domain engine calls.
// All DB access lives here; domain logic lives in lib/trades/engine.ts.
//
// Design: mirror the waiver-service pattern — each function loads what it needs,
// calls the pure engine, writes results, fires side-effects (notifications, events,
// analytics) fire-and-forget so they never block the response.

import type { PrismaClient, Trade, TradeItem } from "@prisma/client";
import {
  validateTradeProposal,
  validateTradeExecution,
  applyTrade,
  canTransitionTo,
  type TradeItemInput,
  type TradableRosterEntry,
} from "@/lib/trades/engine";
import { createNotification } from "@/lib/services/notification-service";
import { sendTradeReceived } from "@/lib/services/email-service";
import { emitEvent } from "@/lib/services/activity";
import { trackEvent } from "@/lib/analytics";
import type { RosterSettings } from "@/lib/lineup";

// ── Error types ──────────────────────────────────────────────────────────────

export class TradeValidationError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "TradeValidationError";
  }
}

export class TradeNotFoundError extends Error {
  constructor(tradeId: string) {
    super(`Trade ${tradeId} not found`);
    this.name = "TradeNotFoundError";
  }
}

export class TradeTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeTransitionError";
  }
}

// ── Re-export Trade type with items ─────────────────────────────────────────

export type TradeWithItems = Trade & { items: TradeItem[] };

// ── Roster loading helper ────────────────────────────────────────────────────

/**
 * Loads a team's roster from the DB enriched with hasPlayedThisPeriod.
 * activePeriodStartMs drives the play-lock check.
 */
async function loadTradableRoster(
  fantasyTeamId: string,
  nowMs: number,
  activePeriodStart: Date | null,
  prisma: PrismaClient
): Promise<TradableRosterEntry[]> {
  const entries = await prisma.rosterEntry.findMany({
    where: { fantasyTeamId },
    include: {
      player: { select: { id: true, position: true, active: true } },
    },
  });

  const nowDate = new Date(nowMs);

  // Batch-check hasPlayedThisPeriod for all players
  let playedSet = new Set<string>();
  if (activePeriodStart) {
    const statLines = await prisma.statLine.findMany({
      where: {
        playerId: { in: entries.map((e) => e.playerId) },
        game: { startsAt: { gte: activePeriodStart, lte: nowDate } },
      },
      select: { playerId: true },
    });
    playedSet = new Set(statLines.map((s) => s.playerId));
  }

  return entries.map((e) => ({
    playerId: e.playerId,
    slot: e.slot,
    position: e.player.position,
    active: e.player.active,
    hasPlayedThisPeriod: playedSet.has(e.playerId),
  }));
}

// ── Propose ──────────────────────────────────────────────────────────────────

export async function proposeTrade(
  leagueId: string,
  proposingTeamId: string,
  receivingTeamId: string,
  items: TradeItemInput[],
  message: string | null,
  nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  if (proposingTeamId === receivingTeamId) {
    throw new TradeValidationError("Cannot trade with yourself.");
  }

  // Validate league is in tradeable state (no trades during playoffs)
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { status: true, playoffStatus: true, rosterSettings: true, tradeReviewHours: true, requireCommissionerTradeApproval: true },
  });
  if (!league) throw new TradeValidationError("League not found.");
  if (league.playoffStatus === "IN_PROGRESS" || league.playoffStatus === "COMPLETE") {
    throw new TradeValidationError("The trade deadline has passed — no trades after playoffs begin.");
  }

  const rosterSettings = (league.rosterSettings ?? {}) as RosterSettings;

  // Load both rosters (no activePeriod start needed for proposal validation —
  // we still check hasPlayedThisPeriod using nowMs against current period in engine)
  const [proposingRoster, receivingRoster] = await Promise.all([
    loadTradableRoster(proposingTeamId, nowMs, null, prisma),
    loadTradableRoster(receivingTeamId, nowMs, null, prisma),
  ]);

  const result = validateTradeProposal(items, proposingRoster, receivingRoster, rosterSettings);
  if (!result.valid) {
    throw new TradeValidationError(result.reason ?? "Trade proposal is invalid.");
  }

  const requireApproval = league.requireCommissionerTradeApproval ?? false;

  // Always create as PROPOSED first so the proposer's "Sent" tab shows the trade
  // in PROPOSED state before it transitions. If commissioner approval is required,
  // we immediately flip it to PENDING_REVIEW in the same transaction.
  const trade = await prisma.$transaction(async (tx) => {
    const created = await tx.trade.create({
      data: {
        leagueId,
        proposingTeamId,
        receivingTeamId,
        status: "PROPOSED",
        message: message?.trim() || null,
        items: {
          create: items.map((i) => ({
            fromTeamId: i.fromTeamId,
            toTeamId: i.toTeamId,
            playerId: i.playerId,
          })),
        },
      },
      include: { items: true },
    });

    if (requireApproval) {
      // Flip to PENDING_REVIEW so commissioner sees it immediately
      return tx.trade.update({
        where: { id: created.id },
        data: { status: "PENDING_REVIEW" },
        include: { items: true },
      });
    }

    return created;
  });

  // Notify the receiving team owner (skip if going straight to commissioner review)
  if (!requireApproval) {
    void notifyReceiver(trade.id, leagueId, receivingTeamId, proposingTeamId, "received", prisma).catch(() => {});
  } else {
    void notifyCommissionerReview(trade.id, leagueId, prisma).catch(() => {});
  }

  // Analytics fire-and-forget
  try {
    trackEvent({
      event: "trade_proposed",
      leagueId,
      properties: { tradeId: trade.id, itemCount: items.length },
    });
  } catch {}

  // Auto-accept if the receiving team is a bot
  const receivingTeam = await prisma.fantasyTeam.findUnique({
    where: { id: receivingTeamId },
    select: { isBot: true },
  });
  if (receivingTeam?.isBot) {
    return acceptTrade(trade.id, receivingTeamId, nowMs, prisma);
  }

  return trade;
}

// ── Accept ───────────────────────────────────────────────────────────────────

export async function acceptTrade(
  tradeId: string,
  receivingTeamId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true, league: { select: { tradeReviewHours: true, requireCommissionerTradeApproval: true, rosterSettings: true, status: true, playoffStatus: true } } },
  });
  if (!trade) throw new TradeNotFoundError(tradeId);
  if (trade.receivingTeamId !== receivingTeamId) {
    throw new TradeTransitionError("Only the receiving team may accept a trade.");
  }
  if (!canTransitionTo(trade.status as import("@/lib/trades/engine").TradeStatus, "ACCEPTED", "receiver")) {
    throw new TradeTransitionError(`Trade cannot be accepted in its current state (${trade.status}).`);
  }

  // Validate league is still tradeable
  if (trade.league.playoffStatus === "IN_PROGRESS" || trade.league.playoffStatus === "COMPLETE") {
    throw new TradeValidationError("The trade deadline has passed.");
  }

  const rosterSettings = (trade.league.rosterSettings ?? {}) as RosterSettings;

  // Re-validate rosters at accept time (stale check + legality)
  const [proposingRoster, receivingRoster] = await Promise.all([
    loadTradableRoster(trade.proposingTeamId, nowMs, null, prisma),
    loadTradableRoster(trade.receivingTeamId, nowMs, null, prisma),
  ]);
  const validation = validateTradeExecution(
    trade.items.map((i) => ({ fromTeamId: i.fromTeamId, toTeamId: i.toTeamId, playerId: i.playerId })),
    proposingRoster,
    receivingRoster,
    rosterSettings
  );
  if (!validation.valid) {
    throw new TradeValidationError(validation.reason ?? "Trade is no longer valid.");
  }

  const reviewHours = trade.league.tradeReviewHours ?? 24;
  const requireApproval = trade.league.requireCommissionerTradeApproval ?? false;

  const needsReview = reviewHours > 0 || requireApproval;

  let updated: TradeWithItems;

  if (needsReview) {
    const reviewEndsAt = reviewHours > 0
      ? new Date(nowMs + reviewHours * 60 * 60 * 1000)
      : null;

    // First transition to ACCEPTED so receiver can still see and interact with the trade
    updated = await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: "ACCEPTED",
        reviewEndsAt,
      },
      include: { items: true },
    });

    // Notify commissioner of pending review
    void notifyCommissionerReview(trade.id, trade.leagueId, prisma).catch(() => {});
  } else {
    // Execute immediately
    updated = await executeTrade(tradeId, nowMs, prisma);
  }

  // Notify proposing team that trade was accepted
  void notifyProposer(trade.id, trade.leagueId, trade.proposingTeamId, "accepted", prisma).catch(() => {});

  try {
    trackEvent({
      event: "trade_responded",
      leagueId: trade.leagueId,
      properties: { tradeId, response: "accepted" },
    });
  } catch {}

  return updated;
}

// ── Reject ───────────────────────────────────────────────────────────────────

export async function rejectTrade(
  tradeId: string,
  receivingTeamId: string,
  _nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true },
  });
  if (!trade) throw new TradeNotFoundError(tradeId);
  if (trade.receivingTeamId !== receivingTeamId) {
    throw new TradeTransitionError("Only the receiving team may reject a trade.");
  }
  if (!canTransitionTo(trade.status as import("@/lib/trades/engine").TradeStatus, "REJECTED", "receiver")) {
    throw new TradeTransitionError(`Trade cannot be rejected in its current state (${trade.status}).`);
  }

  const updated = await prisma.trade.update({
    where: { id: tradeId },
    data: { status: "REJECTED", resolvedReason: "Rejected by receiving team" },
    include: { items: true },
  });

  void notifyProposer(trade.id, trade.leagueId, trade.proposingTeamId, "rejected", prisma).catch(() => {});

  try {
    trackEvent({
      event: "trade_responded",
      leagueId: trade.leagueId,
      properties: { tradeId, response: "rejected" },
    });
  } catch {}

  return updated;
}

// ── Counter ──────────────────────────────────────────────────────────────────

export async function counterTrade(
  tradeId: string,
  receivingTeamId: string,
  newItems: TradeItemInput[],
  message: string | null,
  nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true, league: { select: { rosterSettings: true, status: true, playoffStatus: true } } },
  });
  if (!trade) throw new TradeNotFoundError(tradeId);
  if (trade.receivingTeamId !== receivingTeamId) {
    throw new TradeTransitionError("Only the receiving team may counter a trade.");
  }
  if (!canTransitionTo(trade.status as import("@/lib/trades/engine").TradeStatus, "COUNTERED", "receiver")) {
    throw new TradeTransitionError(`Trade cannot be countered in its current state (${trade.status}).`);
  }
  if (trade.league.playoffStatus === "IN_PROGRESS" || trade.league.playoffStatus === "COMPLETE") {
    throw new TradeValidationError("The trade deadline has passed.");
  }

  const rosterSettings = (trade.league.rosterSettings ?? {}) as RosterSettings;

  // Validate the counter-proposal terms
  const [proposingRoster, receivingRoster] = await Promise.all([
    loadTradableRoster(trade.proposingTeamId, nowMs, null, prisma),
    loadTradableRoster(trade.receivingTeamId, nowMs, null, prisma),
  ]);
  // For the counter, the roles flip: the counter proposer is the original receiver.
  const validation = validateTradeProposal(newItems, receivingRoster, proposingRoster, rosterSettings);
  if (!validation.valid) {
    throw new TradeValidationError(validation.reason ?? "Counter-offer is invalid.");
  }

  // Create a new Trade for the counter, referencing the original
  const [, counter] = await prisma.$transaction([
    prisma.trade.update({
      where: { id: tradeId },
      data: { status: "COUNTERED" },
    }),
    prisma.trade.create({
      data: {
        leagueId: trade.leagueId,
        // Counter roles flip: the original receiver becomes the new proposer
        proposingTeamId: trade.receivingTeamId,
        receivingTeamId: trade.proposingTeamId,
        status: "PROPOSED",
        message: message?.trim() || null,
        counterOfId: tradeId,
        items: {
          create: newItems.map((i) => ({
            fromTeamId: i.fromTeamId,
            toTeamId: i.toTeamId,
            playerId: i.playerId,
          })),
        },
      },
      include: { items: true },
    }),
  ]);

  // Notify the original proposer about the counter
  void notifyReceiver(counter.id, trade.leagueId, trade.proposingTeamId, trade.receivingTeamId, "counter", prisma).catch(() => {});

  try {
    trackEvent({
      event: "trade_responded",
      leagueId: trade.leagueId,
      properties: { tradeId, response: "countered", newTradeId: counter.id },
    });
  } catch {}

  return counter;
}

// ── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelTrade(
  tradeId: string,
  proposingTeamId: string,
  _nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true },
  });
  if (!trade) throw new TradeNotFoundError(tradeId);
  if (trade.proposingTeamId !== proposingTeamId) {
    throw new TradeTransitionError("Only the proposing team may cancel a trade.");
  }
  if (!canTransitionTo(trade.status as import("@/lib/trades/engine").TradeStatus, "CANCELLED", "proposer")) {
    throw new TradeTransitionError(`Trade cannot be cancelled in its current state (${trade.status}).`);
  }

  return prisma.trade.update({
    where: { id: tradeId },
    data: { status: "CANCELLED", resolvedReason: "Cancelled by proposing team" },
    include: { items: true },
  });
}

// ── Commissioner review ───────────────────────────────────────────────────────

export async function reviewTrade(
  tradeId: string,
  commissionerId: string,
  action: "approve" | "veto",
  nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { items: true },
  });
  if (!trade) throw new TradeNotFoundError(tradeId);
  if (trade.status !== "PENDING_REVIEW" && trade.status !== "ACCEPTED") {
    throw new TradeTransitionError(`Trade is not pending review (status: ${trade.status}).`);
  }

  if (action === "veto") {
    const updated = await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: "REVERSED",
        resolvedReason: `Vetoed by commissioner (id: ${commissionerId})`,
      },
      include: { items: true },
    });

    void notifyBothTeams(trade.id, trade.leagueId, trade.proposingTeamId, trade.receivingTeamId, "vetoed", prisma).catch(() => {});

    try {
      trackEvent({
        event: "trade_vetoed",
        leagueId: trade.leagueId,
        properties: { tradeId, commissionerId },
      });
    } catch {}

    return updated;
  } else {
    // Approve — execute the trade
    const updated = await executeTrade(tradeId, nowMs, prisma);
    return updated;
  }
}

// ── Execute ───────────────────────────────────────────────────────────────────

/**
 * Executes a trade atomically:
 * 1. Re-validates both rosters (stale check + legality)
 * 2. Moves all TradeItem players (update RosterEntry — incoming players land on BENCH)
 * 3. Sets trade.status = EXECUTED
 * 4. Emits LeagueEvent for both teams
 * 5. Fires notifications to both managers
 *
 * Idempotent: if trade is already EXECUTED, returns it unchanged.
 */
export async function executeTrade(
  tradeId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<TradeWithItems> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      items: true,
      league: { select: { rosterSettings: true } },
    },
  });
  if (!trade) throw new TradeNotFoundError(tradeId);

  // Idempotency guard
  if (trade.status === "EXECUTED") return trade as TradeWithItems;

  const rosterSettings = (trade.league.rosterSettings ?? {}) as RosterSettings;
  const items = trade.items.map((i) => ({
    fromTeamId: i.fromTeamId,
    toTeamId: i.toTeamId,
    playerId: i.playerId,
  }));

  // Re-validate at execution time
  const [proposingRoster, receivingRoster] = await Promise.all([
    loadTradableRoster(trade.proposingTeamId, nowMs, null, prisma),
    loadTradableRoster(trade.receivingTeamId, nowMs, null, prisma),
  ]);
  const validation = validateTradeExecution(items, proposingRoster, receivingRoster, rosterSettings);
  if (!validation.valid) {
    // Mark trade as failed (stale or illegal)
    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        status: "REJECTED",
        resolvedReason: validation.reason === "STALE"
          ? "Trade failed: a player is no longer on the expected team"
          : `Trade failed at execution: ${validation.reason}`,
      },
    });
    throw new TradeValidationError(validation.reason ?? "Trade failed at execution.");
  }

  // Simulate the roster swap to build the update list
  const { proposingRoster: newProp, receivingRoster: newRec } = applyTrade(
    items,
    proposingRoster,
    receivingRoster
  );

  // Execute atomically
  const executed = await prisma.$transaction(async (tx) => {
    // Move each player: update their RosterEntry.fantasyTeamId and slot=BENCH
    for (const item of items) {
      await tx.rosterEntry.update({
        where: { fantasyTeamId_playerId: { fantasyTeamId: item.fromTeamId, playerId: item.playerId } },
        data: {
          fantasyTeamId: item.toTeamId,
          slot: "BENCH",
        },
      });
    }

    // Mark trade as executed
    return tx.trade.update({
      where: { id: tradeId },
      data: {
        status: "EXECUTED",
        executedAt: new Date(nowMs),
      },
      include: { items: true },
    });
  });

  // Build player name map for activity descriptions
  const playerIds = items.map((i) => i.playerId);
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const playerMap = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  const description = items
    .map((i) => `${playerMap.get(i.playerId) ?? i.playerId} → team ${i.toTeamId}`)
    .join(", ");

  // Emit LeagueEvent for both teams (fire-and-forget)
  emitEvent(
    {
      leagueId: trade.leagueId,
      teamId: trade.proposingTeamId,
      type: "TRADE",
      data: { tradeId, description: `Trade executed: ${description}` },
    },
    prisma
  ).catch(() => {});

  emitEvent(
    {
      leagueId: trade.leagueId,
      teamId: trade.receivingTeamId,
      type: "TRADE",
      data: { tradeId, description: `Trade executed: ${description}` },
    },
    prisma
  ).catch(() => {});

  void notifyBothTeams(trade.id, trade.leagueId, trade.proposingTeamId, trade.receivingTeamId, "executed", prisma).catch(() => {});

  try {
    trackEvent({
      event: "trade_executed",
      leagueId: trade.leagueId,
      properties: { tradeId, itemCount: items.length },
    });
  } catch {}

  return executed as TradeWithItems;
}

// ── Expiry processing ────────────────────────────────────────────────────────

/**
 * Marks all PROPOSED trades in a league as EXPIRED if they are older than
 * `expiryHours` hours. Safe to call on a cron or before listing trades.
 * Sends notifications to proposers about expired trades.
 */
export async function processExpiredTrades(
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<void> {
  const EXPIRY_HOURS = 72; // 3 days default for proposal expiry
  const cutoff = new Date(nowMs - EXPIRY_HOURS * 60 * 60 * 1000);

  const expired = await prisma.trade.findMany({
    where: {
      leagueId,
      status: "PROPOSED",
      createdAt: { lt: cutoff },
    },
    select: { id: true, proposingTeamId: true },
  });

  if (expired.length > 0) {
    await prisma.trade.updateMany({
      where: {
        leagueId,
        status: "PROPOSED",
        createdAt: { lt: cutoff },
      },
      data: {
        status: "EXPIRED",
        resolvedReason: "Trade expired after 72 hours",
      },
    });

    // Notify proposers of expired trades
    for (const trade of expired) {
      const ownerId = await getTeamOwnerId(trade.proposingTeamId, prisma);
      if (ownerId) {
        void createNotification(ownerId, "TRADE_REJECTED", { tradeId: trade.id }, prisma, leagueId, {
          title: "Trade expired",
          body: "Your trade proposal was not accepted within 72 hours and has expired.",
          teamId: trade.proposingTeamId,
          actionUrl: `/league/${leagueId}/trades`,
          dedupeKey: `trade-expired-${trade.id}`,
        }).catch(() => {});
      }
    }
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getTradesForTeam(
  leagueId: string,
  teamId: string,
  prisma: PrismaClient
): Promise<TradeWithItems[]> {
  return prisma.trade.findMany({
    where: {
      leagueId,
      OR: [{ proposingTeamId: teamId }, { receivingTeamId: teamId }],
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrade(
  tradeId: string,
  leagueId: string,
  prisma: PrismaClient
): Promise<TradeWithItems | null> {
  return prisma.trade.findFirst({
    where: { id: tradeId, leagueId },
    include: { items: true },
  });
}

export async function getLeagueTrades(
  leagueId: string,
  prisma: PrismaClient
): Promise<TradeWithItems[]> {
  return prisma.trade.findMany({
    where: { leagueId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ── Notification helpers ─────────────────────────────────────────────────────

async function getTeamOwnerId(teamId: string, prisma: PrismaClient): Promise<string | null> {
  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });
  return team?.ownerId ?? null;
}

async function notifyReceiver(
  tradeId: string,
  leagueId: string,
  receiverTeamId: string,
  senderTeamId: string,
  reason: "received" | "counter",
  prisma: PrismaClient
): Promise<void> {
  const ownerId = await getTeamOwnerId(receiverTeamId, prisma);
  if (!ownerId) return;
  const title = reason === "counter" ? "You received a counter-offer" : "You received a trade offer";
  await createNotification(ownerId, "TRADE_RECEIVED", { tradeId }, prisma, leagueId, {
    title,
    body: "View the proposal and respond.",
    teamId: receiverTeamId,
    actionUrl: `/league/${leagueId}/trades/${tradeId}`,
  });

  // Fire-and-forget email when real email is enabled
  if (process.env.EMAIL_RESEND_ENABLED === "true") {
    void (async () => {
      try {
        const [receiver, senderTeam, league] = await Promise.all([
          prisma.user.findUnique({ where: { id: ownerId }, select: { email: true, displayName: true } }),
          prisma.fantasyTeam.findUnique({ where: { id: senderTeamId }, select: { name: true } }),
          prisma.fantasyLeague.findUnique({ where: { id: leagueId }, select: { name: true } }),
        ]);
        if (receiver && senderTeam && league) {
          await sendTradeReceived(
            receiver.email,
            receiver.displayName,
            senderTeam.name,
            league.name,
            `/league/${leagueId}/trades/${tradeId}`
          );
        }
      } catch {}
    })();
  }
}

async function notifyProposer(
  tradeId: string,
  leagueId: string,
  proposerTeamId: string,
  response: "accepted" | "rejected",
  prisma: PrismaClient
): Promise<void> {
  const ownerId = await getTeamOwnerId(proposerTeamId, prisma);
  if (!ownerId) return;
  const isAccepted = response === "accepted";
  await createNotification(
    ownerId,
    isAccepted ? "TRADE_ACCEPTED" : "TRADE_REJECTED",
    { tradeId },
    prisma,
    leagueId,
    {
      title: isAccepted ? "Your trade offer was accepted" : "Your trade offer was rejected",
      teamId: proposerTeamId,
      actionUrl: `/league/${leagueId}/trades/${tradeId}`,
    }
  );
}

async function notifyBothTeams(
  tradeId: string,
  leagueId: string,
  proposingTeamId: string,
  receivingTeamId: string,
  event: "executed" | "vetoed",
  prisma: PrismaClient
): Promise<void> {
  const [propOwner, recOwner] = await Promise.all([
    getTeamOwnerId(proposingTeamId, prisma),
    getTeamOwnerId(receivingTeamId, prisma),
  ]);
  const type = event === "executed" ? "TRADE_EXECUTED" : "TRADE_VETOED";
  const title = event === "executed" ? "Trade executed" : "Trade vetoed by commissioner";
  const url = `/league/${leagueId}/trades/${tradeId}`;

  if (propOwner) {
    await createNotification(propOwner, type, { tradeId }, prisma, leagueId, {
      title, teamId: proposingTeamId, actionUrl: url,
    }).catch(() => {});
  }
  if (recOwner) {
    await createNotification(recOwner, type, { tradeId }, prisma, leagueId, {
      title, teamId: receivingTeamId, actionUrl: url,
    }).catch(() => {});
  }
}

async function notifyCommissionerReview(
  tradeId: string,
  leagueId: string,
  prisma: PrismaClient
): Promise<void> {
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { commissionerId: true },
  });
  if (!league) return;
  await createNotification(
    league.commissionerId,
    "TRADE_REVIEW_PENDING",
    { tradeId },
    prisma,
    leagueId,
    {
      title: "A trade needs your review",
      body: "Review the trade and approve or veto.",
      actionUrl: `/league/${leagueId}/admin`,
    }
  );
}
