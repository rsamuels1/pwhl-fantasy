// lib/ingestion/hockeytech.ts
// Concrete StatsSource backed by the HockeyTech / LeagueStat API that powers
// thepwhl.com. The API key and client code are public (embedded in every page).
//
// All responses are JSONP — strip the outer ( ) before JSON.parse.
// No auth headers or cookies needed. No official rate-limit documented;
// we add a small sleep between bulk calls to be polite.

import type { StatsSource, RawTeam, RawPlayer, RawGame, RawStatLine } from "./source";

const BASE = "https://lscluster.hockeytech.com/feed/index.php";
const API_KEY = "446521baf8c38984";
const CLIENT = "pwhl";
const SITE_ID = "2";
const LEAGUE_ID = "1";

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchJsonp(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "pwhl-fantasy-ingest/1.0" },
  });
  if (!res.ok) throw new Error(`HockeyTech HTTP ${res.status}: ${url}`);
  let text = await res.text();
  text = text.trim();
  if (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1);
  return JSON.parse(text);
}

function qs(params: Record<string, string | number>) {
  return new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
}

function htParams(extra: Record<string, string | number> = {}) {
  return qs({
    key: API_KEY,
    client_code: CLIENT,
    site_id: SITE_ID,
    league_id: LEAGUE_ID,
    lang: "en",
    ...extra,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Position codes → our three-way enum
function mapPosition(htPos: string): "FORWARD" | "DEFENSE" | "GOALIE" {
  const p = htPos.toUpperCase();
  if (p === "G") return "GOALIE";
  if (p.includes("D")) return "DEFENSE";
  return "FORWARD"; // LW, RW, C, W, F, anything else
}

// HockeyTech game_status → our GameStatus
function mapGameStatus(status: string): RawGame["status"] {
  const s = status.toLowerCase();
  if (s.startsWith("final")) return "FINAL";
  if (s === "live") return "LIVE";
  if (s === "postponed" || s === "cancelled") return "POSTPONED";
  return "SCHEDULED";
}

// Split "Jamie Lee Rattray" → { firstName: "Jamie Lee", lastName: "Rattray" }
function splitName(full: string): { firstName: string; lastName: string } {
  const i = full.lastIndexOf(" ");
  if (i < 0) return { firstName: "", lastName: full };
  return { firstName: full.slice(0, i), lastName: full.slice(i + 1) };
}

// ── season lookup ─────────────────────────────────────────────────────────────

interface HtSeason {
  season_id: string;
  season_name: string;
  playoff: string;
  start_date: string;
  end_date: string;
}

async function fetchSeasons(): Promise<HtSeason[]> {
  const data = (await fetchJsonp(
    `${BASE}?feed=modulekit&view=seasons&${qs({ key: API_KEY, client_code: CLIENT, site_id: SITE_ID, lang: "en", fmt: "json" })}`
  )) as { SiteKit: { Seasons: HtSeason[] } };
  return data.SiteKit.Seasons;
}

// Accept "2024-25", "2025-26", or a raw numeric season_id string.
// Prefers the regular-season ID for a given year (playoff=0).
async function resolveSeasonId(season: string): Promise<string> {
  if (/^\d+$/.test(season)) return season; // already a numeric id

  const seasons = await fetchSeasons();
  // "2024-25" matches "2024-25 Regular Season" or "2025-26 Regular Season"
  const year = season.replace("-", "-"); // normalise
  const match =
    seasons.find((s) => s.season_name.startsWith(year) && s.playoff === "0") ??
    seasons.find((s) => s.season_name.includes(year));
  if (!match) throw new Error(`No HockeyTech season found for "${season}"`);
  return match.season_id;
}

// ── schedule parsing ──────────────────────────────────────────────────────────

interface HtScheduleRow {
  prop: {
    home_team_city: { teamLink: string };
    visiting_team_city: { teamLink: string };
  };
  row: {
    game_id: string;
    date_with_day: string;
    home_team_city: string;
    visiting_team_city: string;
    home_goal_count: string;
    visiting_goal_count: string;
    game_status: string;
  };
}

async function fetchScheduleRows(seasonId: string): Promise<HtScheduleRow[]> {
  const data = (await fetchJsonp(
    `${BASE}?feed=statviewfeed&view=schedule&${htParams({ season_id: seasonId })}`
  )) as Array<{ sections: Array<{ data?: HtScheduleRow[] }> }>;
  return data[0]?.sections[0]?.data ?? [];
}

// ── game summary ──────────────────────────────────────────────────────────────

interface HtTeamInfo {
  id: number;
  name: string;
  city: string;
  nickname: string;
  abbreviation: string;
  logo: string;
}

interface HtPlayerInfo {
  id: number;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: string;
  birthDate: string;
}

interface HtSkater {
  info: HtPlayerInfo;
  stats: {
    goals: number;
    assists: number;
    shots: number;
    plusMinus: number;
    penaltyMinutes: number;
    faceoffAttempts: number;
    faceoffWins: number;
    hits: number;
    blockedShots: number;
    toi: string; // "MM:SS"
  };
}

interface HtGoalie {
  info: HtPlayerInfo;
  stats: {
    shotsAgainst: number;
    goalsAgainst: number;
    saves: number;
    timeOnIce: string | null; // "MM:SS" or null
  };
}

interface HtGoal {
  properties: {
    isPowerPlay: string;
    isShortHanded: string;
  };
  scoredBy: { id: number };
  assists: Array<{ id: number }>;
}

interface HtPeriod {
  goals: HtGoal[];
}

interface HtGameSummary {
  details: {
    id: number;
    GameDateISO8601: string;
    status: string;
    final: string;
    seasonId: string;
  };
  homeTeam: {
    info: HtTeamInfo;
    stats: { goals: number };
    skaters: HtSkater[];
    goalieLog: HtGoalie[];
  };
  visitingTeam: {
    info: HtTeamInfo;
    stats: { goals: number };
    skaters: HtSkater[];
    goalieLog: HtGoalie[];
  };
  periods: HtPeriod[];
}

async function fetchGameSummary(gameId: string): Promise<HtGameSummary> {
  return (await fetchJsonp(
    `${BASE}?feed=statviewfeed&view=gameSummary&game_id=${gameId}&${htParams()}`
  )) as HtGameSummary;
}

// ── per-player power-play point enrichment ────────────────────────────────────
// gameSummary has isPowerPlay on each goal. Aggregate per player from periods[].goals.
function computePpPoints(summary: HtGameSummary): Map<number, number> {
  const pp = new Map<number, number>();
  const add = (id: number) => pp.set(id, (pp.get(id) ?? 0) + 1);

  for (const period of summary.periods) {
    for (const goal of period.goals) {
      if (goal.properties.isPowerPlay !== "1") continue;
      add(goal.scoredBy.id);
      for (const a of goal.assists) add(a.id);
    }
  }
  return pp;
}

// ── StatsSource implementation ────────────────────────────────────────────────

export class HockeytechSource implements StatsSource {
  // Fetch all teams that appear in the season's schedule.
  // Calls gameSummary for the first few games to get full team info
  // (abbreviation, city) which the schedule rows don't expose.
  async fetchTeams(season: string): Promise<RawTeam[]> {
    const seasonId = await resolveSeasonId(season);
    const rows = await fetchScheduleRows(seasonId);
    if (rows.length === 0) return [];

    const teamMap = new Map<number, RawTeam>();

    for (const row of rows) {
      if (teamMap.size >= 12) break; // expansion cap; stop early
      const gameId = row.row.game_id;
      if (!gameId) continue;
      try {
        const summary = await fetchGameSummary(gameId);
        for (const side of [summary.homeTeam, summary.visitingTeam]) {
          const info = side.info;
          if (!teamMap.has(info.id)) {
            teamMap.set(info.id, {
              externalId: String(info.id),
              name: info.name,
              city: info.city,
              abbreviation: info.abbreviation,
            });
          }
        }
        await sleep(120);
      } catch {
        // skip games that 404 or fail
      }
    }

    return [...teamMap.values()];
  }

  // Fetch all players via the roster endpoint for each team.
  async fetchPlayers(season: string): Promise<RawPlayer[]> {
    const seasonId = await resolveSeasonId(season);
    const rows = await fetchScheduleRows(seasonId);

    // Collect unique team IDs from schedule props
    const teamIds = new Set<string>();
    for (const row of rows) {
      teamIds.add(row.prop.home_team_city.teamLink);
      teamIds.add(row.prop.visiting_team_city.teamLink);
    }

    const players = new Map<string, RawPlayer>();

    for (const teamId of teamIds) {
      try {
        const data = (await fetchJsonp(
          `${BASE}?feed=statviewfeed&view=roster&${htParams({ season_id: seasonId, team_id: teamId })}`
        )) as {
          roster: Array<{
            sections: Array<{
              title: string;
              data?: Array<{ row: { player_id: string; name: string; position: string; tp_jersey_number: string } }>;
            }>;
          }>;
        };

        const sections = data.roster?.[0]?.sections ?? [];
        for (const sec of sections) {
          if (sec.title === "Coaches") continue;
          for (const entry of sec.data ?? []) {
            const r = entry.row;
            if (!r.player_id || players.has(r.player_id)) continue;
            const { firstName, lastName } = splitName(r.name);
            players.set(r.player_id, {
              externalId: r.player_id,
              firstName,
              lastName,
              position: mapPosition(r.position),
              jersey: r.tp_jersey_number ? Number(r.tp_jersey_number) : undefined,
              teamExternalId: teamId,
            });
          }
        }
        await sleep(120);
      } catch (err) {
        console.warn(`  roster fetch failed for team ${teamId}:`, (err as Error).message);
      }
    }

    return [...players.values()];
  }

  // Fetch all games in the season from the schedule.
  async fetchGames(season: string): Promise<RawGame[]> {
    const seasonId = await resolveSeasonId(season);
    const rows = await fetchScheduleRows(seasonId);

    return rows
      .filter((r) => r.row.game_id)
      .map((r) => {
        const row = r.row;
        const status = mapGameStatus(row.game_status);
        // The schedule row has "Wed, May 8" without a year. We store a
        // placeholder ISO string using just the month/day text; the ingest
        // script overwrites startsAt with the precise GameDateISO8601 value
        // from gameSummary during stat-line import.
        const approxDate = parseScheduleDate(row.date_with_day);
        return {
          externalId: row.game_id,
          season,
          startsAt: approxDate,
          homeTeamExternalId: r.prop.home_team_city.teamLink,
          awayTeamExternalId: r.prop.visiting_team_city.teamLink,
          status,
          homeScore: status === "FINAL" ? Number(row.home_goal_count) : undefined,
          awayScore: status === "FINAL" ? Number(row.visiting_goal_count) : undefined,
        };
      });
  }

  // Fetch per-player stat lines for one game from gameSummary.
  // Returns one RawStatLine per player who appeared (skaters + goalies).
  async fetchStatLines(gameExternalId: string): Promise<RawStatLine[]> {
    const summary = await fetchGameSummary(gameExternalId);
    const ppPoints = computePpPoints(summary);
    const lines: RawStatLine[] = [];

    const homeWon = summary.homeTeam.stats.goals > summary.visitingTeam.stats.goals;

    for (const [side, won] of [
      [summary.homeTeam, homeWon],
      [summary.visitingTeam, !homeWon],
    ] as const) {
      // Skaters
      for (const skater of side.skaters) {
        const s = skater.stats;
        lines.push({
          playerExternalId: String(skater.info.id),
          gameExternalId,
          goals: s.goals,
          assists: s.assists,
          shots: s.shots,
          plusMinus: s.plusMinus,
          penaltyMinutes: s.penaltyMinutes,
          powerPlayPts: ppPoints.get(skater.info.id) ?? 0,
          hits: s.hits,
          blocks: s.blockedShots,
          saves: 0,
          goalsAgainst: 0,
          shutout: false,
          win: false,
          timeOnIceSecs: parseToi(s.toi),
        });
      }

      // Goalies (use goalieLog which has actual game stats, not the summary zeros)
      const goalies = side.goalieLog;
      // The "winning" goalie is the one with the most timeOnIce on the winning team.
      const winnerGoalieId = won
        ? goalies.reduce(
            (best, g) =>
              parseToi(g.stats.timeOnIce ?? "0:00") >
              parseToi(goalies.find((x) => x === best)?.stats.timeOnIce ?? "0:00")
                ? g
                : best,
            goalies[0]
          )?.info.id
        : null;

      for (const goalie of goalies) {
        const s = goalie.stats;
        const toi = parseToi(s.timeOnIce ?? "0:00");
        if (toi === 0) continue; // did not play
        const isWinner = goalie.info.id === winnerGoalieId;
        lines.push({
          playerExternalId: String(goalie.info.id),
          gameExternalId,
          goals: 0,
          assists: 0,
          shots: 0,
          plusMinus: 0,
          penaltyMinutes: 0,
          powerPlayPts: 0,
          hits: 0,
          blocks: 0,
          saves: s.saves,
          goalsAgainst: s.goalsAgainst,
          // Shutout: goalie faced shots, allowed none, and played solo
          shutout: s.goalsAgainst === 0 && s.saves > 0 && goalies.length === 1,
          win: won && isWinner,
          timeOnIceSecs: toi,
        });
      }
    }

    return lines;
  }
}

// "MM:SS" or "M:SS" → total seconds
function parseToi(toi: string | null | undefined): number {
  if (!toi) return 0;
  const [m, s] = toi.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

// "Wed, May 8" → best-effort ISO date string (year inferred as current year).
// Precise time is overwritten from GameDateISO8601 during stat import.
function parseScheduleDate(dateWithDay: string): string {
  const cleaned = dateWithDay.replace(/^\w+,\s*/, ""); // strip "Wed, "
  const d = new Date(`${cleaned} ${new Date().getFullYear()}`);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Expose the GameDateISO8601 from a gameSummary — used by the ingest script
// to backfill game.startsAt after stat lines are imported.
export async function fetchGameStartTime(gameExternalId: string): Promise<string | null> {
  try {
    const summary = await fetchGameSummary(gameExternalId);
    return summary.details.GameDateISO8601 ?? null;
  } catch {
    return null;
  }
}

// Used by the live-stats cron to check whether a game is now final without
// fetching full stat lines first. Calls fetchGameSummary once and returns both
// the finality flag and the precise start time for backfilling startsAt.
export async function checkGameFinal(
  gameExternalId: string
): Promise<{ isFinal: boolean; startsAt: string | null }> {
  try {
    const summary = await fetchGameSummary(gameExternalId);
    return {
      isFinal: mapGameStatus(summary.details.status) === "FINAL",
      startsAt: summary.details.GameDateISO8601 ?? null,
    };
  } catch {
    return { isFinal: false, startsAt: null };
  }
}
