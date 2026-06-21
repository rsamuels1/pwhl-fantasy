import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiRequireAuth, apiRequireCommissioner } from "@/lib/auth";
import { logCommissionerAction } from "@/lib/services/audit-service";
import { parseScoringSettings } from "@/lib/scoring/settings";

// PUT /api/leagues/[leagueId]/settings
// Commissioner-only. Edit league settings before draft is complete.
export async function PUT(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  const auth = await apiRequireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const commissioner = await apiRequireCommissioner(params.leagueId, auth.id);
  if (commissioner instanceof NextResponse) return commissioner;

  // Fetch the league to check draft/playoff status
  const league = await prisma.fantasyLeague.findUnique({
    where: { id: params.leagueId },
    select: { draft: { select: { status: true } }, playoffStatus: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  const isDraftComplete = league.draft?.status === "COMPLETE";
  const isPlayoffStarted = league.playoffStatus !== "NOT_STARTED";

  const body = (await req.json().catch(() => ({}))) as {
    maxTeams?: number;
    draftType?: string;
    scoringSettings?: unknown;
    rosterSettings?: unknown;
    playoffSettings?: unknown;
  };

  // Block scoring/roster changes after draft complete
  if (isDraftComplete && (body.scoringSettings !== undefined || body.rosterSettings !== undefined)) {
    return NextResponse.json(
      { error: "Scoring and roster settings are locked after the draft." },
      { status: 409 }
    );
  }

  // Block playoff settings changes once playoffs are in progress
  if (isPlayoffStarted && body.playoffSettings !== undefined) {
    return NextResponse.json(
      { error: "Playoff settings are locked once playoffs have started." },
      { status: 409 }
    );
  }

  // Build update object with validation
  const updateData: Record<string, unknown> = {};
  const changedFields: string[] = [];

  // Validate and set maxTeams
  if (body.maxTeams !== undefined) {
    const maxTeams = Number(body.maxTeams);
    if (!Number.isInteger(maxTeams) || maxTeams < 2 || maxTeams > 20) {
      return NextResponse.json(
        { error: "maxTeams must be an integer between 2 and 20" },
        { status: 400 }
      );
    }
    updateData.maxTeams = maxTeams;
    changedFields.push("maxTeams");
  }

  // Validate and set draftType
  if (body.draftType !== undefined) {
    const validTypes = ["SNAKE"];
    if (!validTypes.includes(String(body.draftType))) {
      return NextResponse.json(
        { error: `Invalid draftType: ${body.draftType}. Valid types: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }
    updateData.draftType = String(body.draftType);
    changedFields.push("draftType");
  }

  // Validate and set scoringSettings
  if (body.scoringSettings !== undefined) {
    try {
      const parsed = parseScoringSettings(body.scoringSettings);
      updateData.scoringSettings = parsed;
      changedFields.push("scoringSettings");
    } catch (err) {
      return NextResponse.json(
        { error: `Invalid scoringSettings: ${err instanceof Error ? err.message : "unknown error"}` },
        { status: 400 }
      );
    }
  }

  // Validate and set rosterSettings
  if (body.rosterSettings !== undefined) {
    const rs = body.rosterSettings as Record<string, unknown>;
    const valid = ["forward", "defense", "goalie", "util", "bench", "ir"];
    for (const key of Object.keys(rs)) {
      if (!valid.includes(key)) {
        return NextResponse.json(
          { error: `Invalid rosterSettings key: ${key}` },
          { status: 400 }
        );
      }
      const val = rs[key];
      if (!Number.isInteger(val) || (val as number) < 0) {
        return NextResponse.json(
          { error: `rosterSettings.${key} must be a non-negative integer` },
          { status: 400 }
        );
      }
    }
    updateData.rosterSettings = rs;
    changedFields.push("rosterSettings");
  }

  // Validate and set playoffSettings
  if (body.playoffSettings !== undefined) {
    const ps = body.playoffSettings as Record<string, unknown>;
    const tip = ps.teamsInPlayoff;
    const tsb = ps.topSeedsWithBye;
    const rdp = ps.roundDurationPeriods;
    const hswt = ps.higherSeedWinsTies;
    if (tip !== undefined && (!Number.isInteger(tip) || (tip as number) < 2 || (tip as number) > 20)) {
      return NextResponse.json({ error: "teamsInPlayoff must be 2–20" }, { status: 400 });
    }
    if (tsb !== undefined && (!Number.isInteger(tsb) || (tsb as number) < 0)) {
      return NextResponse.json({ error: "topSeedsWithBye must be a non-negative integer" }, { status: 400 });
    }
    if (rdp !== undefined && (!Number.isInteger(rdp) || (rdp as number) < 1)) {
      return NextResponse.json({ error: "roundDurationPeriods must be >= 1" }, { status: 400 });
    }
    if (hswt !== undefined && typeof hswt !== "boolean") {
      return NextResponse.json({ error: "higherSeedWinsTies must be a boolean" }, { status: 400 });
    }
    updateData.playoffSettings = ps;
    changedFields.push("playoffSettings");
  }

  if (changedFields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Update the league
  const updated = await prisma.fantasyLeague.update({
    where: { id: params.leagueId },
    data: updateData,
  });

  // Log the action
  await logCommissionerAction(
    params.leagueId,
    auth.id,
    "COMMISSIONER_SETTINGS_CHANGED",
    { changed: changedFields },
    prisma
  );

  return NextResponse.json({
    success: true,
    changed: changedFields,
    league: {
      maxTeams: updated.maxTeams,
      draftType: updated.draftType,
      scoringSettings: updated.scoringSettings,
      rosterSettings: updated.rosterSettings,
      playoffSettings: updated.playoffSettings,
    },
  });
}
