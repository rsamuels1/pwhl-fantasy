import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export default async function MatchupsPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;

  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    orderBy: [{ week: "asc" }, { startsAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  const regularMatchups = matchups.filter((matchup) => !matchup.isPlayoff);
  const playoffMatchups = matchups.filter((matchup) => matchup.isPlayoff);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>Matchups</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          Review the regular season schedule and results for {league.name}.
        </p>

        {regularMatchups.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No regular season matchups are available yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {regularMatchups.map((matchup) => (
              <div key={matchup.id} style={matchupCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{matchup.homeTeam.name} vs {matchup.awayTeam.name}</p>
                    <p style={{ color: "#94a3b8", marginTop: 4 }}>Week {matchup.week} · {formatDate(new Date(matchup.startsAt))}</p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    {matchup.homeScore === null || matchup.awayScore === null ? (
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>Upcoming</span>
                    ) : (
                      <span style={{ fontWeight: 700 }}>{matchup.homeScore} – {matchup.awayScore}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Playoff matchups</h2>
        {playoffMatchups.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>Playoff matchups are not created yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {playoffMatchups.map((matchup) => (
              <div key={matchup.id} style={matchupCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{matchup.homeTeam.name} vs {matchup.awayTeam.name}</p>
                    <p style={{ color: "#94a3b8", marginTop: 4 }}>Round {matchup.round} · Week {matchup.week}</p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    {matchup.homeScore === null || matchup.awayScore === null ? (
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>Pending</span>
                    ) : (
                      <span style={{ fontWeight: 700 }}>{matchup.homeScore} – {matchup.awayScore}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};

const matchupCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 18,
  padding: 18,
};
