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
  const myTeam = await requireLeagueMember(leagueId, user.id);

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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Team</th>
                <th style={thStyle}>Points</th>
                <th style={thStyle}>W</th>
                <th style={thStyle}>L</th>
                <th style={thStyle}>T</th>
                <th style={thStyle} className="standings-hide-mobile">PF</th>
                <th style={thStyle} className="standings-hide-mobile">PA</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing, index) => {
                const isMe = standing.fantasyTeamId === myTeam.id;
                return (
                <tr key={standing.fantasyTeamId} style={{
                  background: isMe ? "rgba(99,102,241,0.08)" : "transparent",
                  borderBottom: "1px solid rgba(148,163,184,0.08)",
                }}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: isMe ? 700 : undefined, color: isMe ? "#a5b4fc" : "#e2e8f0" }}>
                    {standing.teamName}
                    {isMe && <span style={{ marginLeft: 8, fontSize: 11, color: "#6366f1" }}>You</span>}
                  </td>
                  <td style={tdStyle}>{formatPoints(standing.points)}</td>
                  <td style={tdStyle}>{standing.wins}</td>
                  <td style={tdStyle}>{standing.losses}</td>
                  <td style={tdStyle}>{standing.ties}</td>
                  <td style={tdStyle} className="standings-hide-mobile">{standing.pointsFor}</td>
                  <td style={tdStyle} className="standings-hide-mobile">{standing.pointsAgainst}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontSize: 13,
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 14,
  color: "#e2e8f0",
};
