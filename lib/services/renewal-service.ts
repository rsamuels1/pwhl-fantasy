import type { PrismaClient } from "@prisma/client";

export class RenewalBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenewalBlockedError";
  }
}

export function bumpSeason(season: string): string {
  const match = season.match(/^(\d{4})-(\d{2})$/);
  if (!match) return season;
  const startYear = parseInt(match[1], 10);
  const endShort = parseInt(match[2], 10);
  const newStart = startYear + 1;
  const newEnd = (endShort + 1) % 100;
  return `${newStart}-${String(newEnd).padStart(2, "0")}`;
}

export async function renewLeague(
  leagueId: string,
  overrides: { name?: string; season?: string; draftStartsAt?: Date | null },
  prisma: PrismaClient
): Promise<{ newLeagueId: string }> {
  // Wrap in an interactive transaction so the playoff-status guard and the child-
  // league creation are atomic. Without this, two concurrent renewal requests could
  // both pass the guard and each create a child league before either commit lands.
  return prisma.$transaction(async (tx) => {
    const league = await tx.fantasyLeague.findUniqueOrThrow({
      where: { id: leagueId },
      include: { childLeagues: true },
    });

    if (league.playoffStatus !== "COMPLETE") {
      throw new RenewalBlockedError(
        "League must complete its playoffs before renewal."
      );
    }

    if (league.childLeagues.length > 0) {
      return { newLeagueId: league.childLeagues[0].id };
    }

    const newLeague = await tx.fantasyLeague.create({
      data: {
        name: overrides.name ?? league.name,
        season: overrides.season ?? bumpSeason(league.season),
        commissionerId: league.commissionerId,
        parentLeagueId: leagueId,
        status: "PRE_DRAFT",
        playoffStatus: "NOT_STARTED",
        draftType: league.draftType,
        maxTeams: league.maxTeams,
        scoringSettings: league.scoringSettings as object,
        rosterSettings: league.rosterSettings as object,
        playoffSettings: league.playoffSettings as object,
        scoringMode: league.scoringMode,
        rulesVersion: league.rulesVersion,
        scoringVersion: league.scoringVersion,
        draftStartsAt: overrides.draftStartsAt !== undefined
          ? overrides.draftStartsAt
          : null,
      },
    });

    return { newLeagueId: newLeague.id };
  });
}
