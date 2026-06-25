import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_SCORING } from "@/lib/scoring";
import { generateShortId } from "@/lib/id";
import { setAuthCookie, USER_SESSION_COOKIE } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { derivePeriods } from "@/lib/scoring/periods";
import { REPLAY_SEASON, LIVE_SEASON } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leagueName = String(body.leagueName || "").trim();

    // On the beta site, only Beta Replay Leagues are permitted.
    const host = req.headers.get("host") ?? "";
    const betaSiteHost = process.env.BETA_SITE_HOST || "beta.fantasy.dykedb.org";
    if (host === betaSiteHost && !body.useBetaReplay) {
      return NextResponse.json(
        { error: "Only Beta Replay Leagues can be created on this domain." },
        { status: 403 }
      );
    }

    if (!leagueName) {
      return NextResponse.json({ error: "League name is required." }, { status: 400 });
    }
    if (leagueName.length > 50) {
      return NextResponse.json({ error: "League name must be 50 characters or fewer." }, { status: 400 });
    }

    // Prefer authenticated session; fall back to email-based creation for backward compat.
    const sessionEmail = req.cookies.get(USER_SESSION_COOKIE)?.value;
    let commissioner = sessionEmail
      ? await prisma.user.findUnique({ where: { email: sessionEmail } })
      : null;

    if (!commissioner) {
      const commissionerEmail = String(body.commissionerEmail || "").trim();
      const commissionerName = String(body.commissionerName || "").trim();
      if (!commissionerEmail) {
        return NextResponse.json({ error: "Commissioner email is required." }, { status: 400 });
      }
      commissioner = await prisma.user.upsert({
        where: { email: commissionerEmail },
        update: { displayName: commissionerName || commissionerEmail.split("@")[0] },
        create: { email: commissionerEmail, displayName: commissionerName || commissionerEmail.split("@")[0] },
      });
    }

    let leagueSeason = LIVE_SEASON;
    let draftStartsAt: Date | null = null;
    let isReplay = false;
    let replayCurrentDate: Date | null = null;
    let maxTeams = Number(body.maxTeams || 8);
    let scoringSettingsOverride: Record<string, unknown> | null = null;
    let betaStatusValue: string | undefined;
    let playoffSettingsOverride: Record<string, unknown> | null = null;

    if (body.useBetaReplay) {
      // --- Beta Replay League ---
      // 4 randomly chosen weeks from 2025-26: first 2 for regular season, last 2 for playoff scoring.
      const betaSeason = REPLAY_SEASON;
      const gameDates = await prisma.game.findMany({
        where: { season: betaSeason },
        select: { startsAt: true },
      });
      const allPeriods = derivePeriods(gameDates.map((g) => g.startsAt));
      if (allPeriods.length < 4) {
        return NextResponse.json(
          { error: "Not enough season data to create a beta league. Load the 2025-26 fixture first." },
          { status: 400 }
        );
      }

      // Pick one index from each quarter of the season for variety.
      const quarterSize = Math.floor(allPeriods.length / 4);
      const indices = [0, 1, 2, 3].map(
        (q) => q * quarterSize + Math.floor(Math.random() * quarterSize)
      );

      // Pre-compute betaWeekMappings for all 4 weeks (regular + playoff).
      // generateBetaMatchups() will overwrite weeks 1-2 with the same data and preserve weeks 3-4.
      const draftStart = Date.now();
      const firstWeekStart = draftStart + 24 * 60 * 60 * 1000;
      const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      const betaWeekMappings = indices.map((idx, i) => ({
        week: i + 1,
        fixtureStart: allPeriods[idx].startsAt.toISOString(),
        fixtureEnd: allPeriods[idx].endsAt.toISOString(),
        remappedStart: new Date(firstWeekStart + i * WEEK_MS).toISOString(),
        remappedEnd: new Date(firstWeekStart + (i + 1) * WEEK_MS).toISOString(),
      }));

      scoringSettingsOverride = {
        ...(DEFAULT_SCORING as object),
        betaWeekIndices: [indices[0], indices[1]],
        betaWeekMappings,
      };
      playoffSettingsOverride = {
        teamsInPlayoff: 4,
        topSeedsWithBye: 0,
        roundDurationPeriods: 1,
        higherSeedWinsTies: true,
      };

      leagueSeason = betaSeason;
      maxTeams = 6;
      draftStartsAt = new Date();
      isReplay = true;
      replayCurrentDate = null; // real-time: weeks advance on the actual calendar
      betaStatusValue = "ACTIVE";
    } else if (body.useLastSeasonSimulation) {
      const lastSeasonRow = await prisma.game.findMany({
        distinct: ["season"],
        select: { season: true },
        orderBy: { season: "desc" },
        take: 1,
      });
      leagueSeason = lastSeasonRow[0]?.season ?? leagueSeason;
      draftStartsAt = new Date();
      isReplay = true;
      replayCurrentDate = new Date("2026-10-01T09:00:00Z");
    } else if (body.draftStartsAt) {
      draftStartsAt = new Date(body.draftStartsAt);
    }

    const isPublic = body.isPublic === true || body.isPublic === "true";

    const league = await prisma.fantasyLeague.create({
      data: {
        id: generateShortId(leagueName),
        name: leagueName,
        season: leagueSeason,
        maxTeams,
        status: "PRE_DRAFT",
        commissionerId: commissioner.id,
        scoringSettings: (scoringSettingsOverride ?? DEFAULT_SCORING) as object,
        scoringMode: "VP",
        rosterSettings: {
          forward: 3,
          defense: 2,
          goalie: 1,
          util: 1,
          bench: 6,
        },
        draftStartsAt,
        isReplay,
        replayCurrentDate,
        isPublic,
        ...(betaStatusValue ? { betaStatus: betaStatusValue as "ACTIVE" } : {}),
        ...(playoffSettingsOverride ? { playoffSettings: playoffSettingsOverride as object } : {}),
      },
    });

    try {
      trackEvent({ event: "league_created", userId: commissioner.id, leagueId: league.id,
        properties: { maxTeams, isReplay, source: sessionEmail ? "wizard" : "form", isBetaReplay: !!body.useBetaReplay } });
    } catch {}

    const response = NextResponse.json({
      leagueId: league.id,
      commissionerId: commissioner.id,
      redirectTo: `/league/${league.id}/admin?welcome=1`,
      message: "League created.",
    });
    // Set cookie so unauthenticated creators are logged in after creation
    if (!sessionEmail) {
      setAuthCookie(response, commissioner.email);
    }
    return response;
  } catch (error) {
    console.error("Error creating league:", error);
    return NextResponse.json({ error: "Failed to create league." }, { status: 500 });
  }
}
