import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import DraftSetupClient from "./DraftSetupClient";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
}

export default async function LeagueDraftPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await requireAuth(`/league/${leagueId}/draft`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: { orderBy: { draftOrder: "asc" } },
      draft: true,
    },
  });

  if (!league) notFound();

  const draftPicks = league.draft
    ? await prisma.draftPick.count({ where: { draftId: league.draft.id, playerId: { not: null } } })
    : 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 26, marginBottom: 10 }}>Draft setup</h1>
        <p style={{ color: "var(--dim)", marginBottom: 20 }}>
          Prepare and launch the league draft for {league.name}. Use the draft server for live selection and ask managers to join using their team IDs.
        </p>

        {league.draft ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={summaryStyle}>
              <div>
                <strong>Status</strong>
                <p>{league.draft.status.replace("_", " ")}</p>
              </div>
              <div>
                <strong>Timer</strong>
                <p>{league.draft.pickTimerSecs}s per pick</p>
              </div>
              <div>
                <strong>Progress</strong>
                <p>{draftPicks} / {league.teams.length * Object.values(league.rosterSettings as Record<string, number>).reduce((sum, slot) => sum + slot, 0)} picks</p>
              </div>
            </div>

            <div style={panelStyle}>
              <h2 style={{ margin: "0 0 12px" }}>Team join links</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {league.teams.map((team) => (
                  <div key={team.id} style={teamRowStyle}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{team.name}</p>
                      <p style={{ margin: 0, color: "var(--dim)", fontSize: 13 }}>Team ID: {team.id}</p>
                    </div>
                    <a
                      href={`/draft/${leagueId}?team=${team.id}`}
                      style={joinLinkStyle}
                    >
                      Join draft
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div style={infoStyle}>
              <p>To run the draft, start the local Draft WebSocket server with:</p>
              <pre style={codeStyle}>npm run draft-server</pre>
              <p>Then each manager should open their join link above and the commissioner should press Start in the draft room.</p>
            </div>
          </div>
        ) : (
          <DraftSetupClient leagueId={leagueId} teams={league.teams} />
        )}
      </section>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 20,
};

const summaryStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const teamRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  background: "var(--bg-raised)",
};

const joinLinkStyle: React.CSSProperties = {
  color: "var(--accent-ink)",
  background: "var(--accent)",
  padding: "10px 14px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 700,
};

const infoStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  borderRadius: 16,
  padding: 18,
  color: "var(--text)",
  lineHeight: 1.7,
};

const codeStyle: React.CSSProperties = {
  marginTop: 12,
  background: "rgba(15,23,42,0.95)",
  padding: "12px 14px",
  borderRadius: 14,
  overflowX: "auto",
};
