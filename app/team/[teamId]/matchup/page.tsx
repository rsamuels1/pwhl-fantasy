import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner, isFounder } from "@/lib/auth";
import { getDashboardData, type ChampionInfo } from "@/lib/services/dashboard";
import InlineLineupEditor, { type LineupPlayer } from "./InlineLineupEditor";
import { getSwingPlayers } from "@/lib/matchups/swingPlayers";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { scoreStatLine, type StatLineInput } from "@/lib/scoring";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow, resolveFixturePeriod, toFixtureNow, type BetaWeekMapping } from "@/lib/replayTime";
import { RosterStatusWidget } from "./RosterStatusWidget";
import { RecapCard } from "./RecapCard";
import { RosterTable } from "./RosterTable";
import { MatchupHero } from "./DuelHero";
import ClinchBanner from "@/components/ClinchBanner";
import FirstResultCard from "@/components/FirstResultCard";
import MomentumStrip from "@/components/MomentumStrip";
import TrophyShelf from "@/components/TrophyShelf";
import FranchiseIdentityChip from "@/components/FranchiseIdentityChip";
import OpeningDayCard from "@/components/OpeningDayCard";
import ChampionshipBanner from "@/components/ChampionshipBanner";
import { computeFranchiseIdentity } from "@/lib/services/franchise-identity";
import { computeRace, type RaceInfo } from "@/lib/playoffs/seeding";
import { computeVpStandings } from "@/lib/scoring/vp";
import { Position } from "@prisma/client";
import MorningSkatePreview from "@/components/MorningSkatePreview";
import type { EditionData } from "@/lib/services/morning-skate-service";
import VpPrimerCard from "@/components/VpPrimerCard";
import FocusHighlight from "@/components/FocusHighlight";

export default async function TeamMatchupPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ focus?: string }>;
}) {
  const { teamId } = await params;
  const { focus } = (await searchParams) ?? {};
  const user = await requireAuth(`/team/${teamId}/matchup`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, rosterSettings: true, isReplay: true, replayCurrentDate: true, season: true, status: true, maxTeams: true, playoffStatus: true, playoffSettings: true },
  });
  if (!league) notFound();

  // Playoff clinch event for this team (used to render dismissible ClinchBanner)
  const clinchEvent = await prisma.leagueEvent.findFirst({
    where: { leagueId, teamId, type: "PLAYOFF_CLINCH" },
    select: { data: true },
  });

  const scoringSettings = parseScoringSettings(league.scoringSettings);
  const rs = (league.rosterSettings as Record<string, number>) ?? {};
  const activeSlotCount = (rs.forward ?? 3) + (rs.defense ?? 2) + (rs.goalie ?? 1) + (rs.util ?? 1);
  const nowMs = getReplayNow(league, await getDevNow());
  const dashboard = await getDashboardData(leagueId, teamId, nowMs, prisma);

  const { activeMatchup, remainingPlayers, lineupAlerts, lastResult, eliminationInfo, championInfo, playoffPending, missedPlayoffs, myPlayersLastWeek, lastWeekLabel, firstResultContext } = dashboard;

  const allTeams = await prisma.fantasyTeam.findMany({
    where: { leagueId },
    select: { id: true, name: true, accentColor: true },
  });

  // ── Bubble Watch chip (in-season regular season only) ─────────────────────
  let myRaceStatus: RaceInfo | null = null;
  if (league.status === "IN_SEASON" && league.playoffStatus === "NOT_STARTED") {
    try {
      const leagueMatchups = await prisma.matchup.findMany({
        where: { leagueId },
      });
      const vpStandings = computeVpStandings(
        allTeams.map((t) => ({ id: t.id, name: t.name })),
        leagueMatchups
      );
      const playoffCutoff = ((league.playoffSettings as { teamsInPlayoff?: number } | null)?.teamsInPlayoff) ?? 4;
      const standingsForRace = vpStandings.map((s) => ({ ...s, points: s.totalVP, pointsAgainst: 0 }));
      const raceMap = computeRace(standingsForRace, leagueMatchups, playoffCutoff);
      myRaceStatus = raceMap.get(teamId) ?? null;
    } catch {
      // non-fatal — bubble watch chip won't show
    }
  }

  // Swing players are a 1v1 concept — only meaningful in playoff (single-opponent) matchups.
  let swingPlayers: Awaited<ReturnType<typeof getSwingPlayers>> = [];
  if (activeMatchup?.status === "active" && activeMatchup.opponentTeam) {
    swingPlayers = await getSwingPlayers(
      teamId,
      activeMatchup.opponentTeam.id,
      activeMatchup.period,
      scoringSettings,
      prisma
    );
  }

  // Bench players for inline editor (upcoming matchups only)
  let benchPlayers: LineupPlayer[] = [];
  if (activeMatchup?.status === "upcoming") {
    const period = activeMatchup.period;
    const benchEntries = await prisma.rosterEntry.findMany({
      where: { fantasyTeamId: teamId, slot: "BENCH" },
      include: { player: { select: { id: true, firstName: true, lastName: true, position: true, team: { select: { id: true, abbreviation: true } } } } },
    });
    const benchTeamIds = [...new Set(benchEntries.map((e) => e.player.team?.id).filter((id): id is string => !!id))];
    // For beta replay leagues, remap the display-calendar period to fixture dates so game queries
    // hit the actual Nov 2025–May 2026 game data rather than the remapped Jun 2026 display window.
    const rawSettings = league.scoringSettings as Record<string, unknown> | null;
    const betaWeekMappings = (rawSettings?.betaWeekMappings as BetaWeekMapping[] | undefined) ?? null;
    const fixturePeriod = resolveFixturePeriod(
      { week: period.week, startsAt: period.startsAt, endsAt: period.endsAt },
      betaWeekMappings
    );
    const fixtureNowForBench = new Date(toFixtureNow(nowMs, period, fixturePeriod));
    const benchGames = benchTeamIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gte: fixtureNowForBench, lt: fixturePeriod.endsAt },
            OR: [{ homeTeamId: { in: benchTeamIds } }, { awayTeamId: { in: benchTeamIds } }],
          },
          select: { homeTeamId: true, awayTeamId: true },
        })
      : [];
    const benchGamesPerTeam = new Map<string, number>();
    for (const g of benchGames) {
      benchGamesPerTeam.set(g.homeTeamId, (benchGamesPerTeam.get(g.homeTeamId) ?? 0) + 1);
      benchGamesPerTeam.set(g.awayTeamId, (benchGamesPerTeam.get(g.awayTeamId) ?? 0) + 1);
    }
    benchPlayers = benchEntries.map((e) => ({
      playerId: e.playerId,
      name: `${e.player.firstName} ${e.player.lastName}`,
      position: e.player.position,
      slot: "BENCH",
      teamAbbr: e.player.team?.abbreviation ?? null,
      gamesThisPeriod: e.player.team?.id ? (benchGamesPerTeam.get(e.player.team.id) ?? 0) : null,
    }));
  }

  const isChampion = championInfo && championInfo.teamId === teamId;

  // ── LL-009: Trophy Shelf — recent trophies for Z7 area ──────────────────────
  const recentTrophies = await prisma.trophy.findMany({
    where: { teamId },
    orderBy: { awardedAt: "desc" },
    take: 3,
    select: { id: true, type: true, season: true },
  });

  // ── LL-011b: Franchise Identity — compute from scored regular-season matchups ─
  let franchiseIdentity: ReturnType<typeof computeFranchiseIdentity> = null;
  if (league.status === "IN_SEASON") {
    try {
      // Get scored regular-season matchups for this team
      const scoredMatchups = await prisma.matchup.findMany({
        where: {
          leagueId,
          isPlayoff: false,
          homeScore: { not: null },
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        select: { homeTeamId: true, homeScore: true, awayTeamId: true, awayScore: true, week: true },
        orderBy: { week: "asc" },
      });

      if (scoredMatchups.length >= 3) {
        // In VTF, each matchup row = this team's score as homeTeamId
        const weeklyScores = scoredMatchups.map((m) =>
          m.homeTeamId === teamId ? (m.homeScore ?? 0) : (m.awayScore ?? 0)
        );

        // Get last 5 periods' stat lines for FP breakdown
        const recentWeeks = [...new Set(scoredMatchups.map((m) => m.week))].sort((a, b) => b - a).slice(0, 5);
        const recentMatchupPeriods = scoredMatchups.filter((m) => recentWeeks.includes(m.week));

        // Find the date range: earliest startsAt of last 5 periods' matchups
        // We need period start/end — use the last 5 weeks' matchup rows as proxy
        // Instead, just query roster players' stat lines for the season
        const myRosterPlayerIds = await prisma.rosterEntry.findMany({
          where: { fantasyTeamId: teamId },
          select: { playerId: true, player: { select: { position: true } } },
        });

        if (myRosterPlayerIds.length > 0) {
          const playerIds = myRosterPlayerIds.map((e) => e.playerId);
          const posMap = new Map(myRosterPlayerIds.map((e) => [e.playerId, e.player.position]));

          const statLines = await prisma.statLine.findMany({
            where: {
              playerId: { in: playerIds },
              game: { season: league.season },
            },
            select: {
              playerId: true, goals: true, assists: true, shots: true, plusMinus: true,
              penaltyMinutes: true, powerPlayPts: true, hits: true, blocks: true,
              saves: true, goalsAgainst: true, shutout: true, win: true,
            },
          });

          let goalsFp = 0, defenseFp = 0, goalieFp = 0, totalFp = 0;
          for (const sl of statLines) {
            const pos = posMap.get(sl.playerId) ?? Position.FORWARD;
            const fp = scoreStatLine(sl as StatLineInput, pos, scoringSettings);
            totalFp += fp;
            if (pos === Position.GOALIE) {
              goalieFp += fp;
            } else {
              // Goals + PPP => sniper portion; BLK+HIT => defense portion
              goalsFp += (sl.goals * scoringSettings.skater.goal) + (sl.powerPlayPts * scoringSettings.skater.powerPlayPoint);
              defenseFp += (sl.blocks * scoringSettings.skater.block) + (sl.hits * scoringSettings.skater.hit);
            }
          }

          franchiseIdentity = computeFranchiseIdentity(weeklyScores, goalsFp, defenseFp, goalieFp, totalFp);
        }
      }
    } catch {
      // non-fatal — franchise identity is a nice-to-have
    }
  }

  // ── LL-014: Opening Day Card data ────────────────────────────────────────────
  const allPeriods = await prisma.matchup.findMany({
    where: { leagueId, isPlayoff: false },
    select: { week: true, startsAt: true },
    orderBy: { week: "asc" },
  });
  const periodCount = [...new Set(allPeriods.map((m) => m.week))].length;
  const firstPeriodStartsAt = allPeriods.length > 0 ? allPeriods[0].startsAt : null;

  // Team count for opening day card
  const teamCount = await prisma.fantasyTeam.count({ where: { leagueId } });

  // ── LL-015: Championship Banner — winner record computation ──────────────────
  let championRecord = "";
  if (isChampion && championInfo) {
    // Compute this team's regular-season W-L for the record string
    const rsMatchups = await prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false, homeScore: { not: null }, homeTeamId: teamId },
    });
    // VTF: all matchups for this team are as homeTeam; compute wins vs field
    const weekGroups = new Map<number, { myScore: number; allScores: number[] }>();
    // We need all teams' scores per week to compute W-L
    const allRsMatchups = await prisma.matchup.findMany({
      where: { leagueId, isPlayoff: false, homeScore: { not: null } },
      select: { homeTeamId: true, homeScore: true, week: true },
    });
    const byWeek = new Map<number, number[]>();
    for (const m of allRsMatchups) {
      if (!byWeek.has(m.week)) byWeek.set(m.week, []);
      byWeek.get(m.week)!.push(m.homeScore ?? 0);
    }
    let wins = 0, losses = 0;
    for (const m of rsMatchups) {
      const allScores = byWeek.get(m.week) ?? [];
      wins += allScores.filter((s) => s < (m.homeScore ?? 0)).length;
      losses += allScores.filter((s) => s > (m.homeScore ?? 0)).length;
    }
    championRecord = `${wins}–${losses}`;
  }

  // ── S28-002: Morning Skate edition preview ───────────────────────────────────
  const latestEditionRaw = await prisma.morningSkateEdition.findFirst({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
    select: { id: true, leagueId: true, data: true },
  });
  const latestEdition = latestEditionRaw
    ? { ...latestEditionRaw, data: latestEditionRaw.data as unknown as EditionData }
    : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Z0 (setup phase only): Morning Skate above the fold when there's no score yet ── */}
      {latestEdition && activeMatchup?.isSetupPhase && (
        <MorningSkatePreview edition={latestEdition} />
      )}

      {/* ── UX-070: VP Primer Card — shown once to orient new managers ── */}
      {activeMatchup !== null && (
        <VpPrimerCard userId={user.id} />
      )}

      {/* ── LL-015: Championship Banner — full-screen overlay for the champion ── */}
      {isChampion && championInfo && (
        <ChampionshipBanner
          leagueId={leagueId}
          teamName={team.name}
          season={league.season}
          record={championRecord}
          trophiesHref={`/team/${teamId}/trophies`}
        />
      )}

      {/* ── LL-014: Opening Day Card — shown 72h after first period starts ── */}
      {league.status === "IN_SEASON" && firstPeriodStartsAt && (
        <OpeningDayCard
          leagueId={leagueId}
          season={league.season}
          weekCount={periodCount}
          managerCount={teamCount}
          periodStartsAt={firstPeriodStartsAt.toISOString()}
        />
      )}

      {/* ── Clinch banner — dismissible, shown once when playoff berth is clinched ── */}
      {clinchEvent && !isChampion && (() => {
        const d = (clinchEvent.data ?? {}) as Record<string, unknown>;
        return (
          <ClinchBanner
            leagueId={leagueId}
            season={league.season ?? ""}
            seed={typeof d.seed === "number" ? d.seed : 1}
            clinchWeek={typeof d.clinchWeek === "number" ? d.clinchWeek : 0}
            teamName={typeof d.teamName === "string" ? d.teamName : team.league.name}
            bracketHref={`/team/${teamId}/bracket`}
          />
        );
      })()}

      {/* ── First-result explainer — shown once after first scored period ── */}
      {firstResultContext && (
        <FirstResultCard userId={user.id} leagueId={leagueId} ctx={firstResultContext} />
      )}

      {/* ── 0. Champion card — top of page when playoffs complete and I won ── */}
      {isChampion && championInfo && (
        <div style={{
          background: "linear-gradient(135deg, rgba(245,201,123,0.12), rgba(245,158,11,0.06))",
          border: "2px solid rgba(245,201,123,0.4)",
          borderRadius: 20, padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>🏆</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)", lineHeight: 1.1 }}>
                Champions!
              </div>
              <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 4 }}>
                {championInfo.teamName} won the championship
              </div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
            background: "rgba(245,201,123,0.06)", borderRadius: 12,
            border: "1px solid rgba(245,201,123,0.15)",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                {championInfo.teamName}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
                {championInfo.myScore.toFixed(1)}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--faint)" }}>vs</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                {championInfo.opponentTeamName}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                {championInfo.opponentScore.toFixed(1)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--dim)" }}>
            Congratulations on a great season. See you next year!
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            display: "inline-block", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(245,201,123,0.15)", color: "var(--gold)",
            border: "1px solid rgba(245,201,123,0.3)", textDecoration: "none", alignSelf: "flex-start",
          }}>
            View bracket →
          </Link>
        </div>
      )}

      {/* ── 1. Lineup alerts — top of page, always visible when present ── */}
      {lineupAlerts.length > 0 && (
        <div style={{
          background: "rgba(245,201,123,0.08)",
          border: "1px solid rgba(245,201,123,0.30)",
          borderRadius: 14, padding: "18px 20px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "rgba(245,201,123,0.16)", border: "1px solid rgba(245,201,123,0.40)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>⚠️</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Lineup action needed
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                {lineupAlerts.length === 1 ? "This player has" : "These players have"} no games remaining this period
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {lineupAlerts.map((a) => (
                  <span key={a.playerId} style={{
                    fontSize: 12, fontWeight: 600, color: "var(--gold)",
                    background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.28)",
                    borderRadius: 7, padding: "6px 11px",
                  }}>{a.name}</span>
                ))}
              </div>
            </div>
          </div>
          <Link href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(245,201,123,0.15)", color: "var(--gold)",
            border: "1px solid rgba(245,201,123,0.30)", textDecoration: "none", flexShrink: 0,
          }}>
            Fix lineup →
          </Link>
        </div>
      )}

      {/* ── 1a. All-set positive state (no alerts, active/upcoming period, roster present) ── */}
      {lineupAlerts.length === 0 && activeMatchup !== null && activeMatchup.myPlayers.length > 0 && (
        (() => {
          const activeStarters = activeMatchup.myPlayers.filter(
            (p) => p.slot !== "BENCH" && p.slot !== "IR"
          );
          if (activeStarters.length < activeSlotCount) return null;
          return (
            <div style={{
              background: "linear-gradient(135deg, rgba(81,216,138,0.07), rgba(81,216,138,0.03))",
              border: "1px solid rgba(81,216,138,0.25)",
              borderRadius: 14, padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(81,216,138,0.15)", border: "1px solid rgba(81,216,138,0.30)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✓</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                    Lineup locked in
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 1 }}>
                    {activeStarters.length} starter{activeStarters.length !== 1 ? "s" : ""} active — you&apos;re good to go
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* ── 1a. Between-weeks lineup nudge ── */}
      {activeMatchup?.status === "upcoming" && (activeMatchup.myPlayers.filter(p => p.slot !== "BENCH" && p.slot !== "IR").length < activeSlotCount) && (
        <div style={{
          background: "rgba(245,201,123,0.08)",
          border: "1px solid rgba(245,201,123,0.30)",
          borderRadius: 14, padding: "18px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              {activeMatchup.isPlayoff && activeMatchup.roundLabel
                ? `${activeMatchup.roundLabel} is coming up`
                : `Week ${activeMatchup.week} is coming up`}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
              Set your lineup before games begin — check projected scores on the lineup page.
            </div>
          </div>
          <Link href={`/team/${teamId}/lineup`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(245,201,123,0.15)", color: "var(--gold)",
            border: "1px solid rgba(245,201,123,0.30)", textDecoration: "none", flexShrink: 0,
          }}>
            Set lineup →
          </Link>
        </div>
      )}

      {/* ── 2. Matchup hero ── */}
      <FocusHighlight targetId="matchup-hero" focus={focus} />
      {activeMatchup ? (
        <div id="matchup-hero">
          <MatchupHero
            matchup={activeMatchup} teamId={teamId} leagueId={leagueId}
            myAccentColor={allTeams.find((t) => t.id === teamId)?.accentColor ?? null}
            oppAccentColor={activeMatchup.opponentTeam ? (allTeams.find((t) => t.id === activeMatchup.opponentTeam!.id)?.accentColor ?? null) : null}
            gamesThisNight={remainingPlayers.length}
          />
        </div>
      ) : eliminationInfo ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🏁</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                You were eliminated in Round {eliminationInfo.round}. The bracket is still playing.
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                You made a great playoff run. Better luck next season!
              </div>
            </div>
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
            border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none",
          }}>
            See who&apos;s still alive →
          </Link>
        </Card>
      ) : playoffPending ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Your round is complete. Next round matchups are being set.
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                Hang tight — the commissioner will advance the bracket shortly.
              </div>
            </div>
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
            border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none",
          }}>
            View updated bracket →
          </Link>
        </Card>
      ) : championInfo && !isChampion ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🏆</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Season complete — {championInfo.teamName} are champions!
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                Great season. See you next year!
              </div>
            </div>
          </div>
          <Link href={`/league/${leagueId}/bracket`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
            border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none",
          }}>
            View bracket →
          </Link>
        </Card>
      ) : missedPlayoffs ? (
        <Card>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8, marginTop: 0 }}>
            You didn&apos;t qualify for playoffs this season.
          </p>
          <p style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.6, margin: "0 0 14px" }}>
            Final standing: <strong style={{ color: "var(--text)" }}>{ordinal(missedPlayoffs.regularSeasonRank)}</strong> of {missedPlayoffs.totalTeams} teams. The top {missedPlayoffs.totalTeams >= 8 ? 4 : 4} advanced to the playoffs.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/league/${leagueId}/bracket`} style={{
              fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
              background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
              border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none",
            }}>
              See the bracket →
            </Link>
            <Link href={`/team/${teamId}/schedule`} style={{
              fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
              background: "var(--surface)", color: "var(--dim)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}>
              Review my season →
            </Link>
          </div>
        </Card>
      ) : league.status === "PRE_DRAFT" ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Your draft is coming up. Get ahead by building your queue.
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                Browse players and star the ones you want before draft day.
              </div>
            </div>
          </div>
          <Link href={`/draft/${leagueId}`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
            border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none", display: "inline-block",
          }}>
            Build my draft queue →
          </Link>
        </Card>
      ) : (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                The season hasn&apos;t started yet. Get your starting lineup ready.
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                Set your active players before puck drop to score from day one.
              </div>
            </div>
          </div>
          <Link href={`/team/${teamId}/roster`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
            border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none", display: "inline-block",
          }}>
            Set my lineup →
          </Link>
        </Card>
      )}

      {/* ── Z2.5. Morning Skate preview (setup phase: above hero; otherwise: below hero) ── */}
      {latestEdition && !(activeMatchup?.isSetupPhase) && (
        <MorningSkatePreview edition={latestEdition} />
      )}

      {/* ── Z2b. Last week recap (shown above live grid when not actively scoring) ── */}
      {lastResult && activeMatchup?.status !== "active" && (
        <RecapCard recap={lastResult} />
      )}

      {/* ── Z3. Live situation grid: Playing Tonight + Swing (left) | Roster Status (right) ── */}
      {activeMatchup?.status === "active" && (
        <>
        <MomentumStrip
          scoreDeltaSinceYesterday={activeMatchup.scoreDeltaSinceYesterday ?? null}
          playersRemainingTonight={activeMatchup.playersRemainingTonight}
          opponentFinished={activeMatchup.opponentFinished}
        />
        <div className="matchup-2col" style={{ alignItems: "start" }}>
          {/* Left: Playing Tonight + Swing Players */}
          <div style={{ display: "grid", gap: 12 }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="section-accent" />
                  <h2 className="section-title" style={{ margin: 0 }}>Playing tonight</h2>
                </div>
                {remainingPlayers.length > 0 && (
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>
                    {remainingPlayers.reduce((s, p) => s + p.projectedPoints, 0).toFixed(1)} pts projected
                  </span>
                )}
              </div>
              {remainingPlayers.length === 0 ? (
                <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>
                  No starters playing tonight — check the schedule for upcoming games.
                </p>
              ) : (() => {
                const byGame = new Map<string, typeof remainingPlayers>();
                for (const p of remainingPlayers) {
                  const key = `${p.homeTeamAbbr}@${p.awayTeamAbbr}`;
                  if (!byGame.has(key)) byGame.set(key, []);
                  byGame.get(key)!.push(p);
                }
                return (
                  <div style={{ display: "grid", gap: 12 }}>
                    {[...byGame.entries()].map(([gameKey, players]) => {
                      const rep = players[0];
                      const slotLabel = (slot: string) =>
                        slot === "FORWARD" ? "F" : slot === "DEFENSE" ? "D" : slot === "GOALIE" ? "G" : slot === "UTIL" ? "UTIL" : "BN";
                      return (
                        <div key={gameKey}>
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            marginBottom: 6, padding: "4px 0",
                            borderBottom: "1px solid var(--border)",
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.04em" }}>
                              {rep.homeTeamAbbr} @ {rep.awayTeamAbbr}
                            </span>
                            <span className="font-stats" style={{ fontSize: 11, color: "var(--muted)", background: "var(--bg-raised)", padding: "2px 7px", borderRadius: 7 }}>
                              {formatTime(rep.gameStartsAt)}
                            </span>
                          </div>
                          <div style={{ display: "grid", gap: 4 }}>
                            {players.map((p) => (
                              <div key={p.playerId} style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px", borderRadius: 8,
                                background: "var(--bg-raised)",
                                borderLeft: "3px solid var(--accent-deep)",
                              }}>
                                <div>
                                  <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{p.name}</span>
                                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--dim)" }}>
                                    {p.position[0]} · {slotLabel(p.slot)}
                                  </span>
                                </div>
                                <span className="font-stats" style={{ fontSize: 12, color: "var(--accent-strong)", fontWeight: 600 }}>
                                  {p.projectedPoints.toFixed(1)} proj
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>

            {swingPlayers.length > 0 && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span className="section-accent" />
                  <h2 className="section-title" style={{ margin: 0 }}>Swing players</h2>
                  <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: 4 }}>players who could flip the result</span>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {swingPlayers.map((p) => (
                    <div key={p.playerId} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 8, padding: "13px 15px", borderRadius: 10,
                      background: "var(--bg-raised)", border: "1px solid var(--border)",
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: p.team === "mine" ? "var(--accent-strong)" : "var(--dim)" }}>
                          {p.team === "mine" ? "Your player" : "Opponent"}
                        </span>
                      </div>
                      <span className="font-stats" style={{ fontSize: 19, fontWeight: 700, flexShrink: 0, color: p.team === "mine" ? "var(--green)" : "var(--red)" }}>
                        {p.projectedImpact > 0 ? "+" : ""}{p.projectedImpact.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Roster Status widget */}
          <RosterStatusWidget matchup={activeMatchup} activeSlotCount={activeSlotCount} teamId={teamId} />
        </div>
        </>
      )}

      {/* ── Z3b. Roster Status widget (upcoming state, full width) ── */}
      {activeMatchup?.status === "upcoming" && (
        <RosterStatusWidget matchup={activeMatchup} activeSlotCount={activeSlotCount} teamId={teamId} />
      )}

      {/* ── Bubble Watch chip — playoff race context for teams in the hunt ── */}
      {myRaceStatus && (myRaceStatus.status === "bubble" || myRaceStatus.status === "in") && (() => {
        const isBubble = myRaceStatus.status === "bubble";
        const chipColor = isBubble ? "rgba(245,201,123,0.18)" : "rgba(143,193,232,0.12)";
        const chipBorder = isBubble ? "rgba(245,201,123,0.4)" : "rgba(143,193,232,0.3)";
        const chipText = isBubble ? "var(--gold)" : "var(--accent-strong)";
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href={`/league/${leagueId}/standings`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: chipColor, border: `1px solid ${chipBorder}`, borderRadius: 20,
                padding: "6px 14px", textDecoration: "none",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: chipText }}>
                {isBubble ? "Bubble watch" : "Playoff push"}
              </span>
              {myRaceStatus.magicNumber !== null && myRaceStatus.magicNumber > 0 && (
                <span style={{ fontSize: 11, color: "var(--dim)" }}>
                  Magic: {myRaceStatus.magicNumber}
                </span>
              )}
              {myRaceStatus.cushion !== null && myRaceStatus.cushion > 0 && (
                <span style={{ fontSize: 11, color: "var(--dim)" }}>
                  {myRaceStatus.cushion} ahead
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--faint)" }}>View standings →</span>
            </Link>
          </div>
        );
      })()}

      {/* ── Z6. Rosters ── */}
      {activeMatchup && (
        <div className="matchup-2col">
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="section-accent" style={{ background: "linear-gradient(180deg, var(--accent-strong), var(--accent-deep))" }} />
                <h2 style={sectionHead}>{activeMatchup.myTeam.name}</h2>
                {activeMatchup.status === "active" && (
                  <span className="font-stats" style={{ fontSize: 17, color: "var(--accent-strong)", fontWeight: 700 }}>
                    {activeMatchup.myTeam.score.toFixed(1)}
                  </span>
                )}
              </div>
              <Link href={`/team/${teamId}/lineup`} style={editLink}>
                {activeMatchup.status === "upcoming" ? "Full lineup →" : "Edit lineup →"}
              </Link>
            </div>
            {activeMatchup.status === "upcoming" ? (
              <InlineLineupEditor
                leagueId={leagueId}
                teamId={teamId}
                active={activeMatchup.myPlayers.map((p) => ({ ...p, slot: p.slot }))}
                bench={benchPlayers}
                rosterSettings={rs as { forward?: number; defense?: number; goalie?: number; util?: number }}
              />
            ) : (
              <RosterTable players={activeMatchup.myPlayers} isMyTeam />
            )}
          </Card>

          {activeMatchup.opponentTeam && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span className="section-accent" style={{ background: "linear-gradient(180deg, #5b6480, #3a4258)" }} />
                <h2 style={sectionHead}>{activeMatchup.opponentTeam.name}</h2>
                {activeMatchup.status === "active" && (
                  <span className="font-stats" style={{ fontSize: 17, color: "var(--muted)", fontWeight: 700 }}>
                    {activeMatchup.opponentTeam.score.toFixed(1)}
                  </span>
                )}
              </div>
              <RosterTable players={activeMatchup.opponentPlayers} />
            </Card>
          )}
        </div>
      )}

      {/* ── Z5. Last week recap (shown above last-week stats during active scoring) ── */}
      {lastResult && activeMatchup?.status === "active" && (
        <RecapCard recap={lastResult} />
      )}

      {/* ── Z6b. Last week's stats (SETUP phase fallback) ── */}
      {lastWeekLabel && myPlayersLastWeek && myPlayersLastWeek.length > 0 && (
        <Card>
          <h2 style={{ ...sectionHead, marginBottom: 14 }}>
            {lastWeekLabel} · final
            <span style={{ fontWeight: 400, fontSize: 12, color: "var(--faint)", marginLeft: 8 }}>
              This week&apos;s stats will appear after simulating
            </span>
          </h2>
          <RosterTable players={myPlayersLastWeek} />
        </Card>
      )}

      {/* ── Z7: Trophy Shelf + Franchise Identity ── */}
      {recentTrophies.length > 0 && (
        <TrophyShelf
          trophies={recentTrophies.map((t) => ({ id: t.id, type: t.type, season: t.season }))}
          trophiesHref={`/team/${teamId}/trophies`}
        />
      )}
      {franchiseIdentity && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600 }}>Franchise style:</span>
          <FranchiseIdentityChip identity={franchiseIdentity} />
        </div>
      )}

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(d);
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16, padding: "18px 20px",
    }}>
      {children}
    </div>
  );
}

const sectionHead: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, margin: 0, color: "var(--dim)",
  letterSpacing: "0.14em", textTransform: "uppercase",
};

const editLink: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--accent-strong)",
  textDecoration: "none", padding: "4px 10px",
  borderRadius: 6, background: "rgba(143,193,232,0.1)",
  border: "1px solid rgba(143,193,232,0.2)",
};
