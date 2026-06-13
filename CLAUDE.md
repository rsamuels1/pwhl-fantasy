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
npx tsx scripts/simulate-season.ts              # end-to-end season sim (Create→Draft→Score→Playoffs→Champion)
npx tsx scripts/simulate-season.ts --league <id>  # reuse an existing league
npx tsx scripts/simulate-season.ts --dry-run    # print plan without DB writes
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
   - VP standings authority ✅ (`computeVpStandings` is the single source everywhere; `scoringMode @default("VP")`)
   - Period-based lineup lock ✅ (`lockTime` locks for the full week once team played any period game)
   - Lineup management ✅ (set active/bench slots, per-player game-time locking, play-lock rule)
   - Lineup management v2 ✅ ("Matchup Proj" tab, between-weeks lineup nudge banner, mobile compact stats)
   - Season matchup lifecycle ✅ (period generation, VTF scoring, status progression)
   - Matchup-first product ✅ (fantasy home, projections, win probability, lineup alerts, storyline chip)
   - Auth & authorization ✅ (middleware, membership guards, commissioner admin panel)
   - Schedule page ✅ (`/team/[teamId]/schedule` — PWHL games this period, progress bar, player counts)
   - Dashboard action items ✅ (contextual alerts: draft live, new week, close match, upcoming soon)
   - Transaction History ✅ (paginated league transaction log at `/league/[leagueId]/transactions` with type filters, team filter, scroll pagination, replay guard)
   - Sim-date audit ✅ (all pages and API routes respect `pwhl_dev_sim_date` cookie)
   - League Overview Redesign ✅ (playoff race as primary module, per-team lineup status widget, commissioner action strip, inline announcement editing)
   - Roster Page UX Overhaul ✅ (default table view FP-sorted, `?view=` team selector, sortable roster+FA tables, full HIT/BLK/GA columns, "Rosters" nav)
5. Playoff bracket and postseason flow — standings, seeding, bracket generation, playoff matchups, and results ✅ (4-team/no-bye bracket, bracket bug fixed, `scripts/simulate-season.ts` validates full flow)
   - Commissioner recovery tools ✅ (CT-001/002: force-move, undo-transaction, replace-manager; `lib/services/audit-service.ts`; audit log in admin panel; draft-paused banner)
   - Season renewal ✅ (`lib/services/renewal-service.ts` `renewLeague`; `POST /api/leagues/[leagueId]/renew`; `components/RenewLeagueForm.tsx`; admin "Start Next Season" gated on `playoffStatus === COMPLETE`)
   - Multi-season schema ✅ (`parentLeagueId`, `rulesVersion`, `scoringVersion`, `pwhlPlayoffStartsAt` on `FantasyLeague`; self-referencing `"LeagueLineage"` relation)
   - Season boundary enforcement ✅ (`validateSeasonBoundary()` in `lib/season/lifecycle.ts`; `startSeason()` blocks overlap when `pwhlPlayoffStartsAt` is set on the league)
   - Analytics instrumentation ✅ (`trackEvent` in `lib/analytics/index.ts`; 6 events: `user_registered`, `league_created`, `league_joined`, `draft_started`, `draft_completed`, `lineup_saved`)
   - VP education ✅ (`components/VpExplainer.tsx` on standings page; 8-team "Recommended" label on league creation form; IA-005/006)
   - Notification framework ✅ (`lib/services/notification-service.ts`; `Notification`/`NotificationPreference` models; in-app bell in league layout; draft server call sites; schema delta shipped: `title`, `body`, `actionUrl`, `teamId`, `dedupeKey` + `@@unique([userId,type,dedupeKey])`; email deferred)
   - Onboarding ✅ (welcome flow, 6-step league setup wizard, manager draft prep guide, replay explanation; `User.onboardingCompletedAt`; `components/WelcomeFlow.tsx`; `app/create-league/CreateLeagueWizard.tsx`; `app/api/user/onboarding/route.ts`)
   - Mobile Optimization ✅ (draft room tabbed layout at ≤900px via `useIsMobile`; 44px touch targets on all interactive buttons; BottomNav `env(safe-area-inset-bottom)`; standings `minWidth` reduced; matchup score `clamp()`; swing player ellipsis truncation; spec: `docs/02-engineering/mobile-optimization-spec.md`)
   - Error Handling ✅ (`components/ErrorState.tsx`, `EmptyState.tsx`, `LoadingState.tsx`; `loading.tsx`+`error.tsx` for 11 routes; draft room raw-error display fixed; empty-state copy standardised; pre-season standings empty state; spec: `docs/02-engineering/error-handling-spec.md`)
   - IA-011 ✅ (bracket page hides bye text when `topSeedsWithBye === 0`; fixed default from 2→0; settings page replaces raw JSON `<pre>` dumps with human-readable labeled rows for scoring, roster, and playoff format; checklist: `docs/02-engineering/ia-011-checklist.md`)
   - Playoff journey fixes ✅ (9 issues resolved: `POST /api/leagues/[leagueId]/advance-playoff-round` commissioner route + SeasonControls UI; eliminated-team detection in `getPlayoffDashboardData`; playoff matchup week numbers; `ChampionInfo` on `DashboardData` + champion card on matchup page + league overview banner; commissioner action strip playoff awareness; "View bracket →" in DuelHero; `playoffPending` between-rounds state; rich mini bracket in league overview; async params in bracket/matchups pages)
6. Integration + load test the draft room + beta
   - Draft Reliability Certification ✅ (duplicate-tab handling, concurrent-league load test, reconnect stress test; findings in `docs/04-operations/commissioner-runbook.md`; all MVP scorecard gates green)
   - Founder Operations Console ✅ (`app/founder/` — dashboard, league explorer, league detail with sim controls, throwaway season validator; `FOUNDER_EMAILS` env-var auth gate; API routes under `app/api/founder/`; no schema change)
7. Public launch ~early Nov, drafts ~1 week before opener

## Draft room UI (`app/draft/[leagueId]/`)

The live draft room is a full-page client component at `app/draft/[leagueId]/page.tsx`.
Each manager opens `/draft/<leagueId>?team=<teamId>`. The server page fetches team names
and determines if the viewer is the commissioner, then passes that down to `DraftRoom.tsx`.

Key pieces:
- `hooks/useDraftSocket.ts` — WebSocket hook; exposes `start`, `makePick`, `listAvailable`,
  `setQueue`, `pause`, `resume`. Connects to `NEXT_PUBLIC_DRAFT_WS_URL` (default `ws://localhost:8080`).
  Reconnects automatically on `onclose` with exponential backoff (1s → 2s → 4s → … → 30s cap); resets
  on successful open. `shouldReconnectRef` prevents reconnect loops after intentional unmount or
  league/team change.
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
- The format is single-elimination for the **top 4 teams, with no byes** (1v4, 2v3 in round 1) and higher seeds winning ties. Schema default: `teamsInPlayoff: 4, topSeedsWithBye: 0`.

## Commissioner recovery tools

Three commissioner-only API routes, all requiring `apiRequireCommissioner`, all writing to the audit log:

- **`POST /api/leagues/[leagueId]/commissioner/force-move`** — moves a player on any team. Reuses `validateSlotMove`, `eligibleSlots`, `lockTime` from `lib/lineup.ts` without the ownership check. Supports swap via `swapWithPlayerId`. Does NOT bypass slot eligibility or play-lock rules.
- **`POST /api/leagues/[leagueId]/commissioner/undo-transaction`** — body `{ type: "waiver" | "draft-pick", teamId? }`. Waiver: reverses the last `PLAYER_ADD/DROP` `LeagueEvent` for a team; requires player not on another team. Draft-pick: requires `draft.status === "PAUSED"`; nulls out the last pick, removes its `RosterEntry`, decrements `Draft.currentPick`.
- **`PUT /api/leagues/[leagueId]/teams/[teamId]/owner`** — body `{ newOwnerEmail }`. Upserts new `User` by email; validates they don't already own a different team in the league; updates `fantasyTeam.ownerId`. Roster/standings preserved.

All three write a `LeagueEvent` via `logCommissionerAction` from `lib/services/audit-service.ts`.

**Admin panel** (`app/league/[leagueId]/admin/page.tsx`) shows: `CommissionerRecoveryTools` component (replace owner, undo transaction, force move), audit log table (last 50 commissioner `LeagueEvent` rows), draft-paused banner, and "Start Next Season" section gated on `playoffStatus === "COMPLETE"` using `RenewLeagueForm`.

## Audit service (`lib/services/audit-service.ts`)

`logCommissionerAction(leagueId, commissionerId, action, data, prisma)` creates a `LeagueEvent` row using commissioner event types. `CommissionerEventType` covers 7 values: `COMMISSIONER_FORCE_MOVE`, `COMMISSIONER_UNDO_TRANSACTION`, `COMMISSIONER_REPLACE_MANAGER`, `COMMISSIONER_DRAFT_PAUSED`, `COMMISSIONER_DRAFT_RESUMED`, `COMMISSIONER_ANNOUNCEMENT`, `COMMISSIONER_SETTINGS_CHANGED`. The `data` JSON always includes `{ timestamp, commissionerId, action, ...details }`.

Called by: all three commissioner API routes, and `lib/draft/server.ts` after PAUSE/RESUME effects via a private `logDraftAction()` helper (fire-and-forget, catches all errors).

## Renewal service (`lib/services/renewal-service.ts`)

`renewLeague(leagueId, overrides, prisma)` — copies `scoringSettings`, `rosterSettings`, `playoffSettings`, `draftType`, `maxTeams`; sets `parentLeagueId` pointing to the current league; bumps season with `bumpSeason("2026-27") → "2027-28"`. Returns `{ newLeagueId }`. Throws `RenewalBlockedError` when `playoffStatus !== "COMPLETE"` or `childLeagues.length > 0` (idempotent: returns the existing child ID if already renewed).

**Routes:** `POST /api/leagues/[leagueId]/renew` (commissioner-only, returns `{ newLeagueId, redirectTo: "/league/.../admin?renewed=1" }`, 409 on `RenewalBlockedError`). `GET /api/leagues/[leagueId]/history` (member-accessible, walks the parentLeagueId chain depth-10, returns seasons ordered oldest-first with champion).

**Schema additions** (`prisma/schema.prisma`):
- `parentLeagueId String?` — self-referencing with named relation `"LeagueLineage"`
- `rulesVersion Int @default(1)` — frozen after draft; increment when v1 rules change between seasons
- `scoringVersion Int @default(1)` — same lifecycle as rulesVersion
- `pwhlPlayoffStartsAt DateTime?` — when set, `startSeason()` calls `validateSeasonBoundary()` and throws if any period ends after this date
- 7 new `EventType` enum values (see audit service above)

## Analytics (`lib/analytics/index.ts`)

`trackEvent(e: AnalyticsEvent): void` — V1 writes `console.log("[ANALYTICS]", ...)`. Designed to swap to PostHog/Plausible by replacing the function body only; call sites are unchanged. All callers wrap in `try { } catch {}` — fire-and-forget, never blocks responses.

**6 instrumented events:**

| Event | File |
|---|---|
| `user_registered` | `app/api/leagues/create/route.ts` and `join/route.ts` (when user is new) |
| `league_created` | `app/api/leagues/create/route.ts` |
| `league_joined` | `app/api/leagues/join/route.ts` |
| `draft_started` | `lib/draft/server.ts` — after `PERSIST_STATUS` lands `IN_PROGRESS` |
| `draft_completed` | `lib/draft/server.ts` — after `COMPLETE` effect |
| `lineup_saved` | `app/api/leagues/[leagueId]/lineup/route.ts` PUT handler |

## Notification framework (`lib/services/notification-service.ts`)

`createNotification(userId, type, data, prisma, leagueId?, opts?)` — writes a `Notification` row; silently no-ops on Prisma P2002 (duplicate `dedupeKey`). Fire-and-forget — all call sites use `void` and catch internally. `markAllRead(userId, leagueId, prisma)` — sets `readAt = now` on all unread notifications for that user in the league.

**`opts` fields:** `{ title?: string, teamId?: string, body?: string, actionUrl?: string, dedupeKey?: string }`. `title` defaults to `""` when omitted. Scheduled triggers must supply a `dedupeKey` for idempotent delivery.

**`NotificationType` enum:** `DRAFT_STARTING` | `ON_THE_CLOCK` | `LINEUP_INCOMPLETE`

**Schema models:** `Notification` (id, userId, leagueId?, teamId?, type, title String, body?, actionUrl?, dedupeKey?, data Json, readAt DateTime?, createdAt — `@@unique([userId,type,dedupeKey])`) and `NotificationPreference` (userId, leagueId, type, enabled — `@@unique([userId, leagueId, type])`).

**Call sites in `lib/draft/server.ts`:**
- `PERSIST_STATUS IN_PROGRESS` effect → `void this.notifyDraftStarting()` (one notification per team owner, title "Draft is starting!", actionUrl `/draft/<id>?team=<id>`) and `void this.notifyOnClock()` (the first team on the clock)
- `BROADCAST_PICK` effect → `void this.notifyOnClock()` for the next team on the clock (title "You're on the clock", body "Pick N of M", actionUrl `/draft/<id>?team=<id>`; skips after final pick)

**API:** `GET /api/leagues/[leagueId]/notifications` returns last 20 for the current user in this league. `POST` with `{ action: "markAllRead" }` marks all as read.

**UI:** `components/NotificationBell.tsx` — client component. Server-fetches unread count in `app/league/[leagueId]/layout.tsx` and passes as `initialCount`. On click: fetches notification list, marks all read, shows dropdown. Items render `n.title` (fallback to `TYPE_LABEL[n.type]`), `n.body` as secondary line, and wrap in `<a href={n.actionUrl}>` when present. Unread badge turns red when count > 0.

**V1 is in-app only.** Email and push channels are deferred post-beta.

## Onboarding (`app/create-league/`, `components/WelcomeFlow.tsx`)

Four surfaces guide a new user from first login to a drafted, ready-to-play league.

**Schema:** `User.onboardingCompletedAt DateTime?` — set on first wizard visit; prevents the welcome flow from re-appearing.

**Surface 1 — Welcome flow** (`components/WelcomeFlow.tsx`):
Shown on `/dashboard` when `!user.onboardingCompletedAt && teams.length === 0`. Three orientation cards ("What this is", "How you win", "Two ways to start") plus CTAs to create a league, join one, or try a replay. Dismiss button calls `POST /api/user/onboarding` (sets `onboardingCompletedAt`) then `router.refresh()`.

**Surface 2 — League setup wizard** (`app/create-league/`):
`page.tsx` is a server component that calls `requireAuth` and passes the user to `CreateLeagueWizard.tsx` (client). Six steps:
1. League name (≤50 chars)
2. Size (6/8/10/12 — 8 highlighted as "Recommended")
3. Season mode (Live vs ⏪ Replay) + optional draft date; replay path creates the league immediately
4. Rules confirmation (read-only: 3F·2D·1UTIL·1G·6B, VP standings, 4-team playoffs)
5. Invite link (`InviteLinkButton`) — league is created at the step-4→5 transition
6. Done → draft prep summary

The wizard calls `POST /api/leagues/create` using the session cookie (no email field needed for authenticated users). The API supports both session-based (wizard) and email-based (legacy form) creation via cookie-first fallback.

**New API:** `POST /api/user/onboarding` — sets `onboardingCompletedAt` on the authenticated user (idempotent).

**Surface 3 — Manager draft prep guide** (`app/league/[leagueId]/page.tsx`):
Shown in the left column of the league overview when `league.status === 'PRE_DRAFT' && !isCommissioner`. Four checklist items: Joined ✅ · Learn VP scoring (inline `VpExplainer` toggle) · Build draft queue (link to draft room) · Draft countdown (if `draftStartsAt` is set). Disappears once results exist or season starts. Commissioners see the admin panel checklist instead (already robust in `app/league/[leagueId]/admin/page.tsx`).

**Surface 4 — Replay explanation**: inline in wizard step 3 when the user selects "Replay" mode.

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
- `START`, `PAUSE`, `RESUME` are commissioner-only **on the server** — `isCommissioner(ws)` in `DraftRoom.handle()` checks that the sender's registered team id matches the commissioner's team id. The WebSocket protocol is enforced server-side in addition to the UI hiding these buttons for non-commissioners.
- `bestAvailablePlayerIds(teamId)` is position-aware: runs the same slot-fill simulation as NeedsPanel (position → UTIL → BENCH) to determine unfilled starting slots, then assigns each undrafted player a priority tier (1 = goalie filling a needed G slot, 2 = skater filling a needed F/D/UTIL slot, 3 = bench only) and sorts by proxy FP (goals×2 + assists×1.5 + win×5 + shutout×3) within each tier. The hard 50-player cap was removed. `DraftRoom` stores `rosterSettings` and `leagueSeason` (loaded in `buildEngineState`); `onTimeout` resolves the on-clock team from `this.state.order[currentOverall - 1].fantasyTeamId`.

## Roster configuration

The canonical 13-slot roster (used everywhere — seed scripts, tests, draft, scoring):

```
{ forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 }
```

- **13 total slots**, all drafted — **13 draft rounds** total.
- UTIL accepts any skater (F or D), not goalies — same convention as Yahoo.
- Slot-assignment priority when filling a roster from picks: natural position → UTIL
  (skaters only) → BENCH.
- IR slot (`ir: 1`) is supported by the code for backward compat but is **not** included
  in the default rosterSettings. IR players come from the waiver wire post-draft.

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
- Locked players (🔒) cannot be moved — their team has played a game in the current scoring period.

**Validation (`lib/lineup.ts` — pure, no IO):**
- Position eligibility: F/D can play their slot or UTIL; G can only play GOALIE; any can play BENCH.
- IR: inactive players only (`player.active = false`).
- Slot capacity checked against `rosterSettings` on both client (highlight) and server (API).
- All validation logic lives in `lib/lineup.ts`; tested in `tests/lineup.test.ts` (19 tests).

**Locking:** a player is locked for the **entire scoring period** once their real team has played any game in the current scoring period. Determined server-side in both the page loader and the API — `lockTime(playerTeamId, games, nowMs?, periodStartMs?)` in `lib/lineup.ts`.
- When `periodStartMs` is provided: locks if the team played any game in `[periodStart, nowMs]` (weekly lock — the default for in-season use).
- Without `periodStartMs`: falls back to locking on today's games only (backward compat for non-season contexts).
- Both the lineup page (`app/team/[teamId]/lineup/page.tsx`) and the lineup API (`app/api/leagues/[leagueId]/lineup/route.ts`) pass `activePeriod.startsAt.getTime()` as `periodStartMs` when an active period exists.
Lock is per-player, not whole-lineup.

**Play-lock rule (active→bench/IR restriction):** a player who has played any game in the current
active scoring period (`StatLine` count > 0 for games with `startsAt <= nowMs`) cannot be moved
from an active slot to bench or IR. This prevents gaming the scoring by retroactively benching
underperformers after they've already contributed (or not) to the score. The rule:
- Is enforced server-side in `PUT /api/leagues/[leagueId]/lineup` for both single-move and swap paths.
  The API calls `getSeasonState` to find the active period, then counts stat lines in `[period.startsAt, nowMs]`.
- Is enforced client-side via `hasPlayedThisPeriod: boolean` on `RosterEntryRow`. `canMoveTo(slot)`
  returns false when the selected player has played and the target is BENCH/IR. Bench player cards
  are not highlighted as valid swap targets either.
- Does NOT block active-to-active swaps (FORWARD ↔ UTIL is still allowed).
- Is signaled visually with a green `✓ Played` badge on active players in `PlayerInfo`.
- `hasPlayedThisPeriod` is derived server-side in `lineup/page.tsx` from `thisWeekStats[playerId]?.gp > 0`.

**API:** `GET /api/leagues/[leagueId]/lineup?team=<id>` and `PUT /api/leagues/[leagueId]/lineup`
`{ teamId, playerId, slot, swapWithPlayerId? }`. When `swapWithPlayerId` is present, both
players atomically exchange slots in a `prisma.$transaction` — capacity is not checked (a swap
is count-neutral), only eligibility and the play-lock rule are validated. When absent, the
single-player move path runs full eligibility + capacity + lock + play-lock validation. Both
handlers use `getDevNowFromRequest(req)` so they respect the dev simulation cookie.

**Swap direction:** the `LineupManager` always sends `swapWithPlayerId` when moving into an
occupied slot (bench→active or active→bench). This is the only safe path when a slot is full —
the single-player move path would fail capacity validation even if the net result is neutral.

**Player stats toggle:** the lineup page shows per-player stats inline, with a four-way toggle:
"Projected / This week / Last week / Season". Default: "This week" when an active period exists,
"Projected" when between weeks (no active period but a next period exists), otherwise "Season".
Each tab is disabled when no data exists for that view.
- **Projected** — rolling 5-game avg FP/game × number of PWHL games the player's team has
  scheduled in the next scoring period. Disabled when no upcoming period exists. Label shows
  "Projections for Week N (Mon – Sun) · rolling 5-game avg × scheduled games". Empty state:
  "No recent data". Data: `projectedStats` map from server (`projectedFp`, `avgFpPerGame`, `games`).
  A starter-total summary bar shows below the active-slots panel with the summed projected FP
  and a bench-upgrade hint if a bench player projects higher than the lowest active starter
  at the same eligible position.
- **This week** — stats from games played so far in the active scoring period (i.e., `startsAt >=
  activePeriod.startsAt AND startsAt <= now`). Only available when a period is ACTIVE. Label shows
  "Week N (Mon – Sun)". Empty state: "No games yet this week".
- **Last week** — aggregate for the most recently COMPLETE scoring period. Label shows "Week N (Mon – Sun)".
  Empty state: "No games last week".
- **Season** — aggregate of all `StatLine` rows for the player in the league's season (e.g. `2025-26`).
  Empty state: "No prior-season data" for rookies/expansion players.
- All views are aggregated server-side in `lineup/page.tsx` using `scoreStatLine` from `lib/scoring`
  and passed to `LineupManager` as `seasonStats`, `lastWeekStats`, `thisWeekStats`, and `projectedStats`
  maps alongside `lastWeekLabel`, `thisWeekLabel`, and `nextWeekLabel` strings.
- Skater display: GP, G, A, PTS, PPP, SOG, HIT, BLK, FP. Goalie: GP, W, SV, GA, SV%, SO, FP.
  `SOG`, `HIT`, `BLK` (skaters) and `SV`, `GA`, `SO` (goalies) carry `className="stat-secondary"`
  and are hidden via `@media (max-width: 480px) { .stat-secondary { display: none; } }` in `globals.css`.

**Games remaining this period:** each player card shows a small badge indicating how many games their PWHL team has remaining in the current scoring period. Uses `periodForGames = activePeriod ?? upcomingPeriod` so the badge is correct both mid-week (ACTIVE) and between weeks (UPCOMING). Query: `startsAt > now AND startsAt < periodForGames.endsAt` — **no** `status != FINAL` filter; the historical fixture has all games as `FINAL`, so filtering by status would zero out all badges when simulating. `startsAt > now` alone is sufficient to establish "not yet played." Three distinct states:
- `N` (e.g. "2G left") — indigo badge; confirmed games still to play.
- `0` ("0 left") — muted gray; schedule loaded, team confirmed done this period.
- No badge — no active or upcoming period, or schedule doesn't extend far enough (unknown, never shown as a false zero).
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

**`app/team/[teamId]/roster/`** — personal roster management (`RosterManager.tsx`). Both skater
and goalie stat aggregations are computed server-side and passed as initial props — no client-side
fetch on load.

- **Default view is the sortable table** (not cards), sorted by FP descending. Cards view is still
  available via a tab toggle.
- **Team selector dropdown** — `?view=<teamId>` query param lets the manager view any team's roster
  on the same page. The server fetches the viewed team's roster + stats; the client navigates via
  `router.push("?view=<id>")`. Viewing another team is **read-only**: tab bar hidden, Drop buttons
  hidden, a "← My Team" back button shown. Security: the server verifies the viewed team belongs to
  the same league (`findFirst({ where: { id, leagueId } })`).
- **Full column set** — skater: GP G A PTS PPP SOG HIT BLK FP; goalie: GP W SV% GA SO FP. Both the
  roster table and the free-agent table are sortable by any column (click header to toggle asc/desc).
  `SortKey` type includes `"goalsAgainst"` for the GA column.
- **Nav label** in `TeamNav.tsx` is `"Rosters"` (not `"Roster"`).
- **Free agent panel** lists all active players not on any team in the league (raw SQL `NOT IN`
  subquery). Stats filtered to the league's season via a LEFT JOIN subquery — prevents cross-season
  leakage. Sorted by FP desc by default, sortable by any column.

**Free agent fantasy points:** computed server-side from aggregated season totals using the
league's scoring settings. Valid because all scoring terms are additive — `total FP = sum(goals)*goal
+ sum(assists)*assist + ...`.

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
- **"⏭ End week N now"** — scores the active (or first pending) week. After scoring, the cookie
  lands at **9am UTC on the first day of the next period** — the next week is immediately ACTIVE.
  `targetPeriod` checks ACTIVE → SCORING_PENDING → UPCOMING (in that order), so the button
  correctly bridges mid-season calendar gaps (e.g. the 21-day all-star break in the 2025-26
  season) without disappearing.
- **"⏩ Sim to playoffs"** — scores all remaining regular-season weeks in a single click by
  calling `advanceSeason` with the simulated date set past the final week's `endsAt`.
  After completion, the "▶ Start Playoffs" button appears. No API changes needed —
  `advanceSeason` already handles multi-week scoring. Only shown when unscored regular-season
  weeks remain.
- **"+1 Day →"** — advances the sim date by 24 hours without scoring anything. Lets you step
  through a week day-by-day to observe how games-remaining badges and lock state change.
- **Simulated "now" date picker** — manual override; defaults to 1 minute past the target period's end.
- **"Start season"** / **"Advance to date"** / **"Clear sim date"** buttons.
The UI re-renders after each advance without a full page reload. After each advance, the
`pwhl_dev_sim_date` cookie is set so all other pages reflect the same simulated time.

**Two-step simulation workflow:**
1. Click "▶ Score week N" → week N scored; cookie lands at 9am of week N+1 day 1
2. Navigate to `/team/[id]/lineup` → week N+1 is ACTIVE; games-remaining badges show counts
3. Optionally step forward with "+1 Day" to see lock state evolve
4. Adjust lineup, then return to season page and click "⏭ End week N+1 now" → repeat

**Games-remaining with the 2025-26 fixture:** the historical fixture has all games as `FINAL`.
The games-remaining query uses `startsAt > now` (which already proves the game is in the future)
and does **not** filter by `status != FINAL` — so fixture games correctly appear as remaining
when the simulated date is before their `startsAt`. No need to run `seed-future-games.ts` for
basic dev simulation. That script still exists if you need SCHEDULED-status games for other reasons.

**To test against the 2025-26 fixture:** the league's `season` field must be `"2025-26"` so
the game queries match. Load fixture with `npm run seed-fixture -- --season 2025-26`, then
use the Season page's dev controls to step through periods.

**Tests:** `tests/season-lifecycle.test.ts` (13 tests) — pure engine only, no DB required.
Covers all period status transitions, multi-week gap skipping, `pendingWeeks` selection, and
catching-up when multiple periods are behind.

## Franchise-first URL structure

The URL space is split into two zones:

- **`/team/[teamId]/`** — personal franchise pages. Only the team owner can access these.
  - `/team/[teamId]/matchup` — fantasy home: lineup alerts, score hero, playing tonight, swing players, roster breakdown
  - `/team/[teamId]/lineup` — set active/bench slots with lock indicators and games-remaining badges
  - `/team/[teamId]/roster` — personal roster + free agent listings (add/drop)
  - `/team/[teamId]/schedule` — PWHL game schedule for this period, progress bar, per-game player counts
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
- All logged-in users → `/dashboard` (the league hub)
- `app/page.tsx` redirects any logged-in visitor to `/dashboard`. The single-team shortcut to `/team/[teamId]/matchup` was removed — the hub is always the landing page.

## Matchup page (`app/team/[teamId]/matchup/`)

The primary in-season landing page ("Fantasy Home"), team-scoped. No team picker — auth enforces ownership.

**What it shows:**
- **Lineup alert strip** — red banner at very top when active starters have `gamesThisPeriod === 0 AND gameCount === 0` (never played, no scheduled games left). Does NOT flag players who already scored.
- **Between-weeks lineup nudge** — amber banner shown when `activeMatchup.status === "upcoming"`, between the lineup-alert strip and the recap card. Prompts manager to set their lineup for the coming week and links to the lineup page with projected scores. Auto-disappears when the period goes ACTIVE.
- **`MatchupHero`** — 52px/900-weight scores color-coded (indigo=winning, red=trailing, amber=upcoming), win probability bar below scores, lead gap in accent color, "Set lineup →" CTA when upcoming.
- **Storyline chip** — "🔥 [Player] is leading your team with X.X pts this week" when `topPerformers[0].points > 0`.
- **Playing tonight** — always rendered during active periods (empty state: "No starters playing tonight"). Uses `getRemainingPlayersTonight(nowMs)`.
- **Swing players** — active roster players whose remaining games could flip the result. Only shown for active matchups, not upcoming.
- **Roster breakdown** — both teams with per-player stat chips and games-remaining badges.
- **League activity feed** — draft picks, major performances.

**Key modules:**
- `lib/scoring/index.ts` — `scoreStatLineDetailed()` returns `{ total, breakdown[] }` with
  per-category point contributions. `ScoringBreakdown = { label, stat, multiplier, points }`.
- `lib/scoring/settings.ts` — `parseScoringSettings(raw)` validates and returns `ScoringSettings`.
- `lib/projections/index.ts` — `projectPlayer(playerId, position, scoringSettings, prisma, nGames=5)`
  rolling average; `projectTeamRemainingScore(fantasyTeamId, earnedSoFar, period, settings, prisma, nowMs)`
  and `getRemainingPlayersTonight(fantasyTeamId, settings, prisma, nowMs)` — both accept `nowMs` so
  dev sim mode shows correct results; `winProbability(my, opp)` logistic function with k=15.
- `lib/matchups/swingPlayers.ts` — `getSwingPlayers(myTeamId, opponentTeamId, period, ...)`.
- `lib/services/dashboard.ts` — `getDashboardData(leagueId, myTeamId, nowMs, prisma)` assembles
  the full matchup view model including `lineupAlerts`. Falls back to draft pick history when no
  `LeagueEvent` records exist.
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

**Dual-mode hero (VTF regular season / 1v1 playoffs):** `ActiveMatchup.opponentTeam` is
**nullable**. Regular season is vs-the-field (VTF): `opponentTeam = null`, and the page renders
`FieldHero` (my score + weekly field record + ranked `weeklyStandings`). Playoff/1v1 matchups set
`opponentTeam`, `opponentProjected`, `winProbability`, and `rivalry`, and the page renders
`DuelHero` (head-to-head scores, win-probability bar, season series record). `getSwingPlayers` and
the opponent roster card are only rendered when `opponentTeam` is non-null — always guard, never
assume it's set. `lib/services/matchup-summary.ts` (dashboard cards) stays VTF: it returns a weekly
W-L-T record vs the full field (`wins`/`losses`/`ties`/`teamsCount`), not a single opponent.

**Rivalry record:** `rivalry: { wins, losses, ties }` on `ActiveMatchup` is the season-long H2H
record vs the current opponent, computed in `getDashboardData` via `getHeadToHeadRecord`
(`lib/playoffs/seeding.ts`). Only populated in 1v1 mode.

**Weekly recap card:** `DashboardData.lastResult` (`WeeklyRecap | null`) summarizes the most recent
completed matchup (result, score, opponent, my top performer). Rendered as `RecapCard` near the top
of the matchup page. Derived in `getLastResult` from the latest scored `Matchup` for the team.

**Live score polling:** `components/LiveScoreRefresh.tsx` is a client component that calls
`router.refresh()` on an interval (default 60s) and shows a "Live · updated Ns ago" pulse. Mounted
in both hero variants whenever the matchup is not upcoming, so active scores refresh without a
manual reload.

## Commissioner announcements

`FantasyLeague.announcement` (`String?`, nullable) holds a league-wide note set by the commissioner.
- **Admin:** `components/AnnouncementForm.tsx` (client) posts to
  `PUT /api/leagues/[leagueId]/announcement` (commissioner-only, trims + caps at 500 chars, empty
  clears). Mounted in the admin panel "League announcement" section.
- **Display:** rendered as a 📣 banner at the top of the league overview (`app/league/[leagueId]/page.tsx`)
  when set. The overview's `findUnique` returns all scalar fields, so `league.announcement` is available.
- Run `npx prisma db push` after pulling — the column was added to the schema.

## Playoff race indicators (standings + overview)

`computeRace(standings, matchups, cutoff)` is exported from `lib/playoffs/seeding.ts`. Each H2H
win = 1 pt, tie = 0.5; max remaining points = games left. A team is **clinched** when the bubble
team's ceiling can't pass it, **eliminated** when its own ceiling can't reach the current playoff
line. Returns `Map<teamId, RaceInfo>` with `status: "clinched" | "eliminated" | "in" | "bubble" |
"out"`, `gamesBack`, and `cushion`.

Used in two places:
- `app/league/[leagueId]/standings/page.tsx` — per-row chips + viewer status banner
- `app/league/[leagueId]/page.tsx` — the primary playoff-race module on the overview

## League Overview (`app/league/[leagueId]/`)

Two-column `.overview-grid` layout (collapses to single column at ≤900px). Left column is primary,
right column is sidebar.

**Left (primary):**
- Playoffs-underway notice (links to bracket) when `playoffStatus !== "NOT_STARTED"`
- Playoff race table using `computeRace` — rank, name, W–L, status chip (CLINCHED / ELIM / BUBBLE / IN / X.X GB); dashed separator at playoff line
- Compact current-week matchup grid (secondary, de-emphasized below the race table)

**Right (sidebar):**
- My matchup compact widget — my score + W–L vs field for the week + "My Matchup →" link
- Team lineup status widget — per-team `✓ Set` / `⚠ N issues` / `—` chips; shown only during `IN_SEASON`; uses the same batch `gamesPerPwhl` query pattern as the lineup page (no `status != FINAL` filter)
- League activity feed (from `getLeagueActivity`)

**Commissioner features (shown only when `isCommissioner`):**
- Inline announcement editing via `AnnouncementForm` — replaces the admin-panel-only UX
- Commissioner action strip (amber banner) — contextual CTA: draft setup needed / week ready to score / regular season complete

`nowMs` comes from `getReplayNow(league, await getDevNow())` — respects both replay mode and
sim-date cookie.

**Inline lineup editor (upcoming matchups):** when `status === "upcoming"`, the matchup page
shows `InlineLineupEditor` (client component) instead of the read-only `RosterTable` for the
user's team. It displays active starters + bench players with games-remaining badges and allows
click-to-swap directly on the page. Bench players are fetched server-side in `matchup/page.tsx`
using the same games-per-team batch query as the lineup page. After a successful swap the
component calls `router.refresh()` to reload with the updated lineup.

**Atomic swap endpoint:** `PUT /api/leagues/[leagueId]/lineup` accepts an optional
`swapWithPlayerId` field. When present, both players exchange slots in a single
`prisma.$transaction`. Capacity is not checked (a swap is slot-count-neutral); only eligibility
is validated (can player A play slot B? can player B play slot A?). The single-player move path
is unchanged.

**Gotchas (don't regress):**
- `computeTeamScoreDetailed(fantasyTeamId, period, scoringSettings, prisma, nowMs?)` in
  `lib/scoring/matchups.ts` caps the stat line query upper bound to `min(nowMs, period.endsAt)` when
  `nowMs` is provided. This makes the matchup score consistent with the lineup page's "This week" tab —
  both only count games that have started by the simulated time. `getDashboardData` always passes
  `nowMs` to both calls. **Don't remove the `nowMs` argument** — it fixes the Eldridge-style
  discrepancy where the matchup page counted future games the lineup page hadn't seen yet.
- `computeTeamScoreDetailed` always returns all active roster players, even those with 0 points
  this period. Falls back to `{ pts: 0, games: 0, statBreakdown: [] }` for players with no stat
  lines yet. Don't filter to `byPlayer.entries()` only — that silently drops players who haven't
  played yet and shows "No active players" for their opponent's roster.
- `getDashboardData` fetches both `myRoster` and `opponentRoster` for upcoming periods
  (when `isUpcoming = true`). Both rosters use the same `activeRosterInclude` and the same
  games-remaining batch query. Dropping the opponent fetch leaves the opponent column empty.
- Remaining games queries in `dashboard.ts` use `startsAt > nowDate` with **no** `status: { not: "FINAL" }`
  filter. The historical fixture has all games as `FINAL`; the status filter would zero out all badges
  when simulating. `startsAt > now` alone proves the game hasn't happened yet.

## Dashboard (`/dashboard`)

League hub landing page for all authenticated users. Shows owned teams grouped by league, with
prominent "New League" and "Join League" buttons in the header for users with existing teams.
Zero-team users see the empty-state Create/Join/Browse buttons. The single-team shortcut to
`/team/[teamId]/matchup` was removed — all users land here first. The dashboard uses `getMatchupQuickSummary` (in
`lib/services/matchup-summary.ts`) for lightweight per-team matchup cards.

**Action items** (shown in amber strip at top when non-empty): contextual alerts across all teams.
- **Draft live** — `draft.status === "IN_PROGRESS"` → "🎯 Draft is live right now!"
- **Draft upcoming** — `league.status === "PRE_DRAFT"` and `draftStartsAt` within 7 days
- **Draft complete, pre-season** — `draft.status === "COMPLETE"` AND `league.status !== "IN_SEASON"
  AND !== "COMPLETE"` → "Draft complete — set your lineup before the season starts". **Condition
  intentionally does NOT use `completedAt` time** — that timestamp is real-world and would be
  in the future relative to sim dates (Jan 2026 sim vs June 2026 real), making the check always true.
- **New week started** — active period, `startsAt` within 48h of `nowMs` → "Week N just started — set your lineup"
- **Tight match** — active, score > 0, `|myScore - oppScore| < 5` → "⚡ Tight match — you're up/down X pts"
- **Upcoming soon** — upcoming period starting within 24h → "Week N starts soon — prep your lineup"

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

**`/league/<id>` redirect rules** (`app/league/[leagueId]/page.tsx`):
- Draft `IN_PROGRESS` → `/draft/<leagueId>?team=<teamId>`
- All other states → renders the league overview (standings snapshot, recent results, next matchup)

The league overview is the communal hub — always reachable regardless of season state. The
login flow handles landing users on their team page after sign-in; don't redirect from the
overview itself or it becomes unreachable from the league nav. It has an "Admin panel →" link
that only appears for commissioners.

### League layout nav

`app/league/[leagueId]/layout.tsx` is async and fetches the current user + league commissioner.
Nav items shown to all members: Overview, Standings, Schedule, Bracket, Rosters.
"Admin" is appended only when `user.id === league.commissionerId`.
A "My Franchise →" button links to `/team/[myTeamId]/matchup` when the user has a team.
Matchup, Lineup, and Roster are NOT in the league nav — they live in the team layout.

The team layout (`app/team/[teamId]/layout.tsx`) renders a persistent tab bar via
`TeamNav.tsx` (client component, uses `usePathname()` for active state). Tabs:
**Matchup · Lineup · Roster · Schedule · Standings** (league standings page), plus a `"League ↗"`
escape hatch on the right. Active tab has white text + 2px indigo underline; inactive tabs are muted
gray. Standings links to `/league/[leagueId]/standings` since standings are league-scoped.

### Logout

`GET /api/auth/logout` — clears the `pwhl_user_email` cookie and redirects to `/`. Implemented
as a GET handler so the nav "Logout" link (`<a href="/api/auth/logout">`) works without JS.
Earlier versions only had a POST handler, which caused the link to bounce to a blank page while
leaving the user still logged in.

### Login flow

`POST /api/auth/login` returns `{ user, redirectTo }`:
1. If `returnTo` is in the request body (same-origin path) → use it
2. Else if user has exactly 1 team → `/team/<teamId>/matchup`
3. Else → `/dashboard`

`app/login/page.tsx` reads `?returnTo` from `window.location.search` in a `useEffect`
(avoids Suspense complexity with `useSearchParams`) and redirects to `data.redirectTo`
after a successful login.

`app/page.tsx` redirects all logged-in users to `/dashboard` (the league hub).
`app/layout.tsx` is async and shows the user's display name + Logout link when logged in.

## Dev simulation mode (`lib/devTime.ts`)

In development, a `pwhl_dev_sim_date` cookie (ISO 8601 string) persists the simulated "now"
across page navigations. This lets you advance a week in the season page, then navigate to the
lineup or matchup page and see it reflect the same simulated point in time.

**How it works:**
- `SeasonControls.tsx` sets `document.cookie = "pwhl_dev_sim_date=<iso>; path=/; max-age=86400"`
  after every successful advance call. The cookie value is set to **9am UTC on the first day of
  the next period** — this puts the next week in ACTIVE state while giving a realistic morning
  start time to test games-remaining badges and lineup decisions before games begin.
- A **"+1 Day →"** button in `SeasonControls` advances the cookie by exactly 24 hours, letting
  you step through the week day-by-day without scoring a whole new period.
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
  window for lock detection, games-remaining queries, and `lockTime()`. Games-remaining query
  uses only `startsAt > now` without a `status != FINAL` filter — necessary for the historical
  fixture to show correct counts.
- `app/team/[teamId]/matchup/page.tsx` — passed to `getDashboardData`.
- `app/league/[leagueId]/page.tsx` — current week detection (max week whose `startsAt <= nowMs`).
- `app/league/[leagueId]/matchups/page.tsx` — current week highlighting.
- `app/league/[leagueId]/season/page.tsx` and `admin/page.tsx` — passed to `getSeasonState`.
- `app/dashboard/page.tsx` — passed to `getMatchupQuickSummary` and action item timing.

**API routes that use `getDevNowFromRequest()`:**
- `app/api/leagues/[leagueId]/lineup/route.ts` — GET and PUT both use it for the "today" window,
  `lockTime()`, and the play-lock stat line check.
- `app/api/leagues/[leagueId]/matchup-summary/route.ts` — passed to `getDashboardData`.
- `app/api/leagues/[leagueId]/season/route.ts` — GET state, POST start, POST advance.

In production (`NODE_ENV === "production"`) both helpers unconditionally return `Date.now()` —
the cookie is never read.

## Build gotchas

- **`next build` vs `next dev`**: `next dev` is lenient with TypeScript; `next build` runs a full
  `tsc` check. Always run `npx tsc --noEmit` before deploying to catch errors that only surface
  at build time.
- **Stale `.next` cache**: if `npm run build` fails with `PageNotFoundError: Cannot find module
  for page: /_error` or `/_document`, delete `.next/` and rebuild: `rm -rf .next && npm run build`.
  These are Next.js 14 internal errors that only surface when the cache is in a corrupted state.
  Vercel does a clean build on every deploy so this only affects local builds.
- **`rosterSettings as Record<string, number>`**: when summing slot counts via `Object.values()`,
  cast to `Record<string, number>` not `any` — `as any` makes the array `unknown[]` and breaks
  the `reduce` type.
- **`DraftRoom` sort key**: `SortKey` includes `"goalsAgainst"` as a proper union member (not a
  cast). Sort comparator uses `stats?.[sortKey] as number | null` — direct indexed access, no
  `Record<string, number | null>` cast needed.

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
- **When updating CLAUDE.md** (build order, feature status, or sprint notes), keep these sibling files in sync:
  `docs/01-roadmap/roadmap-index.md`, `docs/01-roadmap/roadmap-features.md`, `docs/01-roadmap/roadmap-sprints.md`, and `docs/01-roadmap/roadmap-gpt.md`. The HTML files are independently maintained visual dashboards on a separate cadence.
