# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A fantasy sports web app for the **PWHL (Professional Women's Hockey League)**, targeting
the **2026-27 season** (12 teams after the Detroit/Hamilton/Las Vegas/San Jose expansion).
Users create leagues, draft real PWHL players the week before the season opener, set
lineups, and compete in weekly head-to-head matchups scored from real game stats.

## Hard constraints / things that bite

1. **No official PWHL fantasy API.** All real-world data flows through the `StatsSource`
   interface in `lib/ingestion/source.ts`. The concrete implementation is `HockeytechSource`
   in `lib/ingestion/hockeytech.ts` — never call it from app code, only from ingestion scripts.
2. **Season start date is not yet official.** Code assumes a ~Nov 2026 opener and a draft
   ~1 week prior. Don't hardcode dates; read them from `FantasyLeague.draftStartsAt` and
   `Game.startsAt`.
3. **Fantasy points are never stored as source of truth.** Always compute from raw
   `StatLine` rows via `lib/scoring`. Cached scores (e.g. `Matchup.homeScore`) are
   recomputable. This lets leagues change scoring rules without data loss.
4. **The live draft room is the highest-risk feature.** Concurrency, a pick clock, and
   every league drafting the same week. Build and load-test it first.
5. Keep **league data** (Team/Player/Game/StatLine) and **fantasy data** (FantasyLeague/
   FantasyTeam/Roster/Draft/Matchup) cleanly separated. League data is read-only to users.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma (`prisma/schema.prisma`)
- Real-time draft: WebSockets (e.g. a small Node ws server or a hosted realtime service)
- Auth: prefer a provider; only use `User.passwordHash` if rolling your own

## Commands

```bash
npm run dev            # start Next.js dev server
npx prisma db push     # sync schema to DB without a migration file (use in dev against Neon)
npx prisma studio      # inspect the DB
npm run seed           # load mock teams/players/games for development
npm run seed-draft     # create a throwaway 4-team draft-ready league (commissioner owns team 1)
npm run draft-server   # start the WebSocket draft server on :8080
npm run draft-cli -- --league <id> --team <id> [--start]  # terminal client for one team
npm run ingest -- --season 2025-26          # pull real data from HockeyTech (slow, needs network)
npm run ingest -- --season 2025-26 --no-stats  # teams/players/games only, skip stat lines
npm run ingest -- --season 2025-26 --resume    # skip games that already have stat lines (resume interrupted run)
npm run export-fixture -- --season 2025-26  # snapshot DB → tests/fixtures/2025-26/*.json
npm run seed-fixture -- --season 2025-26    # load fixture JSON → DB (fast, offline)
npx tsx scripts/seed-playoff.ts [--init-playoffs]  # seed a playoff test league and optionally initialize playoffs
npm test               # run all tests
npx vitest run tests/draft.test.ts  # run a single test file
```

**Full local draft loop:**
```bash
npm run seed && npm run seed-draft   # prints leagueId + team ids
npm run draft-server                 # in one terminal
npm run draft-cli -- --league <id> --team <id> --start  # terminal 1 (commissioner)
npm run draft-cli -- --league <id> --team <id>          # terminal 2..N
```

## Real data source: HockeyTech / LeagueStat

The PWHL licenses [HockeyTech](https://www.hockeytech.com) (also called LeagueStat). The
concrete adapter is `lib/ingestion/hockeytech.ts`.

**Credentials (public, embedded in every thepwhl.com page — no registration needed):**
```
API key:      446521baf8c38984
Client code:  pwhl
Base URL:     https://lscluster.hockeytech.com/feed/index.php
```

**Response format:** JSONP — every response is wrapped in `(` … `)`. Strip one character
from each end before `JSON.parse`. No auth headers, no cookies, no rate-limit observed.

**Key endpoints** (all GET, params: `key=…&client_code=pwhl&site_id=2&league_id=1&lang=en`):

| view | purpose | notes |
|---|---|---|
| `statviewfeed&view=gameSummary&game_id=N` | box score + per-player stats | skaters in `homeTeam.skaters[]`, goalies in `homeTeam.goalieLog[]` (not `goalies[]` — that has zeros) |
| `statviewfeed&view=gameCenterPlayByPlay&game_id=N` | flat array of 163 events | types: `goal`, `shot`, `blocked_shot`, `hit`, `penalty`, `faceoff`, `goalie_change` |
| `statviewfeed&view=schedule&season_id=N` | full season schedule | response shape: `[{sections:[{data:[{prop,row}]}]}]`; team IDs in `prop.home_team_city.teamLink` |
| `statviewfeed&view=roster&team_id=N&season_id=N` | team roster | shape: `{roster:[{sections:[{title,data:[{row:{player_id,name,position,tp_jersey_number}}]}]}]}` |
| `modulekit&view=seasons&fmt=json` | list all season IDs | use to map "2025-26" → `season_id` |

**Season IDs** (as of June 2026):

| season_id | name | playoff |
|---|---|---|
| 9 | 2026 Playoffs | yes |
| 8 | 2025-26 Regular Season | no |
| 6 | 2025 Playoffs | yes |
| 5 | 2024-25 Regular Season | no |
| 3 | 2024 Playoffs | yes |
| 1 | 2024 Regular Season | no |

**Stat-line gotchas:**
- Goalie stats live in `homeTeam.goalieLog[]`, not `homeTeam.goalies[]` (the goalies array has all-zero stats).
- `win` / `shutout` aren't explicit fields — derive: win = team won AND goalie played; shutout = `goalsAgainst==0 AND saves>0 AND only one goalie played`.
- Per-player power-play points aren't in the player stats row. Derive them from `periods[].goals` where `properties.isPowerPlay=="1"`, summing scorer + assist players.
- `timeOnIce` in goalieLog can be `null` for goalies who didn't play — skip those rows.

**Real-time (live games):** Firebase Realtime Database WebSockets at `wss://leaguestat-b9523.firebaseio.com/` push score/event updates. Not needed for historical data; relevant for the live-scoring loop (build phase 4).

**Known data quality issues:**
- Schedule `date_with_day` is "Wed, May 8" with no year. Precise `startsAt` comes from `gameSummary.details.GameDateISO8601`. The ingest script backfills it during stat-line import.
- Roster `name` field is a full string ("Jamie Lee Rattray"). We split on the last space for firstName/lastName — handles compound first names correctly.
- Some players appear in gameSummary who aren't in the season roster (callups, etc.). The ingest skips stat lines for players not in the DB rather than failing.

## Test fixture: 2025-26 regular season

`tests/fixtures/2025-26/` contains a snapshot of the full 2025-26 regular season:
8 teams, 207 players, 120 games, 4,793 stat lines — all with known real-world outcomes.
This fixture is populated and committed; load it instead of hitting the network.

Use it to test scoring logic, standings calculations, and anything that needs a realistic
data set without hitting the network:

```bash
npm run seed-fixture -- --season 2025-26   # loads in ~30s, fully offline
```

Re-export if the schema changes:
```bash
npm run ingest -- --season 2025-26         # re-pull from HockeyTech
npm run export-fixture -- --season 2025-26 # overwrite the JSON files
```

The fixture JSON uses `externalId` references everywhere (no internal cuids), so it
survives DB resets and schema migrations.

## Build order (matches the launch timeline)

1. Scaffold + schema + auth + seed data ✅
2. Roster ingestion pipeline (against mock source) + scoring engine ✅ (scoring done)
3. **Draft room** — server logic ✅, React UI ✅
4. Live scoring loop: matchups, standings, waivers, trades
   - Lineup management ✅ (set active/bench slots, per-player game-time locking)
   - Season matchup lifecycle ✅ (period generation, VTF scoring, status progression)
5. Playoff bracket and postseason flow — standings, seeding, bracket generation, playoff matchups, and results ✅
6. Integration + load test the draft room + beta
7. Public launch ~early Nov, drafts ~1 week before opener

## Draft room UI (`app/draft/[leagueId]/`)

The live draft room is a full-page client component at `app/draft/[leagueId]/page.tsx`.
Each manager opens `/draft/<leagueId>?team=<teamId>`. The server page fetches team names
and determines if the viewer is the commissioner, then passes that down to `DraftRoom.tsx`.

Key pieces:
- `hooks/useDraftSocket.ts` — WebSocket hook; exposes `start`, `makePick`, `listAvailable`,
  `setQueue`, `pause`, `resume`. Connects to `NEXT_PUBLIC_DRAFT_WS_URL` (default `ws://localhost:8080`).
- **TopBar** — shows clock, on-clock team name, Start/Pause/Resume (commissioner only).
- **PickBoard** — full snake grid; cells show last-name of drafted player or team initials.
- **RecentPicks** — last 10 picks with player name, team name, auto flag.
- **PlayerPanel** — two tabs: Available (search + position filter buttons + sortable stat
  columns from prior season + star button to queue/unqueue) and Queue (reorder with ↑/↓,
  remove, or pick directly when on the clock). Auto-refreshes player list after every pick.
- **NeedsPanel** — right column; shows each draftable slot (F/D/G/UTIL/BENCH) with
  `have/need` counts via slot-assignment simulation (same priority as seed scripts:
  position → UTIL → BENCH). Turns green when filled, orange when 1 left. IR is not
  a draftable row — a note at the bottom says "fill from waivers".
- **MyPicks** — right column below NeedsPanel; full list of drafted players with position tags.

Stats are aggregated server-side in `app/draft/[leagueId]/page.tsx` via a single SQL
`GROUP BY` query and passed as `initialStats` props to `DraftRoom` — no client-side fetch
on initial load. The API route `GET /api/leagues/[leagueId]/draft/players` is only called
for filtered searches (position filter or name search) after the initial render.
Skater columns: GP, G, A, PTS, PPP, SOG, HIT, BLK. Goalie columns: GP, W, SV, GA, SV%, SO.
Clicking a column header sorts. `LIST_AVAILABLE` (WebSocket) has no row limit — with ~220
real players the full list is always returned.

`rosterSettings`, `initialStats`, and `statSeason` are all fetched server-side in the page
and passed into `DraftRoom` so the client never needs an extra DB round trip on load.

**`seed-draft` note:** the commissioner is owner of team 1 (draftOrder 1). The draft room
derives `isCommissioner` from `myTeam.ownerId === league.commissionerId` — if the seed script
ever creates a commissioner user who doesn't own a team, the Start/Pause/Resume buttons will
not appear. The current script avoids this by reusing the commissioner user as team 1's owner.

Player names are resolved client-side from the `AVAILABLE` server messages; `playerNames`
and `playerPositions` are stored in refs so they survive across re-renders without
causing extra renders themselves.

CSS vars used: `--surface`, `--clock-warn` (both now defined in `globals.css`).

## Playoff bracket system

A new playoff layer is integrated into the existing fantasy flow without changing how regular season matchups, scoring, or standings work.

- `FantasyLeague.playoffSettings` now stores playoff rules: `teamsInPlayoff`, `topSeedsWithBye`, `roundDurationPeriods`, and `higherSeedWinsTies`.
- `FantasyLeague.playoffStatus` tracks `NOT_STARTED`, `IN_PROGRESS`, and `COMPLETE`.
- `Matchup` rows now support `isPlayoff` and `round`, so playoff matchups are stored in the same table as regular season games and can reuse existing scoring/standings logic.
- Regular season standings are still computed from `!isPlayoff` matchups by `lib/playoffs/seeding.ts`.
- New `lib/playoffs/` modules handle seeding, bracket generation, playoff periods, and lifecycle.
- `lib/scoring/matchups.ts` now includes `generatePlayoffMatchups(...)` to create/update playoff `Matchup` rows safely.
- New API endpoints:
  - `GET /api/leagues/[leagueId]/standings` returns standings plus playoff eligibility and seed info
  - `GET /api/leagues/[leagueId]/bracket` returns the generated playoff bracket
  - `POST /api/leagues/[leagueId]/start-playoffs` initializes playoffs from regular season standings
- New UI route: `app/league/[leagueId]/bracket` renders standings and the playoff bracket view.
- The format is single-elimination for the top 6 teams, with the top 2 seeds receiving byes and higher seeds winning ties.

## Draft module (`lib/draft/`)

The server is the single source of truth. Clients only send "pick player X" and
render broadcast state — they never run the clock or decide whose turn it is.

- `snake.ts` — pure snake-order generator + rounds-from-roster helper.
- `messages.ts` — the websocket wire contract (client/server message types).
- `engine.ts` — pure reducer `(state, action) -> { state, effects }`. ALL draft
  rules live here (turn validation, taken-player checks, timeout auto-pick,
  auto-escalation, completion). No IO, so it's fully unit-tested in `tests/draft.test.ts`.
- `server.ts` — IO layer: `ws` sockets + the real timer + Prisma persistence.
  Performs the effects the engine returns; swap `broadcast`/sockets for a hosted
  realtime service without touching the engine.

Run locally: `npm run draft-server` (ws://localhost:8080?league=<id>). The clock
is server-side and absolute (`expiresAt` epoch ms); a client disconnect can't
stall the draft because TIMEOUT auto-picks on the server. Every pick persists
immediately, so a server restart rebuilds state via `buildEngineState()`.

**Auto-escalation rule:** each team tracks consecutive auto-picks. At 2 in a row, the
team is "flagged" and their clock drops from `baseSecs` (30s default) to `autoSecs` (10s
default), stored in `Draft.pickTimerSecs` / `Draft.autoPickTimerSecs`. A manual pick
within the short window clears the flag and restores the base clock. The flag and counter
are re-derived in `buildEngineState` from `DraftPick.auto` history — no extra column needed.
`DraftState` broadcasts `autoPickCounts` and `autoFlaggedTeams` so the UI can show the
correct clock and flag status. All logic lives in `engine.ts`; timer dispatch is unchanged.

**Server-side gotchas fixed (don't regress):**
- `getRoom` uses a `Map<string, Promise<DraftRoom>>` (not `Map<string, DraftRoom>`) to prevent a race where concurrent JOINs each call `buildEngineState` and end up in separate rooms, breaking broadcast.
- START/PAUSE/RESUME emit a `PERSIST_STATUS` effect so draft status survives server restarts. Without it, `buildEngineState` reads `PENDING` from the DB even mid-draft.
- `DraftPick.auto` is now persisted (was computed-only before). Required for auto-escalation rebuild on restart.

## Roster configuration

The canonical 13-slot roster (used everywhere — seed scripts, tests, draft, scoring):

```
{ forward: 2, defense: 2, goalie: 1, util: 1, bench: 6, ir: 1 }
```

- **13 total slots**, but only **12 draft rounds** — IR is filled from the waiver wire
  post-draft, never drafted. `rostersToRounds` intentionally excludes `ir` from its sum.
- UTIL accepts any skater (F or D), not goalies — same convention as Yahoo.
- Slot-assignment priority when filling a roster from picks: natural position → UTIL
  (skaters only) → BENCH.

Any time you add a new seed script or test that creates a `FantasyLeague`, use this
`rosterSettings` value. Never hardcode a different one without a comment explaining why.

## Lineup management (`app/league/[leagueId]/lineup/`)

Route: `/league/<leagueId>/lineup?team=<teamId>`. If no `team` param, renders a team picker.

The page is a server component that fetches the roster + today's games (for lock status), then
passes everything to `LineupManager.tsx` (client component) as initial props — no client-side
fetch on load.

**UI — click-to-swap interaction:**
- Two-column layout: active slots (F/D/G/UTIL) on the left, bench + IR on the right.
- Click a player to select them (purple highlight, banner prompt).
- Valid destination slots light up with an indigo border. Click one to move the player.
- Clicking an occupied slot with a selected player swaps them if both moves are valid.
- Click the selected player again, or "✕ Cancel selection", to deselect.
- Locked players (🔒) cannot be moved — their team's game has already started today.

**Validation (`lib/lineup.ts` — pure, no IO):**
- Position eligibility: F/D can play their slot or UTIL; G can only play GOALIE; any can play BENCH.
- IR: inactive players only (`player.active = false`).
- Slot capacity checked against `rosterSettings` on both client (highlight) and server (API).
- All validation logic lives in `lib/lineup.ts`; tested in `tests/lineup.test.ts` (17 tests).

**Locking:** a player is locked once their real team's game has started today (UTC day). Determined
server-side in both the page loader and the API — `lockTime()` in `lib/lineup.ts`. Lock is
per-player, not whole-lineup.

**API:** `GET /api/leagues/[leagueId]/lineup?team=<id>` and `PUT /api/leagues/[leagueId]/lineup`
`{ teamId, playerId, slot }`. PUT validates eligibility, capacity, and lock before updating.

**Player stats toggle:** the lineup page shows per-player stats inline, with a "Season / Last week"
toggle in the header.
- **Season** — aggregate of all `StatLine` rows for the player in the league's season (e.g. `2025-26`).
- **Last week** — aggregate for the most recently completed scoring period, derived via `getSeasonState`
  (the same period engine used by `advanceSeason`). Label shows "Week N (Mon – Sun)".
- Stats are aggregated server-side in `lineup/page.tsx` using `scoreStatLine` from `lib/scoring`
  and passed to `LineupManager` as `seasonStats` and `lastWeekStats` maps.
- Skater display: GP, G, A, PTS, PPP, SOG, HIT, BLK, FP. Goalie: GP, W, SV, GA, SV%, SO, FP.
- Empty states: "No games last week" (last-week view) or "No prior-season data" (season view) for
  rookies/expansion players. Never blank or a JS error.

**Scoring integration:** no changes needed — `computeTeamScore` already reads `slot NOT IN [BENCH, IR]`.

**Nav:** "Lineup" link added to the league layout nav (`app/league/[leagueId]/layout.tsx`).

**Dashboard:** team cards now show a "Set lineup" button linking to the lineup page. The dashboard
also surfaces teams from leagues the user commissions (not just teams they directly own), which
fixes the "no teams" problem when using seed-created commissioner accounts.

## Roster page (`app/league/[leagueId]/roster/`)

Replaced the single long scroll (all teams stacked) with a per-team tab filter. A row of team-name
pills at the top acts as the selector; clicking one updates `?team=<id>` in the URL. The server
page reads `searchParams.team` and defaults to `teams[0]` if absent. Only the selected team's
roster card is rendered — no JS needed for switching.

## Service layer (`lib/services/`)

Application services sit between API route handlers and domain/DB logic. They own
orchestration: load data from Prisma, call pure domain functions, write results back.
Route handlers do only HTTP wiring (parse input, call service, return JSON).

Current services:
- `standings-service.ts` — `getStandings(leagueId, prisma)`: loads teams + matchups, runs
  `computeStandings`, decorates with playoff seed/eligibility. Used by the standings API route
  and any page that needs ranked standings.
- `playoff-service.ts` — `getBracket(leagueId, prisma)`: builds bracket and hydrates with
  scored playoff matchups. `startPlayoffs(leagueId, prisma)`: validates preconditions, seeds
  teams, generates bracket, creates DB rows, flips `playoffStatus`. Exports
  `PlayoffNotStartedError` for typed HTTP status decisions in the route.

`lib/season/index.ts` follows the same pattern (predates the `services/` directory) and
should be considered part of this layer even though it lives under `lib/season/`.

**Architecture note from review:** The pure domain engines (`lib/scoring/`, `lib/draft/`,
`lib/playoffs/`, `lib/lineup.ts`) intentionally contain no IO. Services are the only place
that combine Prisma with domain calls. Future additions (waivers, trades, notifications)
should follow this pattern. Recommended next steps post-launch:
- Event table for async scoring/cache-invalidation
- Redis-backed draft coordinator for multi-node scaling
(Both explicitly post-launch per the architecture review.)

## Season lifecycle (`lib/season/`)

Generates and advances the fantasy season's scoring periods. Reuses the existing VTF scoring
functions — no new scoring math.

**Pure engine (`lib/season/lifecycle.ts`):**
`computeSeasonState(periods, games, scoredWeeks, nowMs)` — takes time as a parameter (same
pattern as the draft engine). Never reads the wall clock directly. Returns a `SeasonState`
with each period's status:
- `UPCOMING` — `startsAt > nowMs`
- `ACTIVE`   — `startsAt <= nowMs < endsAt`
- `SCORING_PENDING` — `endsAt <= nowMs` and matchup scores not yet cached
- `COMPLETE` — ended and scores cached

`pendingWeeks(state)` — returns the subset of `ScoringPeriod`s that need scoring right now.

**DB layer (`lib/season/index.ts`):**
- `getSeasonState(leagueId, nowMs, prisma)` — loads game dates + scored weeks from DB, calls
  the pure engine, returns `SeasonState`. Scored weeks are derived from `Matchup.homeScore != null`
  — no new schema column needed.
- `startSeason(leagueId, prisma)` — calls `generateVtfMatchups` to create all period matchups
  upfront, sets `FantasyLeague.status = IN_SEASON`.
- `advanceSeason(leagueId, nowMs, prisma)` — scores all `SCORING_PENDING` periods by calling
  `scoreVtfWeek`, updates `FantasyLeague.status` to `COMPLETE` when all periods are done.

**Persistence:** no new schema columns. Season status lives in `FantasyLeague.status`
(`IN_SEASON` / `COMPLETE`). Period completion is derived from cached `Matchup` scores, which
already survive restarts.

**API routes:**
- `GET  /api/leagues/[leagueId]/season` — current state using real `Date.now()`
- `POST /api/leagues/[leagueId]/season` `{ action: "start" | "advance" }` — production controls
- `POST /api/leagues/[leagueId]/season/advance` `{ simulatedDate, action? }` — **DEV/TEST ONLY**

**Test harness (`/season/advance` route):**
Gated by `NODE_ENV !== "production"` (or `ALLOW_SEASON_ADVANCE=true`). Calls the exact same
`advanceSeason()` function as production — no special code path. The only difference is the
`nowMs` value. Pass a `simulatedDate` past a period's `endsAt` and that period gets scored.
Because the 2025-26 fixture has all games as `FINAL`, every period is immediately scoreable
once `nowMs` passes its end date.

**UI:** `app/league/[leagueId]/season/` — period table showing week, dates, game counts,
final counts, and status badge. In dev mode a yellow-bordered panel shows the simulated-date
controls and "Start season" / "Advance to date" buttons. The UI re-renders after each advance
without a full page reload.

**To test against the 2025-26 fixture:** the league's `season` field must be `"2025-26"` so
the game queries match. Load fixture with `npm run seed-fixture -- --season 2025-26`, then
use the Season page's dev controls to step through periods.

**Tests:** `tests/season-lifecycle.test.ts` (13 tests) — pure engine only, no DB required.
Covers all period status transitions, multi-week gap skipping, `pendingWeeks` selection, and
catching-up when multiple periods are behind.

## Conventions

- Validate `scoringSettings` / `rosterSettings` JSON shape in app code; don't trust the DB.
- All external data is upserted by `externalId` so re-imports are idempotent.
- Test the scoring engine thoroughly — it's pure and easy to test, and it's the core.
