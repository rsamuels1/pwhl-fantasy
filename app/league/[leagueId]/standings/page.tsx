import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/playoffs/seeding";
import { requireAuth, requireLeagueMember } from "@/lib/auth";

function formatPoints(value: number) {
  return value.toFixed(1);
}

export default async function StandingsPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await requireAuth(`/league/${leagueId}/standings`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: { teams: true },
  });

  if (!league) {
    notFound();
  }

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    include: { homeTeam: true, awayTeam: true },
  });

  const standings = computeStandings(league.teams, matchups);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 20, padding: 20 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Standings</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          Current regular-season standings for {league.name}, sorted by points, wins, and points scored.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Points</th>
                <th style={thStyle}>W</th>
                <th style={thStyle}>L</th>
                <th style={thStyle}>T</th>
                <th style={thStyle}>PF</th>
                <th style={thStyle}>PA</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing, index) => (
                <tr key={standing.fantasyTeamId} style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>{standing.teamName}</td>
                  <td style={tdStyle}>{formatPoints(standing.points)}</td>
                  <td style={tdStyle}>{standing.wins}</td>
                  <td style={tdStyle}>{standing.losses}</td>
                  <td style={tdStyle}>{standing.ties}</td>
                  <td style={tdStyle}>{standing.pointsFor}</td>
                  <td style={tdStyle}>{standing.pointsAgainst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: 13,
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "14px 10px",
  fontSize: 14,
  color: "#e2e8f0",
};
