import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/playoffs/seeding";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
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
  const user = await requireAuth(`/league/${leagueId}`);
  await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: true,
      draft: { select: { id: true, status: true, completedAt: true, startedAt: true } },
    },
  });

  if (!league) {
    notFound();
  }

  // Draft in progress: redirect to draft room
  if (league.draft?.status === "IN_PROGRESS") {
    const myTeam = league.teams.find((t) => t.ownerId === user?.id);
    if (myTeam) redirect(`/draft/${leagueId}?team=${myTeam.id}`);
  }

  const isCommissioner = user?.id === league.commissionerId;

  const firstPlayoffMatchup = await prisma.matchup.findFirst({
    where: { leagueId, isPlayoff: true },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>{league.name}</h1>
            <p style={{ color: "#94a3b8", maxWidth: 600 }}>
              Season {league.season} · {league.teams.length} teams · {league.status.replace("_", " ")}
              {isCommissioner && <span style={{ marginLeft: 8, color: "#6366f1" }}>· You're the commissioner</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <StatusPill
              label="Playoffs"
              value={firstPlayoffMatchup
                ? formatDate(new Date(firstPlayoffMatchup.startsAt))
                : league.playoffStatus === "NOT_STARTED" ? "Not started" : league.playoffStatus.replace("_", " ")}
              color={league.playoffStatus === "IN_PROGRESS" ? "#34d399" : league.playoffStatus === "COMPLETE" ? "#60a5fa" : "#64748b"}
            />
            <StatusPill
              label="Draft"
              value={
                league.draft?.status === "COMPLETE"
                  ? league.draft.completedAt
                    ? `Done ${formatDate(new Date(league.draft.completedAt))}`
                    : "Complete"
                  : league.draft?.status === "IN_PROGRESS"
                  ? "In progress"
                  : league.draftStartsAt
                  ? formatDate(new Date(league.draftStartsAt))
                  : "Not scheduled"
              }
              color={
                league.draft?.status === "COMPLETE" ? "#34d399"
                : league.draft?.status === "IN_PROGRESS" ? "#f59e0b"
                : "#64748b"
              }
            />
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
            <p className="panel-text">No teams yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 16 }}>
              {league.teams.map((team) => (
                <div key={team.id} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{team.name}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        {isCommissioner && (
          <div className="dashboard-panel">
            <div className="panel-headline">Commissioner</div>
            <p className="panel-text">Manage teams, draft, season, and playoff settings.</p>
            <Link
              href={`/league/${leagueId}/admin`}
              style={{
                display: "inline-block", marginTop: 12, padding: "10px 20px",
                background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: 10, color: "#a5b4fc", fontWeight: 600, textDecoration: "none",
              }}
            >
              Admin panel →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 2,
      padding: "8px 14px", borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid rgba(148,163,184,0.12)`,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>
        {value}
      </span>
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


