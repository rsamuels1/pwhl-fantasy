import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { SettingsEditor } from "./SettingsEditor";

export default async function SettingsPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await requireAuth(`/league/${leagueId}/settings`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      draft: { select: { status: true } },
      teams: { select: { id: true } },
    },
  });

  if (!league) notFound();

  const scoring = parseScoringSettings(league.scoringSettings);
  const rawRoster = (league.rosterSettings ?? {}) as Record<string, number>;
  const rawPlayoff = (league.playoffSettings ?? {}) as {
    teamsInPlayoff?: number;
    topSeedsWithBye?: number;
    roundDurationPeriods?: number;
    higherSeedWinsTies?: boolean;
  };

  const initialRoster = {
    forward: rawRoster.forward ?? 3,
    defense: rawRoster.defense ?? 2,
    goalie: rawRoster.goalie ?? 1,
    util: rawRoster.util ?? 1,
    bench: rawRoster.bench ?? 6,
    ir: rawRoster.ir ?? 0,
  };

  const initialPlayoff = {
    teamsInPlayoff: rawPlayoff.teamsInPlayoff ?? 4,
    topSeedsWithBye: rawPlayoff.topSeedsWithBye ?? 0,
    roundDurationPeriods: rawPlayoff.roundDurationPeriods ?? 1,
    higherSeedWinsTies: rawPlayoff.higherSeedWinsTies ?? true,
  };

  return (
    <SettingsEditor
      leagueId={leagueId}
      leagueName={league.name}
      season={league.season}
      status={league.status}
      draftType={league.draftType}
      maxTeams={league.maxTeams}
      teamCount={league.teams.length}
      isCommissioner={user.id === league.commissionerId}
      isDraftComplete={league.draft?.status === "COMPLETE"}
      isPlayoffStarted={league.playoffStatus !== "NOT_STARTED"}
      initialScoring={scoring}
      initialRoster={initialRoster}
      initialPlayoff={initialPlayoff}
    />
  );
}
