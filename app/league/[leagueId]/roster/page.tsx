import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

function formatPlayer(player: { firstName: string; lastName: string; position: string; jersey: number | null; team: { abbreviation: string } | null }) {
  const jersey = player.jersey ? ` #${player.jersey}` : "";
  const team = player.team?.abbreviation ? ` · ${player.team.abbreviation}` : "";
  return `${player.firstName} ${player.lastName}${jersey}${team}`;
}

export default async function RosterPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;

  const teams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    include: {
      owner: { select: { displayName: true } },
      roster: {
        include: {
          player: {
            include: { team: { select: { abbreviation: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (!teams.length) {
    notFound();
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>Roster</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          Review every fantasy team roster in your league and their lineup composition.
        </p>

        <div style={{ display: "grid", gap: 20 }}>
          {teams.map((team) => (
            <div key={team.id} style={{ ...panelStyle, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 18, marginBottom: 4 }}>{team.name}</h2>
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Owner: {team.owner.displayName}</p>
                </div>
                <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{team.roster.length} players</span>
              </div>

              {team.roster.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No roster entries yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {team.roster.map((entry) => (
                    <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 14 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{formatPlayer(entry.player)}</div>
                        <div style={{ color: "#94a3b8", fontSize: 13 }}>{entry.slot}</div>
                      </div>
                      <span style={{ color: "#94a3b8", fontSize: 13 }}>{new Date(entry.acquired).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
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
