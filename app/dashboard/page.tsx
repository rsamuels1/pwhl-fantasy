import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");

  // Find teams the user owns directly, OR teams in leagues they commission
  // (commissioner always has a team in their own league in dev seeds).
  const [ownedTeams, commissionedLeagues] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where: { ownerId: user.id },
      include: {
        league: true,
        roster: { include: { player: { include: { team: { select: { abbreviation: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fantasyLeague.findMany({
      where: { commissionerId: user.id },
      select: { id: true },
    }),
  ]);

  // Pull in any teams from commissioned leagues not already in ownedTeams.
  const ownedTeamLeagueIds = new Set(ownedTeams.map((t) => t.leagueId));
  const extraLeagueIds = commissionedLeagues
    .map((l) => l.id)
    .filter((id) => !ownedTeamLeagueIds.has(id));

  const extraTeams = extraLeagueIds.length > 0
    ? await prisma.fantasyTeam.findMany({
        where: { leagueId: { in: extraLeagueIds } },
        include: {
          league: true,
          roster: { include: { player: { include: { team: { select: { abbreviation: true } } } } } },
        },
        orderBy: { draftOrder: "asc" },
        take: 1, // just show the first team per extra league
      })
    : [];

  const teams = [...ownedTeams, ...extraTeams];

  const teamIds = teams.map((team) => team.id);
  const upcomingMatchups = await prisma.matchup.findMany({
    where: {
      OR: [
        { homeTeamId: { in: teamIds } },
        { awayTeamId: { in: teamIds } },
      ],
      homeScore: null,
    },
    include: { homeTeam: true, awayTeam: true, league: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <main>
      <section className="page-width">
        <header style={{ display: "grid", gap: 12, marginTop: 16, marginBottom: 24 }}>
          <p className="hero-eyebrow">Dashboard</p>
          <h1 style={{ margin: 0 }}>{user.displayName}, welcome back.</h1>
          <p className="hero-text">Manage your leagues, teams, and simulation workflows from a single fantasy hub.</p>
        </header>

        <section className="dashboard-panel">
          <div>
            <div className="panel-headline">Quick actions</div>
            <div className="form-actions">
              <Link href="/create-league" className="button-primary">Create league</Link>
              <Link href="/join-league" className="button-secondary">Join league</Link>
              <Link href="/leagues" className="button-secondary">Browse leagues</Link>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-headline">Your teams</div>
          {teams.length === 0 ? (
            <p className="panel-text">You don’t have a team yet. Join a league or create one to get started.</p>
          ) : (
            <div className="grid-2" style={{ gap: 16, marginTop: 16 }}>
              {teams.map((team) => {
                const upcoming = upcomingMatchups.find(
                  (matchup) => matchup.homeTeamId === team.id || matchup.awayTeamId === team.id
                );

                return (
                  <div key={team.id} className="team-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{team.name}</h3>
                        <p className="team-meta">{team.league.name} · Season {team.league.season}</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <Link href={`/team/${team.id}/matchup`} className="button-primary">My Matchup</Link>
                        <Link href={`/team/${team.id}/lineup`} className="button-secondary">Set Lineup</Link>
                        <Link href={`/league/${team.leagueId}`} className="button-secondary">League</Link>
                      </div>
                    </div>

                    <p className="panel-text">
                      {team.roster.length} players · Draft order: {team.draftOrder ?? "Unassigned"}
                    </p>

                    {team.roster.length > 0 && (
                      <p className="panel-text" style={{ fontSize: "0.95rem" }}>
                        {team.roster.slice(0, 5).map((entry) => `${entry.player.firstName} ${entry.player.lastName}`).join(", ")}
                        {team.roster.length > 5 ? ` +${team.roster.length - 5} more` : ""}
                      </p>
                    )}

                    {upcoming ? (
                      <div className="matchup-chip">
                        {upcoming.homeTeam.name} vs {upcoming.awayTeam.name} · Week {upcoming.week}
                      </div>
                    ) : (
                      <p className="panel-text">No upcoming matchup scheduled yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="panel-headline">Leagues you commission</div>
          <CommissionedLeagues userId={user.id} />
        </section>
      </section>
    </main>
  );
}

async function CommissionedLeagues({ userId }: { userId: string }) {
  const leagues = await prisma.fantasyLeague.findMany({
    where: { commissionerId: userId },
    orderBy: { updatedAt: "desc" },
  });

  if (leagues.length === 0) {
    return <p className="panel-text">You are not a commissioner of any leagues yet.</p>;
  }

  return (
    <div className="grid-2" style={{ gap: 16, marginTop: 16 }}>
      {leagues.map((league) => (
        <div key={league.id} className="team-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>{league.name}</h3>
              <p className="team-meta">Season {league.season} · {league.status.replace("_", " ")}</p>
            </div>
            <Link href={`/league/${league.id}`} className="button-secondary">Open league</Link>
          </div>
          <p className="panel-text">Playoff: {league.playoffStatus.replace("_", " ")}</p>
          <p className="panel-text">Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(league.updatedAt))}</p>
        </div>
      ))}
    </div>
  );
}
