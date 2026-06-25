import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAuth, requireTeamOwner, isFounder } from "@/lib/auth";
import { getDashboardData, type ActiveMatchup, type PlayerMatchupRow, type WeeklyRecap, type LeaguePerformerRow, type ChampionInfo } from "@/lib/services/dashboard";
import InlineLineupEditor, { type LineupPlayer } from "./InlineLineupEditor";
import LiveScoreRefresh from "@/components/LiveScoreRefresh";
import { LogoShield } from "@/components/LogoShield";
import { getSwingPlayers } from "@/lib/matchups/swingPlayers";
import { parseScoringSettings } from "@/lib/scoring/settings";
import { scoreStatLine, type StatLineInput } from "@/lib/scoring";
import { getDevNow } from "@/lib/devTime";
import { getReplayNow } from "@/lib/replayTime";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import StatChip from "@/components/StatChip";
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

export default async function TeamMatchupPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const user = await requireAuth(`/team/${teamId}/matchup`);
  const team = await requireTeamOwner(teamId, user.id);
  const leagueId = team.league.id;

  const league = await prisma.fantasyLeague.findUnique({
    where: { id: leagueId },
    select: { scoringSettings: true, rosterSettings: true, isReplay: true, replayCurrentDate: true, season: true, status: true, maxTeams: true, playoffStatus: true, playoffSettings: true },
  });
  if (!league) notFound();

  // Playoff clinch event for this team (used to render dismissible ClinchBanner)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clinchEvent = (prisma as any).leagueEvent
    ? await (prisma as any).leagueEvent.findFirst({
        where: { leagueId, teamId, type: "PLAYOFF_CLINCH" },
        select: { data: true },
      })
    : null;

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
    // No status filter — historical fixture has all games as FINAL.
    // For upcoming periods, startsAt >= period.startsAt proves games haven't been played.
    const nowForBench = new Date(nowMs);
    const benchGames = benchTeamIds.length > 0
      ? await prisma.game.findMany({
          where: {
            startsAt: { gte: nowForBench, lt: period.endsAt },
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
          if (activeStarters.length === 0) return null;
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
      {activeMatchup?.status === "upcoming" && (activeMatchup.myPlayers.length < activeSlotCount) && (
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
      {activeMatchup ? (
        <MatchupHero
          matchup={activeMatchup} teamId={teamId} leagueId={leagueId}
          myAccentColor={allTeams.find((t) => t.id === teamId)?.accentColor ?? null}
          oppAccentColor={activeMatchup.opponentTeam ? (allTeams.find((t) => t.id === activeMatchup.opponentTeam!.id)?.accentColor ?? null) : null}
        />
      ) : eliminationInfo ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🏁</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                You were eliminated in the {eliminationInfo.roundLabel}
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
            View bracket →
          </Link>
        </Card>
      ) : playoffPending ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Playoffs are advancing
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                You advanced to the next round! Your next matchup will appear shortly once the commissioner advances the bracket.
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
            Regular season complete
          </p>
          <p style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.6, margin: "0 0 14px" }}>
            You finished <strong style={{ color: "var(--text)" }}>{ordinal(missedPlayoffs.regularSeasonRank)}</strong> out of {missedPlayoffs.totalTeams} teams this season. The top 4 advanced to the playoffs.
          </p>
          <Link href={`/league/${leagueId}/bracket`} style={{
            display: "inline-block", fontSize: 13, fontWeight: 600,
            color: "var(--accent-strong)", textDecoration: "none",
          }}>
            Watch the playoff bracket →
          </Link>
        </Card>
      ) : (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                Season hasn&apos;t started yet
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>
                Your matchup will appear once the draft is complete and the season begins.
              </div>
            </div>
          </div>
          <Link href={`/team/${teamId}/schedule`} style={{
            fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8,
            background: "rgba(143,193,232,0.15)", color: "var(--accent-strong)",
            border: "1px solid rgba(143,193,232,0.3)", textDecoration: "none", display: "inline-block",
          }}>
            View schedule →
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

function formatRelative(d: Date, nowMs: number) {
  const diff = nowMs - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
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

function RosterStatusWidget({
  matchup,
  activeSlotCount,
  teamId,
}: {
  matchup: ActiveMatchup;
  activeSlotCount: number;
  teamId: string;
}) {
  const starters = matchup.myPlayers.filter((p) => p.slot !== "BENCH" && p.slot !== "IR");
  const lockedCount = starters.filter((p) => p.gameCount > 0).length;
  const filledCount = starters.length;
  const hasIssues = filledCount < activeSlotCount;
  const isUpcoming = matchup.status === "upcoming";

  const statusLabel = hasIssues
    ? `⚠ ${filledCount}/${activeSlotCount} starters set`
    : `✓ ${filledCount}/${activeSlotCount} starters`;
  const statusColor = hasIssues ? "var(--gold)" : "var(--green)";
  const projColor = hasIssues ? "var(--gold)" : "var(--accent)";

  return (
    <Card>
      <h2 className="section-title" style={{ marginBottom: 14 }}>Roster status</h2>
      {/* Top zone: projected FP as the hero */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
          Projected FP
        </div>
        <div className="font-stats" style={{ fontSize: 36, fontWeight: 700, color: projColor, lineHeight: 1 }}>
          {matchup.myProjected.toFixed(1)}
        </div>
      </div>
      {/* Bottom zone: compact status line */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--dim)", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        <span>·</span>
        <span>
          {lockedCount > 0 ? `🔒 ${lockedCount} locked` : isUpcoming ? "Not yet locked" : "0 locked"}
        </span>
        {matchup.opponentTeam && matchup.opponentProjected > 0 && (
          <>
            <span>·</span>
            <span>Opp. {matchup.opponentProjected.toFixed(1)} FP</span>
          </>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href={`/team/${teamId}/lineup`} style={{
          display: "block", textAlign: "center",
          fontSize: 13, fontWeight: 700, padding: "9px 0", borderRadius: 10,
          background: "rgba(143,193,232,0.12)", color: "var(--accent-strong)",
          border: "1px solid rgba(143,193,232,0.25)", textDecoration: "none",
        }}>
          Adjust lineup →
        </Link>
      </div>
    </Card>
  );
}

function RecapCard({ recap }: { recap: WeeklyRecap }) {
  const won = recap.result === "win";
  const tie = recap.result === "tie";
  const color = won ? "var(--green)" : tie ? "var(--dim)" : "var(--red)";
  const borderColor = won ? "rgba(95,169,140,0.30)" : tie ? "var(--border)" : "rgba(209,139,127,0.25)";
  const verb = won ? "Won" : "Lost";
  const isLeagueHigh = won && recap.highestScore;

  const periodLabel = recap.isPlayoff && recap.roundLabel
    ? recap.roundLabel
    : `Wk ${recap.week}`;

  const recapCopy = won
    ? recap.opponentName
      ? `Took down ${recap.opponentName}.`
      : "Nice work — you outscored the field."
    : "Tough week. You'll bounce back.";

  return (
    <div className={isLeagueHigh ? "recap-card-win" : undefined} style={{
      background: won ? "linear-gradient(135deg, rgba(81,216,138,0.05), transparent)" : "var(--card)",
      border: `1px solid ${isLeagueHigh ? "rgba(212,175,55,0.30)" : borderColor}`,
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Result badge + period */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
          color, padding: "3px 9px", borderRadius: 20, background: `${color}1f`, flexShrink: 0,
        }}>
          {tie ? "TIE" : verb} · {periodLabel}
        </span>
      </div>

      {/* Score as hero */}
      <div>
        <div className="font-stats" style={{ fontSize: 28, fontWeight: 700, color: color, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
          {recap.myScore.toFixed(1)}
        </div>
        <div style={{ fontSize: 12, color: "var(--dim)" }}>
          {recapCopy}
        </div>
      </div>

      {/* Details row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>
        {recap.myTopPerformer && (
          <span style={{ color: "var(--dim)" }}>
            ⭐ {recap.myTopPerformer.name} led with {recap.myTopPerformer.points.toFixed(1)} pts
          </span>
        )}
        {recap.myRank !== null && recap.teamsCount > 0 && (
          <span style={{ color: "var(--faint)" }}>
            #{recap.myRank} of {recap.teamsCount} this week
          </span>
        )}
        {recap.highestScore && recap.myRank === 1 && (
          <span style={{ color: "var(--gold)", fontWeight: 700 }}>
            🏆 League-high score!
          </span>
        )}
      </div>
    </div>
  );
}

function LeaguePerformerItem({ player, rank, variant }: { player: LeaguePerformerRow; rank: number; variant: "top" | "low" }) {
  const rankColor = rank === 1 ? "var(--amber)" : rank === 2 ? "var(--dim)" : "var(--faint)";
  const fpColor = variant === "top" ? "var(--green)" : "var(--red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 10px", borderRadius: 8, marginBottom: 4,
      background: player.isMyPlayer ? "rgba(143,193,232,0.08)" : "transparent",
      borderLeft: player.isMyPlayer ? "2px solid rgba(143,193,232,0.4)" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: rankColor, width: 16, flexShrink: 0, textAlign: "center" }}>
        {rank}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: player.isMyPlayer ? "var(--accent-strong)" : "var(--text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {player.name}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: POS_COLORS[player.position] ?? "var(--dim)", flexShrink: 0 }}>
            {player.position[0]}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 1 }}>
          {player.fantasyTeamName}
          {player.isMyPlayer && <span style={{ color: "var(--accent)", fontWeight: 700 }}> · YOU</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: fpColor, fontVariantNumeric: "tabular-nums" }}>
          {player.points.toFixed(1)}
        </div>
        <div style={{ fontSize: 10, color: "var(--faint)" }}>{player.gamesPlayed}GP</div>
      </div>
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function getScoreColor(myScore: number, oppScore: number): string {
  if (myScore > oppScore) return "var(--green)";
  if (myScore < oppScore) return "var(--red)";
  return "var(--text)";
}

// ── MatchupHero ────────────────────────────────────────────────────────────────

function MatchupHero({ matchup, teamId, leagueId, myAccentColor, oppAccentColor }: {
  matchup: ActiveMatchup; teamId: string; leagueId: string;
  myAccentColor: string | null; oppAccentColor: string | null;
}) {
  return matchup.opponentTeam
    ? <DuelHero matchup={matchup} opponent={matchup.opponentTeam} teamId={teamId} leagueId={leagueId} myAccentColor={myAccentColor} oppAccentColor={oppAccentColor} />
    : <FieldHero matchup={matchup} teamId={teamId} leagueId={leagueId} />;
}

// ── VTF (regular season): rank my team against the field ────────────────────────
function FieldHero({ matchup, teamId, leagueId }: { matchup: ActiveMatchup; teamId: string; leagueId: string }) {
  const isUpcoming = matchup.status === "upcoming";
  const isSetupPhase = !!matchup.isSetupPhase;
  const showDash = isSetupPhase;
  const standings = matchup.weeklyStandings;
  const myRank = standings.findIndex((s) => s.teamId === matchup.myTeam.id) + 1;
  const total = standings.length;
  const { wins, losses, ties } = matchup.myRecord;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const dateRange = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
  const weekLabel = matchup.isPlayoff && matchup.roundLabel ? matchup.roundLabel : `Week ${matchup.week}`;

  // Score display: upcoming → projected FP, setup → "—", active → points earned
  const myScoreDisplay = showDash ? "—" : isUpcoming ? matchup.myProjected.toFixed(1) : matchup.myTeam.score.toFixed(1);
  const scoreLabel = showDash ? "Games starting soon" : isUpcoming ? "Projected FP" : "Points earned";
  const recordColor = wins > losses ? "var(--accent-strong)" : losses > wins ? "var(--red)" : "var(--muted)";
  const myScoreColor = showDash ? "var(--dim)" : recordColor;

  // Starters with games this period (for footer CTA)
  const startersWithGames = matchup.myPlayers.filter(
    (p) => p.slot !== "BENCH" && p.slot !== "IR" && (p.gamesThisPeriod ?? 0) > 0
  ).length;

  // Leading scorer chip (active state only)
  const topScorer = !isUpcoming && !isSetupPhase
    ? matchup.myPlayers
        .filter((p) => p.slot !== "BENCH" && p.slot !== "IR" && p.points > 0)
        .sort((a, b) => b.points - a.points)[0] ?? null
    : null;

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "var(--card)",
      border: "1px solid var(--accent-border)",
      borderRadius: 22,
      boxShadow: "0 40px 90px -45px rgba(0,0,0,0.8)",
    }}>
      {/* Ambient glow overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(620px 280px at 18% -20%, rgba(143,193,232,0.20), transparent 70%), radial-gradient(560px 260px at 92% 120%, rgba(143,193,232,0.16), transparent 70%), radial-gradient(400px 200px at 50% 100%, rgba(212,175,55,0.07), transparent 70%)" }} />

      {/* Top bar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <LogoShield size={24} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
            {weekLabel} · {dateRange}
          </span>
        </div>
        {isUpcoming && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)", background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Set lineup now
          </span>
        )}
        {isSetupPhase && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)", background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            Games starting soon
          </span>
        )}
        {!isUpcoming && !isSetupPhase && <LiveScoreRefresh />}
      </div>

      {/* Body */}
      <div style={{ position: "relative", padding: "28px 30px 22px" }}>
        {/* Identity header: avatar + team name + YOU badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
          <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--accent-ink)", boxShadow: "0 8px 20px -8px rgba(143,193,232,0.5)", flexShrink: 0 }}>
            {matchup.myTeam.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.01em" }}>{matchup.myTeam.name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-strong)", background: "rgba(143,193,232,0.18)", borderRadius: 5, padding: "2px 7px" }}>YOU</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 3 }}>
              <span style={{ color: "var(--faint)", fontWeight: 400 }}>W-L vs field: </span>
              <span style={{ color: recordColor, fontWeight: 700 }}>{wins}–{losses}{ties > 0 ? `–${ties}` : ""}</span>
              {myRank > 0 && <span style={{ color: "var(--faint)" }}> · #{myRank} of {total} this week</span>}
            </div>
          </div>
        </div>

        {/* Score */}
        <div style={{ marginBottom: 20 }}>
          <div className="font-stats" style={{ fontSize: showDash ? "clamp(24px, 6vw, 32px)" : "clamp(48px, 6vw, 64px)", fontWeight: 700, lineHeight: 0.82 }}>
            {!isUpcoming && !isSetupPhase ? (
              <ScoreDisplay value={parseFloat(myScoreDisplay)} color={myScoreColor} />
            ) : (
              <span style={{ color: myScoreColor }}>{myScoreDisplay}</span>
            )}
          </div>
          <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginTop: 6 }}>
            {scoreLabel}
          </div>
        </div>

        {/* FP/VP bridging note */}
        <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "0 0 12px" }}>
          Fantasy points (FP) decide who wins the week. Winning earns Victory Points (VP) in the standings.
        </p>

        {/* W-L vs field explanation */}
        {isSetupPhase ? (
          <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "0 0 12px" }}>
            Each week your score competes against all {total} teams. Most points wins.
          </p>
        ) : !isUpcoming && (wins > 0 || losses > 0) ? (
          <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "0 0 12px" }}>
            You beat {wins} team{wins !== 1 ? "s'" : "'s"} score{wins !== 1 ? "s" : ""} and lost to {losses} this week. Most points wins.
          </p>
        ) : null}

        {/* Leading scorer chip (active state only) */}
        {topScorer && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", marginBottom: 20 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(143,193,232,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "var(--accent-strong)", flexShrink: 0 }}>
              {topScorer.slot === "GOALIE" ? "G" : topScorer.slot === "DEFENSE" ? "D" : "F"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Leading · <strong style={{ color: "var(--text)", fontWeight: 700 }}>{topScorer.name.split(" ").pop()}</strong>
            </span>
            <span className="font-stats" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-strong)" }}>
              {topScorer.points.toFixed(1)}
            </span>
          </div>
        )}

      </div>

      {/* Footer CTA — mirrors DuelHero */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "18px 30px 24px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--dim)", minWidth: 160 }}>
          {isUpcoming
            ? <>Set your lineup before puck drop — you have <strong style={{ color: "var(--gold)", fontWeight: 700 }}>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""}</strong> with games this period.</>
            : <>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""} active this period.</>
          }
        </span>
        <Link href={`/league/${leagueId}/matchups`} style={{
          background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
          padding: "12px 20px", borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          View schedule
        </Link>
        {isUpcoming && (
          <Link href={`/team/${teamId}/lineup`} style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-deep))", color: "var(--accent-ink)",
            padding: "12px 22px", borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          }}>
            Set lineup
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── 1v1 (playoffs): head-to-head duel with win probability + rivalry ────────────
function DuelHero({
  matchup, opponent, teamId, leagueId, myAccentColor, oppAccentColor,
}: {
  matchup: ActiveMatchup;
  opponent: NonNullable<ActiveMatchup["opponentTeam"]>;
  teamId: string;
  leagueId: string;
  myAccentColor: string | null;
  oppAccentColor: string | null;
}) {
  const isUpcoming = matchup.status === "upcoming";
  const isSetupPhase = !!matchup.isSetupPhase;
  const showDash = isSetupPhase;
  const winPct = Math.round(matchup.winProbability * 100);
  const oppPct = 100 - winPct;

  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(d));
  const dateRange = `${fmt(matchup.period.startsAt)} – ${fmt(new Date(new Date(matchup.period.endsAt).getTime() - 1))}`;
  const weekLabel = matchup.isPlayoff && matchup.roundLabel ? matchup.roundLabel : `Week ${matchup.week}`;

  // Score display: upcoming → projected FP, setup phase → "—", active → actual score
  const myScoreDisplay = showDash ? "—" : isUpcoming ? matchup.myProjected.toFixed(1) : matchup.myTeam.score.toFixed(1);
  const oppScoreDisplay = showDash ? "—" : isUpcoming ? matchup.opponentProjected.toFixed(1) : opponent.score.toFixed(1);
  const scoreLabel = showDash ? "Games starting soon" : isUpcoming ? "Projected FP" : "Points earned";
  const myScore = isUpcoming || showDash ? 0 : matchup.myTeam.score;
  const oppScore = isUpcoming || showDash ? 0 : opponent.score;
  const myScoreColor = showDash ? "var(--dim)" : getScoreColor(myScore, oppScore);
  const oppScoreColor = showDash ? "var(--dim)" : getScoreColor(oppScore, myScore);

  // Win prob margin label
  const myProj = matchup.myTeam.score + matchup.myProjected;
  const oppProj = opponent.score + matchup.opponentProjected;
  const diff = Math.abs(myProj - oppProj).toFixed(1);
  const marginLabel = myProj >= oppProj ? `+${diff} FP lead` : `${diff} FP back`;

  // RD-014: trend arrow from yesterday's delta
  const delta = matchup.scoreDeltaSinceYesterday;
  const trendArrow = !isSetupPhase && delta !== null && Math.abs(delta) >= 0.5
    ? { label: delta > 0 ? `▲ +${delta.toFixed(1)}` : `▼ ${delta.toFixed(1)}`, color: delta > 0 ? "var(--green)" : "var(--red)" }
    : null;

  // RD-014: upset chip — trailing with 10–40% win probability
  const isUpset = !isUpcoming && !isSetupPhase && winPct >= 10 && winPct <= 40;

  // Starters with games this period
  const startersWithGames = matchup.myPlayers.filter(
    (p) => p.slot !== "BENCH" && p.slot !== "IR" && (p.gamesThisPeriod ?? 0) > 0
  ).length;

  // Top active scorer (active state only)
  const topScorer = !isUpcoming && !isSetupPhase
    ? matchup.myPlayers
        .filter((p) => p.slot !== "BENCH" && p.slot !== "IR" && p.points > 0)
        .sort((a, b) => b.points - a.points)[0] ?? null
    : null;

  const seriesRecord = `${matchup.rivalry.wins}–${matchup.rivalry.losses}${matchup.rivalry.ties > 0 ? `–${matchup.rivalry.ties}` : ""}`;

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "var(--card)",
      border: "1px solid var(--accent-border)",
      borderRadius: 22,
      boxShadow: "0 40px 90px -45px rgba(0,0,0,0.8)",
    }}>
      {/* Ambient glow overlay */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(620px 280px at 18% -20%, rgba(143,193,232,0.20), transparent 70%), radial-gradient(560px 260px at 92% 120%, rgba(143,193,232,0.16), transparent 70%), radial-gradient(400px 200px at 50% 100%, rgba(212,175,55,0.07), transparent 70%)" }} />

      {/* Top bar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 26px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <LogoShield size={24} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
            {weekLabel} · {dateRange}
          </span>
        </div>
        {isUpcoming && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)", background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Set lineup now
          </span>
        )}
        {isSetupPhase && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--gold)", background: "rgba(245,201,123,0.12)", border: "1px solid rgba(245,201,123,0.32)", borderRadius: 30, padding: "6px 13px" }}>
            Games starting soon
          </span>
        )}
        {!isUpcoming && !isSetupPhase && <LiveScoreRefresh />}
      </div>

      {/* Main 3-column grid */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18, padding: "30px 30px 22px" }}>

        {/* YOU column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
          {/* Avatar + team name */}
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, var(--accent-deep), var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--accent-ink)", boxShadow: myAccentColor ? `0 0 0 2px ${myAccentColor}, 0 8px 20px -8px rgba(143,193,232,0.5)` : "0 8px 20px -8px rgba(143,193,232,0.5)", flexShrink: 0 }}>
              {matchup.myTeam.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: myAccentColor ?? "var(--text)", letterSpacing: "-0.01em" }}>{matchup.myTeam.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--accent-strong)", background: "rgba(143,193,232,0.18)", borderRadius: 5, padding: "2px 7px" }}>YOU</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ color: "var(--faint)", fontWeight: 400 }}>Record: </span>{matchup.myRecord.wins}–{matchup.myRecord.losses}{matchup.myRecord.ties > 0 ? `–${matchup.myRecord.ties}` : ""}
                {seriesRecord !== "0–0" && ` · ${seriesRecord} series`}
              </div>
            </div>
          </div>

          {/* Score */}
          <div>
            <div className="font-stats" style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.82, fontVariantNumeric: "tabular-nums" }}>
              {!isUpcoming && !isSetupPhase ? (
                <ScoreDisplay value={parseFloat(myScoreDisplay)} color={myScoreColor} />
              ) : (
                <span style={{ color: myScoreColor }}>{myScoreDisplay}</span>
              )}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginTop: 6 }}>
              {scoreLabel}
            </div>
          </div>

          {/* Top scorer chip (active state only) */}
          {topScorer && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(143,193,232,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "var(--accent-strong)", flexShrink: 0 }}>
                {topScorer.slot === "GOALIE" ? "G" : topScorer.slot === "DEFENSE" ? "D" : "F"}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Leading · <strong style={{ color: "var(--text)", fontWeight: 700 }}>{topScorer.name.split(" ").pop()}</strong>
              </span>
              <span className="font-stats" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-strong)" }}>
                {topScorer.points.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Center VS column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, alignSelf: "stretch", justifyContent: "center" }}>
          <div style={{ flex: 1, width: 1, background: "linear-gradient(var(--bg), var(--border), var(--bg))", minHeight: 14 }} />
          <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(167,139,250,0.4)", background: "rgba(143,193,232,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", color: "var(--accent-strong)", flexShrink: 0 }}>
            VS
          </div>
          <div style={{ flex: 1, width: 1, background: "linear-gradient(var(--bg), var(--border), var(--bg))", minHeight: 14 }} />
        </div>

        {/* OPPONENT column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14, textAlign: "right" }}>
          {/* Avatar + team name */}
          <div style={{ display: "flex", alignItems: "center", gap: 13, flexDirection: "row-reverse" }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #3a4258, #222a3d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--muted)", boxShadow: oppAccentColor ? `0 0 0 2px ${oppAccentColor}` : undefined, flexShrink: 0 }}>
              {opponent.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: oppAccentColor ?? "var(--text)", letterSpacing: "-0.01em" }}>{opponent.name}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--dim)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>OPP</span>
              </div>
            </div>
          </div>

          {/* Score */}
          <div>
            <div className="font-stats" style={{ fontSize: 72, fontWeight: 700, lineHeight: 0.82, fontVariantNumeric: "tabular-nums" }}>
              {!isUpcoming && !isSetupPhase ? (
                <ScoreDisplay value={parseFloat(oppScoreDisplay)} color={oppScoreColor} />
              ) : (
                <span style={{ color: oppScoreColor }}>{oppScoreDisplay}</span>
              )}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)", marginTop: 6 }}>
              {scoreLabel}
            </div>
          </div>

          {/* Spacer to match top scorer chip height when absent */}
          {!topScorer && <div style={{ height: 40 }} />}
          {topScorer && <div style={{ height: 40 }} />}
        </div>
      </div>

      {/* Win probability bar */}
      <div style={{ position: "relative", padding: "0 30px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--faint)" }}>
            Win Probability
          </span>
          {trendArrow && (
            <span style={{ fontSize: 11, fontWeight: 700, color: trendArrow.color, fontVariantNumeric: "tabular-nums" }}>
              {trendArrow.label} today
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong)", fontVariantNumeric: "tabular-nums" }}>{winPct}% — You</span>
          <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)" }}>Projected · {marginLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>Them — {oppPct}%</span>
        </div>
        <div style={{ height: 9, borderRadius: 6, overflow: "hidden", background: "var(--border)" }}>
          <div className="win-prob-bar" style={{ height: "100%", width: `${winPct}%`, background: "linear-gradient(90deg, var(--accent-strong), var(--accent))" }} />
        </div>
        {/* RD-014: upset chip — trailing but still in it */}
        {isUpset && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--amber)", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.28)", borderRadius: 30, padding: "4px 12px" }}>
              ⚡ {winPct}% chance to steal the win
            </span>
          </div>
        )}
        {/* FP/VP bridging note */}
        <p style={{ fontSize: "0.75rem", color: "var(--faint)", textAlign: "center", margin: "12px 0 0" }}>
          Fantasy points (FP) decide who wins the week. Winning earns Victory Points (VP) in the standings.
        </p>
      </div>

      {/* Footer CTA */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "18px 30px 24px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--dim)", minWidth: 160 }}>
          {isUpcoming
            ? <>Set your lineup before puck drop — you have <strong style={{ color: "var(--gold)", fontWeight: 700 }}>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""}</strong> with games this period.</>
            : <>{startersWithGames} starter{startersWithGames !== 1 ? "s" : ""} active this period.</>
          }
        </span>
        <Link href={matchup.isPlayoff ? `/league/${leagueId}/bracket` : `/league/${leagueId}/matchups`} style={{
          background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
          padding: "12px 20px", borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: "none",
          whiteSpace: "nowrap",
        }}>
          {matchup.isPlayoff ? "View bracket" : "View schedule"}
        </Link>
        {isUpcoming && (
          <Link href={`/team/${teamId}/lineup`} style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-deep))", color: "var(--accent-ink)",
            padding: "12px 22px", borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          }}>
            Set lineup
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── RosterTable ────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  FORWARD: "F", DEFENSE: "D", GOALIE: "G", UTIL: "Flex", BENCH: "BN", IR: "IR",
};
const POS_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "var(--green)", GOALIE: "var(--amber)",
};
const SLOT_COLORS: Record<string, string> = {
  FORWARD: "#60a5fa", DEFENSE: "var(--green)", GOALIE: "var(--amber)",
  UTIL: "var(--accent-strong)", BENCH: "var(--faint)", IR: "var(--red)",
};

function RosterTable({ players, isMyTeam }: { players: PlayerMatchupRow[]; isMyTeam?: boolean }) {
  if (players.length === 0) {
    return <p style={{ color: "var(--faint)", fontSize: 13, margin: 0 }}>No active players yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "44px 1fr 36px 56px",
        gap: 8, padding: "0 12px 6px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: "var(--faint)",
        borderBottom: "1px solid var(--border)",
        marginBottom: 4,
      }}>
        <span>Slot</span><span>Player</span><span style={{ textAlign: "center" }}>Left</span><span style={{ textAlign: "right" }}>FP</span>
      </div>

      {players.map((p) => {
        const isBench = p.slot === "BENCH" || p.slot === "IR";
        const rowStyle: React.CSSProperties = isBench
          ? { background: "var(--bg-raised)", border: "1px solid var(--surface)", opacity: 0.62, borderRadius: 10, padding: "11px 12px" }
          : isMyTeam
            ? { background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "11px 12px" }
            : { background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px" };
        return (
          <div key={p.playerId} style={{ display: "grid", gridTemplateColumns: "44px 1fr 36px 56px", gap: 8, alignItems: "center", ...rowStyle }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, textAlign: "center",
              padding: "3px 7px", borderRadius: 5,
              background: "rgba(143,193,232,0.6)", color: "var(--accent-ink)",
            }}>
              {SLOT_LABELS[p.slot] ?? p.slot}
            </span>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
                {p.teamAbbr && <span style={{ fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>{p.teamAbbr}</span>}
                {p.chips?.map((chip) => <StatChip key={chip.type} chip={chip} />)}
              </div>
              {p.statBreakdown.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                  {p.statBreakdown.map((b) => (
                    <span key={b.label} style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 999,
                      background: b.points >= 0 ? "rgba(95,169,140,0.1)" : "rgba(209,139,127,0.1)",
                      color: b.points >= 0 ? "var(--green)" : "var(--red)",
                    }}>
                      {b.label}{b.stat > 1 ? ` ×${b.stat}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              {p.gamesThisPeriod !== null ? (
                <span className="font-stats" style={{
                  fontSize: 10, fontWeight: 700,
                  padding: "2px 5px", borderRadius: 4,
                  background: p.gamesThisPeriod === 0 ? "rgba(239,68,68,0.12)" : "var(--accent-dim)",
                  color: p.gamesThisPeriod === 0 ? "var(--red)" : "var(--accent-strong)",
                  border: p.gamesThisPeriod > 0 ? "1px solid var(--accent-border)" : undefined,
                }}>
                  {p.gamesThisPeriod === 0 ? "0" : `${p.gamesThisPeriod}G`}
                </span>
              ) : (
                <span style={{ color: "var(--faint)", fontSize: 10 }}>—</span>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <span className="font-stats" style={{ fontSize: 18, fontWeight: 700, color: p.points > 0 ? (isMyTeam ? "var(--muted)" : "var(--text)") : "var(--dim)" }}>
                {p.gameCount === 0 && p.points === 0 ? "—" : p.points.toFixed(1)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Total row */}
      <div style={{
        display: "grid", gridTemplateColumns: "44px 1fr 36px 56px",
        gap: 8, padding: "10px 12px 0",
        borderTop: "1px solid var(--border)", marginTop: 2,
      }}>
        <span /><span style={{ fontSize: 12, color: "var(--dim)", fontWeight: 600 }}>Total</span><span />
        <span className="font-stats" style={{ textAlign: "right", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
          {players.reduce((s, p) => s + p.points, 0).toFixed(1)}
        </span>
      </div>
    </div>
  );
}
