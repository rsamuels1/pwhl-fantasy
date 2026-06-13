import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { parseScoringSettings } from "@/lib/scoring/settings";

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

  const scoring = parseScoringSettings(league.scoringSettings);
  const roster = (league.rosterSettings ?? {}) as Record<string, number>;
  const ps = (league.playoffSettings ?? {}) as { teamsInPlayoff?: number; topSeedsWithBye?: number };
  const teamsInPlayoff = ps.teamsInPlayoff ?? 4;
  const topSeedsWithBye = ps.topSeedsWithBye ?? 0;

  const playoffFormatText = topSeedsWithBye > 0
    ? `${teamsInPlayoff}-team single-elimination, top ${topSeedsWithBye} seed${topSeedsWithBye === 1 ? "" : "s"} receive a bye`
    : `${teamsInPlayoff}-team single-elimination, no byes`;

  const rosterSlots: { label: string; key: string }[] = [
    { label: "Forwards", key: "forward" },
    { label: "Defense", key: "defense" },
    { label: "Goalie", key: "goalie" },
    { label: "UTIL", key: "util" },
    { label: "Bench", key: "bench" },
    { label: "IR", key: "ir" },
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={panelStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 10 }}>League settings</h1>
        <p style={{ color: "#94a3b8", marginBottom: 20 }}>
          Manage settings for draft mode, scoring rules, roster structure, and playoff behavior.
        </p>

        <div style={{ display: "grid", gap: 16 }}>

          {/* Basic */}
          <div style={settingCardStyle}>
            <h2 style={cardHeading}>Basic settings</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Row label="Season" value={league.season} />
              <Row label="Status" value={league.status.replace(/_/g, " ")} />
              <Row label="Draft type" value={league.draftType} />
              <Row label="Max teams" value={String(league.maxTeams)} />
            </div>
          </div>

          {/* Playoff format */}
          <div style={settingCardStyle}>
            <h2 style={cardHeading}>Playoff format</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Row label="Format" value={playoffFormatText} />
              <Row label="Teams qualifying" value={String(teamsInPlayoff)} />
              {topSeedsWithBye > 0 && (
                <Row label="First-round byes" value={String(topSeedsWithBye)} />
              )}
            </div>
          </div>

          {/* Scoring */}
          <div style={settingCardStyle}>
            <h2 style={cardHeading}>Scoring settings — Skaters</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Row label="Goal" value={`${scoring.skater.goal} pts`} />
              <Row label="Assist" value={`${scoring.skater.assist} pts`} />
              <Row label="Shot on goal" value={`${scoring.skater.shot} pts`} />
              <Row label="Power play point" value={`${scoring.skater.powerPlayPoint} pts`} />
              <Row label="+/-" value={`${scoring.skater.plusMinus} pts`} />
              <Row label="Hit" value={`${scoring.skater.hit} pts`} />
              <Row label="Block" value={`${scoring.skater.block} pts`} />
              <Row label="Penalty minute" value={`${scoring.skater.penaltyMinute} pts`} />
            </div>
          </div>

          <div style={settingCardStyle}>
            <h2 style={cardHeading}>Scoring settings — Goalies</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <Row label="Win" value={`${scoring.goalie.win} pts`} />
              <Row label="Save" value={`${scoring.goalie.save} pts`} />
              <Row label="Goal against" value={`${scoring.goalie.goalAgainst} pts`} />
              <Row label="Shutout" value={`${scoring.goalie.shutout} pts`} />
            </div>
          </div>

          {/* Roster */}
          <div style={settingCardStyle}>
            <h2 style={cardHeading}>Roster settings</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {rosterSlots
                .filter(({ key }) => (roster[key] ?? 0) > 0)
                .map(({ label, key }) => (
                  <Row key={key} label={label} value={`${roster[key]} slot${roster[key] === 1 ? "" : "s"}`} />
                ))}
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{value}</span>
    </div>
  );
}

const cardHeading: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#94a3b8",
  margin: "0 0 12px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

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
