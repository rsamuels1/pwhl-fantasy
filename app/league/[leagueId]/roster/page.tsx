import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ team?: string }>;
}

function formatPlayer(player: {
  firstName: string; lastName: string; position: string;
  jersey: number | null; team: { abbreviation: string } | null;
}) {
  const jersey = player.jersey ? ` #${player.jersey}` : "";
  const team = player.team?.abbreviation ? ` · ${player.team.abbreviation}` : "";
  return `${player.firstName} ${player.lastName}${jersey}${team}`;
}

export default async function RosterPage({ params, searchParams }: Props) {
  const { leagueId } = await params;
  const { team: teamIdParam } = await searchParams;

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
        orderBy: { slot: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  if (!teams.length) notFound();

  // Default to first team if none specified.
  const activeTeamId = teamIdParam ?? teams[0].id;
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>Rosters</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          Review every fantasy team roster and their lineup composition.
        </p>

        {/* Team tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {teams.map((t) => {
            const isActive = t.id === activeTeam.id;
            return (
              <a
                key={t.id}
                href={`/league/${leagueId}/roster?team=${t.id}`}
                style={{
                  padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                  textDecoration: "none",
                  background: isActive ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                  color: isActive ? "#a5b4fc" : "#94a3b8",
                  border: `1px solid ${isActive ? "rgba(99,102,241,0.4)" : "rgba(148,163,184,0.1)"}`,
                  transition: "background 0.1s",
                }}
              >
                {t.name}
              </a>
            );
          })}
        </div>

        {/* Active team card */}
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12, marginBottom: 14,
          }}>
            <div>
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>{activeTeam.name}</h2>
              <p style={{ color: "#94a3b8", fontSize: 13 }}>Owner: {activeTeam.owner.displayName}</p>
            </div>
            <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{activeTeam.roster.length} players</span>
          </div>

          {activeTeam.roster.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No roster entries yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {activeTeam.roster.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 14,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{formatPlayer(entry.player)}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13 }}>{entry.slot}</div>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>
                    {new Date(entry.acquired).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
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
