import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const leagueId = params.leagueId;

    const teams = await prisma.fantasyTeam.findMany({
      where: { leagueId },
      include: {
        owner: { select: { displayName: true } },
        roster: {
          include: {
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                position: true,
                jersey: true,
                team: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      leagueId,
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        owner: team.owner.displayName,
        roster: team.roster.map((entry) => ({
          id: entry.id,
          slot: entry.slot,
          acquired: entry.acquired,
          player: {
            id: entry.player.id,
            name: `${entry.player.firstName} ${entry.player.lastName}`,
            position: entry.player.position,
            jersey: entry.player.jersey,
            team: entry.player.team?.abbreviation ?? null,
          },
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching roster:", error);
    return NextResponse.json(
      { error: "Failed to fetch roster" },
      { status: 500 }
    );
  }
}
