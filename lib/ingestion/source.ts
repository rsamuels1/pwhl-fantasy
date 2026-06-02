// lib/ingestion/source.ts
// The PWHL has no official fantasy API. This interface is the seam between your
// app and WHATEVER stats source you end up using (scrape, license, manual entry).
// Build the whole app against this interface so swapping the source later is a
// one-file change, not a refactor.

export interface RawTeam {
  externalId: string;
  name: string;
  city: string;
  abbreviation: string;
}

export interface RawPlayer {
  externalId: string;
  firstName: string;
  lastName: string;
  position: "FORWARD" | "DEFENSE" | "GOALIE";
  jersey?: number;
  teamExternalId: string | null; // null = free agent
}

export interface RawGame {
  externalId: string;
  season: string;
  startsAt: string; // ISO
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  status: "SCHEDULED" | "LIVE" | "FINAL" | "POSTPONED";
  homeScore?: number;
  awayScore?: number;
}

export interface RawStatLine {
  playerExternalId: string;
  gameExternalId: string;
  goals: number;
  assists: number;
  shots: number;
  plusMinus: number;
  penaltyMinutes: number;
  powerPlayPts: number;
  hits: number;
  blocks: number;
  saves: number;
  goalsAgainst: number;
  shutout: boolean;
  win: boolean;
  timeOnIceSecs: number;
}

export interface StatsSource {
  fetchTeams(season: string): Promise<RawTeam[]>;
  fetchPlayers(season: string): Promise<RawPlayer[]>;
  fetchGames(season: string): Promise<RawGame[]>;
  // Stat lines for a single game (called when a game goes FINAL, or polled while LIVE).
  fetchStatLines(gameExternalId: string): Promise<RawStatLine[]>;
}

// During development before you have a real source, implement a MockStatsSource
// that returns seed data so the rest of the app can be built and tested.
