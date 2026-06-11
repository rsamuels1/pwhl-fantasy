import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSnakeOrder, rostersToRounds } from "@/lib/draft/snake";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";

const DEFAULT_ROSTER_SETTINGS = {
  forward: 2,
  defense: 2,
  goalie: 1,
  util: 1,
  bench: 4,
};

export async function POST(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(params.leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  try {
    const leagueId = params.leagueId;
    const league = await prisma.fantasyLeague.findUnique({
      where: { id: leagueId },
      include: { teams: true, draft: true },
    });

    if (!league) {
      return NextResponse.json({ error: "League not found." }, { status: 404 });
    }

    if (league.draft) {
      return NextResponse.json({
        message: "Draft already exists.",
        draftId: league.draft.id,
        status: league.draft.status,
      });
    }

    if (league.teams.length < 2) {
      return NextResponse.json({
        error: "At least two teams are required to create a draft.",
      }, { status: 400 });
    }

    const rosterSettings = (league.rosterSettings as Record<string, number>) || DEFAULT_ROSTER_SETTINGS;
    const settings = {
      forward: rosterSettings.forward ?? DEFAULT_ROSTER_SETTINGS.forward,
      defense: rosterSettings.defense ?? DEFAULT_ROSTER_SETTINGS.defense,
      goalie: rosterSettings.goalie ?? DEFAULT_ROSTER_SETTINGS.goalie,
      util: rosterSettings.util ?? DEFAULT_ROSTER_SETTINGS.util,
      bench: rosterSettings.bench ?? DEFAULT_ROSTER_SETTINGS.bench,
    };

    const rounds = rostersToRounds(settings);

    const orderedTeams = [...league.teams].sort((a, b) => {
      if (a.draftOrder != null && b.draftOrder != null) return a.draftOrder - b.draftOrder;
      if (a.draftOrder != null) return -1;
      if (b.draftOrder != null) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const updates = orderedTeams
      .map((team, index) => ({
        id: team.id,
        draftOrder: team.draftOrder ?? index + 1,
      }))
      .filter((team) => team.draftOrder !== league.teams.find((t) => t.id === team.id)?.draftOrder);

    await Promise.all(
      updates.map((team) =>
        prisma.fantasyTeam.update({
          where: { id: team.id },
          data: { draftOrder: team.draftOrder },
        })
      )
    );

    const orderedIds = orderedTeams.map((team) => team.id);
    const pickOrder = generateSnakeOrder(orderedIds, rounds);

    const draft = await prisma.draft.create({
      data: {
        leagueId,
        status: "PENDING",
        pickTimerSecs: 90,
        currentPick: 1,
      },
    });

    await prisma.draftPick.createMany({
      data: pickOrder.map((slot) => ({
        draftId: draft.id,
        overall: slot.overall,
        round: slot.round,
        fantasyTeamId: slot.fantasyTeamId,
      })),
    });

    return NextResponse.json({
      message: "Draft created successfully.",
      draftId: draft.id,
      rounds,
      picks: pickOrder.length,
      teams: orderedTeams.map((team, index) => ({
        id: team.id,
        name: team.name,
        draftOrder: team.draftOrder ?? index + 1,
      })),
    });
  } catch (error) {
    console.error("Error creating draft:", error);
    return NextResponse.json({ error: "Failed to create draft." }, { status: 500 });
  }
}
