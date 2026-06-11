import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeStandings } from "@/lib/playoffs/seeding";
import { requireAuth, requireLeagueMember } from "@/lib/auth";
import { getLeagueActivity } from "@/lib/services/activity";
import { getDevNow } from "@/lib/devTime";
import Link from "next/link";

export default async function LeagueOverviewPage({
  params,
  searchParams,
}: {
  params: { leagueId: string };
  searchParams?: { welcome?: string };
}) {
  const leagueId = params.leagueId;
  const isWelcome = searchParams?.welcome === "1";
  const user = await requireAuth(`/league/${leagueId}`);
  const myTeam = await requireLeagueMember(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: true,
      draft: { select: { id: true, status: true } },
    },
  });

  if (!league) notFound();

  const myTeamInLeague = league.teams.find((t) => t.ownerId === user?.id);

  // Draft in progress → draft room
  if (league.draft?.status === "IN_PROGRESS" && myTeamInLeague) {
    redirect(`/draft/${leagueId}?team=${myTeamInLeague.id}`);
  }

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    orderBy: [{ week: "asc" }, { startsAt: "asc" }],
    include: { homeTeam: true, awayTeam: true },
  });

  const standings = computeStandings(league.teams, matchups);

  // Parse playoff cutoff (default 6 teams)
  const playoffSettings = (league.playoffSettings ?? {}) as { teamsInPlayoff?: number };
  const teamsInPlayoff = playoffSettings.teamsInPlayoff ?? 6;

  // Activity feed — graceful fallback when LeagueEvent table doesn't exist yet
  let activity: Awaited<ReturnType<typeof getLeagueActivity>> = [];
  try {
    activity = await getLeagueActivity(leagueId, 5, prisma);
  } catch {}

  // Determine the "current" week using sim date: latest week whose period has started.
  const nowMs = await getDevNow();
  const startedMatchups = matchups.filter(
    (m) => new Date(m.startsAt).getTime() <= nowMs
  );
  const currentWeek =
    startedMatchups.length > 0
      ? Math.max(...startedMatchups.map((m) => m.week))
      : matchups.length > 0
      ? Math.min(...matchups.map((m) => m.week))
      : null;

  const thisWeekMatchups = currentWeek !== null
    ? matchups.filter((m) => m.week === currentWeek)
    : [];

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

  // Only show playoff race once the season has started (some matchups scored)
  const hasResults = matchups.some((m) => m.homeScore !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Welcome banner (shown once after joining) ── */}
      {isWelcome && myTeamInLeague && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(52,211,153,0.07)",
          border: "1px solid rgba(52,211,153,0.2)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#34d399" }}>
            ✓ You&apos;re in! {myTeamInLeague.name} is registered.
          </p>
          {league.draft?.status === "COMPLETE" ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              The draft is done. <Link href={`/team/${myTeamInLeague.id}/lineup`} style={{ color: "#a5b4fc" }}>Set your lineup →</Link>
            </p>
          ) : league.draft?.status === "IN_PROGRESS" ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              The draft is live right now! <Link href={`/draft/${leagueId}?team=${myTeamInLeague.id}`} style={{ color: "#a5b4fc" }}>Join the draft room →</Link>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              The commissioner will share a draft room link when it&apos;s time to pick. Watch your email.
            </p>
          )}
        </div>
      )}

      {/* ── Commissioner announcement ── */}
      {league.announcement && (
        <div style={{
          padding: "14px 18px", borderRadius: 14,
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.25)",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📣</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#818cf8", marginBottom: 4 }}>
              Commissioner note
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {league.announcement}
            </p>
          </div>
        </div>
      )}

      {/* ── League header ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{league.name}</h1>
        <span style={{ fontSize: 13, color: "#64748b" }}>
          Season {league.season} · {league.teams.length} teams
        </span>
        {currentWeek !== null && (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
          }}>
            Week {currentWeek}
          </span>
        )}
      </div>

      {/* ── 1. This week's matchups ── */}
      <section style={card}>
        <h2 style={sectionTitle}>
          {currentWeek !== null ? `Week ${currentWeek} Matchups` : "Matchups"}
        </h2>
        {thisWeekMatchups.length === 0 ? (
          <p style={{ color: "#64748b", margin: 0, fontSize: 14 }}>No matchups scheduled yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            {thisWeekMatchups.map((m) => {
              const scored = m.homeScore !== null && m.awayScore !== null;
              const homeIsMe = m.homeTeamId === myTeamInLeague?.id;
              const awayIsMe = m.awayTeamId === myTeamInLeague?.id;
              const isMyMatchup = homeIsMe || awayIsMe;
              const homeWon = scored && m.homeScore! > m.awayScore!;
              const awayWon = scored && m.awayScore! > m.homeScore!;
              return (
                <div key={m.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: "8px 12px",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: isMyMatchup ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.025)",
                  border: isMyMatchup ? "1px solid rgba(99,102,241,0.25)" : "1px solid rgba(148,163,184,0.07)",
                }}>
                  <div style={{ textAlign: "right", minWidth: 0 }}>
                    <span style={{
                      fontSize: 14, fontWeight: homeIsMe ? 700 : 500,
                      color: homeIsMe ? "#e2e8f0" : "#94a3b8",
                      display: "block", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {m.homeTeam.name}
                    </span>
                    {scored && (
                      <span style={{ fontSize: 18, fontWeight: 800, color: homeWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {m.homeScore!.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", textAlign: "center", letterSpacing: "0.5px", padding: "0 4px" }}>
                    {scored ? "FINAL" : "VS"}
                  </div>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <span style={{
                      fontSize: 14, fontWeight: awayIsMe ? 700 : 500,
                      color: awayIsMe ? "#e2e8f0" : "#94a3b8",
                      display: "block", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {m.awayTeam.name}
                    </span>
                    {scored && (
                      <span style={{ fontSize: 18, fontWeight: 800, color: awayWon ? "#e2e8f0" : "#475569", fontVariantNumeric: "tabular-nums" }}>
                        {m.awayScore!.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {myTeamInLeague && (
          <div style={{ marginTop: 14 }}>
            <Link href={`/team/${myTeamInLeague.id}/matchup`} style={ctaLink}>
              My Matchup →
            </Link>
          </div>
        )}
      </section>

      {/* ── 2. Playoff race ── */}
      {hasResults && standings.length > 0 && (
        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={sectionTitle}>Playoff race</h2>
            <Link href={`/league/${leagueId}/standings`} style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
              Full standings →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {standings.map((s, i) => {
              const rank = i + 1;
              const isMe = s.fantasyTeamId === myTeamInLeague?.id;
              const isIn = rank <= teamsInPlayoff;
              const isBubble = rank === teamsInPlayoff + 1;
              const isLastIn = rank === teamsInPlayoff;

              const statusChip = isIn
                ? { label: "IN", bg: "rgba(52,211,153,0.12)", color: "#34d399", border: "rgba(52,211,153,0.25)" }
                : isBubble
                ? { label: "BUBBLE", bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.25)" }
                : { label: "OUT", bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "rgba(100,116,139,0.15)" };

              return (
                <div key={s.fantasyTeamId}>
                  {/* Dashed separator after last playoff spot */}
                  {isLastIn && (
                    <div style={{
                      borderBottom: "1px dashed rgba(148,163,184,0.2)",
                      margin: "6px 0",
                    }} />
                  )}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr auto 56px",
                    gap: 8, padding: "8px 10px", borderRadius: 8, alignItems: "center",
                    background: isMe ? "rgba(99,102,241,0.07)" : "transparent",
                  }}>
                    <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>{rank}</span>
                    <span style={{ fontSize: 14, fontWeight: isMe ? 700 : 400, color: isMe ? "#a5b4fc" : "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.teamName}
                      {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: "#6366f1" }}>You</span>}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>
                      {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textAlign: "center",
                      padding: "2px 6px", borderRadius: 6,
                      background: statusChip.bg,
                      color: statusChip.color,
                      border: `1px solid ${statusChip.border}`,
                      whiteSpace: "nowrap",
                    }}>
                      {statusChip.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. League activity ── */}
      {activity.length > 0 && (
        <section style={card}>
          <h2 style={{ ...sectionTitle, marginBottom: 12 }}>League activity</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activity.map((evt) => (
              <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{evt.description}</span>
                <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
                  {fmt(new Date(evt.createdAt))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 20,
  padding: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, margin: 0, color: "#e2e8f0",
};

const ctaLink: React.CSSProperties = {
  display: "inline-block",
  fontSize: 13, fontWeight: 600, color: "#a5b4fc",
  padding: "6px 14px", borderRadius: 999,
  background: "rgba(99,102,241,0.12)",
  border: "1px solid rgba(99,102,241,0.3)",
  textDecoration: "none",
};
