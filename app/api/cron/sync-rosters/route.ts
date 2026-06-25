// app/api/cron/sync-rosters/route.ts
// Weekly roster sync for the 2026-27 pre-season.
//
// Runs every Monday at 10:00 UTC via Vercel Cron (vercel.json).
// Also callable manually: POST /api/cron/sync-rosters
//
// WHY: season_id=10 has no games yet, so the main ingest script can't
// discover team IDs from the schedule. This hits each team's roster
// endpoint directly using hardcoded HockeyTech numeric team IDs.
//
// KILL SWITCH: set SYNC_ROSTERS_DISABLED=true in Vercel env vars once
// the 2026-27 schedule is published and you switch to
//   npm run ingest -- --season 2026-27 --no-stats
// This route will then no-op and remind you to remove itself.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Vercel Pro allows up to 60s; 12 teams × ~620ms avg = ~7.5s, but pad for slow days.
export const maxDuration = 30;

const BASE = "https://lscluster.hockeytech.com/feed/index.php";
const API_KEY = "446521baf8c38984";
const SEASON_ID = "10";

// HockeyTech numeric team ID → DB externalId
const HT_TEAM_MAP: Record<number, string> = {
  1: "bos", 2: "min", 3: "mtl", 4: "nyc", 5: "ott", 6: "tor",
  8: "sea", 9: "van", 10: "det", 11: "ham", 12: "lv", 13: "sj",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mapPosition(p: string): "FORWARD" | "DEFENSE" | "GOALIE" {
  const u = p.toUpperCase();
  if (u === "G") return "GOALIE";
  if (u.includes("D")) return "DEFENSE";
  return "FORWARD";
}

function splitName(full: string) {
  const i = full.lastIndexOf(" ");
  return i < 0 ? { firstName: "", lastName: full } : { firstName: full.slice(0, i), lastName: full.slice(i + 1) };
}

async function fetchJsonpText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "pwhl-fantasy-cron/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = (await res.text()).trim();
  return text.startsWith("(") && text.endsWith(")") ? text.slice(1, -1) : text;
}

async function hasScheduleAppeared(): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      key: API_KEY, client_code: "pwhl", site_id: "2", league_id: "1",
      lang: "en", feed: "statviewfeed", view: "schedule", season_id: SEASON_ID,
    });
    const json = await fetchJsonpText(`${BASE}?${params}`);
    const data = JSON.parse(json) as Array<{ sections: Array<{ data?: unknown[] }> }>;
    return (data[0]?.sections[0]?.data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function fetchTeamRoster(htTeamId: number) {
  const params = new URLSearchParams({
    key: API_KEY, client_code: "pwhl", site_id: "2", league_id: "1",
    lang: "en", feed: "statviewfeed", view: "roster",
    season_id: SEASON_ID, team_id: String(htTeamId),
  });
  const json = await fetchJsonpText(`${BASE}?${params}`);
  const data = JSON.parse(json) as {
    roster: Array<{ sections: Array<{ title: string; data?: Array<{ row: { player_id: string; name: string; position: string; tp_jersey_number: string } }> }> }>;
  };
  const players = [];
  for (const sec of data.roster?.[0]?.sections ?? []) {
    if (sec.title === "Coaches") continue;
    for (const entry of sec.data ?? []) {
      const r = entry.row;
      if (!r.player_id) continue;
      players.push({
        externalId: r.player_id,
        ...splitName(r.name),
        position: mapPosition(r.position),
        jersey: r.tp_jersey_number ? Number(r.tp_jersey_number) : null,
      });
    }
  }
  return players;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  const isAllowed =
    (expected !== null && secret === expected) ||
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SEASON_ADVANCE === "true";

  if (!isAllowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.SYNC_ROSTERS_DISABLED === "true") {
    logger.info("[cron/sync-rosters] SYNC_ROSTERS_DISABLED=true — skipping. Remove this cron entry from vercel.json.");
    return NextResponse.json({ skipped: true, reason: "SYNC_ROSTERS_DISABLED" });
  }

  // Stop running once the 2026-27 schedule exists in HockeyTech.
  // At that point the main ingest script handles everything; roster-only sync would interfere.
  const scheduleUp = await hasScheduleAppeared();
  if (scheduleUp) {
    logger.warn(
      "[cron/sync-rosters] 2026-27 schedule is live — this cron is now dormant. " +
      "Run `npm run ingest -- --season 2026-27 --no-stats` and remove the sync-rosters " +
      "entry from vercel.json."
    );
    return NextResponse.json({ dormant: true, reason: "schedule_appeared" });
  }

  try {
  const dbTeams = await prisma.team.findMany({ select: { id: true, externalId: true, abbreviation: true } });
  const teamByExternalId = new Map(dbTeams.map((t) => [t.externalId, t]));

  let totalNew = 0, totalMoved = 0, totalUnchanged = 0, totalFailed = 0;
  const teamResults: Record<string, { players: number; new: number; moved: number; unchanged: number }> = {};

  for (const [htTeamId, externalId] of Object.entries(HT_TEAM_MAP)) {
    const dbTeam = teamByExternalId.get(externalId);
    if (!dbTeam) { totalFailed++; continue; }

    let players: Awaited<ReturnType<typeof fetchTeamRoster>>;
    try {
      players = await fetchTeamRoster(Number(htTeamId));
    } catch (e) {
      logger.error(`[cron/sync-rosters] ${dbTeam.abbreviation} fetch failed`, e);
      totalFailed++;
      continue;
    }

    let teamNew = 0, teamMoved = 0, teamUnchanged = 0;
    for (const p of players) {
      const existing = await prisma.player.findUnique({ where: { externalId: p.externalId } });
      if (!existing) {
        teamNew++;
        await prisma.player.create({
          data: { externalId: p.externalId, firstName: p.firstName, lastName: p.lastName, position: p.position, jersey: p.jersey, teamId: dbTeam.id, active: true },
        });
      } else {
        if (existing.teamId !== dbTeam.id) teamMoved++;
        else teamUnchanged++;
        await prisma.player.update({
          where: { id: existing.id },
          data: { firstName: p.firstName, lastName: p.lastName, position: p.position, jersey: p.jersey, teamId: dbTeam.id, active: true },
        });
      }
    }

    totalNew += teamNew; totalMoved += teamMoved; totalUnchanged += teamUnchanged;
    teamResults[dbTeam.abbreviation] = { players: players.length, new: teamNew, moved: teamMoved, unchanged: teamUnchanged };
    await sleep(120);
  }

  const summary = { new: totalNew, moved: totalMoved, unchanged: totalUnchanged, failed: totalFailed, scheduleAppeared: scheduleUp };
  logger.info("[cron/sync-rosters]", { ...summary, teams: teamResults });
  return NextResponse.json({ ok: true, ...summary, teams: teamResults });
  } catch (err) {
    logger.error("[cron/sync-rosters] fatal error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
