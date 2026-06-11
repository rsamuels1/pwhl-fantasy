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
   - Matchup-first product ✅ (current matchup page, projections, win probability, activity feed)
   - Auth & authorization ✅ (middleware, membership guards, commissioner admin panel)
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

## Lineup management (`app/team/[teamId]/lineup/`)

Route: `/team/<teamId>/lineup`. No team picker needed — auth enforces ownership via `requireTeamOwner`.
The old `/league/<leagueId>/lineup?team=<teamId>` route is a redirect stub.

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
server-side in both the page loader and the API — `lockTime(playerTeamId, games, nowMs?)` in
`lib/lineup.ts`. `nowMs` is optional; omit for real time, pass `getDevNow()` in dev mode. Lock is
per-player, not whole-lineup.

**API:** `GET /api/leagues/[leagueId]/lineup?team=<id>` and `PUT /api/leagues/[leagueId]/lineup`
`{ teamId, playerId, slot }`. PUT validates eligibility, capacity, and lock before updating.
Both handlers use `getDevNowFromRequest(req)` so they respect the dev simulation cookie.

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

**Games remaining this period:** each player card shows a small badge indicating how many games their PWHL team has remaining in the current scoring period (i.e., `startsAt > now AND startsAt < activePeriod.endsAt AND status != FINAL`). Three distinct states:
- `N` (e.g. "2G left") — indigo badge; confirmed games still to play.
- `0` ("0 left") — muted gray; schedule loaded, team confirmed done this period.
- No badge — no active period or schedule doesn't extend far enough (unknown, never shown as a false zero).
Already-locked players (🔒) skip the badge since the manager can't act on them. Goalie badge tooltip notes it's team games, not confirmed starts. Data flows as `gamesThisPeriod: number | null` on `RosterEntryRow`; server uses one batch query (same pattern as `lib/matchups/swingPlayers.ts`) keyed on all roster PWHL team IDs.

**Zero-games warning banner:** a yellow alert strip renders above the active-slot columns whenever any starter has `gamesThisPeriod === 0`. Lists the affected players by name and prompts the manager to bench them. Purely client-side derived from `gamesThisPeriod` — no extra data fetch.

**Scoring integration:** no changes needed — `computeTeamScore` already reads `slot NOT IN [BENCH, IR]`.

**Dashboard:** team cards link to `My Matchup` → `/team/${team.id}/matchup` and `Set Lineup` →
`/team/${team.id}/lineup`. The dashboard surfaces teams from leagues the user commissions (not
just teams they directly own), which fixes the "no teams" problem with seed-created commissioner
accounts.

## Roster pages

**`app/league/[leagueId]/roster/`** — "All Rosters" communal view. A row of team-name pills at
the top filters by team via `?team=<id>`. Server-rendered, no JS needed for switching.

**`app/team/[teamId]/roster/`** — personal roster management. Shows the owner's rostered players
with season stats and a free-agent panel listing all active players not on any team in the league
(raw SQL `NOT IN (SELECT playerId FROM RosterEntry WHERE leagueId = ...)`). Both skater and goalie
stat aggregations are computed server-side and passed to `RosterManager` (client component).

**Free agent fantasy points:** computed server-side from aggregated season totals using the
league's scoring settings. Valid because all scoring terms are additive — `total FP = sum(goals)*goal
+ sum(assists)*assist + ...`. Free agent stats are filtered to the league's season via a subquery
(`JOIN "Game" g ON g.id = sl."gameId" AND g.season = $season` inside the LEFT JOIN, not in a WHERE
clause), which prevents stat lines from other seasons leaking into the count.

**Add/drop refresh:** after a successful add (`handleAdd` in `RosterManager.tsx`), the component
calls `router.refresh()` to re-run the server component and return complete stats for the new
player. Never use `setRoster(data.roster!)` from the waiver API response — that response omits
the `stats` field and would wipe stats from the UI.

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
final counts, and status badge. In dev mode a yellow-bordered panel shows:
- **"⏭ End week N now"** — one-click button that scores the current active week and advances to the next. Use this to step through weeks and check the lineup page with correct games-left data for each period. Shown for ACTIVE or SCORING_PENDING periods.
- **Simulated "now" date picker** — manual control; defaults to 1 minute past the active period's end.
- **"Start season"** / **"Advance to date"** / **"Clear sim date"** buttons.
The UI re-renders after each advance without a full page reload. After each advance, the
`pwhl_dev_sim_date` cookie is set so all other pages reflect the same simulated time (see Dev
simulation mode below).

**Dev fixture for testing games-remaining:** `scripts/seed-future-games.ts` clones existing games into the next 7 days with `status=SCHEDULED` so the lineup page has an active period and shows badges. Run `npx tsx scripts/seed-future-games.ts` to seed, `--clear` to remove.

**To test against the 2025-26 fixture:** the league's `season` field must be `"2025-26"` so
the game queries match. Load fixture with `npm run seed-fixture -- --season 2025-26`, then
use the Season page's dev controls to step through periods.

**Tests:** `tests/season-lifecycle.test.ts` (13 tests) — pure engine only, no DB required.
Covers all period status transitions, multi-week gap skipping, `pendingWeeks` selection, and
catching-up when multiple periods are behind.

## Franchise-first URL structure

The URL space is split into two zones:

- **`/team/[teamId]/`** — personal franchise pages. Only the team owner can access these.
  - `/team/[teamId]/matchup` — current matchup hero, swing players, roster breakdown
  - `/team/[teamId]/lineup` — set active/bench slots with lock indicators and games-remaining badges
  - `/team/[teamId]/roster` — personal roster + free agent listings (add/drop)
- **`/league/[leagueId]/`** — communal league views. Any league member can access these.
  - `/league/[leagueId]/` — overview (standings snapshot, next matchup, recent results)
  - `/league/[leagueId]/standings` — full standings table (user's row highlighted)
  - `/league/[leagueId]/matchups` — full schedule with scored/upcoming matchups
  - `/league/[leagueId]/bracket` — playoff bracket
  - `/league/[leagueId]/roster` — all rosters across all teams ("All Rosters")
  - `/league/[leagueId]/admin` — commissioner-only management panel
  - `/league/[leagueId]/season` — season period table + dev simulation controls

The old `/league/[leagueId]/matchup` and `/league/[leagueId]/lineup` routes still exist as
redirect stubs that look up the user's team and redirect to `/team/[teamId]/matchup` etc.

The league layout header includes a "My Franchise →" shortcut that links to `/team/[teamId]/matchup`
for the current user. The team layout includes a "← League" escape hatch.

**Auth helper:** `requireTeamOwner(teamId, userId)` in `lib/auth.ts` — returns the team
(with `league.id` and `league.name` included) or calls `notFound()` if the user doesn't own it.
Used by all `/team/[teamId]/` pages. The middleware at `middleware.ts` covers both `/league/*`
and `/team/*` routes.

**Entry points after login:**
- Single-team user → `/team/[teamId]/matchup`
- Multi-team user → `/dashboard`
- `app/page.tsx` applies the same redirect for already-logged-in users.

## Matchup page (`app/team/[teamId]/matchup/`)

The primary in-season landing page, now team-scoped. No team picker needed — auth enforces ownership.

**What it shows:**
- `MatchupHero` — current score, projected final, win probability, progress bar; "Upcoming" variant
  with projected scores and "Set lineup →" CTA when the period hasn't started
- Swing players — active roster players whose remaining games this period could flip the result
- Remaining players tonight — who's playing today and what they're projected to score
- Top performers / disappointments for the active period
- Roster breakdown for both teams with per-player stat chips and games-remaining badges
- League activity feed (draft picks, major performances)

**Key modules:**
- `lib/scoring/index.ts` — `scoreStatLineDetailed()` returns `{ total, breakdown[] }` with
  per-category point contributions. `ScoringBreakdown = { label, stat, multiplier, points }`.
- `lib/scoring/settings.ts` — `parseScoringSettings(raw)` validates and returns `ScoringSettings`.
- `lib/projections/index.ts` — `projectPlayer(playerId, position, scoringSettings, prisma, nGames=5)`
  rolling average; `projectTeamRemainingScore(...)` uses `Player.teamId` → `Game WHERE homeTeamId
  OR awayTeamId IN teamIds` (NOT `Game.players` which doesn't exist); `winProbability(my, opp)`
  logistic function with k=15.
- `lib/matchups/swingPlayers.ts` — `getSwingPlayers(myTeamId, opponentTeamId, period, ...)`.
- `lib/services/dashboard.ts` — `getDashboardData(leagueId, myTeamId, nowMs, prisma)` assembles
  the full matchup view model. Falls back to draft pick history when no `LeagueEvent` records exist.
- `lib/services/activity.ts` — `getLeagueActivity(leagueId, limit, prisma)` and `emitEvent(...)`.
  Uses `(prisma as any).leagueEvent` guards since the model requires `prisma db push` to activate.

**`LeagueEvent` schema** (in `prisma/schema.prisma`):
```prisma
enum EventType { DRAFT_PICK PLAYER_ADD PLAYER_DROP TRADE PLAYOFF_QUALIFICATION MAJOR_PERFORMANCE }
model LeagueEvent {
  id        String   @id @default(cuid())
  leagueId  String
  teamId    String?
  playerId  String?
  type      EventType
  data      Json     @default("{}")
  createdAt DateTime @default(now())
  league    FantasyLeague @relation(...)
  @@index([leagueId, createdAt])
}
```
Run `npx prisma db push` after schema changes to activate. Until then, activity falls back
gracefully to draft pick history.

**API:** `GET /api/leagues/[leagueId]/matchup-summary?team=<id>` — wraps `getDashboardData`.

**Gotchas (don't regress):**
- `computeTeamScoreDetailed` in `lib/scoring/matchups.ts` always returns all active roster
  players, even those with 0 points this period. The `players` array is built from `playerIds`
  (all active entries) and falls back to `{ pts: 0, games: 0, statBreakdown: [] }` for players
  with no stat lines yet. If you rewrite this function, don't filter to `byPlayer.entries()` only
  — that silently drops players who haven't played yet and shows "No active players" for their
  opponent's roster on the matchup page.
- `getDashboardData` fetches both `myRoster` and `opponentRoster` for upcoming periods
  (when `isUpcoming = true`). Both rosters use the same `activeRosterInclude` and the same
  games-remaining batch query. Dropping the opponent fetch leaves the opponent column empty.

## Auth & authorization

### Middleware (`middleware.ts` at repo root)

Handles the cookie check globally before any league or team route:
- `/league/*` and `/team/*` — redirects to `/login?returnTo=<path>` if no cookie
- `/api/leagues/*` — returns 401 if no cookie

### `lib/auth.ts` helpers

**Page-level (throw/redirect on failure):**
- `requireAuth(returnTo?)` — returns `User` or redirects to `/login?returnTo=...`
- `requireLeagueMember(leagueId, userId)` — returns `FantasyTeam` or calls `notFound()`
- `requireCommissioner(leagueId, userId)` — returns `FantasyLeague` or calls `notFound()`
- `requireTeamOwner(teamId, userId)` — returns `FantasyTeam & { league: { id, name } }` or calls `notFound()`. Used by all `/team/[teamId]/` pages.

**API-level (return NextResponse on failure):**
- `apiRequireAuth(req)` — returns `User | NextResponse(401)`
- `apiRequireLeagueMember(leagueId, userId)` — returns `FantasyTeam | NextResponse(403)`
- `apiRequireCommissioner(leagueId, userId)` — returns `FantasyLeague | NextResponse(403)`

**Pattern for API routes:**
```ts
const auth = await apiRequireAuth(req);
if (auth instanceof NextResponse) return auth;
const member = await apiRequireLeagueMember(leagueId, auth.id);
if (member instanceof NextResponse) return member;
```

All 14 API routes under `app/api/leagues/[leagueId]/` have auth guards. Member-only routes
use the member guard; commissioner-only routes (season POST, start-playoffs, draft/setup,
simulate) use the commissioner guard. Lineup PUT additionally verifies `teamId === myTeam.id`.

All pages under `app/league/[leagueId]/` call `requireAuth` + `requireLeagueMember` at the top.
All pages under `app/team/[teamId]/` call `requireAuth` + `requireTeamOwner` at the top.

### Dev credentials (from seed scripts)

- Commissioner: `commish@dev.local`
- Team owners: `owner2@dev.local`, `owner3@dev.local`, etc.

No passwords — the app uses email-only cookie auth (`pwhl_user_email`, 30-day session).

### Admin panel (`app/league/[leagueId]/admin/`)

Commissioner-only page gated by `requireCommissioner`. Contains:
- League info summary
- Team management (AddTeamForm)
- Draft setup / status and team join links
- Season management (SeasonView with dev controls)

The league overview (`/league/<id>`) no longer shows commissioner tools — it's a read-only
snapshot for all members with an "Admin panel →" link that only appears for commissioners.

### League layout nav

`app/league/[leagueId]/layout.tsx` is async and fetches the current user + league commissioner.
Nav items shown to all members: Overview, Standings, Schedule, Bracket, Rosters.
"Admin" is appended only when `user.id === league.commissionerId`.
A "My Franchise →" button links to `/team/[myTeamId]/matchup` when the user has a team.
Matchup, Lineup, and Roster are NOT in the league nav — they live in the team layout.

The team layout (`app/team/[teamId]/layout.tsx`) nav: My Matchup, My Lineup, My Roster, plus a
"← League" escape hatch.

### Login flow

`POST /api/auth/login` returns `{ user, redirectTo }`:
1. If `returnTo` is in the request body (same-origin path) → use it
2. Else if user has exactly 1 team → `/team/<teamId>/matchup`
3. Else → `/dashboard`

`app/login/page.tsx` reads `?returnTo` from `window.location.search` in a `useEffect`
(avoids Suspense complexity with `useSearchParams`) and redirects to `data.redirectTo`
after a successful login.

`app/page.tsx` redirects logged-in users: 1 team → `/team/<teamId>/matchup`, otherwise → `/dashboard`.
`app/layout.tsx` is async and shows the user's display name + Logout link when logged in.

## Dev simulation mode (`lib/devTime.ts`)

In development, a `pwhl_dev_sim_date` cookie (ISO 8601 string) persists the simulated "now"
across page navigations. This lets you advance a week in the season page, then navigate to the
lineup or matchup page and see it reflect the same simulated point in time.

**How it works:**
- `SeasonControls.tsx` sets `document.cookie = "pwhl_dev_sim_date=<iso>; path=/; max-age=86400"`
  after every successful advance call.
- A "Clear sim date" button in `SeasonControls` and a "Clear" link in the layout banner both
  set `max-age=0` to remove the cookie and reload.
- A yellow "⚠ Dev mode · Simulated: [date] · Clear" banner appears in both the league and team
  layouts whenever the cookie is present.

**Helpers in `lib/devTime.ts`:**
- `getDevNow(): Promise<number>` — reads `cookies()` from `next/headers` (async, Next.js 15).
  Returns the cookie value as `ms` epoch, or real `Date.now()` if absent or in production.
  Used by server component pages: `const nowMs = await getDevNow()`.
- `getDevNowFromRequest(req: NextRequest): number` — sync, reads from `req.cookies`. Used by
  API route handlers.

**Pages that use `getDevNow()`:**
- `app/team/[teamId]/lineup/page.tsx` — `nowMs` drives `getSeasonState`, the "today's games"
  window for lock detection, games-remaining queries, and `lockTime()`.
- `app/team/[teamId]/matchup/page.tsx` — passed to `getDashboardData`.
- `app/league/[leagueId]/season/page.tsx` and `admin/page.tsx` — passed to `getSeasonState`.

**API routes that use `getDevNowFromRequest()`:**
- `app/api/leagues/[leagueId]/lineup/route.ts` — GET and PUT both use it for the "today" window
  and `lockTime()`.

In production (`NODE_ENV === "production"`) both helpers unconditionally return `Date.now()` —
the cookie is never read.

## Conventions

- Validate `scoringSettings` / `rosterSettings` JSON shape in app code; don't trust the DB.
- All external data is upserted by `externalId` so re-imports are idempotent.
- Test the scoring engine thoroughly — it's pure and easy to test, and it's the core.
- All pages under `app/league/[leagueId]/` must call `requireAuth` + `requireLeagueMember`
  before any DB queries. All pages under `app/team/[teamId]/` must call `requireAuth` +
  `requireTeamOwner`. All API routes under `app/api/leagues/[leagueId]/` must call the
  `apiRequire*` guards. Commissioner-only actions use `requireCommissioner` / `apiRequireCommissioner`.
- Use `(prisma as any).leagueEvent` with a null-check guard for any code that queries `LeagueEvent`
  until `prisma db push` + `prisma generate` has been run in the target environment.
