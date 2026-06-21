import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { getMatchupQuickSummary, getTeamTopPerformers, type MatchupQuickSummary } from "@/lib/services/matchup-summary";
import Link from "next/link";
import WelcomeFlow from "@/components/WelcomeFlow";
import { checkAndEmitScheduledNotifications } from "@/lib/services/notification-service";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

// Two-letter crest from a team name: first letters of first two words,
// or the first two characters of a single-word name.
function teamCrest(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const raw = parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
  return raw.toUpperCase();
}

const RECORD_COLOR = { win: "#5fa98c", loss: "#d18b7f", neutral: "#c7d2e0" } as const;
const BAR_COLOR    = { win: "#5fa98c", loss: "rgba(209,139,127,0.7)", neutral: "#a78bfa" } as const;

/* ── Matchup score block ─────────────────────────────────────────────────── */

function MatchupHero({ summary, teamName }: { summary: MatchupQuickSummary; teamName: string }) {
  const isActive   = summary.status === "active";
  const isComplete = summary.status === "complete";
  const hasScores  = summary.myScore > 0;
  const opponents  = summary.teamsCount - 1; // how many teams you play each week

  const label = isActive ? "Active" : isComplete ? "Final" : "Upcoming";
  const winRate = opponents > 0 ? summary.wins / opponents : 0;
  const recordLabel = `${summary.wins}–${summary.losses}${summary.ties > 0 ? `–${summary.ties}` : ""}`;

  const tone: keyof typeof RECORD_COLOR =
    summary.wins > summary.losses ? "win" : summary.losses > summary.wins ? "loss" : "neutral";

  const scoreBg = isActive
    ? "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(124,58,237,0.05))"
    : "rgba(150,160,200,0.04)";
  const scoreBorder = isActive ? "rgba(124,58,237,0.28)" : "var(--border)";

  return (
    <div style={{ padding: 16, borderRadius: 14, background: scoreBg, border: `1px solid ${scoreBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: isActive ? "#a78bfa" : "var(--dim)" }}>
          Week {summary.week} · {label}
        </span>
      </div>

      {(isActive || isComplete) && hasScores ? (
        <>
          {/* Score + record */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 3 }}>Your score</div>
              <div className="font-stats" style={{ fontSize: 42, fontWeight: 700, lineHeight: 0.78, color: "#f6f7fb" }}>
                {summary.myScore.toFixed(1)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 3 }}>This week vs field</div>
              {summary.wins === -1 ? (
                /* Setup phase — no games played yet */
                <>
                  <div className="font-stats" style={{ fontSize: 30, fontWeight: 700, lineHeight: 0.8, color: "var(--faint)" }}>
                    —
                  </div>
                  <div style={{ fontSize: 9, color: "var(--faint)", marginTop: 4, letterSpacing: "0.02em" }}>
                    No games yet
                  </div>
                </>
              ) : (
                <>
                  <div className="font-stats" style={{ fontSize: 30, fontWeight: 700, lineHeight: 0.8, color: RECORD_COLOR[tone] }}>
                    {recordLabel}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--faint)", marginTop: 4, letterSpacing: "0.02em" }} title="Record against all other teams this week in Victory Points format">
                    Record
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Win-rate bar */}
          <div style={{ marginTop: 13 }}>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(150,160,200,0.14)", overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${Math.round(winRate * 100)}%`, background: BAR_COLOR[tone] }} />
            </div>
            <div style={{ fontSize: 10.5, color: "var(--dim)", marginTop: 7 }}>
              {summary.wins} of {opponents} opponents outscored
            </div>
          </div>
        </>
      ) : (
        /* Upcoming — no scores yet */
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f6f7fb", marginBottom: 4 }}>{teamName}</div>
          <div style={{ fontSize: 12, color: "var(--dim)" }}>vs all {opponents} teams · Week {summary.week}</div>
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const user = await requireAuth("/dashboard");

  const devNow = await getDevNow();
  const nowMs = devNow;

  // Run scheduled checks (like LINEUP_INCOMPLETE notifications) for the current user
  await checkAndEmitScheduledNotifications(user.id, nowMs, prisma);

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

  const teams = [
    ...ownedTeams.map(t => ({ ...t, isOwned: true as const })),
    ...extraTeams.map(t => ({ ...t, isOwned: t.ownerId === user.id })),
  ];
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

    // Playoffs are live — highest priority
    if (league.playoffStatus === "IN_PROGRESS") {
      actions.push({
        label: "Playoffs are live — check your bracket",
        href: `/league/${team.leagueId}/bracket`,
        teamName: league.name,
      });
    }

    // Draft live right now
    if (league.draft?.status === "IN_PROGRESS") {
      actions.push({
        label: "Draft is live right now",
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
        label: `Tight week — you're ${summary.wins}–${summary.losses}${summary.ties > 0 ? `–${summary.ties}` : ""} vs the field`,
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

  const inSeason = teams.filter((t) => t.league.status === "IN_SEASON").length;
  const summaryLine = `${teams.length} ${teams.length === 1 ? "franchise" : "franchises"} · ${inSeason} in season · ${teams.length - inSeason} complete`;

  return (
    <main>
      <section className="page-width" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 48 }}>

        {/* ── Header ── */}
        <header style={{ marginTop: 16 }}>
          {hasTeams ? (
            <>
              <p className="hero-eyebrow" style={{ color: "#a78bfa", letterSpacing: "0.2em" }}>My Leagues</p>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", margin: "10px 0 0" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3.2vw, 2.4rem)", fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1 }}>
                    {greeting}, {user.displayName}.
                  </h1>
                  <p style={{ margin: "11px 0 0", fontSize: 14, color: "var(--dim)" }}>{summaryLine}</p>
                </div>
                <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                  <Link href="/create-league" className="button-primary">+ New League</Link>
                  <Link href="/join-league" className="button-secondary">Join League</Link>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="hero-eyebrow" style={{ color: "#a78bfa", letterSpacing: "0.2em" }}>PWHL GM</p>
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

        {/* ── Welcome flow (first-time, zero teams) ── */}
        {!hasTeams && !user.onboardingCompletedAt && (
          <WelcomeFlow />
        )}

        {/* ── Action items ── */}
        {actions.length > 0 && (
          <section className="alert-amber" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e3c989" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#e3c989" }}>Action needed</span>
            </div>
            {actions.map((a, idx) => (
              <Link key={idx} href={a.href} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e3c989", flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: "#eef1f8", fontWeight: 500 }}>{a.label}</span>
                <span style={{ fontSize: 12, color: "var(--dim)" }}>{a.teamName}</span>
                <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#e3c989", whiteSpace: "nowrap" }}>Open →</span>
              </Link>
            ))}
          </section>
        )}

        {/* ── Your franchises ── */}
        {hasTeams && (
          <section>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <span className="section-accent" />
              <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--text)" }}>Your Franchises</span>
              <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 600 }}>{teams.length} active</span>
            </div>
            <div className="grid-2" style={{ gap: 20, alignItems: "stretch" }}>
              {teams.map((team, i) => {
                const summary = summaries[i];
                const topPerformers = topPerformersList[i];
                const isActive = summary?.status === "active";
                const crestBg = isActive
                  ? "linear-gradient(135deg,#7c3aed,#4c1d95)"
                  : "linear-gradient(135deg,#3a4258,#222a3d)";
                return (
                  <div
                    key={team.id}
                    className="team-card"
                    style={{ display: "flex", flexDirection: "column", gap: 0, padding: 22, borderRadius: 18 }}
                  >
                    {/* Card head */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 16 }}>
                      <span style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 17, fontWeight: 800, color: "#fff", background: crestBg,
                      }}>
                        {teamCrest(team.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-0.01em", color: "#f6f7fb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {team.name}
                          </h3>
                          {!team.isOwned && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "var(--accent-dim)", color: "#c9b6ff", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                              Commish
                            </span>
                          )}
                        </div>
                        <div className="team-meta" style={{ fontSize: 11.5, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {team.league.name} · Season {team.league.season}
                        </div>
                      </div>
                      <LeagueStatusChip status={team.league.status} />
                    </div>

                    {/* Score block */}
                    {summary ? (
                      <MatchupHero summary={summary} teamName={team.name} />
                    ) : (
                      <div style={{
                        padding: 16, borderRadius: 14,
                        background: "rgba(150,160,200,0.04)", border: "1px solid var(--border)",
                        fontSize: 13, color: "var(--faint)",
                      }}>
                        No matchup scheduled yet
                      </div>
                    )}

                    {/* Detail row — top performers */}
                    <div style={{ minHeight: 54, marginTop: 14, marginBottom: 16 }}>
                      {topPerformers.length > 0 ? (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
                            Top performers
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {topPerformers.map((p, j) => (
                              <div key={j} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
                                <span style={{ fontSize: 12.5, color: "#dfe3ee", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {p.name}
                                </span>
                                <span className="font-stats" style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", flexShrink: 0 }}>{p.points} pts</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.5 }}>
                          No scoring yet this period.
                        </div>
                      )}
                    </div>

                    {/* Actions — pinned to bottom */}
                    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
                      {team.isOwned ? (
                        <>
                          <Link href={`/team/${team.id}/matchup`} className="button-primary" style={{ width: "100%", textAlign: "center" }}>
                            My Matchup →
                          </Link>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                            <Link href={`/team/${team.id}/lineup`} className="button-secondary" style={{ textAlign: "center" }}>Set Lineup</Link>
                            <Link href={`/league/${team.leagueId}`} className="button-secondary" style={{ textAlign: "center" }}>League</Link>
                          </div>
                        </>
                      ) : (
                        <>
                          <Link href={`/league/${team.leagueId}`} className="button-primary" style={{ width: "100%", textAlign: "center" }}>
                            View League →
                          </Link>
                          <Link href={`/league/${team.leagueId}/admin`} className="button-secondary" style={{ textAlign: "center" }}>Admin Panel</Link>
                        </>
                      )}
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
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PRE_DRAFT: { label: "Pre-draft", color: "#e3c989", bg: "rgba(214,169,78,0.12)", border: "rgba(214,169,78,0.30)" },
    IN_SEASON: { label: "In Season", color: "#7fc2a6", bg: "rgba(95,169,140,0.12)", border: "rgba(95,169,140,0.30)" },
    COMPLETE:  { label: "Complete",  color: "#9aa3bd", bg: "rgba(150,160,200,0.08)", border: "rgba(150,160,200,0.18)" },
  };
  const chip = map[status];
  if (!chip) return null;
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, padding: "5px 9px", borderRadius: 20,
      color: chip.color, background: chip.bg, border: `1px solid ${chip.border}`,
      letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {chip.label}
    </span>
  );
}
