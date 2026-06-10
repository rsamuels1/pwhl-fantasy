import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const leagues = await prisma.fantasyLeague.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        season: true,
        status: true,
        playoffStatus: true,
        maxTeams: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ leagues });
  } catch (error) {
    console.error("Error listing leagues:", error);
    return NextResponse.json({ error: "Failed to fetch leagues" }, { status: 500 });
  }
}
