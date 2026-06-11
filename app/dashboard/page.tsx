import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");

  const ownedTeams = await prisma.fantasyTeam.findMany({
    where: { ownerId: user.id },
    include: { league: true },
    orderBy: { createdAt: "desc" },
  });

  const ownedLeagueIds = new Set(ownedTeams.map((t) => t.leagueId));
  const commissionedLeagues = await prisma.fantasyLeague.findMany({
    where: { commissionerId: user.id, id: { notIn: [...ownedLeagueIds] } },
    select: { id: true },
  });
  const extraTeams = commissionedLeagues.length > 0
    ? await prisma.fantasyTeam.findMany({
        where: { leagueId: { in: commissionedLeagues.map((l) => l.id) } },
        include: { league: true },
        orderBy: { draftOrder: "asc" },
        take: 1,
      })
    : [];

  const teams = [...ownedTeams, ...extraTeams];
  const teamIds = teams.map((t) => t.id);
  const hasTeams = teams.length > 0;

  const [currentMatchups, recentMatchups] = teamIds.length > 0
    ? await Promise.all([
        // Active / upcoming (unscored)
        prisma.matchup.findMany({
          where: {
            OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
            homeScore: null,
            isPlayoff: false,
          },
          include: { homeTeam: true, awayTeam: true },
          orderBy: { week: "asc" },
        }),
        // Most recent scored matchup per team
        prisma.matchup.findMany({
          where: {
            OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }],
            homeScore: { not: null },
          },
          include: { homeTeam: true, awayTeam: true },
          orderBy: { week: "desc" },
          take: teamIds.length * 3,
        }),
      ])
    : [[], []];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main>
      <section className="page-width" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 48 }}>

        <header style={{ marginTop: 16 }}>
          {hasTeams ? (
            <>
              <p className="hero-eyebrow">Fantasy Home</p>
              <h1 style={{ margin: "8px 0 0", fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
                {greeting}, {user.displayName}.
              </h1>
            </>
          ) : (
            <>
              <p className="hero-eyebrow">PWHL Fantasy</p>
              <h1 style={{ margin: "8px 0 0" }}>Welcome, {user.displayName}.</h1>
              <p className="hero-text" style={{ marginTop: 8 }}>
                Join a league or create one to get started.
              </p>
              <div className="hero-actions" style={{ marginTop: 20 }}>
                <Link href="/create-league" className="button-primary">Create league</Link>
                <Link href="/join-league" className="button-secondary">Join league</Link>
                <Link href="/leagues" className="button-secondary">Browse leagues</Link>
              </div>
            </>
          )}
        </header>

        {hasTeams && (
          <section>
            <div className="panel-headline" style={{ marginBottom: 14 }}>Your teams</div>
            <div className="grid-2" style={{ gap: 16 }}>
              {teams.map((team) => {
                const matchup = currentMatchups.find(
                  (m) => m.homeTeamId === team.id || m.awayTeamId === team.id
                );
                const lastResult = recentMatchups.find(
                  (m) => m.homeTeamId === team.id || m.awayTeamId === team.id
                );

                const opponent = matchup
                  ? (matchup.homeTeamId === team.id ? matchup.awayTeam.name : matchup.homeTeam.name)
                  : null;

                // Last result: determine W/L and scores from team's perspective
                let lastResultDisplay: { outcome: "W" | "L" | "T"; myScore: number; oppScore: number; oppName: string } | null = null;
                if (lastResult && lastResult.homeScore !== null && lastResult.awayScore !== null) {
                  const myScore = lastResult.homeTeamId === team.id ? lastResult.homeScore : lastResult.awayScore;
                  const oppScore = lastResult.homeTeamId === team.id ? lastResult.awayScore : lastResult.homeScore;
                  const oppName = lastResult.homeTeamId === team.id ? lastResult.awayTeam.name : lastResult.homeTeam.name;
                  lastResultDisplay = {
                    outcome: myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T",
                    myScore, oppScore, oppName,
                  };
                }

                const outcomeColor = {
                  W: "#34d399", L: "#f87171", T: "#94a3b8",
                } as const;

                return (
                  <div key={team.id} className="team-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Team identity */}
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{team.name}</h3>
                      <p className="team-meta" style={{ marginTop: 2 }}>{team.league.name} · Season {team.league.season}</p>
                    </div>

                    {/* Current matchup hero */}
                    {matchup ? (
                      <div style={{
                        padding: "12px 16px", borderRadius: 12,
                        background: "rgba(99,102,241,0.07)",
                        border: "1px solid rgba(99,102,241,0.2)",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                          Week {matchup.week} · Upcoming
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{team.name}</span>
                          <span style={{ fontSize: 12, color: "#475569", padding: "2px 10px" }}>vs</span>
                          <span style={{ fontSize: 14, color: "#94a3b8" }}>{opponent}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: "12px 16px", borderRadius: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148,163,184,0.08)",
                        fontSize: 13, color: "#475569",
                      }}>
                        No matchup scheduled
                      </div>
                    )}

                    {/* Last result */}
                    {lastResultDisplay && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
                        <span style={{
                          fontWeight: 800, fontSize: 11,
                          padding: "2px 6px", borderRadius: 4,
                          color: outcomeColor[lastResultDisplay.outcome],
                          background: `${outcomeColor[lastResultDisplay.outcome]}18`,
                        }}>
                          {lastResultDisplay.outcome}
                        </span>
                        <span>
                          {lastResultDisplay.myScore.toFixed(1)}–{lastResultDisplay.oppScore.toFixed(1)} vs {lastResultDisplay.oppName}
                        </span>
                      </div>
                    )}

                    {/* CTAs */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/team/${team.id}/lineup`} className="button-primary">
                        Set Lineup →
                      </Link>
                      <Link href={`/team/${team.id}/matchup`} className="button-secondary">
                        Matchup
                      </Link>
                      <Link href={`/league/${team.leagueId}`} className="button-secondary">League</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {hasTeams && (
          <p style={{ fontSize: 13, color: "#475569", marginTop: 8 }}>
            <Link href="/create-league" style={{ color: "#64748b", textDecoration: "underline" }}>
              + Create another league
            </Link>
            {" · "}
            <Link href="/join-league" style={{ color: "#64748b", textDecoration: "underline" }}>
              Join a league
            </Link>
          </p>
        )}

      </section>
    </main>
  );
}
