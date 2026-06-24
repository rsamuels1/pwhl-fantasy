// lib/services/waiver-service.ts
// Waiver wire service: manages WaiverEntry, WaiverClaim, and WaiverPriority.
//
// Key concepts:
// - Dropped players enter a 48-hour (configurable) waiver window.
// - Any team can submit a claim during the window. The highest-priority team
//   (lowest priority number = first in line = reverse VP standings) wins.
// - After winning, the team moves to last priority (rolling waiver).
// - processWaivers() is idempotent — safe to call multiple times.

import type { PrismaClient } from "@prisma/client";
import { computeVpStandings } from "@/lib/scoring/vp";
import { emitEvent } from "@/lib/services/activity";

// ── Priority initialization ─────────────────────────────────────────────────

/**
 * Sets up WaiverPriority rows for all teams in the league.
 * Called when the season starts (after draft completes, before first week).
 * Priority 1 = first in line (reverse VP standings — last place gets first pick).
 * If no matchups exist yet, falls back to reverse draft order.
 */
export async function initializeWaiverPriority(
  leagueId: string,
  prisma: PrismaClient
): Promise<void> {
  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true, draftOrder: true },
    orderBy: { draftOrder: "asc" },
  });
  if (teams.length === 0) return;

  const matchups = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: false },
    select: {
      homeTeamId: true, awayTeamId: true,
      homeScore: true, awayScore: true,
      homeVP: true, awayVP: true,
      isPlayoff: true, week: true,
    },
  });

  let orderedTeamIds: string[];

  if (matchups.length === 0) {
    // Pre-season: last draft pick = priority 1 (reverse draft order).
    // draftOrder is already ascending; reverse it so last pick = index 0.
    const sorted = [...teams].sort((a, b) => {
      const ao = a.draftOrder ?? 0;
      const bo = b.draftOrder ?? 0;
      return bo - ao; // descending draft order → last pick first
    });
    orderedTeamIds = sorted.map((t) => t.id);
  } else {
    // Use VP standings — last place gets priority 1.
    const standings = computeVpStandings(
      teams.map((t) => ({ id: t.id, name: t.name })),
      matchups
    );
    // standings is sorted best-first; reverse to get worst-first
    orderedTeamIds = [...standings].reverse().map((s) => s.fantasyTeamId);
  }

  // Upsert priorities: index 0 gets priority 1, index 1 gets priority 2, …
  for (let i = 0; i < orderedTeamIds.length; i++) {
    const fantasyTeamId = orderedTeamIds[i]!;
    const priority = i + 1;
    await prisma.waiverPriority.upsert({
      where: { leagueId_fantasyTeamId: { leagueId, fantasyTeamId } },
      update: { priority },
      create: { leagueId, fantasyTeamId, priority },
    });
  }
}

// ── Waiver entry management ─────────────────────────────────────────────────

/**
 * Places a dropped player on the waiver wire (48h window by default).
 * Idempotent: if already on waivers, resets the expiry clock.
 */
export async function enterWaiverWire(
  leagueId: string,
  playerId: string,
  windowHours: number,
  prisma: PrismaClient
): Promise<void> {
  const expiresAt = new Date(Date.now() + windowHours * 60 * 60 * 1000);
  await prisma.waiverEntry.upsert({
    where: { leagueId_playerId: { leagueId, playerId } },
    update: { expiresAt },
    create: { leagueId, playerId, expiresAt },
  });
}

// ── Status check ────────────────────────────────────────────────────────────

/**
 * Returns whether a player is currently on the waiver wire in this league.
 * An expired WaiverEntry returns `isOnWaivers: false`.
 */
export async function getPlayerWaiverStatus(
  leagueId: string,
  playerId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<{ isOnWaivers: boolean; expiresAt?: Date }> {
  const entry = await prisma.waiverEntry.findUnique({
    where: { leagueId_playerId: { leagueId, playerId } },
  });
  if (!entry || entry.expiresAt.getTime() <= nowMs) return { isOnWaivers: false };
  return { isOnWaivers: true, expiresAt: entry.expiresAt };
}

// ── Claim submission ────────────────────────────────────────────────────────

/**
 * Submits a waiver claim for `addPlayerId`. `dropPlayerId` is optional (only
 * needed when the team is at roster capacity).
 * Throws if:
 * - player is not on waivers
 * - team already has a PENDING claim for this player
 */
export async function submitClaim(
  leagueId: string,
  fantasyTeamId: string,
  addPlayerId: string,
  dropPlayerId: string | null,
  nowMs: number,
  prisma: PrismaClient
): Promise<{ claim: object }> {
  // Verify the player is on waivers
  const waiverStatus = await getPlayerWaiverStatus(leagueId, addPlayerId, nowMs, prisma);
  if (!waiverStatus.isOnWaivers) {
    throw new Error("Player is not currently on the waiver wire.");
  }

  // Get this team's current priority
  const priorityRow = await prisma.waiverPriority.findUnique({
    where: { leagueId_fantasyTeamId: { leagueId, fantasyTeamId } },
    select: { priority: true },
  });
  const priority = priorityRow?.priority ?? 999;

  // Check for duplicate pending claim — let the DB unique constraint catch it
  // too, but give a clearer error up front
  const existing = await prisma.waiverClaim.findFirst({
    where: { leagueId, fantasyTeamId, addPlayerId, status: "PENDING" },
  });
  if (existing) {
    throw new Error("You already have a pending claim for this player.");
  }

  const claim = await prisma.waiverClaim.create({
    data: {
      leagueId,
      fantasyTeamId,
      addPlayerId,
      dropPlayerId,
      prioritySnapshot: priority,
      status: "PENDING",
    },
  });

  // Emit activity event (best-effort)
  emitEvent(
    {
      leagueId,
      teamId: fantasyTeamId,
      playerId: addPlayerId,
      type: "WAIVER_CLAIM_SUBMITTED",
      data: { description: "Waiver claim submitted" },
    },
    prisma
  ).catch(() => {});

  return { claim };
}

// ── Waiver processing ───────────────────────────────────────────────────────

/**
 * Processes all expired waiver entries in this league.
 * For each expired entry:
 * - 0 claims → entry deleted, counts as "expired"
 * - 1+ claims → lowest prioritySnapshot wins; winner gets the player added
 *   to BENCH, loser claims marked DENIED, winner moves to last in priority order
 *
 * IDEMPOTENT: already-awarded entries are skipped.
 */
export async function processWaivers(
  leagueId: string,
  nowMs: number,
  prisma: PrismaClient
): Promise<{ awarded: number; denied: number; expired: number }> {
  let awarded = 0;
  let denied = 0;
  let expired = 0;

  // Find all expired WaiverEntries
  const expiredEntries = await prisma.waiverEntry.findMany({
    where: { leagueId, expiresAt: { lte: new Date(nowMs) } },
  });

  for (const entry of expiredEntries) {
    // Idempotency guard: if already AWARDED for this player in this league, skip
    const alreadyAwarded = await prisma.waiverClaim.findFirst({
      where: { leagueId, addPlayerId: entry.playerId, status: "AWARDED" },
    });
    if (alreadyAwarded) {
      // Clean up the WaiverEntry if it still exists
      await prisma.waiverEntry
        .delete({ where: { leagueId_playerId: { leagueId: entry.leagueId, playerId: entry.playerId } } })
        .catch(() => {});
      continue;
    }

    // Find all PENDING claims for this player, sorted by priority ASC (lowest = first in line)
    const claims = await prisma.waiverClaim.findMany({
      where: { leagueId, addPlayerId: entry.playerId, status: "PENDING" },
      orderBy: { prioritySnapshot: "asc" },
    });

    if (claims.length === 0) {
      // No claims — just delete the entry
      await prisma.waiverEntry
        .delete({ where: { leagueId_playerId: { leagueId: entry.leagueId, playerId: entry.playerId } } })
        .catch(() => {});
      expired++;
      continue;
    }

    const winner = claims[0]!;
    const losers = claims.slice(1);

    // Process the award in a transaction
    await prisma.$transaction(async (tx) => {
      // Drop requested player if specified
      if (winner.dropPlayerId) {
        const dropEntry = await tx.rosterEntry.findFirst({
          where: { fantasyTeamId: winner.fantasyTeamId, playerId: winner.dropPlayerId },
        });
        if (dropEntry) {
          await tx.rosterEntry.delete({ where: { id: dropEntry.id } });
        }
      }

      // Add the claimed player to the winner's roster at BENCH
      await tx.rosterEntry.create({
        data: {
          fantasyTeamId: winner.fantasyTeamId,
          playerId: winner.addPlayerId,
          slot: "BENCH",
        },
      });

      // Mark winner claim as AWARDED
      await tx.waiverClaim.update({
        where: { id: winner.id },
        data: { status: "AWARDED", processedAt: new Date(nowMs) },
      });

      // Mark all loser claims as DENIED
      if (losers.length > 0) {
        await tx.waiverClaim.updateMany({
          where: { id: { in: losers.map((c) => c.id) } },
          data: { status: "DENIED", processedAt: new Date(nowMs) },
        });
      }

      // Delete the WaiverEntry
      await tx.waiverEntry
        .delete({ where: { leagueId_playerId: { leagueId: entry.leagueId, playerId: entry.playerId } } })
        .catch(() => {});

      // Move winner to last priority position (rolling waiver)
      const allPriorities = await tx.waiverPriority.findMany({
        where: { leagueId },
        orderBy: { priority: "asc" },
      });

      // Re-number all teams except the winner first (1..N-1 in original order)
      let counter = 1;
      for (const row of allPriorities) {
        if (row.fantasyTeamId === winner.fantasyTeamId) continue;
        await tx.waiverPriority.update({
          where: { leagueId_fantasyTeamId: { leagueId, fantasyTeamId: row.fantasyTeamId } },
          data: { priority: counter },
        });
        counter++;
      }
      // Winner goes last
      const maxPriority = allPriorities.length;
      await tx.waiverPriority.update({
        where: { leagueId_fantasyTeamId: { leagueId, fantasyTeamId: winner.fantasyTeamId } },
        data: { priority: maxPriority },
      });
    });

    // Emit activity events (best-effort, outside transaction)
    emitEvent(
      {
        leagueId,
        teamId: winner.fantasyTeamId,
        playerId: winner.addPlayerId,
        type: "WAIVER_CLAIM_AWARDED",
        data: { description: "Waiver claim awarded" },
      },
      prisma
    ).catch(() => {});
    // Also emit PLAYER_ADD so the "Adds/Drops" transaction filter includes waiver-claim additions
    emitEvent(
      {
        leagueId,
        teamId: winner.fantasyTeamId,
        playerId: winner.addPlayerId,
        type: "PLAYER_ADD",
        data: { description: "Added via waiver claim" },
      },
      prisma
    ).catch(() => {});

    for (const loser of losers) {
      emitEvent(
        {
          leagueId,
          teamId: loser.fantasyTeamId,
          playerId: loser.addPlayerId,
          type: "WAIVER_CLAIM_DENIED",
          data: { description: "Waiver claim denied" },
        },
        prisma
      ).catch(() => {});
    }

    awarded++;
    denied += losers.length;
  }

  return { awarded, denied, expired };
}
