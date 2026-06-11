import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner } from "@/lib/auth";

interface Props {
  params: Promise<{ teamId: string }>;
}

function formatPlayer(player: {
  firstName: string; lastName: string; position: string;
  jersey: number | null; team: { abbreviation: string } | null;
}) {
  const jersey = player.jersey ? ` #${player.jersey}` : "";
  const team = player.team?.abbreviation ? ` · ${player.team.abbreviation}` : "";
  return `${player.firstName} ${player.lastName}${jersey}${team}`;
}

export default async function TeamRosterPage({ params }: Props) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/roster`);
  await requireTeamOwner(teamId, user.id);

  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
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
  });

  if (!team) notFound();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>{team.name}</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          {team.roster.length} players · Owner: {team.owner.displayName}
        </p>

        {team.roster.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No roster entries yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {team.roster.map((entry) => (
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
