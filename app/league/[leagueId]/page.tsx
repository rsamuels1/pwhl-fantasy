import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeRace } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
import { requireAuth, requireLeagueAccess } from "@/lib/auth";
import { getLeagueActivity } from "@/lib/services/activity";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import Link from "next/link";
import AnnouncementForm from "@/components/AnnouncementForm";
import { VpExplainer } from "@/components/VpExplainer";

export default async function LeagueOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const { leagueId } = await params;
  const sp = await searchParams;
  const isWelcome = sp?.welcome === "1";

  const user = await requireAuth(`/league/${leagueId}`);
  const { myTeam, isCommissioner } = await requireLeagueAccess(leagueId, user.id);

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    include: {
      teams: true,
      draft: { select: { id: true, status: true } },
    },
  });

  if (!league) notFound();

  // Draft in progress → draft room (only if user has a team in the league)
  if (league.draft?.status === "IN_PROGRESS" && myTeam) {
    redirect(`/draft/${leagueId}?team=${myTeam.id}`);
  }

  const nowMs = getReplayNow(league, await getDevNow());
  const now = new Date(nowMs);

  const [matchups, seasonState, activity] = await Promise.all([
    prisma.matchup.findMany({
      where: { leagueId },
      orderBy: [{ week: "asc" }, { startsAt: "asc" }],
      include: { homeTeam: true, awayTeam: true },
    }),
    getSeasonState(leagueId, nowMs, prisma),
    getLeagueActivity(leagueId, 6, prisma).catch(() => []),
  ]);

  // Determine champion for COMPLETE playoffs
  let championTeamName: string | null = null;
  if (league.playoffStatus === "COMPLETE") {
    const finalMatchup = matchups
      .filter((m) => m.isPlayoff && m.homeScore !== null && m.awayScore !== null)
      .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
    if (finalMatchup && finalMatchup.homeScore !== null && finalMatchup.awayScore !== null) {
      const homeWon = finalMatchup.homeScore >= finalMatchup.awayScore;
      championTeamName = homeWon ? finalMatchup.homeTeam.name : finalMatchup.awayTeam.name;
    }
  }

  const vpStandings = computeVpStandings(
    league.teams,
    matchups.map((m) => ({
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeVP: m.homeVP, awayVP: m.awayVP,
      isPlayoff: m.isPlayoff,
      week: m.week,
    }))
  );
  // Map to Standing shape (points = totalVP) so computeRace works.
  const standings = vpStandings.map((s) => ({
    ...s,
    points: s.totalVP,
    pointsAgainst: 0,
  }));
  const playoffSettings = (league.playoffSettings ?? {}) as { teamsInPlayoff?: number };
  const teamsInPlayoff = playoffSettings.teamsInPlayoff ?? 4;
  const hasResults = matchups.some((m) => m.homeScore !== null);
  const playoffStatus = league.playoffStatus;
  const playoffsStarted = playoffStatus !== "NOT_STARTED";

  // Bracket is the primary landing during active playoffs (same pattern as draft redirect)
  if (playoffStatus === "IN_PROGRESS") {
    redirect(`/league/${leagueId}/bracket`);
  }

  // Current week derivation
  const startedMatchups = matchups.filter((m) => new Date(m.startsAt).getTime() <= nowMs);
  const currentWeek =
    startedMatchups.length > 0
      ? Math.max(...startedMatchups.map((m) => m.week))
      : matchups.length > 0
      ? Math.min(...matchups.map((m) => m.week))
      : null;
  const thisWeekMatchups = currentWeek !== null
    ? matchups.filter((m) => m.week === currentWeek)
    : [];

  // Race info (only when results exist and playoffs haven't started)
  const raceMap = hasResults && !playoffsStarted && standings.length > 1
    ? computeRace(standings, matchups, teamsInPlayoff)
    : null;

  // ── Season state for lineup status + commissioner strip ──
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const upcomingPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;
  const periodForGames = activePeriod ?? upcomingPeriod;

  // Team lineup status widget — batch query for all active-slot entries
  let alertsByTeam = new Map<string, number>(); // fantasyTeamId → count of 0-game starters
  if (league.status === "IN_SEASON" && periodForGames) {
    const activeEntries = await prisma.rosterEntry.findMany({
      where: { fantasyTeam: { leagueId }, slot: { notIn: ["BENCH", "IR"] } },
      select: { fantasyTeamId: true, player: { select: { team: { select: { id: true } } } } },
    });
    const pwhlTeamIds = [...new Set(
      activeEntries.map((e) => e.player.team?.id).filter((id): id is string => !!id)
    )];
    const remainingGames = pwhlTeamIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gt: now, lt: periodForGames.endsAt },
            OR: [{ homeTeamId: { in: pwhlTeamIds } }, { awayTeamId: { in: pwhlTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : [];
    const gamesPerPwhl = new Map<string, number>();
    for (const g of remainingGames) {
      gamesPerPwhl.set(g.homeTeamId, (gamesPerPwhl.get(g.homeTeamId) ?? 0) + 1);
      gamesPerPwhl.set(g.awayTeamId, (gamesPerPwhl.get(g.awayTeamId) ?? 0) + 1);
    }
    for (const e of activeEntries) {
      const pId = e.player.team?.id ?? null;
      if (pId && (gamesPerPwhl.get(pId) ?? 0) === 0) {
        alertsByTeam.set(e.fantasyTeamId, (alertsByTeam.get(e.fantasyTeamId) ?? 0) + 1);
      }
    }
  }

  // Commissioner action strip
  let commishAction: { label: string; sublabel: string; href: string } | null = null;
  if (isCommissioner) {
    const hasPendingWeek = seasonState.periods.some((p) => p.status === "SCORING_PENDING");
    const pendingPeriod = seasonState.periods.find((p) => p.status === "SCORING_PENDING");
    const allDone = seasonState.periods.length > 0 &&
      seasonState.periods.every((p) => p.status === "COMPLETE" || p.status === "SCORING_PENDING");
    const regularSeasonDone = league.status === "IN_SEASON" && allDone && !playoffsStarted;

    // Playoff round detection: populated matchups (both teams set) that are unscored
    const populatedPlayoffMatchups = matchups.filter(
      (m) => m.isPlayoff && m.homeTeamId && m.awayTeamId
    );
    const currentPlayoffRound = populatedPlayoffMatchups.length > 0
      ? Math.min(...populatedPlayoffMatchups.filter((m) => m.homeScore === null).map((m) => m.round ?? 1).concat([Infinity]))
      : null;
    const playoffRoundComplete = currentPlayoffRound !== Infinity && currentPlayoffRound !== null &&
      populatedPlayoffMatchups.filter((m) => (m.round ?? 1) === currentPlayoffRound).every((m) => m.homeScore !== null);
    const playoffRoundLive = currentPlayoffRound !== null && currentPlayoffRound !== Infinity && !playoffRoundComplete;

    if (league.status === "PRE_DRAFT" && (!league.draft || league.draft.status === "PENDING")) {
      commishAction = {
        label: "Draft setup needed",
        sublabel: "Configure roster settings and generate team join links before the draft.",
        href: `/league/${leagueId}/admin`,
      };
    } else if (hasPendingWeek && pendingPeriod) {
      const period = pendingPeriod.period;
      commishAction = {
        label: `Week ${period.week} is ready to score`,
        sublabel: "Games are final — advance the season to lock in results and start the next week.",
        href: `/league/${leagueId}/season`,
      };
    } else if (regularSeasonDone) {
      commishAction = {
        label: "Regular season complete",
        sublabel: "All weeks are scored. Head to the admin panel to seed and start the playoffs.",
        href: `/league/${leagueId}/admin`,
      };
    }
    // Note: IN_PROGRESS playoff actions omitted — when playoffs are IN_PROGRESS the page
    // redirects to /bracket, so these branches are unreachable. Playoff controls live on
    // the season page, accessible from the bracket page nav.
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Welcome banner ── */}
      {isWelcome && myTeam && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#34d399" }}>
            ✓ You&apos;re in! {myTeam.name} is registered.
          </p>
          {league.draft?.status === "COMPLETE" ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              The draft is done. <Link href={`/team/${myTeam.id}/lineup`} style={{ color: "#a5b4fc" }}>Set your lineup →</Link>
            </p>
          ) : league.draft?.status === "IN_PROGRESS" ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              The draft is live right now! <Link href={`/draft/${leagueId}?team=${myTeam.id}`} style={{ color: "#a5b4fc" }}>Join the draft room →</Link>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              The commissioner will share a draft room link when it&apos;s time to pick.
            </p>
          )}
        </div>
      )}

      {/* ── Commissioner announcement — display + inline edit for commissioner ── */}
      {(league.announcement || isCommissioner) && (
        <div style={{
          padding: "14px 18px", borderRadius: 14,
          background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: isCommissioner ? 12 : 0 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📣</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#818cf8", marginBottom: 4 }}>
                Commissioner note
              </div>
              {league.announcement ? (
                <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {league.announcement}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#475569", fontStyle: "italic" }}>No league announcements yet.</p>
              )}
            </div>
          </div>
          {isCommissioner && (
            <div style={{ borderTop: "1px solid rgba(99,102,241,0.15)", paddingTop: 12, marginTop: 4 }}>
              <AnnouncementForm leagueId={leagueId} initial={league.announcement ?? null} />
            </div>
          )}
        </div>
      )}

      {/* ── Commissioner action strip ── */}
      {commishAction && (
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{commishAction.label}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{commishAction.sublabel}</div>
          </div>
          <Link href={commishAction.href} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, flexShrink: 0,
            background: "rgba(245,158,11,0.15)", color: "#fbbf24",
            border: "1px solid rgba(245,158,11,0.3)", textDecoration: "none",
          }}>
            Take action →
          </Link>
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

      {/* ── Two-column grid ── */}
      <div className="overview-grid">

        {/* LEFT: Playoff race (primary) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Champion announcement */}
          {league.playoffStatus === "COMPLETE" && championTeamName && (
            <section style={{
              ...card,
              background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.04))",
              border: "2px solid rgba(251,191,36,0.35)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <div>
                    <h2 style={{ ...sectionTitle, color: "#fbbf24", marginBottom: 2 }}>Season Complete</h2>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
                      {championTeamName} are champions!
                    </div>
                  </div>
                </div>
                <Link href={`/league/${leagueId}/bracket`} style={ctaLink}>View bracket →</Link>
              </div>
              <p style={{ color: "#78716c", margin: 0, fontSize: 13 }}>
                Congratulations to {championTeamName} on a great season. See you next year!
              </p>
            </section>
          )}

          {/* Playoffs underway — mini bracket summary */}
          {playoffsStarted && league.playoffStatus !== "COMPLETE" && (() => {
            const playoffMatchups = matchups.filter((m) => m.isPlayoff);
            const populatedPlayoffMatchups = playoffMatchups.filter((m) => m.homeTeamId && m.awayTeamId);
            if (populatedPlayoffMatchups.length === 0) return null;

            // Find current round: lowest round with unscored matchups, else highest scored
            const unscoredRounds = populatedPlayoffMatchups
              .filter((m) => m.homeScore === null)
              .map((m) => m.round ?? 1);
            const currentPlayoffRound = unscoredRounds.length > 0
              ? Math.min(...unscoredRounds)
              : Math.max(...populatedPlayoffMatchups.map((m) => m.round ?? 1));

            const currentRoundMatchups = populatedPlayoffMatchups.filter(
              (m) => (m.round ?? 1) === currentPlayoffRound
            );
            const totalRounds = Math.max(...populatedPlayoffMatchups.map((m) => m.round ?? 1));
            const roundLabel =
              currentPlayoffRound === totalRounds ? "Championship" :
              currentPlayoffRound === totalRounds - 1 ? "Semifinals" :
              `Round ${currentPlayoffRound}`;

            return (
              <section style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={sectionTitle}>🏒 {roundLabel}</h2>
                  <Link href={`/league/${leagueId}/bracket`} style={ctaLink}>Full bracket →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {currentRoundMatchups.map((m) => {
                    const scored = m.homeScore !== null && m.awayScore !== null;
                    const isMyMatchup = m.homeTeamId === myTeam?.id || m.awayTeamId === myTeam?.id;
                    return (
                      <div key={m.id} style={{
                        display: "grid", gridTemplateColumns: "1fr auto 1fr",
                        gap: "4px 8px", padding: "8px 10px", borderRadius: 8, alignItems: "center",
                        background: isMyMatchup ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)",
                        border: isMyMatchup ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(148,163,184,0.06)",
                      }}>
                        <span style={{
                          fontSize: 13, textAlign: "right", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                          color: m.homeTeamId === myTeam?.id ? "#e2e8f0" : "#94a3b8",
                          fontWeight: m.homeTeamId === myTeam?.id ? 600 : 400,
                        }}>
                          {m.homeTeam.name}
                          {scored && <span style={{ marginLeft: 6, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.homeScore!.toFixed(1)}</span>}
                        </span>
                        <span style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: "0.5px" }}>
                          {scored ? "FINAL" : "VS"}
                        </span>
                        <span style={{
                          fontSize: 13, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                          color: m.awayTeamId === myTeam?.id ? "#e2e8f0" : "#94a3b8",
                          fontWeight: m.awayTeamId === myTeam?.id ? 600 : 400,
                        }}>
                          {scored && <span style={{ marginRight: 6, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.awayScore!.toFixed(1)}</span>}
                          {m.awayTeam.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* Playoff race / standings — primary module */}
          {hasResults && !playoffsStarted && standings.length > 0 && (
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h2 style={{ ...sectionTitle, marginBottom: 2 }}>Playoff race</h2>
                  <div style={{ fontSize: 12, color: "#475569" }}>Top {teamsInPlayoff} advance</div>
                </div>
                <Link href={`/league/${leagueId}/standings`} style={{ fontSize: 12, color: "#64748b", textDecoration: "none" }}>
                  Full standings →
                </Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {standings.map((s, i) => {
                  const rank = i + 1;
                  const isMe = s.fantasyTeamId === myTeam?.id;
                  const race = raceMap?.get(s.fantasyTeamId);
                  const isLastIn = rank === teamsInPlayoff;

                  const chipStyle = (() => {
                    if (!race) {
                      const inNow = rank <= teamsInPlayoff;
                      return inNow
                        ? { label: "IN", bg: "rgba(52,211,153,0.12)", color: "#34d399", border: "rgba(52,211,153,0.2)" }
                        : rank === teamsInPlayoff + 1
                        ? { label: "BUBBLE", bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" }
                        : { label: "OUT", bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "rgba(100,116,139,0.15)" };
                    }
                    switch (race.status) {
                      case "clinched":   return { label: "✓ CLINCHED", bg: "rgba(52,211,153,0.12)", color: "#34d399", border: "rgba(52,211,153,0.2)" };
                      case "in":         return { label: "IN", bg: "rgba(52,211,153,0.08)", color: "#4ade80", border: "rgba(52,211,153,0.15)" };
                      case "bubble":     return { label: "BUBBLE", bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" };
                      case "eliminated": return { label: "✗ ELIM", bg: "rgba(239,68,68,0.1)", color: "#f87171", border: "rgba(239,68,68,0.2)" };
                      case "out":        return { label: `${race.gamesBack} GB`, bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "rgba(100,116,139,0.15)" };
                    }
                  })();

                  return (
                    <div key={s.fantasyTeamId}>
                      {isLastIn && (
                        <div style={{ borderBottom: "1px dashed rgba(148,163,184,0.18)", margin: "5px 0" }} />
                      )}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "22px 1fr auto 70px",
                        gap: 8, padding: "9px 10px", borderRadius: 8, alignItems: "center",
                        background: isMe ? "rgba(99,102,241,0.07)" : "transparent",
                      }}>
                        <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>{rank}</span>
                        <span style={{
                          fontSize: 14, fontWeight: isMe ? 700 : 400,
                          color: isMe ? "#a5b4fc" : "#e2e8f0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s.teamName}
                          {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#6366f1" }}>You</span>}
                        </span>
                        <span style={{ fontSize: 12, color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>
                          {s.wins}–{s.losses}{s.ties > 0 ? `–${s.ties}` : ""}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textAlign: "center",
                          padding: "2px 6px", borderRadius: 6, whiteSpace: "nowrap",
                          background: chipStyle.bg, color: chipStyle.color,
                          border: `1px solid ${chipStyle.border}`,
                        }}>
                          {chipStyle.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pre-season / no results yet */}
          {!hasResults && league.status !== "IN_SEASON" && (
            <>
              {/* Manager draft prep guide — shown to non-commissioners in PRE_DRAFT */}
              {league.status === "PRE_DRAFT" && !isCommissioner && myTeam && (
                <section style={card}>
                  <h2 style={{ ...sectionTitle, marginBottom: 14 }}>Get ready to draft</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    <DraftPrepItem done label="Joined league" detail={`You're in as ${myTeam.name}`} />
                    <DraftPrepItem done={false} label="Learn how scoring works" detail="Victory Points: win your matchup AND be a top scorer each week.">
                      <VpExplainer />
                    </DraftPrepItem>
                    <DraftPrepItem
                      done={false}
                      label="Build a draft queue"
                      detail="Queue up players you want before the draft starts — you'll be on the clock!"
                      linkHref={league.draft?.id ? `/draft/${leagueId}?team=${myTeam.id}` : undefined}
                      linkLabel="Open draft room →"
                    />
                    {league.draftStartsAt && (() => {
                      const ms = new Date(league.draftStartsAt).getTime() - nowMs;
                      const days = Math.ceil(ms / 86_400_000);
                      return ms > 0 ? (
                        <DraftPrepItem
                          done={false}
                          label="Draft day is coming"
                          detail={days <= 1 ? "Draft is today or tomorrow!" : `Draft in ${days} day${days === 1 ? "" : "s"} — make sure you're available`}
                        />
                      ) : null;
                    })()}
                  </div>

                  {isCommissioner === false && (
                    <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>
                      The commissioner will share the draft room link when it&apos;s time to pick.
                    </p>
                  )}
                </section>
              )}

              {/* Commissioner sees the admin panel checklist, not this */}
              {(isCommissioner || !myTeam) && (
                <section style={card}>
                  <h2 style={sectionTitle}>Standings</h2>
                  <p style={{ color: "#475569", fontSize: 13, margin: "10px 0 0" }}>
                    Standings will appear once the season starts.
                  </p>
                  {isCommissioner && league.status === "PRE_DRAFT" && (
                    <Link href={`/league/${leagueId}/admin`} style={{ ...ctaLink, marginTop: 14, display: "inline-block" }}>
                      Go to admin panel →
                    </Link>
                  )}
                </section>
              )}
            </>
          )}

          {/* ── All matchups this week — compact / secondary ── */}
          {thisWeekMatchups.length > 0 && (
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ ...sectionTitle, fontSize: 14, color: "#64748b" }}>
                  {currentWeek !== null ? `Week ${currentWeek} matchups` : "Matchups"}
                </h2>
                <Link href={`/league/${leagueId}/matchups`} style={{ fontSize: 12, color: "#475569", textDecoration: "none" }}>
                  Full schedule →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {thisWeekMatchups.map((m) => {
                  const scored = m.homeScore !== null && m.awayScore !== null;
                  const isMyMatchup = m.homeTeamId === myTeam?.id || m.awayTeamId === myTeam?.id;
                  return (
                    <div key={m.id} style={{
                      display: "grid", gridTemplateColumns: "1fr auto 1fr",
                      gap: "4px 8px", padding: "6px 8px", borderRadius: 8, alignItems: "center",
                      background: isMyMatchup ? "rgba(99,102,241,0.05)" : "transparent",
                      border: isMyMatchup ? "1px solid rgba(99,102,241,0.15)" : "1px solid transparent",
                    }}>
                      <span style={{
                        fontSize: 13, textAlign: "right", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        color: m.homeTeamId === myTeam?.id ? "#e2e8f0" : "#94a3b8",
                        fontWeight: m.homeTeamId === myTeam?.id ? 600 : 400,
                      }}>
                        {m.homeTeam.name}
                        {scored && <span style={{ marginLeft: 6, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.homeScore!.toFixed(1)}</span>}
                      </span>
                      <span style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: "0.5px" }}>
                        {scored ? "·" : "VS"}
                      </span>
                      <span style={{
                        fontSize: 13, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        color: m.awayTeamId === myTeam?.id ? "#e2e8f0" : "#94a3b8",
                        fontWeight: m.awayTeamId === myTeam?.id ? 600 : 400,
                      }}>
                        {scored && <span style={{ marginRight: 6, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.awayScore!.toFixed(1)}</span>}
                        {m.awayTeam.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: My matchup + lineup status + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* My matchup compact widget */}
          {myTeam && (() => {
            const myMatchups = thisWeekMatchups.filter(
              (m) => m.homeTeamId === myTeam.id || m.awayTeamId === myTeam.id
            );
            const myScore = myMatchups.length > 0
              ? (() => {
                  const first = myMatchups[0];
                  const scored = first.homeScore !== null;
                  if (!scored) return null;
                  return first.homeTeamId === myTeam.id ? first.homeScore : first.awayScore;
                })()
              : null;
            const scoredCount = myMatchups.filter((m) => m.homeScore !== null).length;
            const wins = myMatchups.filter((m) => {
              if (m.homeScore === null) return false;
              const mine = m.homeTeamId === myTeam.id ? m.homeScore : m.awayScore!;
              const theirs = m.homeTeamId === myTeam.id ? m.awayScore! : m.homeScore;
              return mine > theirs;
            }).length;
            const losses = myMatchups.filter((m) => {
              if (m.homeScore === null) return false;
              const mine = m.homeTeamId === myTeam.id ? m.homeScore : m.awayScore!;
              const theirs = m.homeTeamId === myTeam.id ? m.awayScore! : m.homeScore;
              return mine < theirs;
            }).length;

            return (
              <section style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h2 style={sectionTitle}>My matchup</h2>
                  {currentWeek !== null && (
                    <span style={{ fontSize: 11, color: "#475569" }}>Wk {currentWeek}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                  {myScore !== null ? (
                    <span style={{ fontSize: 32, fontWeight: 800, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
                      {myScore.toFixed(1)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#475569" }}>—</span>
                  )}
                  {scoredCount > 0 && (
                    <span style={{ fontSize: 13, color: "#64748b" }}>
                      {wins}–{losses} vs field
                    </span>
                  )}
                  {scoredCount === 0 && myMatchups.length > 0 && (
                    <span style={{ fontSize: 13, color: "#64748b" }}>
                      {currentWeek !== null
                        ? new Date(myMatchups[0].startsAt).getTime() > nowMs ? "Upcoming" : "In progress"
                        : ""}
                    </span>
                  )}
                </div>
                <Link href={`/team/${myTeam.id}/matchup`} style={ctaLink}>
                  My Matchup →
                </Link>
              </section>
            );
          })()}

          {/* Team lineup status widget */}
          {league.status === "IN_SEASON" && league.teams.length > 0 && (
            <section style={card}>
              <h2 style={{ ...sectionTitle, marginBottom: 12 }}>Lineup status</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {league.teams.map((t) => {
                  const alerts = alertsByTeam.get(t.id) ?? 0;
                  const isMe = t.id === myTeam?.id;
                  const chip = !periodForGames
                    ? { label: "—", bg: "rgba(100,116,139,0.08)", color: "#475569" }
                    : alerts > 0
                    ? { label: `⚠ ${alerts} ${alerts === 1 ? "issue" : "issues"}`, bg: "rgba(245,158,11,0.1)", color: "#f59e0b" }
                    : { label: "✓ Set", bg: "rgba(52,211,153,0.1)", color: "#34d399" };
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 8px", borderRadius: 8,
                      background: isMe ? "rgba(99,102,241,0.06)" : "transparent",
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: isMe ? 600 : 400,
                        color: isMe ? "#a5b4fc" : "#94a3b8",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                      }}>
                        {t.name}
                        {isMe && <span style={{ marginLeft: 5, fontSize: 10, color: "#6366f1" }}>You</span>}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6,
                        background: chip.bg, color: chip.color, flexShrink: 0, marginLeft: 8,
                      }}>
                        {chip.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {periodForGames && (
                <div style={{ fontSize: 11, color: "#334155", marginTop: 10 }}>
                  Games remaining through {fmt(new Date(periodForGames.endsAt.getTime() - 1))}
                </div>
              )}
            </section>
          )}

          {/* League activity */}
          <section style={card}>
            <h2 style={{ ...sectionTitle, marginBottom: 12 }}>League activity</h2>
            {activity.length === 0 ? (
              <p style={{ color: "#334155", fontSize: 13, margin: 0, fontStyle: "italic" }}>League activity will appear here.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activity.map((evt) => {
                  const ICONS: Record<string, string> = {
                    PLAYER_ADD: "➕", PLAYER_DROP: "➖", DRAFT_PICK: "🎯",
                    PLAYOFF_QUALIFICATION: "🏒", MAJOR_PERFORMANCE: "⭐",
                  };
                  return (
                    <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
                        <span style={{ marginRight: 6 }}>{ICONS[evt.type] ?? "•"}</span>
                        {evt.description}
                      </span>
                      <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>{fmt(new Date(evt.createdAt))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

function DraftPrepItem({
  done,
  label,
  detail,
  linkHref,
  linkLabel,
  children,
}: {
  done: boolean;
  label: string;
  detail: string;
  linkHref?: string;
  linkLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 12px", borderRadius: 10,
      background: done ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${done ? "rgba(52,211,153,0.15)" : "rgba(148,163,184,0.08)"}`,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, marginTop: 1,
        background: done ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.1)",
        color: done ? "#34d399" : "#818cf8",
        border: `1.5px solid ${done ? "#34d399" : "rgba(99,102,241,0.3)"}`,
      }}>
        {done ? "✓" : "·"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? "#64748b" : "#e2e8f0", textDecoration: done ? "line-through" : "none" }}>
          {label}
          {linkHref && linkLabel && (
            <Link href={linkHref} style={{ marginLeft: 8, fontSize: 12, color: "#a5b4fc", fontWeight: 400, textDecoration: "none" }}>
              {linkLabel}
            </Link>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{detail}</div>
        {children && <div style={{ marginTop: 8 }}>{children}</div>}
      </div>
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
