# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**PWHL GM** — a fantasy sports web app for the **PWHL (Professional Women's Hockey League)**, targeting
the **2026-27 season** (12 teams: 8 originals + Detroit Hockey Team, Hamilton Hockey Team, Las Vegas Hockey Team, San Jose Hockey Team).
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

## Deployment environments

Three environments. Full runbook: `docs/04-operations/environments.md`.

| Environment | Vercel project | Branch | Domain | Database |
|---|---|---|---|---|
| **Beta** | `pwhl-gm-beta` | `release/beta-v1` | `beta.fantasy.dykedb.org` | Neon branch: `main` |
| **Production** | `pwhl-fantasy` | `main` | `fantasy.dykedb.org` | Neon branch: `main` |
| **Staging** | `pwhl-fantasy` | `dev` | `fantasydev.dykedb.org` | Neon branch: `preview` |

**Key rules:**
- `DATABASE_URL` is the isolation boundary — staging must point at the Neon `preview` branch, never `main`.
- `BETA_HOST` env var controls which host is locked to just the `/beta` signup page (defaults to `"fantasy.dykedb.org"`). The beta subdomain (`beta.fantasy.dykedb.org`) never matches this check, so the full app runs there. Set `BETA_HOST` to `""` in the production Vercel project when ready to open `fantasy.dykedb.org` to the full app.
- `ALLOW_SIM_DATE` must NOT be set in Production — it would let any user rewind the clock for all live leagues.
- `prisma db push` is safe on the staging Neon branch; never run it on the prod branch while beta users are active. Use `prisma migrate dev` to generate a migration, commit it, and let `prisma migrate deploy` (in the build command) apply it to prod.
- Vercel crons (`vercel.json`) run on Production only — waivers won't double-process on staging.
- The draft WebSocket server runs on Render. Production: `pwhl-draft-server`. Staging: optionally a second `pwhl-draft-server-staging` service; if absent, live draft testing is prod-only.

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
| 10 | 2026-27 Pre-Season | no |
| 9 | 2026 Playoffs | yes |
| 8 | 2025-26 Regular Season | no |
| 6 | 2025 Playoffs | yes |
| 5 | 2024-25 Regular Season | no |
| 3 | 2024 Playoffs | yes |
| 1 | 2024 Regular Season | no |

**2026-27 roster notes:**
- The expansion draft + PWHL draft occurred the week of June 21, 2026.
- Pre-season rosters (season_id=10) reflect initial expansion draft allocations: 10–17 players per team (Jun 24 snapshot). Full rosters will fill in as contracts are signed through summer 2026.
- Expansion team names in DB: Detroit Hockey Team, Hamilton Hockey Team, Las Vegas Hockey Team, San Jose Hockey Team.
- HockeyTech numeric team IDs → DB externalIds: 1=bos, 2=min, 3=mtl, 4=nyc, 5=ott, 6=tor, 8=sea, 9=van, 10=det, 11=ham, 12=lv, 13=sj.
- **Why a separate script:** The main `ingest` script discovers team IDs from the schedule. season_id=10 has no games yet, so it gets 0 team IDs and fetches nothing. The update script fetches rosters directly by hardcoded HockeyTech numeric team IDs.
- **Run weekly** until the 2026-27 schedule is published. Once a schedule exists, `npm run ingest -- --season 2026-27 --no-stats` handles it instead.
  ```bash
  npx tsx scripts/update-2026-27-rosters.ts --dry-run   # preview changes
  npx tsx scripts/update-2026-27-rosters.ts              # apply
  ```

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
   - **Replay league bug fix** ✅ (commit 52ea547: auto-start season after draft, fix simulator endpoint routing, fix test mocks; replay feature now fully functional)
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
   - Playoff Experience UX — Feature #30 ✅ (commit 5df2b0c — final pieces: `/league/[leagueId]/` redirects to `/bracket` when `playoffStatus === IN_PROGRESS`; `PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`, `CHAMPIONSHIP_WON` added to `EventType` enum in `prisma/schema.prisma` and `LeagueEventType` union in `lib/services/activity.ts`; `advance-playoff-round` route emits elimination/clinch/championship activity feed events after scoring each round; TypeScript narrowing fix in `app/league/[leagueId]/page.tsx`)
6. Integration + load test the draft room + beta
   - Draft Reliability Certification ✅ (duplicate-tab handling, concurrent-league load test, reconnect stress test; findings in `docs/04-operations/commissioner-runbook.md`; all MVP scorecard gates green)
   - Founder Operations Console ✅ (`app/founder/` — dashboard, league explorer, league detail with sim controls, throwaway season validator; `FOUNDER_EMAILS` env-var auth gate; API routes under `app/api/founder/`; no schema change)
   - Auto-Set Lineup ✅ (`computeOptimalLineup()` in `lib/lineup.ts`; staged save model — "Auto-set" purple button in `LineupManager.tsx`, pending diff shown before persisting; `beforeunload` guard; playoff period fallback for games-remaining badges during playoffs; `GET /api/leagues/[leagueId]/fa-suggestions` returns top 10 unrostered players by projected FP; spec: `docs/02-engineering/auto-set-lineup-spec.md`; commits: 3e6bbd0, f83468f, 1f06c9a)
   - Beta Feedback Infrastructure ✅ (spec: `docs/02-engineering/beta-feedback-spec.md`; schema: `FeedbackSubmission` model + `FeedbackType` enum `BUG|SUGGESTION|OTHER` + `BetaStatus` enum `NONE|INVITED|ACCEPTED|ACTIVE|RENEWED` + `betaStatus BetaStatus @default(NONE)` on `FantasyLeague`; widget: `components/FeedbackWidget.tsx` — fixed bottom-right button opens a Bug/Suggestion/Other modal rendered via `ReactDOM.createPortal` into `document.body`, mounted in league layout, team layout, and founder layout; API routes: `POST /api/feedback` auth-gated writes `FeedbackSubmission` rows, `GET /api/founder/feedback` returns last 100 submissions, `PATCH /api/founder/leagues/[leagueId]/beta-status` updates cohort status; Founder Console: `app/founder/feedback/page.tsx` feed table + "Feedback" nav link in `app/founder/layout.tsx` + "Beta" tab with betaStatus dropdown in `app/founder/leagues/[leagueId]/LeagueDetailTabs.tsx`)
   - **Trade System** ✅ (`lib/trades/engine.ts` pure 10-state machine + `applyTrade`; `lib/services/trade-service.ts`; schema: `Trade`/`TradeItem` models + `TradeStatus` enum + `tradeReviewHours`/`requireCommissionerTradeApproval` on `FantasyLeague` + 6 new `NotificationType` values; 7 API routes under `/api/leagues/[leagueId]/trades/`; Trade Center at `/league/[leagueId]/trades`; Propose flow at `.../trades/new`; Trade Settings in admin panel; "Trades" in league nav; 22 tests in `tests/trade.test.ts`; spec: `docs/02-engineering/trade-spec.md`)
   - **PWHL GM Rebrand — Sprint 9** ✅ (REBRAND-001/002/003/004/005 shipped; see `docs/branding/`):
     - REBRAND-001: `components/LogoShield.tsx`; "PWHL GM" global rename; home page hero rewrite ("Think Like a GM."); `app/layout.tsx`, `app/page.tsx`
     - REBRAND-002: "Your Franchises" dashboard; "Front Office" nav; welcome flow + login/register/invite copy
     - REBRAND-003: draft room header "PWHL GM — Draft Room"; fantasy pts → FP terminology; CLAUDE.md + README product name
     - REBRAND-004: `app/globals.css` design tokens (`--accent*`, `--card`, `--font-body/stats`, `.rebrand-card`, `.pos-badge`, `.alert-amber`, `.chip-*`, `.font-stats`)
     - REBRAND-005: Matchup page IA restructure (Z1–Z9 render order, `RosterStatusWidget`, Analysis promoted to `/team/[teamId]/analysis`); BUG-MATCHUP-001 fix (`isSetupPhase` flag — hero shows "—" not "0.0 vs 0.0" in SETUP phase)
   - **UX Polish — Sprint 11b** ✅ (16 items: UX-002/003/004/005/006/007/008/009/013/014/015/016/017/019/020/021):
     - UX-006: League nav white text + indigo underline active state (match team nav)
     - UX-007/005: Renamed "⊕ Front Office" → "⚙ Admin"; removed "Front Office" subtext
     - UX-008: Moved `AnnouncementForm` below primary content on league overview
     - UX-014/015: Wizard buttons inside card; 6-segment filled progress bar
     - UX-016: Pre-season empty state on matchup page with "Season hasn't started" message
     - UX-017: Register headline "Build your franchise" aligned with REBRAND-001/002
     - UX-019: Free agent banner explaining immediate adds during season
     - UX-020: Free Agents / Waiver Wire tabs with hover tooltips
     - UX-002/003: Auth pages — reduced padding, season timing chip, inlined "(optional)"
     - UX-004/021: Nav "Account" label (not display name); hydration fix prevents "Login" flash
     - UX-009: Removed duplicate league name from body `<h1>`
     - UX-013: Wizard card `min-height: 60vh`
   - **Emotional Design Polish — Sprint 16** ✅ (DS-004: Score colors, animations, typography hierarchy, font loading):
     - Score colors respond to game state (green #34d399 if winning, red #f87171 if losing, white if tied)
     - Score count-up animation (0→value over 1.2s) on active-matchup load via `components/ScoreDisplay.tsx`
     - Section heading hierarchy (14px normal case vs 12px uppercase) for primary sections
     - Saira Condensed 700 font loads from Google Fonts and applies to all score displays
     - RecapCard elevation with colored borders and contextual copy ("Took down opponent" vs "Tough week")
     - Card entrance animations (fadeSlideUp + stagger) on page load
     - Win probability bar spring easing (cubic-bezier) instead of linear fill
     - No schema changes; transforms matchup page from "Bloomberg terminal" to energetic sports product
   - **UX Polish — Sprint 17** ✅ (AG-001–009: agent test run fixes, 9/9 shipped):
     - AG-001: LEAGUES page overhaul — "What's Happening" showcase + open-league directory; `FantasyLeague.isPublic Boolean @default(false)` schema field; public/private toggle in wizard + admin panel
     - AG-002: Matchup page restructure — Z7 performers moved to Analysis tab; Z8 league leaders + Z9 activity feed moved to league overview; FieldHero embedded standings removed; positive "all set" lineup state added
     - AG-003: FP/VP comprehension copy — VP bridge sentence in dashboard MatchupHero; "vs the field" rendered as visible text in FieldHero; setup-phase "0.0" → "—" fix on dashboard action card
     - AG-004: Terminology standardization — FPts → FP in all stat table headers; FP/VP relationship sentence in `VpExplainer.tsx`; slot legend on lineup page (F/D/G/UTIL); draft stat glossary opens by default
     - AG-005: Non-qualifying playoff empty state — `lib/services/dashboard.ts` detects `playoffStatus === IN_PROGRESS` + no active playoff matchup; returns `playoffEliminated` context with regular-season rank + bracket link
     - AG-006: Season renewal two-step confirmation — `RenewLeagueForm.tsx` requires two explicit actions before firing `POST /renew`; post-renewal invite link displayed before redirect
     - AG-007: Pre-login UX — plain-language features grid copy (no acronyms); "Try a Replay" secondary CTA on landing + login/register pages; invite join page shows draft date + fantasy explainer
     - AG-008: VP education reinforcement — compact "How VP works" callout in FieldHero + dashboard matchup action card; links to standings page explainer
     - AG-009: Lineup lock contextual tooltip — hover/tap on lock indicator reveals explanation: player's team played this week, cannot move to bench after contributing
   - **Beta Operations + Onboarding Repair — Sprint 18** ✅ (24 items across 5 tracks, all shipped Jun 23, 2026):
     - **Beta League Replay Format** ✅ (BLR-001/002/003: founder-created beta replay leagues, wizard beta welcome screen, expansion team teaser in welcome screen + draft room)
     - **Sprint 13 carry-forwards** ✅ (BF-009, OB-002/003/004, UX-046/047/048, OB-005/006/007/009: analysis nav confirmed, VP explainer in wizard, team-creation warning, cancel confirm, season series dedup, trade form partner-first, trade form hint, home page cleanup, replay mode desc, "12 teams" copy, scoring chip row)
     - **Beta bug fixes** ✅ (BF-012/013/014/015/016/017: FA add error copy clarified, pre-season trade gate removed, VTF matchup ranked view, UTIL slot stale-closure fix, activity feed LEAGUE_STORYLINE label, auto-set 0-game null-coalescing fix)
     - **Ops gates** ✅ (OPS-001 security audit GATE-1 PASS, OPS-002 load test GATE-2 PASS 20 leagues×80 connections, OPS-003 CRON_SECRET GATE-3 PASS, OPS-004 accessibility focus-visible + aria-labels)
     - **Wizard 401 fix** ✅ (middleware exemption for `/api/leagues/create` + WizardError styled component)
   - **IA Restructure — Sprint 19** ✅ (5 parts, all shipped Jun 23, 2026):
     - **Part 1: Emoji policy + colorblind fix** ✅ (`docs/branding/emoji-policy.md`; standings chips now use ✓/✗/◉ glyphs for CLINCHED/ELIM/BUBBLE; `chip-bubble` + `chip-out` CSS classes; commit 0d00092)
     - **Part 2: Trades → My Franchise** ✅ (new `/team/[teamId]/trades`, `/team/[teamId]/trades/new`, `/team/[teamId]/trades/[tradeId]` routes; `/team/[teamId]/bracket` + `/team/[teamId]/transactions` routes; league trades routes redirect to team-scoped equivalents; Trades removed from league nav; `TeamNav.tsx` restructured — Lineup/FA tabs removed, Rosters→My Roster, Trades/Playoffs/Transactions link to team routes; commit a2cd617)
     - **Part 3: League overview → commissioner-only** ✅ (`/league/[leagueId]` redirects non-commissioners to `/team/[teamId]/matchup`; My Matchup widget and non-commissioner content removed from commissioner overview; `/league/[leagueId]/roster` requires commissioner access; commit 3ceb056)
     - **Part 4: DnD lineup management on roster page** ✅ (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` installed; new `components/LineupDnD.tsx` with drag-to-swap, stats tabs, games-remaining badges, play-lock validation, DragOverlay; `app/team/[teamId]/roster/page.tsx` rewritten to fetch all lineup data server-side and render LineupDnD above RosterManager; `/team/[teamId]/lineup` redirects to `/team/[teamId]/roster`; commit 01075f9)
     - **Part 5: Commissioner god-mode on roster page** ✅ (commissioner can view + DnD any team's lineup via team selector; uses `/api/leagues/[leagueId]/commissioner/force-move` when `forceMove=true`; amber "Commissioner view" banner in LineupDnD; "⚙ Commissioner View" chip in RosterManager; commit b4986a6)
   - **VTF Navigation Rename — Sprint 20** ✅ (2 items shipped Jun 23, 2026):
     - **BF-018: League nav rename** ✅ (league nav "Schedule" tab renamed to "Results"; VTF explainer subtitle added; commit ad4185a)
     - **UX-049: Team nav rename** ✅ (team nav "Schedule" tab renamed to "My Season"; "Your Players This Week" section heading updated)
   - **Living League: Weekly Delight — Sprint 21** ✅ (5/5 stories shipped; 6 commits; no schema changes):
     - **LL-001: Weekly Awards Ceremony** ✅ (`computeWeeklyAwards()` pure function + `emitWeeklyAwards()` IO layer in `lib/services/storyline-service.ts`; 5 awards: `ice_cold_closer`, `heater`, `heartbreaker`, `collapse`, `frozen_stick`; called fire-and-forget from `advanceSeason()` after `emitWeeklyStorylines()`; `WeekHighlights.tsx` renders award cards with icon, color-coded borders, recovery CTA links for negative awards)
     - **LL-002: Matchup Momentum Strip (data layer)** ✅ (`scoreDeltaSinceYesterday: number | null`, `playersRemainingTonight: number`, `opponentFinished: boolean` added to `ActiveMatchup` in `lib/services/dashboard.ts`; visual `MomentumStrip.tsx` shipped Sprint 22 RD-008 — feature complete)
     - **LL-003: Animated Stat Chips** ✅ (`StatChip` type + `chips: StatChip[]` on `PlayerMatchupRow`; `computeStatChips()` in `lib/services/dashboard.ts` with `weekly_leader`, `streak` (≥3 consecutive games), `projection_swing_up/down` (±5 FP threshold) chip types; `StatChip.tsx` with `chipPulse` CSS animation; renders inline in matchup page Z6 `RosterTable`)
     - **LL-017: Plain-Language Award & Storyline Explainers** ✅ (`lib/copy/living-league-glossary.ts` single source of truth for all award and chip copy; `InfoTooltip.tsx` client component — tappable ⓘ button, 44px touch target, aria-accessible; every award card on league overview has a tappable ⓘ showing fan-first explainer)
     - **LL-018: Negative Award Tone Calibration** ✅ (negative awards include recovery CTA links; `showNegativeAwards` commissioner toggle stored in `scoringSettings` JSON — no schema migration; `NegativeAwardsToggle.tsx` in admin panel; `PATCH /api/leagues/[leagueId]/settings` route)
   - **Living League: The Race — Sprint 23** ✅ (7/7 stories shipped; schema migration: `FantasyTeam.accentColor String?`):
     - **LL-004: Magic Number** ✅ (`computeRace()` in `lib/playoffs/seeding.ts` extended with `magicNumber: number | null` on `RaceInfo`; shows `null` before midseason and when already clinched/eliminated; "Magic: N" chip rendered on standings page for teams with `status === "in"` or `"bubble"` where `magicNumber > 0`)
     - **LL-005: Playoff Clinch Celebration** ✅ (`emitClinchEvents()` in `advanceSeason()` detects teams newly at `status === "clinched"` after each scoring pass; calls `createNotification()` + emits `PLAYOFF_CLINCH` `LeagueEvent`; `ClinchBanner.tsx` dismissible banner on matchup page; localStorage-keyed `leagueId + season`)
     - **LL-007: Bubble Watch** ✅ (`BubbleWatch.tsx` server component appended below standings table on `/league/[leagueId]/standings`; 3 groupings (clinched/in + bubble + eliminated/out) from `computeRace()`; visible only when `IN_SEASON`; heading switches to "Playoff Push" after week N/2)
     - **LL-008: Upset Tracker** ✅ (`lib/services/upset-service.ts` — `getLeagueUpsets()` computes upsets retrospectively via `winProbability(homeScore, awayScore)` proxy; `UpsetCard.tsx` on league overview sidebar; no schema change — uses option (a) from spec)
     - **LL-019: First-Result Explainer** ✅ (`FirstResultContext` added to `DashboardData` in `lib/services/dashboard.ts`; `FirstResultCard.tsx` dismissible card on matchup page after manager's first scored period; VTF explanation + top contributor named + most actionable gap surfaced; localStorage-keyed `userId + leagueId + "first-result-seen"`)
     - **LL-021: Small-Win Encouragement** ✅ (`MilestoneToast.tsx` inline micro-celebration component; lineup-complete toast fired from `PUT /api/leagues/[leagueId]/lineup` after first fully-set lineup; first-add toast fired from `POST /api/leagues/[leagueId]/waiver` after first successful add; both localStorage-gated, each fires once per manager)
     - **RD-013: Team Identity Colors** ✅ (`FantasyTeam.accentColor String?` schema field + migration; `TeamColorPicker.tsx` in team settings with 6–8 AA-compliant swatches; `PATCH /api/leagues/[leagueId]/teams/[teamId]/color` route; avatar ring + team-name tint render in DuelHero and standings rows; never overrides semantic win/loss colors)
   - **Inviting Dark Redesign — Sprint 22** ✅ COMPLETE (23/23 stories shipped; no schema changes). See `docs/01-roadmap/roadmap-sprints.md` for full item list. Includes: RD-001–012, RD-014–017, BF-018, UX-051/052/054/055/056/057 — all shipped across commits 047cd20 and 6c294d0.
   - **Franchise Zone UX Fixes** ✅ COMPLETE (commit 28c02ae): BF-019 Scoreboard nav no longer bounces to league layout (team-scoped `/team/[teamId]/scoreboard` + `ScoreboardPageContent` shared component); UX-060 new `/team/[teamId]/settings` page with team color picker; RD-006 partial — color picker removed from matchup page, Z5 Recap promoted above Z4 Rival.
   - **Living League: Season Story — Sprint 24** ✅ (5/7 stories shipped; UX-058/BF-020 deferred to Sprint 25):
     - **LL-006: Season Timeline** ✅ — `/team/[teamId]/schedule` extended with W-L-T summary header; page title "My Season"
     - **LL-010: League Record Book** ✅ — new `/league/[leagueId]/records` page (member-visible); records: highest weekly score, best season record, biggest blowout, top-5 individual player weeks; "Records" in league nav; `components/SuperlativesCard.tsx`; `lib/services/superlatives.ts`
     - **LL-011: Franchise Identity (Team Name Editing)** ✅ — `PATCH /api/leagues/[leagueId]/teams/[teamId]/name` (ownership-gated, 1–50 chars); `components/TeamNameEditor.tsx` inline edit on Settings page; NOTE: franchise archetype system (Boom or Bust etc.) deferred to Sprint 25 as LL-011b
     - **LL-012: Manager Superlatives** ✅ — `lib/services/superlatives.ts` pure function; 5 awards: Top Scorer, Feast or Famine, Steady Eddie, Hot Start, Strong Finish; `SuperlativesCard.tsx` in league overview sidebar; team's own superlatives as gold callout on Analysis page
     - **LL-023: Empty States** ✅ — personality copy across Trades (all 3 tabs), Transactions feed, Analysis page
   - **Living League: Legacy — Sprint 25** ✅ (6/6 stories shipped; commit ab44083):
     - **LL-009: Trophy Cabinet** ✅ — `Trophy` model + `TrophyType` enum in `prisma/schema.prisma`; `lib/services/trophy-service.ts`; `/team/[teamId]/trophies` page; `TrophyCard.tsx`, `TrophyShelf.tsx`; trophy icons in matchup page Z2
     - **LL-011b: Franchise Identity Archetypes** ✅ — `computeFranchiseIdentity()` in `lib/services/franchise-identity.ts`; `FranchiseIdentityChip.tsx` in matchup page Z2; requires ≥4 scored weeks; no schema change
     - **LL-014: Opening Day Card** ✅ — `OpeningDayCard.tsx` in `app/team/[teamId]/matchup/page.tsx`; Week 1 only (`activePeriod.number === 1`); localStorage dismiss keyed on `leagueId + season`
     - **LL-015: Championship Banner** ✅ — `ChampionshipBanner.tsx` in matchup page; triggered by unread `CHAMPIONSHIP_WON` notification; dismiss calls `markAllRead()`
     - **UX-058: Trade Proposal 4-Step Guided Experience** ✅ — 4-step state machine in `ProposeTrade.tsx`; Step 0 pick partner, Step 1 give, Step 2 receive, Step 3 review; same `POST /trades` endpoint
     - **BF-020: Auto-Draft Position Balance** ✅ — Tier 1b (defenders filling open D slots) added in `bestAvailablePlayerIds()` in `lib/draft/server.ts`
   - **Beta Defect Sweep — Sprint 26** ✅ (BF-024 and BF-027 shipped by parallel agents):
     - **BF-024** ✅ — `/team/[teamId]/transactions` renders `TransactionFeed` inside team layout; no league-layout redirect
     - **BF-027** ✅ — LEAGUE_STORYLINE raw enum regression resolved; all `getLeagueActivity()` paths now emit human-readable descriptions
   - **Polish & The Arena Concourse — Sprint 27** ✅ (11/11 items shipped; Jun 24, 2026):
     - **BF-022** ✅ — `BottomNav` hidden on desktop; `className="bottom-nav"` added to `<nav>` in `components/BottomNav.tsx`; inline `display: "flex"` override removed
     - **BF-023** ✅ — `processWaivers()` in `lib/services/waiver-service.ts` emits both `WAIVER_CLAIM_AWARDED` and `PLAYER_ADD` events so waiver-awarded adds appear in transaction history
     - **BF-025** ✅ — Trade UI position filter investigated; new `ProposeTrade.tsx` 4-step wizard has no position filter; old bug confirmed resolved without code change
     - **BF-026** ✅ — Standings playoff cutoff contrast improved to WCAG AA (5.5:1) in `app/league/[leagueId]/standings/page.tsx`; `chip-out` color `#94a3b8`; dashed border opacity 0.55; footer uses `var(--dim)`
     - **BF-028** ✅ — Commissioner dashboard now surfaces `PENDING_REVIEW` trade count as action item; `app/dashboard/page.tsx` queries `prisma.trade.groupBy`
     - **LL-024** ✅ — New `app/league/[leagueId]/how-it-works/page.tsx` server component; 6 sections: VP explained, FP scoring (live from league settings), roster slots, stat glossary (15 abbreviations), waiver wire, trades; "How it works" nav link in `app/league/[leagueId]/layout.tsx`
     - **LL-022 Phase 1** ✅ — `components/StatTooltip.tsx` (abbr element pattern); `title` prop on `SortTh` in `app/team/[teamId]/roster/RosterManager.tsx` for PPP/SOG/HIT/BLK/SV%/GA/SO/FP; `tooltip` field on `SKATER_COLS`/`GOALIE_COLS` in `app/draft/[leagueId]/DraftRoom.tsx`
     - **LL-022 Phase 2** ✅ — "How it works →" anchor link added to standings page legend in `app/league/[leagueId]/standings/page.tsx`
     - **VTF subtitle update** ✅ — league overview VTF subtitle updated to "Everyone races the same week — your rank is your result"
     - **LL-016 (partial)** ✅ — Inline weekly top-scorer teaser after race table in commissioner overview; trophy leaderboard sidebar widget via `prisma.trophy.groupBy`; "Full record book →" link
   - **Beta Sweep & Transactions Fix — Sprint 29** ✅ (6 items shipped; Jun 24, 2026):
     - **S29-001: Rival improvements** ✅ — commit a90a50c; `getRival()` rewritten to pick closest-contested opponent by avg points-apart (≥2 scored weeks), tie-broken by most balanced W/L record; `RivalBadge` now shows "points apart" narrative copy + "Dead even." callout; rival chip + card moved to `/team/[teamId]/standings`; removed from matchup page Z4
     - **BF-NEW: Transactions legacy guard cleanup** ✅ — removed `(prisma as any).leagueEvent` guard in `app/api/leagues/[leagueId]/waiver/route.ts` milestone-count query; replaced with direct `prisma.leagueEvent.count()` call; no silent failures in first-add milestone detection
     - **TR-002: Silent trade expiry notification** ✅ — `processExpiredTrades()` in `lib/services/trade-service.ts` now passes `dedupeKey: \`trade-expired-${tradeId}\`` to `createNotification()`; idempotent delivery for expired trade notifications
     - **TR-003: Trade PROPOSED→PENDING_REVIEW state machine** ✅ — added `PROPOSED → PENDING_REVIEW` transition for `"proposer"` and `"commissioner"` roles in `lib/trades/engine.ts`; `proposeTrade()` in `lib/services/trade-service.ts` always creates trade as `PROPOSED` first then auto-flips to `PENDING_REVIEW` in the same `$transaction` when `requireCommissionerTradeApproval = true`; 3 new tests in `tests/trade.test.ts`
     - **OB-001: Start Your Franchise → /register** ✅ — verified `app/page.tsx` hero CTA and CTA Band already link to `/register`; no code change required
     - **BF-021: DnD lineup mobile tap-to-swap** ✅ — `components/LineupDnD.tsx` adds tap-to-swap mode on mobile (≤640px): tap to select (purple ring), valid targets highlight, tap to swap via existing lineup API; cancel hint shown while selection is active; mobile hint text updated to "Tap a player to select, then tap another to swap positions"; DnD preserved on desktop
   - **Track A Bug Sweep — Sprint 30** ✅ (2 items shipped; Jun 24, 2026):
     - **BF-012: FA add stale-state fix** ✅ — `useEffect(() => { setRoster(initialRoster); }, [initialRoster])` added to `app/team/[teamId]/roster/RosterManager.tsx`; `useState(initialRoster)` alone does not re-sync when Next.js App Router delivers new props after `router.refresh()`; without the effect `isFull` is stale after a successful add, causing immediate follow-up adds to fire without a required drop
     - **BF-013: Pre-season trades verified fixed** ✅ — fix shipped Sprint 18; `lib/services/trade-service.ts` blocks on `playoffStatus !== "NOT_STARTED"` only, allowing all pre-season states; roadmap docs updated to DONE
   - **Track B: Morning Skate Newcomer Mode + Hub Reorg — Sprint 31** ✅ (5 items shipped; Jun 24, 2026):
     - **LL-020: Inline acronym expansion** ✅ — `expand()` helper in `generateEdition()` in `lib/services/morning-skate-service.ts` rewrites FP/VP/PPP to "fantasy points (FP)" etc. on first use per edition; `EditionData.newHereUrl` field added; "New here? How it works →" link in edition masthead (`app/league/[leagueId]/morning-skate/[editionId]/page.tsx`)
     - **LL-020: Team-scoped Morning Skate routes** ✅ — `app/team/[teamId]/morning-skate/page.tsx` and `[editionId]/page.tsx` redirect to league-scoped equivalents via `requireTeamOwner` + `redirect()`; `MorningSkatePreview` accepts `teamId?` prop and links to team-scoped URL when provided
     - **LL-016: Matchup page Z0 consolidation** ✅ — two conditional `<MorningSkatePreview>` blocks (setup-phase only Z0 + always-on Z2.5) replaced with single unconditional Z0 with `teamId` prop in `app/team/[teamId]/matchup/page.tsx`
     - **LL-016: Commissioner overview reorder** ✅ — left column in `app/league/[leagueId]/page.tsx` now: Morning Skate preview → commissioner action strip → race table; Morning Skate is always the first thing commissioners see
   - **WCAG 2.2 AA Accessibility Audit — Sprint 37** ✅ (22 items shipped; Jun 25, 2026; no schema changes):
     - **Utilities** ✅ — `.visually-hidden`, `.skip-link` CSS in `globals.css`; `components/RouteAnnouncer.tsx` SPA navigation announcer; skip-to-main link + `id="main-content"` in `app/layout.tsx`
     - **Live regions** ✅ — `MilestoneToast`, `ClinchBanner` always-present `role="status" aria-live="polite"` (not conditionally rendered); `LiveScoreRefresh` clear-then-set with `requestAnimationFrame`; `ScoreDisplay` `prefers-reduced-motion` + `aria-hidden` on animated span
     - **Dialogs** ✅ — `ChampionshipBanner` single `role="dialog"` on card + Escape key; `FeedbackWidget` focus trap + Escape + `aria-pressed`; `AddAndSlotModal` focus on mount + Escape; `InfoTooltip` `role="tooltip"` + Escape
     - **Forms** ✅ — `CommissionerRecoveryTools` all four sections labeled; login/register/invite error `role="alert"`; `NotificationBell` `aria-expanded`/`aria-haspopup`/`aria-controls` + focus management
     - **Navigation** ✅ — `TeamNav` + `BottomNav` + league layout nav all get `aria-label` + `aria-current="page"`; all decorative SVGs `aria-hidden="true" focusable="false"`
     - **Interactive** ✅ — `InlineLineupEditor` `<div onClick>` → `<button aria-pressed>`; `DraftRoom` `role="timer"` + single assertive 10s warning + `role="log"` + on-clock `role="alert"`; `StatChip` emoji `aria-hidden`
     - **Page titles** ✅ — dashboard + standings get `export const metadata` with descriptive titles
   - **Technical Debt Reduction — Sprint 38** ◻ PLANNED: TD-001…011 — structured error logging, cron observability, god-object decomposition (dashboard.ts / matchup/page.tsx / DraftRoom.tsx), service-layer tests, hardcoded season constants, raw SQL comments, inline style audit. No schema changes. Full spec: `docs/01-roadmap/roadmap-sprints.md`.
   - **UX Clarity Sweep — Sprint 39** ✅ (8/8 stories shipped; Jun 25, 2026; no schema changes):
     - **UX-070: VP primer card** ✅ — `components/VpPrimerCard.tsx` localStorage-gated per userId; shown once when `activeMatchup !== null`; "How you win in PWHL GM" + FP→VP explanation + "Got it — let's play" dismiss; rendered at matchup page Z0
     - **UX-071: FP→VP bridge copy standardized** ✅ — identical sentence "FP decides your matchup result — win and rank well to earn VP, the currency of your league standing." as visible text across FieldHero, DuelHero, dashboard MatchupHero, standings page, and VpExplainer
     - **UX-072: Wizard mode-first flow** ✅ — mode choice (Live vs Replay) moved to Step 1; `visibleSteps(isReplay)` replaces three-way `getDisplayStep`/`getDisplayTotal`/`getStepLabels` remap; mode card shows step count per option before user commits
     - **UX-073: Honest progress bar** ✅ — bar reflects correct total from screen 1; replay Rules screen includes amber note "Replay leagues skip size & draft date setup — they're pre-configured for the 2025-26 season"
     - **UX-074: Terminal matchup state CTAs** ✅ — elimination → "You were eliminated in Round N" + "See who's still alive →"; playoffPending → "Your round is complete" + "View updated bracket →"; missedPlayoffs → "You didn't qualify…Final standing: Nth" + bracket + season links; PRE_DRAFT → "Build my draft queue →"; PRE_SEASON → "Set my lineup →"
     - **UX-075: Setup phase timing copy** ✅ — both FieldHero and DuelHero: "Scores appear once tonight's PWHL games go final · N games tonight" or "Scores update as PWHL games are played this week"; `gamesThisNight` prop threaded from matchup page
     - **UX-076: Deep-link focus params** ✅ — `?focus=matchup` on tight-week hrefs; `?focus=lineup` on new-week/upcoming-soon hrefs; `components/FocusHighlight.tsx` scrolls + amber-pulses target element; matchup page wraps hero in `<div id="matchup-hero">`; roster page wraps LineupDnD in `<div id="lineup-section">`; `.focus-highlight-pulse` keyframe in globals.css
     - **UX-077: Action item copy** ✅ — all labels explicitly name destination: "Draft is live · Enter draft room →"; "Week N started · Set lineup →"; "Tight week — you're W–L · Open matchup →"; "Week N starts soon · Prep lineup →"
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

## Trade system (`lib/trades/engine.ts`, `lib/services/trade-service.ts`)

The trade system follows the same pure-engine + service-layer pattern as the draft.

**Engine (`lib/trades/engine.ts`):** pure, no IO. Key exports:
- `canTransitionTo(current, next, actorRole)` — declarative state-machine guard; `actorRole` is `"proposer" | "receiver" | "commissioner"`.
- `applyTrade(items, proposingRoster, receivingRoster, proposingTeamId?, receivingTeamId?)` — moves players between rosters (incoming players land on BENCH). Auto-derives team IDs from roster membership when not explicitly provided. Called both for post-trade legality simulation in `_validate()` and for actual roster mutation in the service.
- `validateTradeProposal` / `validateTradeExecution` — both call the same `_validate()` which runs: stale check first (returns `"STALE"` immediately), then both-sides check, then play-lock check, then roster-legality simulation via `applyTrade` + `checkRosterLegal`.

**Service (`lib/services/trade-service.ts`):** error classes `TradeValidationError`, `TradeNotFoundError`, `TradeTransitionError`. Functions: `proposeTrade`, `acceptTrade`, `rejectTrade`, `counterTrade`, `cancelTrade`, `reviewTrade`, `executeTrade`, `processExpiredTrades`, `getTradesForTeam`, `getTrade`, `getLeagueTrades`. All notifications fire-and-forget (`void … .catch(() => {})`).

**Counter-offer flow:** modeled as a new `Trade` row with `counterOfId` linking back to the original. Original flips to `COUNTERED` status atomically in the same `$transaction`.

**Commissioner review:** `acceptTrade` checks `tradeReviewHours > 0 || requireCommissionerTradeApproval` and routes to `PENDING_REVIEW` or calls `executeTrade` directly.

**Trade deadline:** `proposeTrade` and `executeTrade` both block when `league.playoffStatus !== "NOT_STARTED"`.

**Schema additions:**
- `TradeStatus` enum (10 values: PROPOSED, COUNTERED, ACCEPTED, PENDING_REVIEW, EXECUTED, VETOED, REVERSED, REJECTED, CANCELLED, EXPIRED) — VETOED = killed during commissioner review (never executed); REVERSED = post-execution rollback by commissioner
- `Trade` model (`leagueId`, `proposingTeamId`, `receivingTeamId`, `status`, `message?`, `counterOfId?`, `reviewEndsAt?`, `executedAt?`, `resolvedReason?`)
- `TradeItem` model (`tradeId`, `fromTeamId`, `toTeamId`, `playerId`)
- `tradeReviewHours Int @default(24)` on `FantasyLeague`
- `requireCommissionerTradeApproval Boolean @default(false)` on `FantasyLeague`
- 6 new `NotificationType` values (TRADE_RECEIVED, TRADE_ACCEPTED, TRADE_REJECTED, TRADE_EXECUTED, TRADE_VETOED, TRADE_REVIEW_PENDING)

**API routes** (all under `app/api/leagues/[leagueId]/trades/`):
- `GET /trades` — list trades for the requesting team (incoming + sent) or league history
- `POST /trades` — propose a new trade; body `{ receivingTeamId, items, message? }`
- `GET /trades/[tradeId]` — trade detail
- `POST /trades/[tradeId]/accept` — receiver accepts
- `POST /trades/[tradeId]/reject` — receiver rejects
- `POST /trades/[tradeId]/counter` — receiver counters; body `{ items, message? }`
- `POST /trades/[tradeId]/cancel` — proposer cancels
- `POST /trades/[tradeId]/review` — commissioner approves/vetoes; body `{ action: "approve" | "veto" }`
- `PUT /trade-settings` — commissioner updates `tradeReviewHours` and `requireCommissionerTradeApproval`

**UI:** Trade Center at `/league/[leagueId]/trades` (Incoming / Sent / League History tabs); Propose flow at `.../trades/new`; Trade detail at `.../trades/[tradeId]`. Trade Settings and Pending Review list in admin panel. "Trades" nav link in league layout.

**Tests:** 22 tests in `tests/trade.test.ts` (8 state-machine, 6 proposal validation, 2 execution validation, 3 apply-trade, 3 transition negative cases via implicit coverage in terminal-state test).

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

**`NotificationType` enum:** `DRAFT_STARTING` | `ON_THE_CLOCK` | `LINEUP_INCOMPLETE` | `TRADE_RECEIVED` | `TRADE_ACCEPTED` | `TRADE_REJECTED` | `TRADE_EXECUTED` | `TRADE_VETOED` | `TRADE_REVIEW_PENDING`

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
  - `/team/[teamId]/roster` — combined lineup management (DnD, `LineupDnD.tsx`) + personal roster + free agent listings (add/drop). **`/team/[teamId]/lineup` redirects here** (Sprint 19).
  - `/team/[teamId]/schedule` — PWHL game schedule for this period, progress bar, per-game player counts
  - `/team/[teamId]/trades` — trade center (Incoming / Sent / League History tabs)
  - `/team/[teamId]/trades/new` — propose a trade
  - `/team/[teamId]/trades/[tradeId]` — trade detail
  - `/team/[teamId]/bracket` — playoff bracket (team-layout version)
  - `/team/[teamId]/transactions` — transaction log (team-layout version)
- **`/league/[leagueId]/`** — commissioner-only views. Non-commissioners are redirected to `/team/[teamId]/matchup` (Sprint 19).
  - `/league/[leagueId]/` — commissioner overview (playoff race, lineup status, announcements)
  - `/league/[leagueId]/standings` — full standings table
  - `/league/[leagueId]/matchups` — full schedule with scored/upcoming matchups
  - `/league/[leagueId]/bracket` — playoff bracket (league-layout version)
  - `/league/[leagueId]/roster` — all rosters across all teams ("All Rosters") — commissioner-only (Sprint 19)
  - `/league/[leagueId]/admin` — commissioner-only management panel
  - `/league/[leagueId]/season` — season period table + dev simulation controls

The old `/league/[leagueId]/matchup`, `/league/[leagueId]/lineup`, `/league/[leagueId]/trades/*`
routes exist as redirect stubs that look up the user's team and redirect to `/team/[teamId]/...`.

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

**Section render order (Z1–Z9, single flat page — no tab switcher):**
- **Z1: Lineup alert strip** — red banner when active starters have `gamesThisPeriod === 0 AND gameCount === 0`. Does NOT flag players who already scored.
- **Z2: MatchupHero** (`FieldHero` / `DuelHero`) — scores, win-probability bar, "Set lineup →" CTA when upcoming. Shows "—" instead of 0.0 during SETUP phase (`isSetupPhase` flag), with amber "No games yet" badge.
- **Z3: Live situation grid (active periods only)** — 2-column: left = Playing Tonight + Swing Players; right = `RosterStatusWidget` (lineup fill count, lock state, projected FP, "Adjust lineup →").
- **Z3b: RosterStatusWidget only (upcoming periods)** — full-width when no live situation to show.
- **Z4: Rival badge + H2H history** — if rival exists.
- **Z5: Recap card (last result)** — most recent completed matchup, compact.
- **Z6: Roster tables** — both teams. Uses `InlineLineupEditor` for own team when upcoming.
- **Z6b: Last week's stats (SETUP phase fallback)** — shown when `lastWeekLabel && myPlayersLastWeek.length > 0`.
- **Z7: Storyline chip + Top/Underperforming performers** — shown when `topPerformers.length > 0` or `disappointments.length > 0`.
- **Z8: League leaders this week** — active periods only, when `leagueTopPerformers.length > 0`.
- **Z9: League activity feed** — full-width bottom.

**`isSetupPhase` flag:** `ActiveMatchup.isSetupPhase?: boolean` — set in `lib/services/dashboard.ts` when the period is technically active (`status === "active"`) but all roster players have `gameCount === 0` (zero stat lines so far). Both heroes use `hideScore = isUpcoming || isSetupPhase` — shows "—" instead of 0.0. Prevents the "0.0 vs 0.0 · Tied" display during replay SETUP phase and real-world week start before any games tip off.

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
Run `npx prisma db push` after any schema change to activate new models/fields in the dev DB.

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
- Playoffs `IN_PROGRESS` → `/league/<leagueId>/bracket`
- Non-commissioner (all other states) → `/team/<teamId>/matchup` (Sprint 19: league overview is commissioner-only)
- Commissioner (all other states) → renders the commissioner overview

The league overview is now a **commissioner-only hub** (Sprint 19). Non-commissioner members are
redirected to their franchise page. The commissioner overview shows the playoff race, per-team
lineup status, announcements, and the commissioner action strip.

### League layout nav

`app/league/[leagueId]/layout.tsx` is async and fetches the current user + league commissioner.
Nav items shown to members: Overview, Standings, Schedule, Bracket.
"Admin" is appended only when `user.id === league.commissionerId`.
"Rosters" (All Rosters) is commissioner-only in the league zone (Sprint 19); members use `/team/[teamId]/roster`.
A "My Franchise →" button links to `/team/[myTeamId]/matchup` when the user has a team.
Matchup, Lineup, Roster, Trades, Transactions, and Bracket also live in the team layout.

The team layout (`app/team/[teamId]/layout.tsx`) renders a persistent tab bar via
`TeamNav.tsx` (client component, uses `usePathname()` for active state). Tabs (Sprint 19):
**Matchup · My Roster · Trades · Record · Analysis** (conditionally + **Playoffs** when `playoffStatus !== "NOT_STARTED"` + **Transactions**), plus a `"{leagueName} ↗"`
escape hatch on the right. "Lineup" and "Free Agents" tabs were removed in Sprint 19 — lineup management
is now on the roster page. Active tab has white text + 2px indigo underline; inactive tabs are muted
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
- **When updating CLAUDE.md** (build order, feature status, or sprint notes), keep these sibling files in sync:
  `docs/01-roadmap/roadmap-index.md`, `docs/01-roadmap/roadmap-features.md`, `docs/01-roadmap/roadmap-sprints.md`. The HTML dashboard (`docs/01-roadmap/roadmap-dashboard.html`) is the visual tracker and should be updated on the same cadence as the markdown files.
