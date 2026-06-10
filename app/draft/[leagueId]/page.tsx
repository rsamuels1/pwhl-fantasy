import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import DraftRoom from "./DraftRoom";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
}

export default async function DraftPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { team: teamId } = await searchParams;

  if (!teamId) {
    return (
      <main style={{ padding: "2rem" }}>
        <p style={{ color: "var(--red)" }}>
          Missing <code>?team=&lt;teamId&gt;</code> in the URL.
        </p>
      </main>
    );
  }

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      commissionerId: true,
      rosterSettings: true,
      teams: {
        select: { id: true, name: true, ownerId: true },
        orderBy: { draftOrder: "asc" },
      },
    },
  });

  if (!league) notFound();

  // Resolve which userId owns this team so the page knows if the viewer is commissioner
  const myTeam = league.teams.find((t) => t.id === teamId);
  if (!myTeam) notFound();

  const teamNames: Record<string, string> = Object.fromEntries(
    league.teams.map((t) => [t.id, t.name])
  );

  const rosterSettings = (league.rosterSettings ?? {}) as Record<string, number>;

  return (
    <DraftRoom
      leagueId={leagueId}
      teamId={teamId}
      teamNames={teamNames}
      isCommissioner={myTeam.ownerId === league.commissionerId}
      rosterSettings={rosterSettings}
    />
  );
}
