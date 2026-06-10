import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/playoffs/seeding";
import { getCurrentUser } from "@/lib/auth";
import LeagueSimulationControls from "@/components/LeagueSimulationControls";
import AddTeamForm from "@/components/AddTeamForm";
import SetupDraftButton from "@/components/SetupDraftButton";
import Link from "next/link";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export default async function LeagueOverviewPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await getCurrentUser();

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: { select: { id: true, name: true } },
      draft: { select: { id: true, status: true } },
    },
  });

  if (!league) {
    notFound();
  }

  const isCommissioner = user?.id === league.commissionerId;

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    orderBy: [{ week: "asc" }, { startsAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  const standings = computeStandings(league.teams, matchups);
  const nextMatchup = matchups.find((m) => m.homeScore === null || m.awayScore === null);
  const recentResults = matchups
    .filter((m) => m.homeScore !== null && m.awayScore !== null)
    .slice(-3)
    .reverse();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>{league.name}</h1>
            <p style={{ color: "#94a3b8", maxWidth: 760 }}>
              Season {league.season} · {league.teams.length} teams · {league.status.replace("_", " ")}
              {isCommissioner && <span style={{ marginLeft: 8, color: "#6366f1" }}>· You're the commissioner</span>}
            </p>
          </div>
          <div style={{ display: "grid", gap: 10, width: "min(100%, 480px)" }}>
            <div style={cardStyle}>
              <strong>Playoff status</strong>
              <p>{league.playoffStatus.replace("_", " ")}</p>
            </div>
            <div style={cardStyle}>
              <strong>Draft window</strong>
              <p>{league.draftStartsAt ? formatDate(new Date(league.draftStartsAt)) : "Not scheduled"}</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div style={cardStyle}>
            <h2 style={{ marginBottom: 10 }}>Top standings</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {standings.slice(0, 4).map((team, index) => (
                <div key={team.fantasyTeamId} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{index + 1}. {team.teamName}</span>
                  <span style={{ color: "#94a3b8" }}>{team.points.toFixed(1)} pts</span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginBottom: 10 }}>Next matchup</h2>
            {nextMatchup ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{nextMatchup.homeTeam.name} vs {nextMatchup.awayTeam.name}</div>
                <div style={{ color: "#94a3b8" }}>Week {nextMatchup.week} · {formatDate(new Date(nextMatchup.startsAt))}</div>
              </div>
            ) : (
              <p style={{ color: "#94a3b8" }}>No upcoming matchup available yet.</p>
            )}
            <LeagueSimulationControls leagueId={league.id} />
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginBottom: 10 }}>Recent results</h2>
            {recentResults.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {recentResults.map((matchup) => (
                  <div key={matchup.id} style={{ display: "grid", gap: 4 }}>
                    <span>{matchup.homeTeam.name} {matchup.homeScore} — {matchup.awayScore} {matchup.awayTeam.name}</span>
                    <span style={{ color: "#94a3b8" }}>Wk {matchup.week}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#94a3b8" }}>No results available yet.</p>
            )}
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginBottom: 12 }}>League summary</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <StatTile label="Teams" value={league.teams.length.toString()} />
          <StatTile label="Playoff" value={league.playoffStatus.replace("_", " ")} />
          <StatTile label="Draft type" value={league.draftType} />
          <StatTile label="Max teams" value={league.maxTeams.toString()} />
        </div>
      </section>

      <section style={{ display: "grid", gap: 18 }}>
        <div className="dashboard-panel">
          <div className="panel-headline">Teams in this league</div>
          {league.teams.length === 0 ? (
            <p className="panel-text">No teams yet. Add your first team to get started!</p>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 16 }}>
              {league.teams.map((team) => (
                <div key={team.id} style={{ ...cardStyle, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: 4 }}>{team.name}</h3>
                    <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>ID: {team.id}</p>
                  </div>
                  {league.draft && (
                    <Link href={`/draft/${leagueId}?team=${team.id}`} className="button-secondary">
                      Draft as {team.name.split(" ")[0]}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isCommissioner && (
          <>
            <AddTeamForm leagueId={leagueId} />

            {!league.draft && league.teams.length >= 2 && (
              <div className="dashboard-panel">
                <div className="panel-headline">Start draft</div>
                <p className="panel-text">Ready to begin drafting? Set up the draft board and start making picks.</p>
                <SetupDraftButton leagueId={leagueId} />
              </div>
            )}

            {league.draft && (
              <div className="dashboard-panel">
                <div className="panel-headline">Draft status</div>
                <p className="panel-text">Draft {league.draft.status.toLowerCase()}. Pick any team to draft as them.</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 16 }}>
      <p style={{ marginBottom: 8, color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};


