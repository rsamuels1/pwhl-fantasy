import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { logCommissionerAction } from "@/lib/services/audit-service";
import { logger } from "@/lib/logger";

// POST /api/leagues/[leagueId]/commissioner/undo-transaction
// Two variants: type="waiver" undoes last add/drop; type="draft-pick" undoes last pick (draft must be PAUSED).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  const body = await req.json() as { type?: string; teamId?: string };

  if (!body.type || !["waiver", "draft-pick"].includes(body.type)) {
    return NextResponse.json({ error: "type must be 'waiver' or 'draft-pick'" }, { status: 400 });
  }

  if (body.type === "draft-pick") {
    return undoDraftPick(leagueId, auth.id, prisma);
  }

  // Waiver undo requires teamId
  if (!body.teamId) {
    return NextResponse.json({ error: "Missing teamId for waiver undo" }, { status: 400 });
  }

  return undoWaiverTransaction(leagueId, body.teamId, auth.id, prisma);
}

async function undoWaiverTransaction(
  leagueId: string,
  teamId: string,
  commissionerId: string,
  db: typeof prisma
): Promise<NextResponse> {
  // Guard: leagueEvent model requires `prisma db push` to be activated in the target environment.
  // Return a clean 503 instead of a 500 crash if the table doesn't exist yet.
  const leagueEventModel = (db as any).leagueEvent as typeof db.leagueEvent | undefined;
  if (!leagueEventModel) {
    return NextResponse.json(
      { error: "Transaction history not available — run prisma db push" },
      { status: 503 }
    );
  }

  // Find the most recent add or drop for this team in this league
  const lastEvent = await leagueEventModel.findFirst({
    where: {
      leagueId,
      teamId,
      type: { in: ["PLAYER_ADD", "PLAYER_DROP"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastEvent) {
    return NextResponse.json({ error: "No waiver transaction found to undo" }, { status: 404 });
  }

  const playerId = lastEvent.playerId as string | undefined;

  if (!playerId) {
    return NextResponse.json({ error: "Cannot determine player from transaction record" }, { status: 422 });
  }

  const eventData = lastEvent.data as { slot?: string };

  try {
    // Wrap roster entry change and event deletion in a transaction for atomicity
    await db.$transaction(async (tx) => {
      if (lastEvent.type === "PLAYER_ADD") {
        // Reverse an add: remove the roster entry if the player is still on this team
        const entry = await tx.rosterEntry.findFirst({
          where: { fantasyTeamId: teamId, playerId },
        });
        if (!entry) {
          throw new Error("Player is no longer on this team — undo would create a conflict");
        }
        await tx.rosterEntry.delete({ where: { id: entry.id } });
      } else {
        // Reverse a drop: add the player back — first check they haven't been picked up
        const onAnotherTeam = await tx.rosterEntry.findFirst({
          where: {
            playerId,
            fantasyTeam: { leagueId },
          },
        });
        if (onAnotherTeam) {
          throw new Error("Player was picked up by another team — undo would create a conflict");
        }
        await tx.rosterEntry.create({
          data: {
            fantasyTeamId: teamId,
            playerId,
            slot: (eventData.slot as any) ?? "BENCH",
            acquired: new Date(),
          },
        });
      }

      // Delete the event so it doesn't appear as undoable again
      await leagueEventModel.delete({ where: { id: lastEvent.id } });
    });
  } catch (e: unknown) {
    const message = (e as { message?: string })?.message || String(e);
    if (message.includes("Player is no longer on this team")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("Player was picked up by another team")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({
        error: "Player is already on this team — undo would create a duplicate entry",
      }, { status: 409 });
    }
    throw e;
  }

  await logCommissionerAction(leagueId, commissionerId, "COMMISSIONER_UNDO_TRANSACTION", {
    target: teamId,
    details: { undoneType: lastEvent.type, playerId, originalEventId: lastEvent.id },
  }, db).catch((err) => logger.error("logCommissionerAction failed (undo-waiver)", err));

  return NextResponse.json({ success: true, undone: lastEvent.type });
}

async function undoDraftPick(
  leagueId: string,
  commissionerId: string,
  db: typeof prisma
): Promise<NextResponse> {
  const draft = await db.draft.findUnique({
    where: { leagueId },
    include: {
      picks: {
        where: { pickedAt: { not: null } },
        orderBy: { overall: "desc" },
        take: 1,
        include: { fantasyTeam: { select: { id: true } } },
      },
    },
  });

  if (!draft) return NextResponse.json({ error: "No draft found" }, { status: 404 });
  if (draft.status !== "PAUSED") {
    return NextResponse.json({ error: "Draft must be PAUSED to undo a pick" }, { status: 409 });
  }

  const lastPick = draft.picks[0];
  if (!lastPick || !lastPick.playerId) {
    return NextResponse.json({ error: "No picks to undo" }, { status: 404 });
  }

  const { playerId, fantasyTeamId, overall } = lastPick as { playerId: string; fantasyTeamId: string; overall: number };

  await db.$transaction([
    // Clear the pick
    db.draftPick.update({
      where: { id: lastPick.id },
      data: { playerId: null, pickedAt: null, auto: false },
    }),
    // Remove from roster
    db.rosterEntry.deleteMany({
      where: { fantasyTeamId, playerId },
    }),
    // Rewind the draft pick counter
    db.draft.update({
      where: { id: draft.id },
      data: { currentPick: overall },
    }),
  ]);

  await logCommissionerAction(leagueId, commissionerId, "COMMISSIONER_UNDO_TRANSACTION", {
    target: fantasyTeamId,
    details: { undoneType: "DRAFT_PICK", playerId, overall },
  }, db).catch((err) => logger.error("logCommissionerAction failed (undo-draft-pick)", err));

  return NextResponse.json({ success: true, undone: "DRAFT_PICK", overall });
}
