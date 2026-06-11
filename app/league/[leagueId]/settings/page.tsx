import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function SettingsPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await requireAuth(`/league/${leagueId}/settings`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
  });

  if (!league) {
    notFound();
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>League settings</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          Manage settings for draft mode, scoring rules, roster structure, and playoff behavior.
        </p>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={settingCardStyle}>
            <h2 style={{ marginBottom: 6 }}>Basic league settings</h2>
            <div style={{ display: "grid", gap: 8, color: "#e2e8f0" }}>
              <div>Season: {league.season}</div>
              <div>Status: {league.status.replace("_", " ")}</div>
              <div>Draft type: {league.draftType}</div>
              <div>Max teams: {league.maxTeams}</div>
            </div>
          </div>

          <div style={settingCardStyle}>
            <h2 style={{ marginBottom: 6 }}>Playoff settings</h2>
            <pre style={preStyle}>{prettyJson(league.playoffSettings)}</pre>
          </div>

          <div style={settingCardStyle}>
            <h2 style={{ marginBottom: 6 }}>Scoring settings</h2>
            <pre style={preStyle}>{prettyJson(league.scoringSettings)}</pre>
          </div>

          <div style={settingCardStyle}>
            <h2 style={{ marginBottom: 6 }}>Roster settings</h2>
            <pre style={preStyle}>{prettyJson(league.rosterSettings)}</pre>
          </div>
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

const settingCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  borderRadius: 18,
  padding: 18,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  overflowX: "auto",
  background: "rgba(15,23,42,0.9)",
  padding: 14,
  borderRadius: 14,
  color: "#e2e8f0",
  fontSize: 13,
  lineHeight: 1.6,
};
