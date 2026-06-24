import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeRace } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
import { requireAuth, requireLeagueAccess, isFounder } from "@/lib/auth";
import { getLeagueActivity } from "@/lib/services/activity";
import { getLeaguePerformers, type LeaguePerformerRow } from "@/lib/services/dashboard";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { getSeasonState } from "@/lib/season";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import Link from "next/link";
import AnnouncementForm from "@/components/AnnouncementForm";
import WeekHighlights from "@/components/WeekHighlights";
import UpsetCard from "@/components/UpsetCard";
import type { Storyline, WeeklyAward } from "@/lib/services/storyline-service";
import { getLeagueUpsets } from "@/lib/services/upset-service";
import { computeSuperlatives } from "@/lib/services/superlatives";
import SuperlativesCard from "@/components/SuperlativesCard";

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

  // League overview is commissioner-only. Non-commissioners live in My Franchise.
  if (!isCommissioner) {
    redirect(myTeam ? `/team/${myTeam.id}/matchup` : `/dashboard`);
  }

  const nowMs = getReplayNow(league, await getDevNow());
  const now = new Date(nowMs);

  const [matchups, seasonState, activity, upsets] = await Promise.all([
    prisma.matchup.findMany({
      where: { leagueId },
      orderBy: [{ week: "asc" }, { startsAt: "asc" }],
      include: { homeTeam: true, awayTeam: true },
    }),
    getSeasonState(leagueId, nowMs, prisma),
    getLeagueActivity(leagueId, 6, prisma).catch(() => []),
    getLeagueUpsets(leagueId, prisma).catch(() => []),
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

  const isVpMode = (league as { scoringMode?: string }).scoringMode === "VP";
  const isVtfMode = isVpMode;

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

  // Superlatives (computed once we have matchup data)
  const superlativesMap = hasResults
    ? computeSuperlatives(
        league.teams.map((t) => ({ fantasyTeamId: t.id, teamName: t.name })),
        matchups.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          week: m.week,
          isPlayoff: m.isPlayoff,
        }))
      )
    : null;
  const superlativeItems = superlativesMap
    ? league.teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        superlatives: superlativesMap.get(t.id) ?? [],
        isMe: t.id === myTeam?.id,
      })).filter((t) => t.superlatives.length > 0)
    : [];

  // Bracket is the primary landing during active playoffs (same pattern as draft redirect)
  if (playoffStatus === "IN_PROGRESS") {
    redirect(`/league/${leagueId}/bracket`);
  }

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);

  // Current week derivation
  const startedMatchups = matchups.filter((m) => new Date(m.startsAt).getTime() <= nowMs);
  const currentWeek =
    startedMatchups.length > 0
      ? Math.max(...startedMatchups.map((m) => m.week))
      : matchups.length > 0
      ? Math.min(...matchups.map((m) => m.week))
      : null;
  const thisWeekMatchups = currentWeek !== null
    ? matchups.filter((m) => m.week === currentWeek && !m.isPlayoff)
    : [];

  // Build VTF ranked list for the current week (replaces misleading pair-card display)
  type VtfEntry = { teamId: string; teamName: string; score: number | null; wins: number; losses: number; ties: number };
  let vtfRanked: VtfEntry[] | null = null;
  if (isVtfMode && thisWeekMatchups.length > 0) {
    const teamMap = new Map<string, VtfEntry>();
    for (const m of thisWeekMatchups) {
      if (!teamMap.has(m.homeTeamId)) {
        teamMap.set(m.homeTeamId, { teamId: m.homeTeamId, teamName: m.homeTeam.name, score: m.homeScore, wins: 0, losses: 0, ties: 0 });
      }
      if (!teamMap.has(m.awayTeamId)) {
        teamMap.set(m.awayTeamId, { teamId: m.awayTeamId, teamName: m.awayTeam.name, score: m.awayScore, wins: 0, losses: 0, ties: 0 });
      }
    }
    const anyScored = thisWeekMatchups.some((m) => m.homeScore != null && m.awayScore != null);
    if (anyScored) {
      for (const m of thisWeekMatchups) {
        if (m.homeScore == null || m.awayScore == null) continue;
        const home = teamMap.get(m.homeTeamId)!;
        const away = teamMap.get(m.awayTeamId)!;
        if (m.homeScore > m.awayScore) { home.wins++; away.losses++; }
        else if (m.homeScore < m.awayScore) { home.losses++; away.wins++; }
        else { home.ties++; away.ties++; }
      }
    }
    vtfRanked = [...teamMap.values()].sort((a, b) => {
      if (a.score != null && b.score != null) return b.score - a.score;
      if (a.score != null) return -1;
      if (b.score != null) return 1;
      return a.teamName.localeCompare(b.teamName);
    });
  }

  // Date range label for this week's chip
  const thisWeekDateRange = thisWeekMatchups.length > 0
    ? `${fmt(new Date(thisWeekMatchups[0].startsAt))} – ${fmt(new Date(thisWeekMatchups[0].endsAt))}`
    : null;

  // Race info (only when results exist and playoffs haven't started)
  const raceMap = hasResults && !playoffsStarted && standings.length > 1
    ? computeRace(standings, matchups, teamsInPlayoff)
    : null;

  // ── Season state for lineup status + commissioner strip ──
  const activePeriod = seasonState.periods.find((p) => p.status === "ACTIVE")?.period ?? null;
  const upcomingPeriod = seasonState.periods.find((p) => p.status === "UPCOMING")?.period ?? null;

  // ── League leaders this week (active period only) ──
  const leagueLeadersScoringSettings = parseScoringSettings(league.scoringSettings);
  const leagueLeaders = activePeriod
    ? await getLeaguePerformers(leagueId, myTeam?.id ?? "", activePeriod, leagueLeadersScoringSettings, prisma, nowMs).catch(() => ({ top: [] as LeaguePerformerRow[], disappointing: [] as LeaguePerformerRow[] }))
    : { top: [] as LeaguePerformerRow[], disappointing: [] as LeaguePerformerRow[] };
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

  // ── Trophy counts per team (for sidebar leaderboard) ──
  const teamIds = league.teams.map((t) => t.id);
  const trophyGroups = teamIds.length > 0
    ? await prisma.trophy.groupBy({
        by: ["teamId"],
        where: { teamId: { in: teamIds } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      })
    : [];
  const trophyCountByTeam = new Map(trophyGroups.map((g) => [g.teamId, g._count.id]));
  const teamsWithTrophies = league.teams
    .map((t) => ({ id: t.id, name: t.name, count: trophyCountByTeam.get(t.id) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Storylines for the most recently scored regular-season week ──
  const leagueEventModel = (prisma as unknown as Record<string, unknown>).leagueEvent as
    | typeof prisma.leagueEvent
    | undefined;
  const latestScoredMatchup = leagueEventModel
    ? await prisma.matchup.findFirst({
        where: { leagueId, homeScore: { not: null }, isPlayoff: false },
        orderBy: { week: "desc" },
        select: { week: true },
      })
    : null;

  // Fetch all LEAGUE_STORYLINE events for the latest scored week (storylines + awards share the same type).
  const allHighlightRows =
    latestScoredMatchup && leagueEventModel
      ? await leagueEventModel
          .findMany({
            where: { leagueId, type: "LEAGUE_STORYLINE" },
            orderBy: { createdAt: "asc" as const },
            take: 30,
          })
          .then((rows) =>
            rows.filter(
              (r) => (r.data as Record<string, unknown>)?.week === latestScoredMatchup.week
            )
          )
      : [];

  const storylines: Storyline[] = allHighlightRows
    .filter((r) => !(r.data as Record<string, unknown>)?.isAward)
    .slice(0, 3)
    .map((r) => r.data as unknown as Storyline);

  const awards: WeeklyAward[] = allHighlightRows
    .filter((r) => (r.data as Record<string, unknown>)?.isAward)
    .map((r) => {
      const d = r.data as Record<string, unknown>;
      return {
        awardType: d.awardType as WeeklyAward["awardType"],
        teamId: d.teamId as string,
        teamName: d.teamName as string,
        value: d.value as number,
      };
    });

  const showNegativeAwards =
    ((league.scoringSettings as Record<string, unknown>)?.showNegativeAwards ?? true) !== false;

  // Build a label for the highlights week (e.g. "Week 3")
  const highlightsWeekLabel =
    latestScoredMatchup ? `Week ${latestScoredMatchup.week}` : "";

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

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
      paddingBottom: league.isReplay && (isCommissioner || isFounder(user.email)) ? 100 : 0,
    }}>

      {/* ── Welcome banner ── */}
      {isWelcome && myTeam && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "rgba(81,216,138,0.07)", border: "1px solid rgba(81,216,138,0.2)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--green)" }}>
            {myTeam.name} is registered.
          </p>
          {league.draft?.status === "COMPLETE" ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
              The draft is done. <Link href={`/team/${myTeam.id}/lineup`} style={{ color: "var(--accent-strong)" }}>Set your lineup →</Link>
            </p>
          ) : league.draft?.status === "IN_PROGRESS" ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
              The draft is live right now! <Link href={`/draft/${leagueId}?team=${myTeam.id}`} style={{ color: "var(--accent-strong)" }}>Join the draft room →</Link>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--faint)" }}>
              The commissioner will share a draft room link when it&apos;s time to pick.
            </p>
          )}
        </div>
      )}

      {/* ── Commissioner action strip — gold strip ── */}
      {commishAction && (
        <div style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.10), rgba(212,175,55,0.04))",
          border: "1px solid rgba(212,175,55,0.30)",
          borderLeft: "3px solid var(--gold)",
          borderRadius: 14, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{commishAction.label}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{commishAction.sublabel}</div>
            </div>
          </div>
          <Link href={commishAction.href} style={{
            fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, flexShrink: 0,
            background: "rgba(212,175,55,0.18)", color: "var(--gold)",
            border: "1px solid rgba(212,175,55,0.35)", textDecoration: "none",
          }}>
            Take action →
          </Link>
        </div>
      )}

      {/* ── League header ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{league.name}</h1>
        <span style={{ fontSize: 13, color: "var(--faint)" }}>
          Season {league.season} · {league.teams.length} teams
        </span>
        {currentWeek !== null && thisWeekDateRange && (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: "var(--accent-dim)", color: "var(--accent-strong)",
            border: "1px solid var(--accent-border)",
          }}>
            Week {currentWeek} · {thisWeekDateRange}
          </span>
        )}
        {currentWeek !== null && !thisWeekDateRange && (
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: "var(--accent-dim)", color: "var(--accent-strong)",
            border: "1px solid var(--accent-border)",
          }}>
            Week {currentWeek}
          </span>
        )}
      </div>

      {/* ── Two-column grid ── */}
      <div className="overview-grid">

        {/* LEFT: Commissioner command center — this week first, then playoff race, then highlights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Champion announcement */}
          {league.playoffStatus === "COMPLETE" && championTeamName && (
            <section style={{
              ...card,
              background: "linear-gradient(135deg, rgba(245,201,123,0.1), rgba(245,158,11,0.04))",
              border: "2px solid rgba(245,201,123,0.35)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 9a6 6 0 0 0 12 0V3H6z"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 2 }}>Season Complete</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                      {championTeamName} are champions!
                    </div>
                  </div>
                </div>
                <Link href={`/league/${leagueId}/bracket`} style={ctaLink}>View bracket →</Link>
              </div>
              <p style={{ color: "var(--faint)", margin: 0, fontSize: 13 }}>
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
                  {sideLabel(roundLabel, 0)}
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
                        background: isMyMatchup ? "rgba(143,193,232,0.07)" : "var(--bg-raised)",
                        border: isMyMatchup ? "1px solid rgba(143,193,232,0.2)" : "1px solid var(--border)",
                      }}>
                        <span style={{
                          fontSize: 13, textAlign: "right", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                          color: m.homeTeamId === myTeam?.id ? "var(--text)" : "var(--dim)",
                          fontWeight: m.homeTeamId === myTeam?.id ? 600 : 400,
                        }}>
                          {m.homeTeam.name}
                          {scored && <span className="font-stats" style={{ marginLeft: 6, fontWeight: 700 }}>{m.homeScore!.toFixed(1)}</span>}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--dim)", fontWeight: 700, letterSpacing: "0.5px" }}>
                          {scored ? "FINAL" : "VS"}
                        </span>
                        <span style={{
                          fontSize: 13, overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                          color: m.awayTeamId === myTeam?.id ? "var(--text)" : "var(--dim)",
                          fontWeight: m.awayTeamId === myTeam?.id ? 600 : 400,
                        }}>
                          {scored && <span className="font-stats" style={{ marginRight: 6, fontWeight: 700 }}>{m.awayScore!.toFixed(1)}</span>}
                          {m.awayTeam.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* ── This week VTF rankings — primary in-season section ── */}
          {isVtfMode && vtfRanked && vtfRanked.length > 0 && (
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  {cardLabel(currentWeek !== null ? `Week ${currentWeek} standings` : "This week", 2)}
                  <div style={{ fontSize: 12, color: "var(--faint)" }}>Everyone races the same week — your rank is your result</div>
                </div>
                <Link href={`/league/${leagueId}/matchups`} style={{ fontSize: 12, color: "var(--faint)", textDecoration: "none" }}>
                  Full schedule →
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {vtfRanked.map((entry, idx) => {
                  const isMe = entry.teamId === myTeam?.id;
                  const rank = idx + 1;
                  const anyScored = entry.score != null;
                  const scoreStr = anyScored ? entry.score!.toFixed(1) : "—";
                  const recordStr = anyScored ? `${entry.wins}–${entry.losses}${entry.ties > 0 ? `–${entry.ties}` : ""}` : "";
                  return (
                    <div key={entry.teamId} style={{
                      display: "grid",
                      gridTemplateColumns: "22px 1fr auto auto",
                      gap: 8, padding: "9px 10px", borderRadius: 8, alignItems: "center",
                      background: isMe ? "var(--accent-dim)" : "transparent",
                      borderLeft: isMe ? "2px solid var(--accent)" : "2px solid transparent",
                    }}>
                      <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{rank}</span>
                      <span style={{
                        fontSize: 14, fontWeight: isMe ? 700 : 400,
                        color: isMe ? "var(--accent-strong)" : "var(--text)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {entry.teamName}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)" }}>You</span>}
                      </span>
                      <span className="font-stats" style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {recordStr}
                      </span>
                      <span className="font-stats" style={{
                        fontSize: 15, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap",
                        color: isMe ? "var(--accent-strong)" : "var(--text)",
                        minWidth: 52,
                      }}>
                        {scoreStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Playoff race / standings — primary module */}
          {hasResults && !playoffsStarted && standings.length > 0 && (
            <section style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  {cardLabel("Playoff race", 2)}
                  <div style={{ fontSize: 12, color: "var(--faint)" }}>Top {teamsInPlayoff} advance</div>
                </div>
                <Link href={`/league/${leagueId}/standings`} style={{ fontSize: 12, color: "var(--faint)", textDecoration: "none" }}>
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
                        ? { label: "IN", bg: "rgba(81,216,138,0.12)", color: "var(--green)", border: "rgba(81,216,138,0.25)" }
                        : rank === teamsInPlayoff + 1
                        ? { label: "BUBBLE", bg: "rgba(245,201,123,0.12)", color: "var(--gold)", border: "rgba(245,201,123,0.28)" }
                        : { label: "OUT", bg: "rgba(100,116,139,0.1)", color: "var(--faint)", border: "rgba(100,116,139,0.15)" };
                    }
                    switch (race.status) {
                      case "clinched":   return { label: "✓ CLINCHED", bg: "rgba(81,216,138,0.12)", color: "var(--green)", border: "rgba(81,216,138,0.30)" };
                      case "in":         return { label: "IN", bg: "rgba(81,216,138,0.08)", color: "var(--green)", border: "rgba(81,216,138,0.20)" };
                      case "bubble":     return { label: "◉ BUBBLE", bg: "rgba(245,201,123,0.12)", color: "var(--gold)", border: "rgba(245,201,123,0.28)" };
                      case "eliminated": return { label: "✗ ELIM", bg: "rgba(246,131,127,0.12)", color: "var(--red)", border: "rgba(246,131,127,0.28)" };
                      case "out":        return { label: `${race.gamesBack} GB`, bg: "rgba(100,116,139,0.1)", color: "var(--faint)", border: "rgba(100,116,139,0.15)" };
                    }
                  })();

                  return (
                    <div key={s.fantasyTeamId}>
                      {isLastIn && (
                        <div style={{ borderBottom: "1px dashed var(--border)", margin: "5px 0" }} />
                      )}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "22px 1fr auto 70px",
                        gap: 8, padding: "9px 10px", borderRadius: 8, alignItems: "center",
                        background: isMe ? "var(--accent-dim)" : "transparent",
                        borderLeft: isMe ? "2px solid var(--accent)" : "2px solid transparent",
                      }}>
                        <span style={{ fontSize: 12, color: "var(--faint)", fontWeight: 700 }}>{rank}</span>
                        <span style={{
                          fontSize: 14, fontWeight: isMe ? 700 : 400,
                          color: isMe ? "var(--accent-strong)" : "var(--text)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s.teamName}
                          {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)" }}>You</span>}
                        </span>
                        <span className="font-stats" style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", whiteSpace: "nowrap" }}>
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

          {/* ── Record Book teaser ── */}
          {hasResults && leagueLeaders.top.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(143,193,232,0.06)", border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 13, color: "var(--dim)" }}>
                <span style={{ color: "var(--faint)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>Top this week</span>
                <span style={{ marginLeft: 8, color: "var(--text)", fontWeight: 600 }}>{leagueLeaders.top[0]!.name}</span>
                <span style={{ marginLeft: 6, color: "var(--faint)" }}>—</span>
                <span className="font-stats" style={{ marginLeft: 6, color: "var(--accent-strong)", fontWeight: 700 }}>{leagueLeaders.top[0]!.points.toFixed(1)} FP</span>
              </div>
              <Link href={`/league/${leagueId}/records`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", flexShrink: 0 }}>
                Record book →
              </Link>
            </div>
          )}

          {/* Pre-season / no results yet — commissioner sees admin link */}
          {!hasResults && league.status !== "IN_SEASON" && (
            <section style={card}>
              {cardLabel("Standings")}
              <p style={{ color: "var(--faint)", fontSize: 13, margin: "10px 0 0" }}>
                Standings will appear once the season starts.
              </p>
              {league.status === "PRE_DRAFT" && (
                <Link href={`/league/${leagueId}/admin`} style={{ ...ctaLink, marginTop: 14, display: "inline-block" }}>
                  Go to admin panel →
                </Link>
              )}
            </section>
          )}

          {/* ── Week highlights + awards ── */}
          {league.status === "IN_SEASON" && (storylines.length > 0 || awards.length > 0) && (
            <WeekHighlights
              storylines={storylines}
              weekLabel={highlightsWeekLabel}
              awards={awards}
              showNegativeAwards={showNegativeAwards}
              teamId={myTeam?.id}
            />
          )}

          {/* ── League leaders this week ── */}
          {leagueLeaders.top.length > 0 && currentWeek !== null && (
            <section style={card}>
              {cardLabel(`League leaders · Week ${currentWeek}`, 14)}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>
                    Scoring leaders
                  </div>
                  {leagueLeaders.top.map((p, i) => (
                    <LeagueLeaderRow key={p.playerId} player={p} rank={i + 1} variant="top" />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>
                    Cold this week
                  </div>
                  {leagueLeaders.disappointing.map((p, i) => (
                    <LeagueLeaderRow key={p.playerId} player={p} rank={i + 1} variant="low" />
                  ))}
                </div>
              </div>
            </section>
          )}

        </div>

        {/* RIGHT: Lineup status (in-season priority) + My Franchise + activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Team lineup status widget — first in sidebar during in-season, most urgent commissioner view */}
          {league.status === "IN_SEASON" && league.teams.length > 0 && (
            <section style={card}>
              {sideLabel("Lineup status")}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {league.teams.map((t) => {
                  const alerts = alertsByTeam.get(t.id) ?? 0;
                  const isMe = t.id === myTeam?.id;
                  const chip = !periodForGames
                    ? { label: "—", bg: "rgba(100,116,139,0.08)", color: "var(--faint)" }
                    : alerts > 0
                    ? { label: `${alerts} ${alerts === 1 ? "issue" : "issues"}`, bg: "rgba(245,201,123,0.10)", color: "var(--gold)" }
                    : { label: "Set", bg: "rgba(81,216,138,0.10)", color: "var(--green)" };
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 8px", borderRadius: 8,
                      background: isMe ? "rgba(143,193,232,0.06)" : "transparent",
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: isMe ? 600 : 400,
                        color: isMe ? "var(--accent-strong)" : "var(--dim)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                      }}>
                        {t.name}
                        {isMe && <span style={{ marginLeft: 5, fontSize: 10, color: "var(--accent)" }}>You</span>}
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
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 10 }}>
                  Games remaining through {fmt(new Date(periodForGames.endsAt.getTime() - 1))}
                </div>
              )}
            </section>
          )}

          {/* My Franchise quick-link — sky-accent commissioner card */}
          {myTeam && (
            <section style={{
              background: "linear-gradient(135deg, rgba(143,193,232,0.10), rgba(143,193,232,0.04))",
              border: "1px solid rgba(143,193,232,0.28)",
              borderRadius: 14, padding: "14px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 3 }}>
                  My Franchise
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{myTeam.name}</div>
              </div>
              <Link href={`/team/${myTeam.id}/matchup`} style={{
                fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8,
                background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
                border: "1px solid rgba(143,193,232,0.30)", textDecoration: "none", flexShrink: 0,
              }}>
                My Matchup →
              </Link>
            </section>
          )}

          {/* Trophy leaderboard */}
          {teamsWithTrophies.length > 0 && (
            <section style={card}>
              {sideLabel("Trophy cabinet")}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {teamsWithTrophies.map((t, i) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--faint)", minWidth: 14, textAlign: "right" }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: t.id === myTeam?.id ? "var(--accent-strong)" : "var(--text)" }}>{t.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
                      {t.count === 1 ? "1 trophy" : `${t.count} trophies`}
                    </span>
                  </div>
                ))}
              </div>
              <Link href={`/league/${leagueId}/records`} style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--faint)", textDecoration: "none" }}>
                Full record book →
              </Link>
            </section>
          )}

          {/* Biggest upsets this season */}
          {upsets.length > 0 && <UpsetCard upsets={upsets} />}

          {/* Season superlatives */}
          {superlativeItems.length > 0 && (
            <SuperlativesCard items={superlativeItems} />
          )}

          {/* League activity */}
          <section style={card}>
            {sideLabel("League activity")}
            {activity.length === 0 ? (
              <p style={{ color: "var(--faint)", fontSize: 13, margin: 0, fontStyle: "italic" }}>League activity will appear here.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activity.map((evt) => {
                  const ACT_META: Record<string, { label: string; color: string; bg: string }> = {
                    PLAYER_ADD:            { label: "Add",     color: "var(--green)", bg: "rgba(81,216,138,0.12)" },
                    PLAYER_DROP:           { label: "Drop",    color: "var(--red)",   bg: "rgba(246,131,127,0.12)" },
                    DRAFT_PICK:            { label: "Draft",  color: "var(--accent-strong)", bg: "rgba(143,193,232,0.14)" },
                    TRADE:                 { label: "Trade",  color: "var(--accent-strong)", bg: "rgba(143,193,232,0.10)" },
                    PLAYOFF_QUALIFICATION: { label: "Playoff",color: "var(--gold)",  bg: "rgba(245,201,123,0.12)" },
                    MAJOR_PERFORMANCE:     { label: "Perf",   color: "var(--gold)",  bg: "rgba(245,201,123,0.10)" },
                    LEAGUE_STORYLINE:      { label: "Story",  color: "var(--muted)", bg: "rgba(150,160,200,0.08)" },
                  };
                  const m = ACT_META[evt.type] ?? { label: "Event", color: "var(--faint)", bg: "rgba(150,160,200,0.06)" };
                  return (
                    <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", padding: "3px 7px",
                          borderRadius: 5, background: m.bg, color: m.color, flexShrink: 0, whiteSpace: "nowrap" as const,
                        }}>{m.label}</span>
                        <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{evt.description}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--faint)", flexShrink: 0 }}>{fmt(new Date(evt.createdAt))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── Commissioner announcement — display + inline edit for commissioner ── (moved to bottom) */}
      {(league.announcement || isCommissioner) && (
        <div style={{
          padding: "14px 18px", borderRadius: 14,
          background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
        }}>
          <div style={{ marginBottom: isCommissioner ? 12 : 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent-strong)", marginBottom: 6 }}>
              Commissioner note
            </div>
            {league.announcement ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {league.announcement}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--faint)", fontStyle: "italic" }}>No league announcements yet.</p>
            )}
          </div>
          {isCommissioner && (
            <div style={{ borderTop: "1px solid var(--accent-border)", paddingTop: 12, marginTop: 4 }}>
              <AnnouncementForm leagueId={leagueId} initial={league.announcement ?? null} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function LeagueLeaderRow({ player, rank, variant }: { player: LeaguePerformerRow; rank: number; variant: "top" | "low" }) {
  const rankColor = rank === 1 ? "var(--amber)" : rank === 2 ? "var(--dim)" : "var(--faint)";
  const fpColor = variant === "top" ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 8px", borderRadius: 8, marginBottom: 3,
      background: player.isMyPlayer ? "rgba(143,193,232,0.07)" : "transparent",
      borderLeft: player.isMyPlayer ? "2px solid rgba(143,193,232,0.35)" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: rankColor, width: 14, flexShrink: 0, textAlign: "center" }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: player.isMyPlayer ? "var(--accent-strong)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {player.name}
          {player.isMyPlayer && <span style={{ marginLeft: 4, fontSize: 9, color: "var(--accent)", fontWeight: 700 }}>YOU</span>}
        </div>
        <div style={{ fontSize: 10, color: "var(--faint)" }}>{player.fantasyTeamName}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: fpColor, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        {player.points.toFixed(1)}
      </span>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 20,
};

const cardLabel = (text: string, mb = 12) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: mb }}>
    <span className="section-accent" />
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--dim)" }}>{text}</span>
  </div>
);

const sideLabel = (text: string, mb = 12) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--dim)", marginBottom: mb }}>{text}</div>
);

const ctaLink: React.CSSProperties = {
  display: "inline-block",
  fontSize: 13, fontWeight: 600, color: "var(--accent-strong)",
  padding: "6px 14px", borderRadius: 999,
  background: "rgba(143,193,232,0.12)",
  border: "1px solid rgba(143,193,232,0.3)",
  textDecoration: "none",
};
