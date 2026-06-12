import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getMatchupQuickSummary, getTeamTopPerformers, type MatchupQuickSummary } from "@/lib/services/matchup-summary";
import Link from "next/link";

function MatchupHero({ summary, teamName }: { summary: MatchupQuickSummary; teamName: string }) {
  const isActive   = summary.status === "active";
  const isComplete = summary.status === "complete";
  const hasScores  = summary.myScore > 0;
  const opponents  = summary.teamsCount - 1; // how many teams you play each week

  const label = isActive ? "Active" : isComplete ? "Final" : "Upcoming";
  const accentColor = isActive ? "#6366f1" : "#475569";

  // Win rate as a fraction of opponents (0–1)
  const winRate = opponents > 0 ? summary.wins / opponents : 0;
  const recordLabel = `${summary.wins}–${summary.losses}${summary.ties > 0 ? `–${summary.ties}` : ""}`;
  const isWinningRecord = summary.wins > summary.losses;

  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: isActive ? "rgba(99,102,241,0.09)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${isActive ? "rgba(99,102,241,0.25)" : "rgba(148,163,184,0.1)"}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, color: accentColor }}>
        Week {summary.week} · {label}
      </div>

      {(isActive || isComplete) && hasScores ? (
        <>
          {/* Score + record row */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Your score</div>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: "#e2e8f0" }}>
                {summary.myScore.toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>vs field</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                <span style={{ color: isWinningRecord ? "#34d399" : summary.losses > summary.wins ? "#f87171" : "#94a3b8" }}>
                  {recordLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Win rate bar */}
          <div>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>
              {isComplete ? "Final record" : "Current record"} · {summary.wins} of {opponents} opponents outscored
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.round(winRate * 100)}%`,
                borderRadius: 3,
                background: isWinningRecord
                  ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                  : "linear-gradient(90deg, #6366f1, #818cf8)",
              }} />
            </div>
          </div>
        </>
      ) : (
        /* Upcoming — no scores yet */
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{teamName}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            vs all {opponents} teams · Week {summary.week}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");

  const devNow = await getDevNow();
  const nowMs = devNow;

  const ownedTeams = await prisma.fantasyTeam.findMany({
    where: { ownerId: user.id },
    include: { league: { include: { draft: { select: { status: true, completedAt: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  // Surface a team for the commissioner even if they don't directly own one
  const ownedLeagueIds = new Set(ownedTeams.map((t) => t.leagueId));
  const commissionedLeagues = await prisma.fantasyLeague.findMany({
    where: { commissionerId: user.id, id: { notIn: [...ownedLeagueIds] } },
    select: { id: true },
  });
  const extraTeams = commissionedLeagues.length > 0
    ? await prisma.fantasyTeam.findMany({
        where: { leagueId: { in: commissionedLeagues.map((l) => l.id) } },
        include: { league: { include: { draft: { select: { status: true, completedAt: true } } } } },
        orderBy: { draftOrder: "asc" },
        take: 1,
      })
    : [];

  const teams = [...ownedTeams, ...extraTeams];
  const hasTeams = teams.length > 0;

  const teamNowMs = (team: (typeof teams)[number]) =>
    getReplayNow({ isReplay: team.league.isReplay, replayCurrentDate: team.league.replayCurrentDate }, devNow);

  const [summaries, topPerformersList] = await Promise.all([
    Promise.all(teams.map((team) => getMatchupQuickSummary(team.id, team.leagueId, teamNowMs(team), prisma))),
    Promise.all(teams.map((team) => getTeamTopPerformers(team.id, team.leagueId, teamNowMs(team), prisma))),
  ]);

  const hour = new Date(nowMs).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Derive action items across all teams
  const actions: { label: string; href: string; teamName: string }[] = [];
  teams.forEach((team, i) => {
    const summary = summaries[i];
    const league = team.league;
    const tNowMs = teamNowMs(team);

    // Draft live right now — highest priority
    if (league.draft?.status === "IN_PROGRESS") {
      actions.push({
        label: "🎯 Draft is live right now!",
        href: `/draft/${team.leagueId}?team=${team.id}`,
        teamName: team.name,
      });
    }

    // Draft upcoming within 7 days
    if (league.status === "PRE_DRAFT" && league.draftStartsAt) {
      const daysUntil = Math.ceil(
        (new Date(league.draftStartsAt).getTime() - tNowMs) / 86_400_000
      );
      if (daysUntil >= 0 && daysUntil <= 7) {
        actions.push({
          label: daysUntil === 0 ? "Draft is today!" : `Draft in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
          href: `/league/${team.leagueId}/admin`,
          teamName: league.name,
        });
      }
    }

    // Draft complete but season hasn't started — set lineup before opener
    if (
      league.draft?.status === "COMPLETE" &&
      league.status !== "IN_SEASON" &&
      league.status !== "COMPLETE"
    ) {
      actions.push({
        label: "Draft complete — set your lineup before the season starts",
        href: `/team/${team.id}/lineup`,
        teamName: team.name,
      });
    }

    // New week just started (within 48 h of period start) — prompt to set lineup
    if (
      summary?.status === "active" &&
      tNowMs - summary.startsAt.getTime() < 48 * 3_600_000
    ) {
      actions.push({
        label: `Week ${summary.week} just started — set your lineup`,
        href: `/team/${team.id}/lineup`,
        teamName: team.name,
      });
    }

    // Tight week — your weekly field record is close (within one game)
    if (summary?.status === "active" && summary.myScore > 0 && Math.abs(summary.wins - summary.losses) <= 1) {
      actions.push({
        label: `⚡ Tight week — you're ${summary.wins}–${summary.losses}${summary.ties > 0 ? `–${summary.ties}` : ""} vs the field`,
        href: `/team/${team.id}/matchup`,
        teamName: team.name,
      });
    }

    // Upcoming matchup starting within 24 h
    if (summary?.status === "upcoming") {
      const hoursUntil = (summary.startsAt.getTime() - tNowMs) / 3_600_000;
      if (hoursUntil >= 0 && hoursUntil <= 24) {
        actions.push({
          label: `Week ${summary.week} starts soon — prep your lineup`,
          href: `/team/${team.id}/lineup`,
          teamName: team.name,
        });
      }
    }
  });

  return (
    <main>
      <section className="page-width" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 48 }}>

        {/* ── Header ── */}
        <header style={{ marginTop: 16 }}>
          {hasTeams ? (
            <>
              <p className="hero-eyebrow">My Leagues</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", margin: "8px 0 0" }}>
                <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
                  {greeting}, {user.displayName}.
                </h1>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Link href="/create-league" className="button-primary">+ New League</Link>
                  <Link href="/join-league" className="button-secondary">Join League</Link>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="hero-eyebrow">PWHL Fantasy</p>
              <h1 style={{ margin: "8px 0 0" }}>Welcome, {user.displayName}.</h1>
              <p className="hero-text" style={{ marginTop: 8 }}>Join a league or create one to get started.</p>
              <div className="hero-actions" style={{ marginTop: 20 }}>
                <Link href="/create-league" className="button-primary">Create league</Link>
                <Link href="/join-league" className="button-secondary">Join league</Link>
                <Link href="/leagues" className="button-secondary">Browse leagues</Link>
              </div>
            </>
          )}
        </header>

        {/* ── Action items ── */}
        {actions.length > 0 && (
          <section style={{
            padding: "12px 16px", borderRadius: 12,
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.2)",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Action needed
            </div>
            {actions.map((a, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "#f59e0b" }}>›</span>
                <Link href={a.href} style={{ fontSize: 13, color: "#e2e8f0", textDecoration: "none" }}>
                  {a.label}
                  <span style={{ color: "#64748b", marginLeft: 6 }}>({a.teamName})</span>
                </Link>
              </div>
            ))}
          </section>
        )}

        {/* ── Your teams ── */}
        {hasTeams && (
          <section>
            <div className="panel-headline" style={{ marginBottom: 14 }}>Your teams</div>
            <div className="grid-2" style={{ gap: 16 }}>
              {teams.map((team, i) => {
                const summary = summaries[i];
                const topPerformers = topPerformersList[i];
                return (
                  <div key={team.id} className="team-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{team.name}</h3>
                      <p className="team-meta" style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>{team.league.name} · Season {team.league.season}</span>
                        <LeagueStatusChip status={team.league.status} />
                      </p>
                    </div>

                    {summary ? (
                      <MatchupHero summary={summary} teamName={team.name} />
                    ) : (
                      <div style={{
                        padding: "12px 14px", borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(148,163,184,0.08)",
                        fontSize: 13, color: "#475569",
                      }}>
                        No matchup scheduled yet
                      </div>
                    )}

                    {topPerformers.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#f59e0b" }}>🔥</span>
                        {topPerformers.map((p, j) => (
                          <span key={j} style={{ fontSize: 12, color: "#94a3b8" }}>
                            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.name}</span>
                            {" "}
                            <span style={{ color: "#6366f1", fontWeight: 700 }}>{p.points} pts</span>
                            {j < topPerformers.length - 1 && <span style={{ color: "#334155", marginLeft: 10 }}>·</span>}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/team/${team.id}/matchup`} className="button-primary">
                        My Matchup →
                      </Link>
                      <Link href={`/team/${team.id}/lineup`} className="button-secondary">Set Lineup</Link>
                      <Link href={`/league/${team.leagueId}`} className="button-secondary">League</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}


      </section>
    </main>
  );
}

function LeagueStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    PRE_DRAFT:  { label: "Pre-draft",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    IN_SEASON:  { label: "In Season",  color: "#34d399", bg: "rgba(52,211,153,0.1)" },
    COMPLETE:   { label: "Complete",   color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  };
  const chip = map[status];
  if (!chip) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      color: chip.color, background: chip.bg,
      letterSpacing: "0.04em", textTransform: "uppercase",
    }}>
      {chip.label}
    </span>
  );
}
