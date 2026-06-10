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
npm run seed-draft     # create a throwaway 4-team draft-ready league (run after seed)
npm run draft-server   # start the WebSocket draft server on :8080
npm run draft-cli -- --league <id> --team <id> [--start]  # terminal client for one team
npm run ingest -- --season 2025-26          # pull real data from HockeyTech (slow, needs network)
npm run ingest -- --season 2025-26 --no-stats  # teams/players/games only, skip stat lines
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
8 teams, ~220 players, 120 games, ~4,900 stat lines — all with known real-world outcomes.

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
- **PlayerPanel** — two tabs: Available (search + position filter + sortable stat columns from
  prior season, plus "+Q" to add to queue) and Queue (reorder with ↑/↓, remove, or pick
  directly when on the clock). Auto-refreshes after every pick.
- **NeedsPanel** — right column; shows each roster slot type with `have/need` counts so
  managers know which positions to target. Turns green when filled, orange when 1 left.
- **MyPicks** — right column below NeedsPanel; full list of drafted players with position tags.

Stats are served from `GET /api/leagues/[leagueId]/draft/players` which aggregates the most
recent completed regular season's `StatLine` rows per player. Skater columns: GP, G, A, PTS,
PPP, SOG, HIT, BLK. Goalie columns: GP, W, SV, GA, SV%, SO. Clicking a column header sorts.
Stats are fetched over HTTP (not WebSocket) and cached in a `statsMap` ref in `PlayerPanel`.

`rosterSettings` is fetched server-side in the page and passed into `DraftRoom` so both
`NeedsPanel` and future logic can read it without an extra DB call.

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
  completion). No IO, so it's fully unit-tested in `tests/draft.test.ts`.
- `server.ts` — IO layer: `ws` sockets + the real timer + Prisma persistence.
  Performs the effects the engine returns; swap `broadcast`/sockets for a hosted
  realtime service without touching the engine.

Run locally: `npm run draft-server` (ws://localhost:8080?league=<id>). The clock
is server-side and absolute (`expiresAt` epoch ms); a client disconnect can't
stall the draft because TIMEOUT auto-picks on the server. Every pick persists
immediately, so a server restart rebuilds state via `buildEngineState()`.

**Server-side gotchas fixed (don't regress):**
- `getRoom` uses a `Map<string, Promise<DraftRoom>>` (not `Map<string, DraftRoom>`) to prevent a race where concurrent JOINs each call `buildEngineState` and end up in separate rooms, breaking broadcast.
- START/PAUSE/RESUME emit a `PERSIST_STATUS` effect so draft status survives server restarts. Without it, `buildEngineState` reads `PENDING` from the DB even mid-draft.

## Conventions

- Validate `scoringSettings` / `rosterSettings` JSON shape in app code; don't trust the DB.
- All external data is upserted by `externalId` so re-imports are idempotent.
- Test the scoring engine thoroughly — it's pure and easy to test, and it's the core.
