# PWHL Fantasy Roadmap — Sprint Plan & Timeline

---

## About This Document

This document contains the sprint plan (how features map to sprints), sprint history, and the launch timeline. For detailed feature specifications, see [roadmap-features.md](roadmap-features.md). For the current state and "what to build next" queue, see [roadmap-index.md](roadmap-index.md).

---

# Sprint Plan — Alignment + Validation + Feature Builds

The "What To Build Next" list above sequences feature work by token cost. This section is the
**calendar view**: it interleaves Phase 0 alignment, MVP validation, and feature builds into
sprints. Item IDs reference Phase 0 (IA-*) above and the GPT launch tracks in
`docs/01-roadmap/roadmap-features.md` (DE-*, LC-*, CT-*, TR-*, NT-*, MS-*).

Assumes a solo builder working with Claude (Pro), ~2 weeks per sprint. Tracks: **A**lignment ·
**V**alidation · **F**eature.

## Sprint 0 — "Make it match the rules" · ✅ COMPLETE · Track A (P0)

- IA-001 Roster defaults 3F — validation updated + CLAUDE.md updated ✅
- IA-002 VP authoritative (standings, qualification, seeding) ✅
- IA-003 Playoff defaults → 4 teams / no byes / single-week ✅
- IA-007 Auto-draft rebalance for 3F demand ✅

**Exit:** scorecard Rosters / VP standings / Playoffs flipped FAIL → PASS. ✅

## Sprint 1 — "Prove a season completes" · ✅ COMPLETE · Track V (P0)

- End-to-end season simulation framework (`scripts/simulate-season.ts`) ✅
- VP standings validation suite — 28 tests in `tests/vp.test.ts` ✅
- Playoff qualification & seeding validation suite — 18 tests in `tests/playoffs.test.ts` ✅
- Period-based lineup lock (LC-001) ✅
- MVP readiness scorecard updated — confidence 85–90% ✅

**Exit:** one simulated league completes a full season with zero manual DB edits. ✅

## Sprint 2 — "Commissioner + Platform Foundation" · ✅ COMPLETE

**Draft reliability track:**
- C1 WebSocket reconnect with exponential backoff (`useDraftSocket.ts`) ✅
- C2 Commissioner auth enforcement on START/PAUSE/RESUME — server-side (`server.ts`) ✅
- H1/H3 Position-aware + value-ranked auto-pick — tier (G needed → skater starter → bench) + proxy FP ✅

**Commissioner track:**
- CT-001 Force roster move, undo transaction, replace inactive manager ✅
- CT-002 Audit logging — `lib/services/audit-service.ts`, all routes write `LeagueEvent`; admin panel shows last 50 ✅
- CT-004 Draft pause/resume audit writes + draft-paused banner on admin panel ✅
- IA-004 Season boundary validation — `validateSeasonBoundary()` in `lib/season/lifecycle.ts` ✅

**Platform foundation track:**
- MS-001 `parentLeagueId` schema + self-referencing `"LeagueLineage"` relation ✅
- MS-002 `rulesVersion Int @default(1)` on `FantasyLeague` ✅
- MS-003 `scoringVersion Int @default(1)` on `FantasyLeague` ✅
- MS-004 Season renewal — `lib/services/renewal-service.ts`, `/renew` API, `RenewLeagueForm`, admin "Start Next Season" ✅

**Analytics track:**
- AN-001 All 6 events shipped — `lib/analytics/index.ts` `trackEvent()`; `user_registered`, `league_created`, `league_joined`, `draft_started`, `draft_completed`, `lineup_saved` ✅

**Product track:**
- IA-006 VP education UI — `components/VpExplainer.tsx` on standings page ✅
- IA-005 8-team "Recommended" label on league creation form ✅

**Exit:** ✅ 130/130 tests pass · `tsc --noEmit` clean · commissioner can recover from any stuck state without engineering help · schema is multi-season-ready · schedule generator blocks PWHL playoff overlaps.

## Sprint 3 — "Beta-ready: onboarding, trust, mobile" · ✅ COMPLETE · June 13, 2026 · Track F

**Progress report:** `docs/01-roadmap/sprint-3-progress.md` (closed June 13, 2026)

- #2 League Onboarding ✅ (welcome flow, setup wizard, draft prep guide, replay explanation; `User.onboardingCompletedAt`; `components/WelcomeFlow.tsx`; `app/create-league/CreateLeagueWizard.tsx`; manager checklist on league overview)
- #4 Error Handling ✅ (empty / loading / retry across all core pages — draft room, matchup, lineup, standings, roster)
- #3 Mobile Optimization ✅ (draft room tabbed layout at ≤900px, 44px touch targets everywhere, BottomNav safe-area, standings minWidth, matchup score clamp())
- NT-001 in-app notification infrastructure ✅ (`lib/services/notification-service.ts`, bell UI, draft server call sites for DRAFT_STARTING + ON_THE_CLOCK)
- NT-001 schema delta ✅ (`title`, `body`, `actionUrl`, `teamId`, `dedupeKey` on `Notification`; `@@unique([userId,type,dedupeKey])` live; bell renders stored fields)
- NT-002 draft notifications ✅ (DRAFT_STARTING + ON_THE_CLOCK wired from `lib/draft/server.ts`)
- NT-003 Scheduled trigger decision ✅ resolved June 13, 2026: check-on-dashboard-load + DB-level dedupeKey — see `docs/02-engineering/notification-framework-spec.md`
- #8 Transaction History ✅ (paginated API + page with type/team filters, replay guard, infinite scroll)
- #28 Lineup Stats Tab Polish ✅ (unplanned positive addition — renamed "Matchup Proj", between-weeks default, "This week" hidden when no active period)
- #32 Draft Room Team Distribution Panel ✅ (unplanned positive addition — `TeamSpreadPanel` in `DraftRoom.tsx`, concentration color-coding)

**Carry-forwards to Sprint 4:**
- NT-002 LINEUP_INCOMPLETE — shipped early Sprint 4 (June 13, 2026); see Sprint 4 shipped items
- IA-011 Hide advanced non-v1 settings — shipped during Sprint 3 (`ae9246d`)

**Exit:** a brand-new user creates and drafts a league on a phone with no docs. ✅ ACHIEVED

## Sprint 4 — "Product polish: lineup, commissioner UX, rivalries" · ✅ COMPLETE · Jun 13, 2026 · Track F

Closed all in-progress feature gaps and carry-forwards before beta.

**Shipped early Sprint 4 (June 13, 2026):**
- **NT-002 LINEUP_INCOMPLETE notification** ✅ — `checkAndEmitScheduledNotifications(userId, nowMs, prisma)` in `lib/services/notification-service.ts`; wired into `app/dashboard/page.tsx` on load; `dedupeKey = "{periodStartsAt}-{teamId}"`; fires when any active starter's PWHL team has no games remaining in the active period; idempotent via DB unique constraint (commits `cb3a5d1`, `1a63871`)

**Remaining sprint 4 items:**
- **#28 Lineup Stats Tab Polish** ✅ — shipped during Sprint 3; no further work needed
- **#01 Commissioner Dashboard (remaining gaps)** ✅ — pause/restart replay shortcut; force-draft-start CTA; lineup lock override (`POST .../commissioner/unlock-player`); settings editor (gated on pre-draft); all actions write to audit log (shipped June 13, 2026; commit eb65449)
- **#17 Rivalries (remaining gaps)** ✅ — rival badge + H2H history view on matchup page (shipped June 13, 2026; commit cbe8374); rival = most-played opponent (tie-break W/L); H2H shows last 5 matchups with dates, scores, outcomes

**Bug fixes & UX improvements (Sprint 4):**
- **VP Standings Zeroing Fix** ✅ — root cause: `homeVP`/`awayVP` columns defined in schema but missing from Prisma migration; DB returned `undefined` → unsafe casts degraded to `null` → `computeVpStandings` skipped all rows. Solution: created migration `20260627101300_add_vp_scoring` to add missing columns; removed 7 unsafe type casts across standings-service, 4 page components, and season/index (commit da9a027)
- **League Matchup Slate Removal** ✅ — user feedback: slate card showing all league matchups was not the right UX. Removed MatchupSlateRow type, leagueMatchupSlate field, VP-mode slate computation, and MatchupSlateItem component. Remaining sections on matchup page unchanged: hero card, rival badge, playing tonight, swing players, rosters, activity feed (commit b41161b)
- **Playoff Mode + Replay Support** ✅ — fixed critical bug in `derivePlayoffPeriods` (removed broken array-index heuristic); implemented `getPlayoffDashboardData()` showing live playoff 1v1 matchups on franchise page with DuelHero component; added "Start Playoffs →" button and "+1 Week" advancement to ReplayDayBar; added "Playoffs" tab to TeamNav when in playoffs; added playoff R1/R2 round chips to team layout; fixed `getLastResult` to include playoff results in recap card; added playoff action item to dashboard; removed placeholder matchup row creation (foreign key constraint violation); all TypeScript checks pass (commit b41161b)

**Exit:**
- NT-002: ✅ ACHIEVED — manager with a starter whose PWHL team has no games remaining this period receives a LINEUP_INCOMPLETE in-app notification on dashboard load; second load in the same period does not duplicate it.
- IA-011: ✅ ACHIEVED (Sprint 3) — bracket shows no "bye" text on default 4-team format; admin settings render as readable tables.
- #01: ✅ ACHIEVED — all four commissioner recovery actions are reachable from the admin panel, write a `LeagueEvent`, and are reflected in the audit log table. Specifically: pause/restart replay, force draft start, unlock player (period-lock only, respects play-lock), and pre-draft settings editor.
- #17: ✅ ACHIEVED — rival badge shows most-played opponent with season series W-L-T record; H2H history on matchup page displays last 5 matchups with dates, scores, and outcomes. Rival = opponent with highest number of completed matchups (tie-break by W-L record). Data computed from existing `Matchup` rows; no schema changes.
- **Playoff Mode (Replay + Live):** ✅ ACHIEVED — replay commissioners can advance through game days until regular season ends, then click "Start Playoffs →" to initialize playoffs. ReplayDayBar shows "+1 Week" to advance through playoff rounds. Franchise page shows live 1v1 playoff matchup with DuelHero, opponent rosters, and win probability. TeamNav shows "Playoffs" tab linking to bracket. Team layout shows "R1"/"R2" etc. playoff round chips. Dashboard surfaces "🏆 Playoffs are live" action item. All controls work in both replay and dev-sim modes.
- No Phase 1 or Phase 5 feature card enters beta in "partial" state when the remaining work is small and well-specified. Any item not shipped must be explicitly deferred with a documented reason.

## Sprint 5 — "Validation + Beta Operations" · ~2 wks · Track V ✅ COMPLETE

**Shipped (Sprint 5):**

- **Replay gap bug fix** ✅ — After scoring Week 10 of the 2025-26 season the 21-day all-star break gap (Jan 31 → Feb 21) caused the "Score week N" button to disappear because `targetPeriod` only checked for ACTIVE or SCORING_PENDING periods. Added UPCOMING as a third fallback so the button correctly shows "Score week 11" and bridges the gap in one click. Fixed in `app/league/[leagueId]/season/SeasonControls.tsx`. **Verified end-to-end via Playwright (Jun 13, 2026): after scoring Week 10, "Score week 11" correctly appeared across the all-star break gap. PASS.**
- **"Sim to playoffs" button** ✅ — Added a purple "⏩ Sim to playoffs" button in the replay/dev season controls. Scores all remaining regular-season weeks in a single click by calling `advanceSeason` with the simulated date set past the final week's end. After completion, the "▶ Start Playoffs" button appears. No API changes — `advanceSeason` already supports multi-week scoring. Implemented in `app/league/[leagueId]/season/SeasonControls.tsx`. **Verified end-to-end via Playwright (Jun 13, 2026): clicking from mid-season scored all remaining weeks (11–20) in one shot; "Score week N" and "Sim to playoffs" disappeared; "▶ Start Playoffs" appeared; clicking it generated a correct 4-team bracket (Semifinals Active, Championship TBD). No regressions. PASS.**
- **Draft Reliability Certification** ✅ — duplicate-tab handling, concurrent-league load test (8–10 leagues), reconnect stress test (10+ forced disconnects); findings documented in `docs/04-operations/commissioner-runbook.md`. MVP scorecard all green.
- **Founder Operations Console** ✅ — `FOUNDER_EMAILS` env-var auth gate; `/founder/` dashboard (league stats, MVP gates, cross-league commissioner action feed); `/founder/leagues` searchable explorer; `/founder/leagues/[leagueId]` tabbed detail (Config · Standings · Season with sim controls · Draft); `/founder/simulate` end-to-end throwaway season validator (create → auto-draft → score all → playoffs → champion). New API routes: `POST /api/founder/leagues/[leagueId]/simulate`, `POST /api/founder/leagues/[leagueId]/start-playoffs`, `POST /api/founder/simulate-season`. No schema changes. (commit c48a1e7)

- **Playoff Experience UX + Journey Fixes** ✅ — Full audit of the playoff user journey revealed 9 issues (3 P0 blockers, 4 P1 UX gaps, 2 P2 polish items). All fixed: new `POST /api/leagues/[leagueId]/advance-playoff-round` commissioner route with SeasonControls UI (P0-A); eliminated-team detection in `getPlayoffDashboardData` (P0-B); playoff matchup week numbers (P0-C); champion announcement card + league overview banner + `ChampionInfo` on `DashboardData` (P1-A); commissioner action strip playoff awareness (P1-B); "View bracket →" in DuelHero (P1-C); between-rounds `playoffPending` state (P1-D); rich mini bracket summary in league overview (P2-A); async params in bracket/matchups pages (P2-B). tsc clean.

- **Feature #30 Playoff Experience UX — COMPLETE** ✅ (commit 5df2b0c) — final pieces: `/league/[leagueId]/` now redirects to `/bracket` when `playoffStatus === IN_PROGRESS` (bracket is the primary landing during active playoffs); `PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`, `CHAMPIONSHIP_WON` added to `EventType` enum in `prisma/schema.prisma` and `LeagueEventType` union in `lib/services/activity.ts`; `advance-playoff-round` route emits elimination/clinch/championship activity feed events after scoring each round; TypeScript narrowing fix (`playoffStatus` local const, dead `IN_PROGRESS` commissioner branches removed from overview). Files: `prisma/schema.prisma`, `lib/services/activity.ts`, `app/api/leagues/[leagueId]/advance-playoff-round/route.ts`, `app/league/[leagueId]/page.tsx`.

**Deferred from Sprint 5 to Sprint 6:**
- **Commissioner workflow validation** ✅ COMPLETE — async params fixed in 4 routes; null-check guard added to undo-transaction; force-move no-op comment added; runbook updated with VP values, playoff instructions, season renewal UI path, reconnect backoff, champion banner, replace-manager edge case, and per-tool detail. Findings documented in `docs/02-engineering/commissioner-workflow-validation-plan.md`.
- **Weekly Performance Dashboard (#29)** — shipped Sprint 6; see below.
- **Beta Feedback Infrastructure** — deferred: cohort small enough for out-of-band channels. Revisit once founding commissioners are active.

**Exit:** commissioner can run a league start-to-finish with no engineering help; founder can monitor platform health without DB access; founding commissioner cohort can be invited. ✅ ACHIEVED

## Sprint 6 — "Engagement + Transactions" · ~2 wks · Track F · P1 · ✅ COMPLETE

Goal: Ship the features founding commissioners will notice during the closed beta. All items
here are read-heavy or isolated new domains — none touch the draft or standings core.

**Shipped (Sprint 6):**

- **Priority 1 — Auto-Set Lineup (#34)** ✅ · ~60K
  Spec: `docs/02-engineering/auto-set-lineup-spec.md` · Commits: 3e6bbd0, f83468f, 1f06c9a
  `computeOptimalLineup()` in `lib/lineup.ts`; staged save model; "Auto-set" button (purple, disabled when no projections); `beforeunload` guard; playoff period fallback for games-remaining badges; `GET /api/leagues/[leagueId]/fa-suggestions` (top 10 unrostered by projected FP). No schema changes.

- **Weekly Performance Dashboard (#29)** ✅ (carried from Sprint 5)
  `lib/services/performance-service.ts` — `getWeeklyPerformance()` reads scored `Matchup` rows + live `computeAllTeamScores` for the active period; returns per-week FP, rank, W-L-T. Schedule tab overhauled into a full performance history page showing each completed/active week with FP, rank chip, and VP W-L-T record. TeamNav tab renamed "PWHL Schedule" → "Performance". No schema changes.

- **Wizard team-name step + join flow fix** ✅
  `CreateLeagueWizard.tsx` gains a new Step 5 where the commissioner names their own team before seeing the invite link (wizard now 7 steps). `POST /api/leagues/join` is session-aware: fills `ownerEmail` from the `pwhl_user_email` cookie when not provided; does not overwrite the existing session. Dashboard gains a "Commissioner" badge on teams the user commissions but doesn't own, and hides owner-only CTAs (Set Lineup, My Matchup) for those entries. Season "Start" action auto-sets `replayCurrentDate` to Week 1's `startsAt` so replay commissioners land on Week 1 immediately. Seed script upsert uses `OR [externalId, abbreviation]` to handle team-abbreviation conflicts on re-seed.

- **FA Schedule Awareness + Add & Slot (#35)** ✅ · Commit: 6a6b40f
  Games-remaining "Wk" badge on every FA row in `app/team/[teamId]/roster/page.tsx` + `RosterManager.tsx`, powered by the same batch query as the lineup page; sortable column. `components/AddAndSlotModal.tsx`: after adding a FA the modal offers eligible active slots (F/D/G/UTIL); selecting one calls `PUT /api/leagues/[leagueId]/lineup`; "Bench for now" dismisses; locked FAs skip the modal. Bonus fixes: lineup nudge on matchup page now respects roster settings slot count; dashboard lineup alert checks `gamesPlayedPerTeam` to avoid false positives. No schema changes.

- **Beta Feedback Infrastructure** ✅
  Spec: `docs/02-engineering/beta-feedback-spec.md`
  Schema: `FeedbackSubmission` model, `FeedbackType` enum (BUG/SUGGESTION/OTHER), `BetaStatus` enum (NONE/INVITED/ACCEPTED/ACTIVE/RENEWED), `betaStatus` field on `FantasyLeague`. Widget: `components/FeedbackWidget.tsx` — fixed bottom-right button → modal with type selector, textarea, submit; rendered via `ReactDOM.createPortal` into `document.body`; mounted in league, team, and founder layouts. API: `POST /api/feedback` (auth-gated, writes FeedbackSubmission rows); `GET /api/founder/feedback` (last 100 submissions); `PATCH /api/founder/leagues/[leagueId]/beta-status`. Founder Console: `app/founder/feedback/page.tsx` (feed table) + new Beta tab in `LeagueDetailTabs.tsx` with betaStatus dropdown.

**Bug fixes & UX improvements (Sprint 6):**
- **Between-weeks lineup nudge false-positive** ✅ — "Week N is coming up / Set lineup before games begin" amber banner persisted on the matchup page even after the user had used Auto-Set Lineup and saved. Root cause: nudge condition was `status === "upcoming"` only, with no check for lineup state. Fix: suppress nudge when `myPlayers.length >= activeSlotCount` (forward + defense + goalie + util from `rosterSettings`). `app/team/[teamId]/matchup/page.tsx`.

- **Priority 3 — Code Review & Pre-Beta Audit (#37)** ✅ — Findings: `docs/04-operations/pre-beta-audit.md`. All P0 and P1 findings resolved. **Go/No-Go: ✅ GREEN — ready to invite founding commissioners.**

  **P0 fixes (commit 00f26b0):**
  - **Renewal race condition** (`lib/services/renewal-service.ts`) — wrapped in `prisma.$transaction()` so the `playoffStatus` guard and child-league `create` are atomic.
  - **Draft concurrent-pick P2002 handling** (`lib/draft/server.ts` `persistPick()`) — P2002 caught; logs and no-ops instead of throwing.
  - **Auto-timeout re-entrancy guard** (`lib/draft/server.ts` `onTimeout()`) — `pickInFlight` flag prevents stale callbacks from re-entering pick resolution.

  **P1 fixes:**
  - **Force-move play-lock** (`commissioner/force-move/route.ts`) — `playerHasPlayedThisPeriod()` helper added; play-lock enforced on both the single-move path and both directions of the swap path.
  - **Playoff scoring documented** (`advance-playoff-round/route.ts`) — header comment clarifies 1v1 raw-FP scoring model vs VTF/VP regular-season scoring.
  - **Undo-waiver P2002 handling** (`commissioner/undo-transaction/route.ts`) — P2002 on PLAYER_DROP reversal now returns a clean 409 instead of an unhandled 500.

- **Replay league matchup generation & scoring** ✅ (commit 52ea547)
  Root cause audit uncovered three issues breaking the replay feature entirely:
  - **Auto-start season after draft** (`lib/draft/server.ts`) — COMPLETE effect now calls `startSeason()` to generate initial `Matchup` rows and sets `replayCurrentDate` to first period's start. Without this, no matchups existed in DB so the matchup page always showed "No matchups scheduled".
  - **Fix endpoint routing** (`components/ReplaySimulatorControls.tsx`) — both "advance" and "set-date" actions now correctly POST to `/season/advance` (was inverted: advance routed to `/season` which ignored `simulatedDate` body). Fixes the bug where the simulator was reading wall-clock time instead of the request body's simulated date, causing scoring to never happen.
  - **Test mock $transaction** (`tests/renewal.test.ts`) — mock Prisma object now implements `$transaction` callback pattern, fixing 9 failing renewal tests.
  Result: replay feature works end-to-end — draft completes → matchups auto-generate → weeks score correctly via simulator.

- **Team Analysis & Insights (#25)** ✅
  `lib/services/analysis-service.ts` — `getTeamAnalysis()` with 4 DB queries; player hot/cold/on-track/new trends (rolling 5-game avg vs season avg); position-group FP per week vs league median; FA upgrade cards for weakest group. `app/api/leagues/[leagueId]/analysis/route.ts` — GET with `apiRequireLeagueMember`. `components/MatchupTabs.tsx` — tab switcher (Matchup | Analysis). `components/AnalysisTab.tsx` — Player Trends table, Position Groups table (amber WEAK highlight), FA Upgrade cards. `app/team/[teamId]/matchup/page.tsx` modified: `getDashboardData` + `getTeamAnalysis` run in parallel via `Promise.all`; hero/alerts/replay controls stay above tabs. Trade suggestions scoped out — deferred until Trade System (#7) ships.

- **Priority 5 — Waiver Priority + Processing (#5)** ✅ · ~110K
  Spec: `docs/02-engineering/waiver-spec.md`
  Schema: `WaiverEntry`, `WaiverClaim`, `WaiverPriority` models; `WaiverStatus` enum; 4 new `EventType` values; `waiverWindowHours Int @default(48)` on `FantasyLeague`. Service: `lib/services/waiver-service.ts` — `initializeWaiverPriority()` (reverse VP-standings; pre-season falls back to reverse draft order); `enterWaiverWire()` (idempotent upsert after every DROP); `getPlayerWaiverStatus()`; `submitClaim()` (priority snapshot); `processWaivers()` (idempotent batch processor). API: `GET/POST/DELETE /api/leagues/[leagueId]/waivers`; `POST .../waivers/process` (commissioner-only). UI: `components/WaiverWirePanel.tsx` — wire table, pending claims, priority panel; "Waiver Wire" tab in `RosterManager.tsx`; "On Waivers" badge in FA table. Ops: `scripts/process-waivers.ts` cron script; "Process Waivers" button in founder console. Season: `startSeason()` now calls `initializeWaiverPriority()`. Transactions: "Waivers" filter tab in `TransactionFeed.tsx`; 4 new event types in `lib/services/activity.ts`. Tests: 13 new tests in `tests/waiver.test.ts` (174 total). FAAB and priority customization (static vs. rolling) explicitly deferred to Sprint 7.

**Exit:** founding commissioners can auto-set lineups ✅, see their weekly performance history ✅, add a FA with immediate slot-in flow ✅, submit feedback visible in founder console ✅, code audit complete with P0 findings resolved ✅, team analysis shipped ✅, waiver priority + batch processing live ✅. 7/7 items complete.

---

## Sprint 7 — "Retention Layer" · ✅ COMPLETE · Track F · P2

Goal: Cement the multi-season story before the season ends. These features build on the
schema foundation laid in Sprint 2 (parentLeagueId, rulesVersion, scoringVersion) and the
engagement surfaces from Sprint 6.

**Priority 1 — Trade System (#7)** · ~130K
Spec: `docs/02-engineering/trade-spec.md`
Pulled up from backlog June 2026 — higher priority than League History/HoF for the launch
period. Full trade proposal/review/approval flow: managers propose trades, league displays
pending trades for both parties to accept/reject, commissioner review gate (optional),
trade history in Transaction feed. Schema: `Trade` / `TradeOffer` tables. 3 new notification
types. Full audit log. Trade-suggestion CTA in Team Analysis (#25) unblocked once this ships.

**Priority 2 — League-Wide Matchup Storylines (#11)** · ✅ SHIPPED
Spec: `docs/02-engineering/matchup-storylines-spec.md`
`computeWeeklyStorylines()` + `emitWeeklyStorylines()` in `lib/services/storyline-service.ts`;
`LEAGUE_STORYLINE` `EventType` in `prisma/schema.prisma`; `components/WeekHighlights.tsx`
renders closest-match, high-score, and player-standout cards on the league overview after each
week scores. Storylines emitted fire-and-forget from `advanceSeason()` in `lib/season/index.ts`.
Fetched server-side in `app/league/[leagueId]/page.tsx` (no separate API route needed).
173-line test suite in `tests/storyline.test.ts`. No schema changes beyond the new EventType value.

**Priority 3 — GM Command Center — Replay Simulator Rebuild (#39)** · ✅ SHIPPED
Complete rebuild of the replay simulator, replacing the scattered 3-surface model (sticky footer +
inline panel + admin page) with a single dedicated `/league/[leagueId]/sim` route modeled on sports
franchise games (Madden, etc.). Five explicit phases drive the UX: PRE_SEASON → SETUP → RECAP →
SEASON_COMPLETE → PLAYOFFS. Commissioners progress with one clear action per phase; phases derive
deterministically from season state with no extra DB flag. API: single `/api/leagues/[leagueId]/sim`
POST endpoint with 4 actions (simulate/advance/start/skip-to-playoffs). Deleted 9 old files (~1,545
lines). Shipped June 20, 2026. Spec: `docs/02-engineering/replay-season-simulator-spec.md`.

**Hotfix (June 20, 2026):** Playoff start week calculation corrected. Previously used historical
Game.startsAt dates for replay leagues, causing playoffs to schedule for non-existent weeks. Now
derives playoff start from actual end time of last regular season matchup week. For an 8-team
league, playoffs now correctly start in week 19 (instead of calculating into week 21+).

**Priority 4 — Replay Simulation V2 — Accelerated & Scheduled Playback (#38)** (DEFERRED)
Enhance the replay experience so commissioners can run faster, more automated simulations.
V1 lets you click "Next day" one day at a time. V2 adds:

- (a) Configurable playback speed — advance N days per click, or auto-advance on a timer
- (b) "Jump to week N" shortcut — commissioner selects a target week from a dropdown and
  the simulation advances all intermediate days/weeks in one operation
- (c) Replay progress summary card — shown in the league overview during active replay; displays
  current simulated date, W-L record, standings snapshot, and top scorer at that point in the season
- (d) Notification trigger points — fire at least one notification to managers at a key replay
  moment (e.g. "Week 3 complete — check your standings!"), using the existing
  `createNotification` / `dedupeKey` infrastructure so triggers are idempotent

User story: As a commissioner running a replay league, I want to control the speed and flow
of the simulation so that my league stays engaged without requiring me to manually click
through every single day.

Acceptance criteria:
- Speed control UI on the season/replay controls page (advance N days per click or timer)
- "Jump to week N" dropdown that scores all weeks up to the target in one action
- Replay progress summary card visible on the league overview with record, standings, top scorer
- At least one notification trigger point fires during replay advancement with a dedupeKey

Builds on: `isReplay` / `replayCurrentDate` / `getReplayNow()` / `ReplayDayBar`
(`scripts/seed-replay.ts`). No schema changes anticipated.

**Stretch — Email Notifications** · ~50K
Email channel for `LINEUP_INCOMPLETE`, `TRADE_RECEIVED`, and `WAIVER_RESULT` notification types.
Uses the existing `Notification` / `NotificationPreference` models. Integration with a transactional
email provider (e.g. Resend). Deferred from Sprint 3 — add only if beta feedback surfaces it as P1.

**PLAYOFF-AUDIT-001 — Playoff System Verification** · ✅ COMPLETE (2026-06-20)
Spec: `docs/02-engineering/playoff-system-spec.md`

All 5 ACs passed. Three bugs found and fixed during the verification run:

- **PLAYOFF-BUG-001** ✅ — Already fixed in commit b465423 (`?? 6` → `?? 4`). No code change needed.
- **Q1** ✅ — `computeVpStandings()` correctly filters `isPlayoff = true` at lines 159, 188, 218 of `lib/scoring/vp.ts`.
- **Bug A — `populateNextRound` silent no-op** ✅ — Script's `populateNextRound()` only looked for
  placeholder rows; the current design never creates them. Updated to create a fresh matchup row
  (dates shifted from round 1) when no existing row for the target round exists.
- **Bug B — cleanup FK violation** ✅ — Added `waiverPriority.deleteMany` + `waiverClaim.deleteMany`
  before team deletion in the prior-league cleanup block.
- **Bug C — tsc error in `lib/draft/server.ts`** ✅ — `firstPeriod.startsAt` → `firstPeriod.period.startsAt`.

Results: `simulate-season.ts` completes end-to-end (🏆 Northern Lights, 37VP, 13-7-0);
`tsc --noEmit` clean; 180/180 tests pass (including all 19 in `tests/playoffs.test.ts`).

**Exit:** trade system is live for beta commissioners; ~~league overview shows weekly storylines~~ ✅ DONE; ~~playoff system verified end-to-end~~ ✅ DONE (PLAYOFF-AUDIT-001 complete Jun 20).
The platform is ready for the 2027-28 off-season renewal window.

**Note:** Player Legacy & Cross-Season Tracking (#31) was removed from Sprint 7 and deferred to the post-launch backlog. The feature requires at least one completed and renewed season to be meaningful — it cannot deliver real value until 2027-28.

---

## Sprint 8 — "Beta Hardening" · ✅ COMPLETE · ~1 wk · Track V+F · P0/P1

Goal: Close the gap between code-complete and production-ready before the founding commissioner
cohort is invited. This is the integration and production-readiness work that unit tests cannot
catch. Based on the staff-level code audit findings from Sprint 6 (#37).

**Audit verdict: GO TO BETA.** No showstoppers. ~8h of P0/P1 fixes needed.

**Note: All P0 and P1 items were applied immediately after Sprint 6 completion — ahead of the
Sprint 8 schedule. See "Shipped early (Jun 20, ahead of schedule)" below.**

**Shipped (commit b465423 — Beta Bug Fixes):** ✅

These 7 bugs were caught during Sprint 7/8 and resolved in a single commit before beta invites.

1. **BUG-1 / PLAYOFF-1: Anchor playoff periods to last game in replay leagues** ✅ — playoff period derivation now anchors to the last game in the replay dataset rather than using a broken wall-clock heuristic; fixes scoring periods that ended prematurely in replay leagues.
2. **BUG-2 / PLAYOFF-2: Auto-resolved by BUG-1** ✅ — downstream issue caused by the same root cause as PLAYOFF-1; resolved without separate code change.
3. **BUG-3A / PLAYOFF-3: Enable auto-set during playoffs** ✅ — `computeOptimalLineup()` / Auto-set button now works during playoff periods; previously failed to find a valid period and returned no suggestion.
4. **BUG-4 / ROSTER-1: Fix roster refresh after adding FA** ✅ — `RosterManager.tsx` `handleAdd` now calls `router.refresh()` instead of `setRoster(data.roster!)` after a successful FA add; prevents stats wiping on refresh.
5. **BUG-5A / LINEUP-1: Demote zero-games players in lineup sort** ✅ — `computeOptimalLineup()` in `lib/lineup.ts` deprioritizes players whose PWHL team has zero games remaining in the period, preventing auto-set from starting players who cannot score.
6. **BUG-5B / FA-SUGG-1: Fix fa-suggestions with sim-date + games filter** ✅ — `GET /api/leagues/[leagueId]/fa-suggestions` now respects the `pwhl_dev_sim_date` cookie and applies the correct games-remaining filter; fixes suggestions returning stale or zero-game players in dev sim mode.
7. **PLAYOFF-BUG-001 / BRACKET-1: Fix bracket default from 6 → 4 teams** ✅ — `app/league/[leagueId]/bracket/page.tsx` line 70: `teamsInPlayoff ?? 6` corrected to `?? 4`; bracket race banner now correctly shows "4 teams qualify" for default leagues. This resolves the P1 item from PLAYOFF-AUDIT-001 tracked in Sprint 7.

**Shipped early (Jun 20, ahead of schedule):** ✅

1. **Waiver cron (P0-1, P0-4)** ✅ · Shipped Jun 20 — `app/api/cron/process-waivers/route.ts`
   POST handler; iterates all `IN_SEASON` leagues; calls `processWaivers()`. Auth-gated by
   `CRON_SECRET` header in production; open in dev via `ALLOW_SEASON_ADVANCE`. New
   `vercel.json` with cron entry at `0 8 * * *` (08:00 UTC = 03:00 ET daily).
   Ops note: `CRON_SECRET` env var must be set in Vercel before public launch.

2. **Auto-set projection safety (P0-2)** ✅ · Shipped Jun 20 — projection fetch in
   `app/team/[teamId]/lineup/page.tsx` wrapped in try/catch; `projectionsAvailable: boolean`
   passed to `LineupManager`. Auto-set button disabled with tooltip when
   `!projectionsAvailable`; "Matchup Proj" stats tab also disabled.

3. **Verify waiver priority init (P0-3)** ✅ · Verified Jun 20 — `lib/draft/server.ts`
   already calls `startSeason()` unconditionally for all leagues. No code change needed.

4. **Analysis tab error state (P1-A)** ✅ · Shipped Jun 20 — `getTeamAnalysis()` failure
   now returns `null` instead of crashing; `AnalysisTab` renders
   "Analysis data unavailable. Try refreshing." when `null`.

5. **Auto-set between-weeks UX (P1-B)** ✅ · Shipped Jun 20 — `computeOptimalLineup()`
   sort in `lib/lineup.ts` now falls back to `gamesThisPeriod` when all `projectedFp` are
   `null`, giving a useful ordering between weeks.

6. **Add/Slot capacity validation (P1-C)** ✅ · Shipped Jun 20 — `components/AddAndSlotModal.tsx`
   now shows "roster is full, drop a player first" and hides the slot picker when at max
   roster size.

7. **Waiver cancel confirmation (P1-E)** ✅ · Shipped Jun 20 — `components/WaiverWirePanel.tsx`
   two-step inline confirm: "Confirm cancel?" + "Keep" — no accidental tap destroys a claim.

8. **Analysis scoring settings freshness (P1-F)** ✅ · Verified Jun 20 — `lib/services/analysis-service.ts`
   already fetches fresh `scoringSettings` on every call. No code change needed.

**Test status at time of P0/P1 fixes:** 174/174 tests pass. Zero new TypeScript errors.

**P1-D (schedule badge timezone)** ✅ — resolved as part of Sprint 8 tail polish.

**Deferred to operations phase (pre-launch, does not block beta invites):**

9. **End-to-end integration test** — full season simulation with waivers + FAAB scoring
    across 3+ leagues simultaneously; verify no data corruption.

10. **Vercel cron wiring** — confirm `CRON_SECRET` env var is set in Vercel staging; confirm
    `process-waivers` fires at 03:00 ET; `check-incomplete-lineups` entry added to
    `vercel.json`. Both must fire in staging before public launch.

11. **Load test** — 10+ concurrent leagues drafting/scoring simultaneously. Goal: zero
    dropped picks, no duplicate-pick errors, no waiver-priority corruption.

12. **P2 notification gaps (can slip to first post-beta fix):**
    - P2-A: cron for `LINEUP_INCOMPLETE` notifications (currently fires on dashboard load only)
    - P2-B: `WAIVER_CLAIM_AWARDED` / `WAIVER_CLAIM_DENIED` notification types wired from `processWaivers()`

13. **Final UX polish** — error messages, empty states, and tooltips standardised across all
    surfaces; audit any remaining raw error strings visible to users.

**Progress: 14/14 items done (all P0 + P1 shipped early Jun 20; 7 beta bug fixes shipped commit b465423)**

**Exit:** Vercel cron confirmed live with `CRON_SECRET` set; load test passed with 10+
concurrent leagues; integration test clean; founding commissioner beta invites go out.

---

## Sprint 9 — "PWHL GM Rebrand" · ~2 wks · Track F · P1/P2 · ✅ COMPLETE

Goal: Execute the planned PWHL Fantasy → PWHL GM rebrand. All 8 stories shipped. The product is now fully rebranded as PWHL GM.

**All items shipped:**

**REBRAND-001: Core Identity (Name, Logo, Hero)** · 5 pts · P1 · ✅ SHIPPED
`components/LogoShield.tsx` (new); global "PWHL Fantasy" → "PWHL GM" rename across all `.tsx` files; `public/favicon.ico` and `public/manifest.json` updated; home page hero rewrite ("Think Like a GM.", management sub-copy, "How it works" steps reframed); hero eyebrow color `--green` → `--accent`.
Files: `app/layout.tsx`, `app/page.tsx`, `public/favicon.ico`, `public/manifest.json`, `components/LogoShield.tsx`.

**REBRAND-002: Voice Consistency** · 3 pts · P1 · ✅ SHIPPED
Welcome flow title/eyebrow/card descriptions; dashboard "Your Franchises"; login pitch copy; admin nav "Admin" → "Front Office"; invite and register page copy.
Files: `components/WelcomeFlow.tsx`, `app/dashboard/page.tsx`, `app/login/page.tsx`, `app/league/[leagueId]/layout.tsx`, `app/register/page.tsx`, `app/invite/[leagueId]/page.tsx`.

**REBRAND-003: Detail Polish ("Fantasy" Modifiers + Docs)** · 3 pts · P2 · ✅ SHIPPED
Removed "fantasy pts" label from `RosterManager.tsx`; draft room header updated to "PWHL GM — Draft Room"; `CLAUDE.md` and `README.md` product name updated; "pts" terminology throughout.
Files: `app/team/[teamId]/roster/RosterManager.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`, `app/leagues/page.tsx`, `CLAUDE.md`, `README.md`.

**REBRAND-004: Design Token System Upgrade** · 5 pts · P2 · ✅ SHIPPED
Archivo + Saira Condensed font vars (`--font-body`, `--font-stats`); deep violet `--accent` (#7c3aed); solid dark card surface (`--card`, #121829); radial gradient background; `.rebrand-card`, `.pos-badge`, `.alert-amber`, `.chip-*`, `.section-accent`, `.font-stats` utility classes; `.draft-player-row:hover`, `.bracket-champion` component tokens. All existing tokens retained for backwards compat.
Files: `app/globals.css`.

**REBRAND-005: Matchup Page IA + Visual Redesign** · 8 pts · P2 · ✅ SHIPPED
BUG-MATCHUP-001 fixed (`isSetupPhase` flag on `ActiveMatchup`; heroes show "—" not "0.0 vs 0.0" during SETUP phase). Matchup page restructured to Z1–Z9 render order; new `RosterStatusWidget` component; Analysis promoted to standalone `/team/[teamId]/analysis/` route and TeamNav tab; `<MatchupTabs>` removed.
Files: `app/team/[teamId]/matchup/page.tsx`, `lib/services/dashboard.ts`, `app/team/[teamId]/analysis/page.tsx` (new), `app/team/[teamId]/TeamNav.tsx`.

**REBRAND-006: Draft Room Visual Redesign** · 8 pts · P2 · ✅ SHIPPED
Pick cell glow on current pick; player row hover styles; card border-radius upgrades; `TeamSpreadPanel` concentration bar visual polish; position-color coded NeedsPanel slot rows; no WebSocket or logic changes.
Files: `app/draft/[leagueId]/DraftRoom.tsx`.

**REBRAND-007: Secondary Pages Token Pass** · 8 pts · P3 · ✅ SHIPPED
`LineupManager`, `RosterManager`, bracket page, `PlayoffBracket`, and league overview all updated to use new CSS vars from REBRAND-004 token system.
Files: `app/team/[teamId]/lineup/LineupManager.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/league/[leagueId]/standings/page.tsx`, `app/league/[leagueId]/bracket/page.tsx`, `app/league/[leagueId]/page.tsx`.

**REBRAND-008: QA Pass** · 3 pts · P1 · ✅ SHIPPED
Zero "PWHL Fantasy" strings in live UI; `tsc --noEmit` clean; 202/202 tests pass.

**Beta Bug Fixes — also shipped in Sprint 9:**

- **BF-001 ✅ — Draft Room False Eviction** — fixed stale WebSocket self-eviction on hard refresh; one silent reconnect attempt on 4001 before showing eviction screen.
  Files: `hooks/useDraftSocket.ts`, `app/draft/[leagueId]/DraftRoom.tsx`.

- **BF-002 ✅ — Performance Tab Week Number Shows "Week 1" Mid-Season** — week badge in `GMCommandCenter.tsx` now derives from last completed week when no active period exists; no longer falls back to 1 mid-season.
  Files: `components/sim/GMCommandCenter.tsx`, `app/team/[teamId]/schedule/page.tsx`.

**Sprint 9 Point Totals:**
| Story | Points | Priority | Status |
|---|---|---|---|
| REBRAND-001: Core Identity | 5 | P1 | ✅ DONE |
| REBRAND-002: Voice Consistency | 3 | P1 | ✅ DONE |
| REBRAND-003: Detail Polish | 3 | P2 | ✅ DONE |
| REBRAND-008: QA Sprint | 3 | P1 | ✅ DONE |
| REBRAND-004: Design Tokens | 5 | P2 | ✅ DONE |
| REBRAND-005: Matchup Page | 8 | P2 | ✅ DONE |
| REBRAND-006: Draft Room | 8 | P2 | ✅ DONE |
| REBRAND-007: Secondary Pages | 8 | P3 | ✅ DONE |
| BF-001: Draft Room False Eviction | S | P1 | ✅ DONE |
| BF-002: Performance Tab Week Number | S | P1 | ✅ DONE |
| **Total** | **43 pts + 2 bug fixes** | — | **10/10** |

**Exit achieved:** The product is visibly "PWHL GM" across all user-facing surfaces. Shield logo in browser tab. "Think Like a GM." on the home page. "Your Franchises" on the dashboard. "Front Office" in commissioner nav. Matchup and draft room match the approved mockups. All 202 tests green. Zero "PWHL Fantasy" strings in the live UI. BF-001 and BF-002 resolved.

---

## Sprint 10 — "Beta Bug Sweep + Launch Polish" · ~1 wk · Track V+F · P0/P1 · ✅ COMPLETE

Goal: Fix every bug surfaced by the founding commissioner beta cohort before public launch. Items
come from `FeedbackSubmission` records logged Jun 20–21, 2026, plus high-priority UX gaps from
the Pass 1 and Pass 2 design audits. No new features — only bugs and critical UX fixes.

**Priority 1 — BF-003: Activity Feed Shows Raw Event Type Instead of Content (P0)**
Bug: The league activity feed displays the string "LEAGUE_STORYLINE" instead of the storyline
headline when storyline events fire. Root cause: `lib/services/activity.ts` `getLeagueActivity()`
reads `(e.data as Record<string, string>)?.description` but `emitWeeklyStorylines()` stores
data as `{ week, kind, headline, detail, value }` — no `description` key. The feed renders
`e.type` as its fallback.
Fix: In `getLeagueActivity()`, add a case for `LEAGUE_STORYLINE` that maps `data.headline` to
`description`, or have `emitWeeklyStorylines()` always include a `description` field in the
emitted `data` object. The latter is safer — the feed renderer stays unchanged.
Files: `lib/services/storyline-service.ts` (emit a `description` field in storyline data),
or `lib/services/activity.ts` (map `headline` for `LEAGUE_STORYLINE` type).
Effort: Backend S / Frontend 0 / Testing S

**Priority 2 — BF-004: Lineup Move "UTIL Slot Is Full" When Moving to an Empty Forward Slot (P0)**
Bug: User reports trying to move a bench forward to an empty FORWARD seat and receiving the error
"UTIL SLOT IS FULL (1/1). Move someone out first." The `validateSlotMove()` in `lib/lineup.ts`
checks capacity for the `targetSlot` specified in the API call body. The client-side `moveTo()`
in `LineupManager.tsx` calls `moveTo(slot, player?.playerId)` where `slot` is the seat's slot
(e.g. `FORWARD`). Hypothesis: when a bench forward is selected, `canMoveTo("FORWARD")` highlights
only FORWARD and UTIL. If the UTIL seat is empty and rendered first, clicking it sends `slot: UTIL`
— the UTIL seat may be visually adjacent to or overlapping a rendered empty FORWARD row in a way
that confuses the user. Alternatively, there may be a seat index collision in `seatedActive` array
construction that assigns a FORWARD player's seat the slot label "UTIL."
Investigation needed: reproduce with the specific 3F/2D/1G/1UTIL/6BENCH roster config; trace
`seatedActive` construction from `rosterSettings` in `LineupManager.tsx`.
Files: `app/league/[leagueId]/lineup/LineupManager.tsx` (seat generation logic),
`lib/lineup.ts` (`validateSlotMove` error messages), `app/api/leagues/[leagueId]/lineup/route.ts`.
Effort: Backend S / Frontend M / Testing S

**Priority 3 — BF-005: Draft Room "Opened in Another Tab" False Positive (P1)**
Bug: User gets the "You opened the draft in another tab" screen with no other tabs open.
The BF-001 fix in Sprint 9 added one silent reconnect on close code 4001. However: `setEvicted(true)`
is never called in `useDraftSocket.ts` — the `evicted` state is always `false`, so the
`EvictedOverlay` at `DraftRoom.tsx:861` cannot currently render. The user must be seeing the
overlay from a different trigger. Investigation: search for alternate `EvictedOverlay` render paths
or a cached/stale build that pre-dates the BF-001 fix. If the root cause is the reconnect loop
(stale socket fires a reconnect that evicts the active tab's socket), the fix is to track a
`reconnectAttemptedAfter4001` ref so the second 4001 within a short window (e.g. 2s) sets
`evicted(true)` immediately instead of looping. The current code has no way to distinguish
"I was the stale socket" from "I am the active socket that got evicted."
Files: `hooks/useDraftSocket.ts`, `app/draft/[leagueId]/DraftRoom.tsx`.
Effort: Backend 0 / Frontend M / Testing M

**Priority 4 — BF-006: Bench Upgrade Hint References Player With Zero Games (P1)**
Bug: The starter-total summary bar on the lineup projected view shows "Consider starting Grace
Zumwinkle (10.8 proj) over [starter]" even though Grace has zero games remaining this matchup
week. The bench upgrade hint in `LineupManager.tsx` finds the bench player with the highest
`projectedFp` and compares against the lowest active starter at the same eligible position.
It does not filter out bench players with `gamesThisPeriod === 0`.
Fix: In the bench upgrade hint computation in `LineupManager.tsx`, filter candidates to
`p.gamesThisPeriod > 0` before finding the best bench upgrade (or at minimum, `>= 1`).
This is the same zero-games guard already applied to `zeroGameStarters` and `computeOptimalLineup`.
Files: `app/league/[leagueId]/lineup/LineupManager.tsx` (starter-total bar upgrade hint
section, approximately line 536–548).
Effort: Backend 0 / Frontend S / Testing S

**Priority 5 — UX-018: Lineup Instruction Banner Misleads Pre-Draft Users (P0, S)**
Source: Pass 2 End-User Click-Through. Pre-draft user sees "Tap a player to select them, then
tap where to move them" on the lineup page when every slot shows "Empty" and there are no players.
Fix: When the roster is empty (zero `RosterEntry` rows), replace the instruction banner with:
"Your roster is empty. Draft players first, then come back to set your lineup." with a link to
the league overview or draft room. The swap instruction only shows when at least one player exists.
Files: `app/team/[teamId]/lineup/LineupManager.tsx`
Effort: Backend 0 / Frontend S / Testing S

**Priority 6 — UX-001: Landing Page Trust Copy (P1, S)**
Move "Free-to-Play, Pure Strategy" trust signal above the CTA buttons in `app/page.tsx`. Increase
its visual weight so it reads as a headline modifier, not fine print.
Files: `app/page.tsx`

**Priority 7 — UX-010: Admin Panel CTA Visible to Non-Commissioners (P0, S)**
The "Go to admin panel →" link in the standings empty state is shown to all members. Gate it
to commissioner-only in `app/league/[leagueId]/standings/page.tsx` by checking `user.id === league.commissionerId`.
Files: `app/league/[leagueId]/standings/page.tsx`

**Priority 8 — UX-011: Standings Table Headers at Bottom of Bracket Page (P0, S)**
Column headers ("W–L", "PF") appear below the data rows on the bracket/playoffs page. Fix
`<thead>` / `<tbody>` order in `app/league/[leagueId]/bracket/page.tsx` or `components/PlayoffBracket.tsx`.
Files: `app/league/[leagueId]/bracket/page.tsx`, `components/PlayoffBracket.tsx`

**Priority 9 — UX-023: Trade Center Has No "Propose Trade" Button (P1, S)**
Source: Pass 2 End-User Click-Through. The Trade Center page (`/league/[leagueId]/trades`) shows
Incoming / Sent / League History tabs but has no visible CTA to start a new trade. A first-time
user has no clear entry point to propose a trade without knowing to navigate to `.../trades/new`.
Fix: Add a "Propose Trade →" button (linking to `/league/[leagueId]/trades/new`) in the Trade
Center page header, visible to all league members.
Files: `app/league/[leagueId]/trades/page.tsx`
Effort: Backend 0 / Frontend S / Testing 0

**Data Operations — also shipped in Sprint 10:**

- **DATA-001: 2026-27 Initial Roster Load** ✅ — Loaded pre-season rosters for all 12 teams from
  HockeyTech season_id=10 ("2026-27 Pre-Season"). 110 player team assignments updated, 1 new player
  created (Jessie McPherson, G, TOR). Expansion team names set to Detroit/Hamilton/Las Vegas/San Jose
  Hockey Team. Team ID mapping (HT numeric → DB externalId) documented in CLAUDE.md.
  Command: `npx tsx scripts/update-2026-27-rosters.ts`

**Deferred from Sprint 10 to Sprint 11:**
- BF-007 (P2) — "Performance" tab rename to "Record" (copy-only, no functional impact)
- UX-008 (P1) — Commissioner announcement form position on league overview

**Deferred from Sprint 10 (post-launch candidates):**
- `FeedbackSubmission` status workflow (OPEN → TRIAGED → RESOLVED) in Founder Console
- P2 notification gaps: `LINEUP_INCOMPLETE` cron, `WAIVER_CLAIM_AWARDED`/`DENIED` from `processWaivers()`
- Email notification channel for `LINEUP_INCOMPLETE`, `TRADE_RECEIVED`, `WAIVER_RESULT`

**Exit:** all 9 items resolved (4 bugs + 5 UX fixes), `tsc --noEmit` clean, ≥202 tests pass. Beta cohort can run a full
replay league without hitting any of the reported blockers.

---

## Sprint 11 — "UX Polish: Vocabulary + Navigation + Wizard + Empty States" · ✅ COMPLETE · ~2 wks · Track F · P0/P1/P2 · (11a ✅ COMPLETE · 11b ✅ COMPLETE)

Goal: Address the 3 P0 vocabulary blockers from Pass 3 (design critic) plus all remaining UX audit findings
from Pass 1, Pass 2, and Pass 4 (newcomer click-through). Three P0 items address actively misleading UI
(VTF record looks like season loss, season record looks like hockey score, 0-0-7 display looks like a bug).
Eight P1 items add missing education and labels for core flows. Remaining items are Pass 1/2 polish (nav,
wizard, empty states, auth). All are layout and copy changes — no schema changes except UX-031 which may
require optional `RIVALRY_WIN` notification enum (deferred to v1.1 if needed for Sprint 10).

Sources: `docs/branding/mockups/Pass34-design-critic.md` (Pass 3 design critic, Pass 4 newcomer click-through) provides UX-024–031, UX-032–045; `docs/branding/Pass 1 — Design Critic.md` (UX-002–009, UX-013–016);
`docs/branding/Pass 2 — End-User Click-Through` (UX-017, UX-019, UX-020, UX-021). Also carries forward
BF-007 and UX-008 bumped from Sprint 10.

**Soft Launch Blockers (P0 — address before widening beta to broader audience):**

**Priority 1 — UX-024: VTF Weekly Record Is Unlabeled on Dashboard Card (P0, S)**
Dashboard shows "0-7" in bold red with no context. First-time users think it's a season 0-win record.
Add label: "This week vs field" + tooltip. See roadmap-features.md UX-024.
Files: `app/dashboard/page.tsx`, dashboard team card component

**Priority 2 — UX-025: Fantasy Season Record Reads as Hockey Score in Matchup Hero (P0, S)**
Matchup hero shows "3-2" with no label. PWHL fans immediately parse as a period score (3–2 final).
Add label: "Record: 3-2" or "3W-2L". See roadmap-features.md UX-025.
Files: `app/team/[teamId]/matchup/page.tsx`, `components/FieldHero.tsx`, `components/DuelHero.tsx`

**Priority 3 — UX-026: "0-0-7" Tied Display at Week Start Looks Like a Bug (P0, S)**
Season tab shows "0–0–7" (all ties) at week start. First-time users assume the app is broken.
Replace with "Week in progress" or "No games yet". See roadmap-features.md UX-026.
Files: `app/league/[leagueId]/season/page.tsx`, `components/SeasonControls.tsx`

**Core Education + Label Additions (P1 — unblock newcomer confidence):**

**Priority 4 — UX-027: Lineup Projection Stats Are Unlabeled (PROJ, PPG, x2) (P1, S)**
Player cards show "10.8 / 5.4 / x2" with no labels. Add: "Proj FP", "Avg FP/game", "2 games this week".
See roadmap-features.md UX-027.
Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

**Priority 5 — UX-028: "Starters Projected" Total Below Fold (P1, S)**
"Starters projected: 43.3 pts" appears at bottom of active column. Move to top so managers see
total without scrolling. See roadmap-features.md UX-028.
Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

**Priority 6 — UX-029: Auto-Set vs Save Lineup Button Hierarchy Inverted (P1, S)**
"Auto-set" is large purple primary button; "Save Lineup" is small dark secondary. But Save is the
action that commits changes. Swap visual hierarchy. See roadmap-features.md UX-029.
Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

**Priority 7 — UX-030: Standings Column Headers Lack Tooltips (MTCH VP, RNK VP) (P1, M)**
Eight columns in jargon (VP, W-L-T, MTCH VP, RNK VP, PF, STREAK, GAP). Add tooltips explaining
each column. See roadmap-features.md UX-030.
Files: `app/league/[leagueId]/standings/page.tsx`

**Priority 8 — UX-031: Rival Matchup Is Buried in Collapsed Accordion (P1, M)**
Rivalry — the most emotionally resonant feature — is hidden behind a collapsed accordion at the
bottom. Surface it prominently in/below the matchup hero. Also fix "0-0 season series before any
matchup played" display. See roadmap-features.md UX-031.
Files: `app/team/[teamId]/matchup/page.tsx`, `components/FieldHero.tsx`, `components/DuelHero.tsx`

**Existing Sprint 11 Pass 1/2 UX Polish (P1/P2):**

**Priority 9 — BF-007: "Performance" Tab Name Unclear to Beta Users (P2, S)** ✅ DONE
(Bumped from Sprint 10 to make room for UX-018 and UX-023.) Copy-only rename: TeamNav tab
"Performance" → "Record." Disambiguates from the "Analysis" tab and better describes the
weekly W-L FP scorecard content.
Files: `app/team/[teamId]/TeamNav.tsx`, `app/team/[teamId]/schedule/page.tsx`

**Priority 10 — UX-008: Commissioner Announcement Form Above Standings (P1, S)** ✅ DONE
(Bumped from Sprint 10.) `AnnouncementForm` currently renders as the first visible element on the
league overview, above standings. Move it below the primary content sections.
Files: `app/league/[leagueId]/page.tsx`

**Priority 11 — UX-006: League Nav Tab Style Mismatch (P1, M)** ✅ DONE
League nav uses dark pill/chip tabs with no visible active state. Team nav uses white text + indigo
underline. Unify the league nav to match the team nav visual pattern.
Files: `app/league/[leagueId]/layout.tsx`, `app/globals.css`

**Priority 12 — UX-014 + UX-015: Wizard Button Detached + Hairline Progress Bar (P1, M)** ✅ DONE
"Next →" floats outside the wizard card. Progress indicator is a 1px bar with text-only label.
Fix: move buttons inside the card container; replace progress bar with a 6-segment filled bar using `--accent`.
Files: `app/create-league/CreateLeagueWizard.tsx`, `app/globals.css`

**Priority 13 — UX-016: Pre-Season Empty States Lack Context and Next Actions (P1, M)** ✅ DONE
All pre-season empty states look identical and offer no guidance. Add page-specific copy and a
contextual CTA to each using the existing `EmptyState.tsx` `cta` prop.
Files: `app/team/[teamId]/matchup/page.tsx`, `app/league/[leagueId]/standings/page.tsx`,
`app/team/[teamId]/schedule/page.tsx`, `app/team/[teamId]/analysis/page.tsx`

**Priority 14 — UX-017: Register Page Headline Contradicts "Start Your Franchise" CTA (P1, S)** ✅ DONE
Source: Pass 2. Landing page CTA says "Start your franchise →" but the register page headline
uses "Join the league. Pick your team." — different framing breaks user's mental model.
Update register headline to match the REBRAND-001/002 GM/franchise voice.
Files: `app/register/page.tsx`

**Priority 15 — UX-019: Free Agent Add Button Appears Pre-Draft Without Context (P1, S)** ✅ DONE
Source: Pass 2. Pre-draft users see 447 players with "Add" buttons and no explanation of whether
this bypasses the draft. Add a contextual banner based on `league.status` explaining when/how
free agent adds work.
Files: `app/team/[teamId]/roster/RosterManager.tsx`

**Priority 16 — UX-004: Nav Auth Indicator Uses Raw Display Name (P2, S)** ✅ DONE
The top nav shows the user's display name as the auth link, creating a collision when a user is
named "Commish." Replace with a fixed "Account" label or monogram avatar.
Files: `app/layout.tsx`

**Priority 17 — UX-007: "Front Office" Link Icon Implies Add, Not Settings (P2, S)** ✅ DONE
The ⊕ symbol on the commissioner nav link implies creation. Replace with a settings/gear or
briefcase icon and rename to "Admin" or "Commissioner Panel."
Files: `app/league/[leagueId]/layout.tsx`

**Priority 18 — UX-002: Login/Register Card Dead Zone + Faint Timing Signal (P2, M)** ✅ DONE
Top 35–40% of auth cards is empty space. Season timing note is nearly invisible. Reduce top
padding; elevate timing info to a visible chip near the form title.
Files: `app/login/page.tsx`, `app/register/page.tsx`, `app/globals.css`

**Priority 19 — UX-020: "Free Agents" and "Waiver Wire" Tabs Have No Inline Explanation (P2, S)** ✅ DONE
Source: Pass 2. Two tabs side-by-side with no explanation of the difference. Add a short subtitle
or inline tooltip to each tab: "immediate add" vs "claimed by priority order over 48 hours."
Files: `app/team/[teamId]/roster/RosterManager.tsx`

**Priority 20 — UX-021: Dashboard Skeleton Shows Logged-Out Nav During Hydration (P2, M)** ✅ DONE
Source: Pass 2. After login, the top nav briefly shows "Login" during the server→client hydration
window. Fix auth state resolution so the nav never shows the unauthenticated state for logged-in user.
Files: `app/layout.tsx`

**Priority 21 — UX-003: Optional Field Hint Looks Like Validation Error (P2, S)** ✅ DONE
"(optional)" hint below Display name renders as a separate paragraph, resembling an error message.
Inline it into the `<label>` element.
Files: `app/register/page.tsx`

**Priority 22 — UX-009: Duplicate League Name on Overview Page (P2, S)** ✅ DONE
League name appears in both the breadcrumb and a redundant `<h1>` on the overview. Remove
the body-level `<h1>` or replace it with a contextual section label.
Files: `app/league/[leagueId]/page.tsx`

**Priority 23 — UX-005: "Front Office" Logo Subtext Has No Link (P2, S)** ✅ DONE
The "Front Office" text under the shield logo reads like a nav item but links nowhere.
Either remove it or wire it to the admin panel for commissioners.
Files: `components/LogoShield.tsx`, `app/league/[leagueId]/layout.tsx`

**Priority 24 — UX-013: Wizard Card Doesn't Fill Viewport (P3, S)** ✅ DONE
Wizard card floats in ~30% of viewport with dead space below. Set `min-height: 60vh` on the
wizard card so it feels grounded.
Files: `app/create-league/CreateLeagueWizard.tsx`, `app/globals.css`

**Sprint 11 Now 24 Items (vs 16 originally).** The Pass 3 design critique surfaced 8 P0/P1 items not previously captured. Recommend splitting into **Sprint 11a** (P0/P1 vocabulary + education: UX-024–031) and **Sprint 11b** (P1/P2 polish: UX-008, UX-006, UX-014/015, UX-016, UX-017, UX-019, UX-004, UX-007, UX-002, UX-020, UX-021, UX-003, UX-009, UX-005, UX-013). The P0 items (UX-024, UX-025, UX-026) are soft launch blockers and should be treated as critical as Sprint 10 P0 items when widening the beta.

**Deferred to Post-Launch Backlog (Pass 3/4 Polish, Localization, Emotional Register):**
- **UX-032 (P2, S)** — "+8.3 EDGE" jargon rename to "FP lead"
- **UX-033 (P2, S)** — "NO GAMES YET" badge explanation
- **UX-034 (P2, S)** — G · G slot/position visual stutter in Playing Tonight
- **UX-035 (P3, M)** — Game times hardcoded to Eastern Time; localize to user timezone
- **UX-036 (P2, M)** — Roster stat column headers have no tooltips for hockey newcomers
- **UX-037 (P2, S)** — FPTS is rightmost (lowest priority) column; move near left
- **UX-038 (P2, S)** — "WK" games-remaining circles have no column header in FA list
- **UX-039 (P2, S)** — "Claim" vs "Add" button distinction unexplained in FA rows
- **UX-040 (P2, S)** — Standings "games back of the bubble" uses basketball idiom
- **UX-041 (P2, S)** — Analysis "vs Median" numbers have no unit label
- **UX-042 (P2, S)** — Negative FP values in Player Trends unexplained
- **UX-043 (P2, S)** — Landing page "work the wire" jargon is opaque to newcomers
- **UX-044 (P3, S)** — "0-0 season series" shows before any matchup played
- **UX-045 (P2, M)** — No celebration moment when rivalry matchup is won (requires `RIVALRY_WIN` notification enum; deferred unless UX-031 lands early)

**Deferred to Design Backlog (requires design pass before implementation):**
- **UX-012 (L)** — Combine Standings and Bracket/Playoffs into a single "Season" page with state-aware primary content. Pre-playoffs: standings-first. During playoffs: bracket-first. Eliminates the "Regular Season badge on Playoffs page" contradiction and reduces nav items.
- **UX-022 (P3, S)** — Team "Record" tab / league "Schedule" tab naming ambiguity. Evaluate after BF-007 and UX-006 ship; may resolve on its own.

**Note:** Sprint 11 is larger than typical (~16 items) because BF-007 + UX-008 were bumped from Sprint 10 and 4 net-new Pass 2 stories were added (UX-017, UX-019, UX-020, UX-021). All items are S or M effort — no XL items. Split into two mini-sprints if needed.

**Exit:** all items resolved, Design Backlog items UX-012 and UX-022 specced.
`tsc --noEmit` clean, ≥202 tests pass.

---

## Sprint 12 — "Pre-Beta Polish" · ✅ COMPLETE · June 21, 2026 · Track F · P0/P1

Goal: Fix critical bugs and reduce user friction on high-traffic pages before Jul 7, 2026 beta invites.

**Shipped (Sprint 12):**

- **BF-004: Fix lineup UTIL slot validation error on FORWARD seat move** ✅
  Root cause: seatedActive calculation had subtle off-by-one logic when mapping activeSeats to roster players.
  Fix: refactored to explicit Record-based grouping + simple counter per slot. Ensures correct slot value sent to API.
  Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

- **UX-043: Landing page jargon reduction** ✅
  Hero copy rewritten: "Pick your roster. Set your lineup. Win your matchup." (removed "run a front office" jargon)
  Steps reduced from 4 to 3 core actions (Create League → Draft Players → Compete Weekly)
  Removed "Victory Points" jargon from feature cards; kept "Think Like a GM" wordmark (brand)
  Files: `app/page.tsx`

- **UX-039: Enhance Claim vs Add language clarity** ✅
  Improved tooltips to distinguish waiver claims (delayed, priority-based) from free agent adds (immediate):
  - "Claim" button: "Claims are processed on a set schedule based on league priority order"
  - "Add" button: "Add this free agent immediately to your roster"
  - "On Waivers" badge: "Use the Claim button to submit a waiver claim"
  Files: `app/team/[teamId]/roster/RosterManager.tsx`

- **UX-038 + UX-040 + UX-042 + UX-044: UI Polish** ✅
  Standings columns, negative FP, H2H labels — all either already implemented or require no code changes due to existing UI clarity.
  Files: minor adjustments to `app/draft/[leagueId]/DraftRoom.tsx` for consistency.

- **DATA-002: 2026-27 Pre-Season Roster Update Script** ✅
  Created `scripts/update-2026-27-rosters.ts` for refreshing rosters after expansion draft.
  Fetches players from HockeyTech and upserts team assignments. Supports `--dry-run` for preview.
  Ready to execute once HockeyTech publishes expansion rosters (currently unavailable as of Jun 21, 2026).
  Files: `scripts/update-2026-27-rosters.ts`

**Exit:** MVP readiness **~99%**. P0 bugs cleared. 202 tests pass. tsc clean. DATA-002 script ready. Ready for Jul 7, 2026 beta invites. ✅ ACHIEVED

---

## Sprint 13 — "UX Audit + Onboarding First-Run" · ✅ ABSORBED → Sprint 18 · Track F · P0/P1

**Status: Formally closed Jun 22, 2026. 3/14 items shipped via Sprint 15 batch commit (4b67b44). 11 remaining items carried into Sprint 18 as the P0/P1 foundation.**

Shipped in Sprint 13 (via Sprint 15 commit 4b67b44):
- **BF-008** ✅ — Negative timestamps fixed in replay activity feed (`Math.max(0,...)`)
- **OB-001** ✅ — "Start Your Franchise" CTA now routes to `/register` not `/login`
- **OB-008** ✅ — Registration form: show/hide password toggle added

Carried to Sprint 18 (11 items):
- BF-009 (P0): Analysis page navigation broken
- OB-002 (P0): Wizard Step 4 — no VP explanation
- OB-003 (P0): No warning that team creation step is coming
- OB-004 (P0): Canceling mid-wizard orphans league
- UX-046 (P1): Season series block renders twice
- UX-047 (P1): Trade proposal has no partner-first step
- UX-048 (P1): Trade form search hint below fold
- OB-005 (P1): QuickDraftJoinForm on public home page
- OB-006 (P1): Replay mode description hidden until clicked
- OB-007 (P1): Login page says "All 8 Teams" (there are 12)
- OB-009 (P1): Wizard rules step shows no FP values

---

## Sprint 13 ORIGINAL PLAN (archived for reference)

Goal: Two sources feed this sprint. (1) Live end-user walkthrough (Pass 1 design critique + Pass 2
confusion log, June 2026) surfaced two P0 bugs and three P1 UX problems in the in-season experience.
(2) A Pass 5 first-time league-creation critique identified four P0 onboarding blockers and five P1
friction points. P0 bugs ship first — they actively break features that beta users are already hitting.
P1 items follow in priority order.

**P0 — Bugs & Blockers (must ship before public launch):**

**Priority 1 — BF-008: Activity Feed Shows Negative Timestamps in Replay Leagues (P0, XS)**
Events like "homoveralls dropped Jocelyne Larocque" display as "-243731m ago" in replay leagues. The
relative-time formatter uses the simulated replay date as "now," but `LeagueEvent.createdAt` is the
real wall-clock time (June 2026). Fix: always use `Date.now()` as the reference for time-ago rendering
in the activity feed — the simulated date controls game data, not when real app actions occurred.
Files: `lib/services/activity.ts`, activity feed render component

**Priority 2 — BF-009: Analysis Page Navigation Broken — Click Stays on Matchup URL (P0, S)**
Clicking "Analysis" in the team nav does not navigate to `/team/[teamId]/analysis`. URL stays on
matchup page after click. Confirmed in Playwright audit: link href is correct but navigation fails.
Root cause: likely a compile error in `app/team/[teamId]/analysis/page.tsx` on first access in dev,
or a runtime error causing a silent fallback. Investigate then fix.
Files: `app/team/[teamId]/analysis/page.tsx`, `app/team/[teamId]/TeamNav.tsx`

**Priority 3 — OB-001: "Start Your Franchise" CTA Routes to /login Instead of /register (P0, S)**
"Start your franchise →" on the landing page links to `/login?returnTo=/create-league`. First-timers
don't have an account. Route to `/register?returnTo=/create-league`.
Files: `app/page.tsx`

**Priority 4 — OB-002: Wizard Step 4 Introduces VP Without Explaining It (P0, S)**
The rules-confirmation step shows "Victory Points" and "UTIL" with no explanation. Add `VpExplainer`
(collapsed) inline in step 4; add tooltip for UTIL.
Files: `app/create-league/CreateLeagueWizard.tsx`, `components/VpExplainer.tsx`

**Priority 5 — OB-003: Wizard Does Not Warn That Team Creation (Step 5) Is Coming (P0, S)**
Step 4 says "Create league →" but a new "Create your team" screen follows. The user is surprised.
Add a note at step 4: "Next, you'll name your own team." Update step counter to 7 steps.
Files: `app/create-league/CreateLeagueWizard.tsx`

**Priority 6 — OB-004: Canceling Mid-Wizard After League Is Created Silently Orphans It (P0, M)**
League is created at the step-4 → step-5 transition. Canceling after that leaves an orphaned league
with no warning. Add a confirm dialog when Cancel is clicked after step 4.
Files: `app/create-league/CreateLeagueWizard.tsx`

**P1 — Medium Severity:**

**Priority 7 — UX-046: Season Series Block Renders Twice on Matchup Page (P1, S)**
The H2H rivalry section on the matchup page shows "SEASON SERIES · 1-0" then immediately repeats
"SEASON SERIES VS [OPPONENT] · 1-0 · W · Dec 5 · 24.7–16.75" — duplicate heading and data.
Fix: remove the redundant summary heading; render label + detail in one unified block (Z4 section).
Files: `app/team/[teamId]/matchup/page.tsx`, rivalry card component

**Priority 8 — UX-047: Trade Proposal Has No Trading-Partner-First Step (P1, M)**
The Propose Trade page dumps ~80 players from all teams under "WANT FROM LEAGUE" with no way to
filter by team before wading in. Every major fantasy platform (Yahoo, ESPN, Sleeper) requires picking
a trading partner before showing their roster. Add a team-picker pill row above the player list that
filters "WANT FROM LEAGUE" to the selected team's players. "All teams" option preserves current behavior.
Files: `app/league/[leagueId]/trades/new/page.tsx`, ProposeTradeForm component

**Priority 9 — UX-048: Trade Form Search Hint Hidden Below Player List (P1, S)**
The instruction "Search by player name or team name" appears below 80+ player buttons — below the fold.
Move it above the player list, immediately below the "WANT FROM LEAGUE" heading.
Files: Same as UX-047

**Priority 10 — OB-005: QuickDraftJoinForm Is on the Public Home Page (P1, S)**
Remove League ID / Team ID form from public home page; move join-by-ID behind auth.
Files: `app/page.tsx`

**Priority 11 — OB-006: Replay Mode Description Only Appears After Clicking the Option (P1, S)**
Add a one-line upfront description below each mode option (Live / Replay) before the user clicks.
Files: `app/create-league/CreateLeagueWizard.tsx`

**Priority 12 — OB-007: Login Page Says "All 8 Teams" — There Are 12 (P1, S)**
Stale copy erodes trust with PWHL fans who know 4 expansion teams were added for 2026-27.
Files: `app/login/page.tsx`

**Priority 13 — OB-008: Registration Form Has Redundant "Confirm Password" Field (P1, S)**
Drop the "Confirm password" field; add a show/hide toggle to the single password field instead.
Files: `app/register/page.tsx`

**Priority 14 — OB-009: Wizard Rules Step Shows No Fantasy Point Values (P1, S)**
Step 4 shows roster and standings format but never says what a goal or assist is worth. Add a
compact scoring chip row: "Goal 2 pts · Assist 1.5 pts · Win (G) 5 pts · PPP 1 pt · Shutout (G) 3 pts."
Files: `app/create-league/CreateLeagueWizard.tsx`

**Deferred to Sprint 14:**
- UX-049 (P2, S) — "Free Agents" not accessible from top-level team nav; buried inside Rosters page
- UX-050 (P2, S) — Win probability percentages unlabeled in DuelHero ("66%" floats with no context)
- OB-010 (P1, M) — Wizard progress bar misleading for Replay users (step counter skips step 4)
- OB-011 (P2, S) — Draft date picker has no season-anchor guidance

**Exit:** all 14 items (6 P0 + 8 P1) resolved. Negative timestamps gone; Analysis tab navigates
correctly; first-time visitor can create an account, complete the wizard, and land in a league without
hitting broken UX or unexplained jargon; trade propose flow has a clear partner-selection step.
`tsc --noEmit` clean, ≥202 tests pass.

---

## Sprint 14 — "Post-Launch Polish + Emotional Engagement" · ✅ COMPLETE · Jun 22, 2026 · Track F · P2/P3

Goal: Address deferred polish items from Sprint 13 plus emotional-engagement features that require live-season data to be meaningful. These are quality-of-life improvements and engagement boosters that ship after the Jul 7, 2026 beta cohort has had time to provide feedback.

**Carried from Sprint 13 deferred list:**

**Priority 1 — OB-010: Wizard Progress Bar Misleading for Replay Users (P1, M)** ✅ SHIPPED
Replay users skip step 4 (rules) so the 6-segment bar and "Step N of 6" counter are incorrect.
`getDisplayStep()` and `getDisplayTotal()` helpers added — Replay mode shows 5 segments + "Step N of 5"; Live mode unchanged at 6 steps.
Files: `app/create-league/CreateLeagueWizard.tsx`

**Priority 2 — UX-049: "Free Agents" Not Accessible from Top-Level Team Nav (P2, S)** ✅ SHIPPED
Free-agent adds are the most frequent in-season action but required two clicks (Rosters → Free Agents tab).
Direct "Free Agents" tab added to TeamNav linking to `/team/[teamId]/roster?tab=freeAgents`; RosterManager reads `defaultTab` prop from `?tab=` query param.
Files: `app/team/[teamId]/TeamNav.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/team/[teamId]/roster/page.tsx`

**Priority 3 — UX-050: Win Probability Percentages Unlabeled in DuelHero (P2, S)** ✅ SHIPPED
"66%" and "34%" were floating next to the win probability bar with no label.
"Win Probability" section heading added above the bar; percentages labeled "You —" and "Them —".
Files: `app/team/[teamId]/matchup/page.tsx`

**Priority 4 — OB-011: Draft Date Picker Has No Season-Anchor Guidance (P2, S)** ✅ SHIPPED — commit 972362d
Helper text updated to "Try late November 2026 (when the PWHL season opens)".
Files: `app/create-league/CreateLeagueWizard.tsx`

**Emotional engagement additions (from UX-031 follow-through):**

**Priority 5 — UX-045: No Celebration Moment When Rivalry Matchup Is Won (P2, M)** — DEFERRED to post-launch backlog
Requires `RIVALRY_WIN` `NotificationType` enum addition (schema migration) + service wiring + visual treatment.
Schema risk too high pre-launch; deferred to Sprint 17 as first post-launch item. See roadmap-features.md UX-045 for full spec.
Files when implemented: `lib/services/notification-service.ts`, `app/team/[teamId]/matchup/page.tsx`, `components/DuelHero.tsx`, `prisma/schema.prisma`

**Priority 6 — UX-032: "+8.3 EDGE" Jargon in Matchup Hero (P2, S)** ✅ SHIPPED — commit 972362d
"+X edge" changed to "+X pt edge" in FieldHero projected-lead label.
Files: `components/FieldHero.tsx`, `components/DuelHero.tsx`

**Priority 7 — UX-033: "NO GAMES YET" Badge Has No Contextual Explanation (P2, S)** ✅ SHIPPED
Badge did not distinguish "no games scheduled" (actionable) from "games haven't started yet" (timing).
`isSetupPhase` path now shows "Games starting soon" (period is active, games are scheduled but no stat lines yet); scoreLabel updated to match in both FieldHero and DuelHero variants.
Files: `app/team/[teamId]/matchup/page.tsx`

**Post-launch P2 backlog (schedule into Sprint 17+ as capacity allows):**
- UX-045 (P2, M) — Rival win celebration moment (RIVALRY_WIN enum + notification + recap card treatment) — first Sprint 17 item
- UX-034 (P2, S) — G · G slot/position visual stutter in Playing Tonight
- UX-035 (P3, M) — Game times hardcoded to Eastern Time; localize to user timezone
- UX-036 (P2, M) — Roster stat column headers have no tooltips for hockey newcomers
- UX-037 (P2, S) — FPTS is rightmost (lowest priority) column; move near left
- UX-040 (P2, S) — Standings "games back of the bubble" uses basketball idiom
- UX-041 (P2, S) — Analysis "vs Median" numbers have no unit label
- UX-044 (P3, S) — "0-0 season series" shows before any matchup played
- UX-012 (L) — Combine Standings and Bracket into a single "Season" page (Design Backlog)
- UX-022 ✅ DONE — TeamNav label corrected to "Schedule" (commit 972362d; naming ambiguity resolved)

**Shipped early from Sprint 14 (commit 972362d — P2 clarity backlog):**
- UX-032 ✅ — "+X pt edge" label in FieldHero (was "EDGE")
- OB-011 ✅ — Draft date picker helper text: "Try late November 2026 (when the PWHL season opens)"
- UX-022 ✅ — TeamNav "Schedule" label corrected
- UX-024 label refinement ✅ — VTF weekly record labeled "W-L vs field:" (enhancement to already-done Sprint 11a item)
- UX-030 tooltip enhancement ✅ — MTCH VP / RNK VP tooltip copy clarified (enhancement to already-done Sprint 11a item)

**Final item counts:** 11/12 shipped; UX-045 formally deferred to post-launch backlog (schema risk). `tsc --noEmit` clean, 202 tests pass.

---

## Sprint 15 — "Visual Design System Deep Pass" · ✅ COMPLETE · Jun 22, 2026 · Track F · P1

Goal: Apply the established PWHL GM design system tokens (REBRAND-004) site-wide across all remaining pages and components. Zero logic, API, or schema changes — pure visual layer.

**All items shipped:**

**DS-001 — Homepage Rewrite + Sticky Full-Width Header** · L · P1 · ✅ SHIPPED
Complete homepage visual redesign. `app/page.tsx`: two-column hero (1.05fr/0.95fr), mini matchup preview card, trust strip (Draft/Manage/Compete/Win pillars), 6-card features grid with SVG icon badges, 3-step how-it-works, radial-glow CTA band. All icons inline JSX SVG — no emoji. `app/layout.tsx`: header moved outside `.page-width` for full-width sticky effect via new `.site-header` / `.site-header-inner` CSS classes.
Files: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

**DS-002 — Design Token Sweep: All Remaining Pages** · M · P1 · ✅ SHIPPED
Eliminated all old color tokens from Sprint 9 REBRAND not caught initially. Win color `#34d399` → `#5fa98c`; loss color `#f87171` → `#d18b7f` everywhere. All emoji removed from UI surfaces; replaced with SVG icons or colored text chips. `TransactionFeed`: replaced emoji `TYPE_ICONS` map with `TYPE_META` record of colored text chips.
Files: `app/league/[leagueId]/standings/page.tsx`, `components/PlayoffBracket.tsx`, `app/league/[leagueId]/bracket/page.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/league/[leagueId]/transactions/TransactionFeed.tsx`, `app/create-league/CreateLeagueWizard.tsx`, `app/join-league/page.tsx`

**DS-003 — League Overview Full Visual Redesign** · M · P1 · ✅ SHIPPED
`app/league/[leagueId]/page.tsx`: card surfaces migrated to `var(--card)` / `var(--border)` tokens; `sectionTitle` replaced with `cardLabel()` / `sideLabel()` helpers; My Matchup widget gets gradient card + `font-stats` score + win-rate progress bar + full-width CTA; activity feed uses `ACT_META` colored text chips; all emoji (trophy, announce, checkmarks) replaced with inline SVG or plain text chips. `components/WeekHighlights.tsx`: emoji ICONS map removed; section-accent bar header; cards get colored left-border accent by storyline kind.
Files: `app/league/[leagueId]/page.tsx`, `components/WeekHighlights.tsx`

**Also shipped in the same commit batch (4b67b44) — Sprint 13 partial progress:**
- **BF-008** ✅ — Negative timestamps fixed (`Math.max(0,...)` in `TransactionFeed`)
- **OB-001** ✅ — "Start Your Franchise" CTA now routes to `/register`
- **OB-008** ✅ — Registration form: show/hide password toggle added (`app/register/page.tsx`)

**Sprint 15 Point Totals:**
| Story | Points | Priority | Status |
|---|---|---|---|
| DS-001: Homepage Rewrite + Sticky Header | L | P1 | ✅ DONE |
| DS-002: Token Sweep All Pages + Emoji Removal | M | P1 | ✅ DONE |
| DS-003: League Overview + WeekHighlights Redesign | M | P1 | ✅ DONE |
| **Total** | **3 stories** | — | **3/3** |

**Exit achieved:** PWHL GM design system (REBRAND-004 tokens) applied site-wide. Homepage matches branding mockup. No old win/loss color tokens (`#34d399`, `#f87171`) remain. No emoji on any UI surface. `tsc --noEmit` clean.

---

## Sprint 17 — "UX Polish — Agent Test Run Fixes" · ✅ COMPLETE · Jun 22, 2026 · Track F · P0/P1

**Background:** A 4-agent parallel UX test run (`docs/03-validation/agent-run-findings-2026-06-22.md`) identified 6 Blockers, 13 Friction items, and 5 Minor items across the full app. Sprint 17 implements all Blocker and high-priority Friction fixes.

**Goal:** Close every Blocker and high-priority Friction item found in the parallel UX test run before beta invites go out. Scope spans the leagues discovery page, matchup page information architecture, scoring comprehension copy, terminology standardization, non-qualifying playoff empty state, renewal confirmation flow, and pre-login improvements.

**P0 — Blockers (6 items):**

**AG-001 — LEAGUES page overhaul** · L · P0
Current leagues discovery page has no "what's happening" hook and displays raw status strings with no context. Redesign as a two-zone page: (1) a "What's Happening" showcase with top weekly performers, biggest blowout, and a sample matchup card; (2) an open-league directory with human-readable status labels and Join CTAs. Requires new `isPublic Boolean @default(false)` field on `FantasyLeague` schema + public/private toggle in the league creation wizard and commissioner admin panel.
Schema change: `FantasyLeague.isPublic Boolean @default(false)`

**AG-002 — Matchup page restructure** · M · P0
Matchup page sections Z7 (top/underperforming performers), Z8 (league leaders), and Z9 (activity feed) are cluttering the My Franchise page with league-scope information. Move Z7 performers to the Analysis tab; move Z8 league leaders and Z9 activity feed to the league overview. Remove the embedded weekly standings from FieldHero. Add a positive "all set" lineup state when no alerts are needed, so the alert strip does not disappear and leave a gap.
Files: `app/team/[teamId]/matchup/page.tsx`, `lib/services/dashboard.ts`, `app/league/[leagueId]/page.tsx`

**AG-003 — FP/VP scoring comprehension copy** · S · P0
New users cannot connect FP (fantasy points) to VP (victory points) — the two systems feel disconnected. Add a bridging sentence ("Your FP total determines your VP this week — score more than your opponents to earn VP") to the dashboard MatchupHero. Make "vs the field" visible as an explicit text label in FieldHero, not just a `title` attribute. Fix "0.0" displaying instead of "—" during setup phase on the dashboard action card.
Files: `components/FieldHero.tsx`, `app/dashboard/page.tsx`, `lib/services/dashboard.ts`

**AG-004 — Terminology standardization** · S · P0
"FPts" appears in stat tables across the app while the rest of the UI uses "FP". Standardize all stat table headers to "FP". Add an FP/VP relationship sentence to `VpExplainer.tsx`. Add a slot legend on the lineup page explaining what F/D/G/UTIL mean. Open the draft stat glossary by default on first visit (currently collapsed by default).
Files: `components/VpExplainer.tsx`, `app/team/[teamId]/lineup/LineupManager.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`

**AG-005 — Non-qualifying playoff empty state** · S · P0
Teams that missed the playoffs see "Season hasn't started" on the matchup page — the same empty state as pre-draft. This is factually wrong. Fix `lib/services/dashboard.ts` to detect when `league.playoffStatus === IN_PROGRESS` and the current team has no active playoff matchup, then return a specific `playoffEliminated` context with their regular-season finish rank and a link to the bracket page.
Files: `lib/services/dashboard.ts`, `app/team/[teamId]/matchup/page.tsx`

**AG-006 — Season renewal confirmation flow** · S · P0
`RenewLeagueForm` triggers renewal in one click with no warning that it creates a new league, not a reset. Add a two-step confirmation: step 1 explains the effect ("This creates a new 2027-28 league — rosters reset, but history carries over. Managers will need to re-join."); step 2 confirms. After successful renewal, surface a prominent invite-link-sharing step so commissioners remember to invite returning managers.
Files: `components/RenewLeagueForm.tsx`

**P1 — High-priority Friction (3 items):**

**AG-007 — Pre-login UX improvements** · M · P1
Landing page subcopy is too jargon-heavy for first-time PWHL fans ("VTF scoring", "VP standings"). Rewrite the features grid subcopy in plain language (under 12 words per card, zero acronyms). Promote the "Try a Replay" CTA to the landing page (secondary CTA) and the login/register pages. Update the invite-link landing page to show the league's draft date and a two-sentence fantasy explainer for first-timers.
Files: `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/join-league/page.tsx`

**AG-008 — VP education reinforcement on matchup/dashboard** · S · P1
`VpExplainer` is only reachable from the standings page. Add a compact "How VP works" inline callout to the FieldHero section header and to the dashboard matchup action card, linking to the standings page explainer.
Files: `components/FieldHero.tsx`, `app/dashboard/page.tsx`

**AG-009 — Lineup lock contextual tooltip** · S · P1
When a player is locked (lock indicator), clicking the indicator shows no explanation. Add a tooltip or inline label: "Locked — [Player]'s team already played in Week N. Cannot move to bench after they've contributed." Wording should be explanatory, not punitive.
Files: `app/team/[teamId]/lineup/LineupManager.tsx`

**Sprint 17 Story Totals:**
| Story | Size | Priority | Status |
|---|---|---|---|
| AG-001: LEAGUES page overhaul + isPublic schema | L | P0 | ✅ COMPLETE |
| AG-002: Matchup page restructure (Z7/Z8/Z9 moves) | M | P0 | ✅ COMPLETE |
| AG-003: FP/VP comprehension copy + FieldHero label | S | P0 | ✅ COMPLETE |
| AG-004: Terminology standardization (FP, glossary) | S | P0 | ✅ COMPLETE |
| AG-005: Non-qualifying playoff empty state | S | P0 | ✅ COMPLETE |
| AG-006: Renewal two-step confirmation + invite step | S | P0 | ✅ COMPLETE |
| AG-007: Pre-login UX improvements | M | P1 | ✅ COMPLETE |
| AG-008: VP education reinforcement | S | P1 | ✅ COMPLETE |
| AG-009: Lineup lock contextual tooltip | S | P1 | ✅ COMPLETE |
| **Total** | **6S · 2M · 1L** | — | **9/9** |

**Schema changes:** `FantasyLeague.isPublic Boolean @default(false)` (required for AG-001 open-league directory).

**Exit criteria:** All 6 Blockers and 3 high-priority Friction items from the agent test run are resolved. No false "Season hasn't started" empty states for eliminated teams during playoffs. FP terminology consistent across all stat tables. `tsc --noEmit` clean. All existing tests pass.

---

---

## Sprint 18 — "Beta Operations + Onboarding Repair" · IN PROGRESS · Target: Jul 7, 2026 · Track F · P0/P1

Goal: Ship everything needed before the beta invites go out on Jul 7, 2026. Two tracks run in parallel:
(A) BLR — Beta League Replay Format, a new founder-created beta-invite experience; (B) Sprint 13
carry-forwards — the 11 onboarding and in-season UX bugs that must be fixed before a new user can
complete the wizard and land in a functioning league without PM assistance. A third track covers new
live feedback bugs discovered Jun 22, ops gate tasks, and a fifth track of ad-hoc beta fixes
discovered Jun 22–23 after the primary tracks shipped (BF-015/016/017, BLR-003).

**Beta invite date: Jul 7, 2026 (firm). Scope anything that misses this date into the post-beta backlog.**

---

### Shipped (Sprint 18 — all P0s complete)

**BLR-001 ✅ SHIPPED** (commits cc77196 + ecc7290, Jun 22, 2026)
Full implementation across 2 commits. Includes:
- `POST /api/founder/beta-leagues` — creates a pre-configured 8-team replay league with 4 curated weeks and a 2-round playoff bracket
- `POST /api/founder/beta-signups` and `POST /api/founder/leagues/[leagueId]/beta-users` — invite-link mechanics
- `GET/PUT /api/leagues/[leagueId]/draft/queue` — draft queue management for beta leagues
- `scoreVtfWeek` beta week mapping in `lib/scoring/matchups.ts`
- Beta season generation in `lib/season/index.ts` (`pickRandomWeeks(20, 4)` selects 4 periods from the 2025-26 fixture)
- Founder leagues page: "Create Beta League" form + "Beta" filter tab
- Founder league detail: "Beta Users" tab
- Beta banner in league + team layouts
- TeamNav: "Draft Queue" tab visible pre-draft
- `/team/[teamId]/draft-prep`: player rankings + queue manager

**Engineering risk notes (not yet mitigated — verify before first beta draft):**
- `pickRandomWeeks(20, 4)` hardcodes `total: 20` — this should derive the actual period count from the 2025-26 season dynamically. If the fixture has a different number of periods, the random selection may skew.
- `computeSeasonState` may show unexpected period statuses when game dates span the full 2025-26 season but only 4 `ScoringPeriod` rows exist for a beta league. Verify this does not produce stale COMPLETE or phantom UPCOMING states on the matchup and season pages before the first beta invitee drafts.

**Settings API isPublic fix ✅ SHIPPED** (commit 971cd11)
`app/api/leagues/[leagueId]/settings/route.ts` now correctly persists the `isPublic` field. Unblocks AG-001 public/private league toggle.

**Deploy config ✅ SHIPPED** (commit e24b508)
`prisma migrate deploy` added to `package.json` build step. Schema migrations now apply automatically on every Vercel deploy. Advances GATE-3 ops readiness.

**Beta UX polish ✅ SHIPPED** (commit eed7d35)
Nav hidden on `/beta` landing page; completed admin setup checklist (5/5 steps done) now auto-hides.

**BLR-002 — ✅ CONFIRMED SHIPPED** · M · P0
Wizard step-0 beta welcome screen confirmed in `CreateLeagueWizard.tsx`. `isBetaMode && step === 0` renders `<BetaWelcomeStep onContinue={() => setStep(1)} />`. Heading: "You're in. Welcome, Founding GM." 3 cards + "Build my league →" CTA. Progress bar hidden on step 0 via `{step > 0 && ...}`. `NEXT_PUBLIC_BETA_MODE=true` added to `.env.local` for dev testing. No schema change.

**Approved copy:**
- Eyebrow badge: `Beta · Replay Season` (pulse dot, reuse `/beta/page.tsx` treatment)
- Heading: `You're in. Welcome, Founding GM.`
- Intro: "You're one of a small group helping us shape PWHL GM before the live 2026-27 season. Your league runs on four real weeks from the 2025-26 PWHL season — same players, same stats, compressed into a ~4-week format so you can experience a full season before opening night. Everything you try, break, or love goes directly into what we build next."
- Card 1 (⏪ "Real PWHL stats. Condensed timeline."): Four weeks of 2025-26 data, full snake draft, weekly head-to-head VP scoring.
- Card 2 (💬 "Send us feedback. All of it."): Use the feedback button in the bottom-right corner. Bugs, confusion, missing features — we read every one.
- Card 3 (🏒 "Founding GMs get first access in November."): When the live 2026-27 season opens, you get early invites and skip the waitlist.
- CTA: `Build my league →`
- Secondary link: `What's a replay league?` → tooltip or `/league-rules` anchor (engineer's choice)

**Engineer checklist:**
1. Change `useState(1)` to `useState(process.env.NEXT_PUBLIC_BETA_MODE === "true" ? 0 : 1)` in `CreateLeagueWizard.tsx`
2. Wrap the progress indicator block in `{step > 0 && ...}`
3. Add `{step === 0 && <BetaWelcomeStep onContinue={() => setStep(1)} />}` before the existing step-1 block
4. `BetaWelcomeStep` renders: eyebrow badge + heading + intro paragraph + 3 cards + CTA button + secondary link. No Cancel, no Skip.
5. Use `--accent*` CSS vars and `.chip-*` classes from `globals.css` for the badge; `.rebrand-card` for cards; `.button-primary` for CTA.
6. Add `NEXT_PUBLIC_BETA_MODE=true` to `.env.local` for dev testing.

Full spec: `docs/01-roadmap/roadmap-features.md` § BLR-002

---

### Track A — BLR: Beta League Replay Format

**BLR-001: Founder-Created Beta Replay Leagues** · L · P0 · ✅ SHIPPED (commits cc77196 + ecc7290, Jun 22, 2026)
A founder-console UI to spin up a pre-configured 8-team replay league using 4 curated weeks from the
2025-26 season + a 2-round playoff bracket (semifinals + final). Invitees join via a link and experience
the full PWHL GM loop in a compressed, low-stakes format before the live season begins.

What shipped: `POST /api/founder/beta-leagues`; `POST /api/founder/beta-signups`; `POST /api/founder/leagues/[leagueId]/beta-users`; `GET/PUT /api/leagues/[leagueId]/draft/queue`; `scoreVtfWeek` beta week mapping; beta season generation via `pickRandomWeeks(20, 4)`; founder console "Create Beta League" form + "Beta" filter; "Beta Users" tab in league detail; beta banner in league + team layouts; TeamNav "Draft Queue" tab pre-draft; `/team/[teamId]/draft-prep` player rankings + queue manager.

**Engineering risk — verify before first beta draft:**
- `pickRandomWeeks(20, 4)` hardcodes `total: 20` — should derive actual period count dynamically from the fixture.
- `computeSeasonState` may show unexpected period statuses when only 4 `ScoringPeriod` rows exist for a beta league spanning 2025-26 game dates — needs verification.

**BLR-002: Wizard Beta Welcome Screen** · M · P0 · ✅ CONFIRMED SHIPPED
Step-0 beta welcome screen confirmed live in `app/create-league/CreateLeagueWizard.tsx`, gated on `NEXT_PUBLIC_BETA_MODE=true`.
Line 220: `{isBetaMode && step === 0 && <BetaWelcomeStep onContinue={() => setStep(1)} />}`. Heading: "You're in. Welcome, Founding GM."
Three orientation cards (replay format, feedback widget, November access). CTA: "Build my league →". Progress bar hidden on step 0
via `{step > 0 && ...}`. `NEXT_PUBLIC_BETA_MODE=true` added to `.env.local`. No Skip, no Cancel, no async call.

---

### Track B — Sprint 13 Carry-Forwards (P0/P1)

**BF-009: Analysis Page Navigation Broken** · S · P0
Click on "Analysis" in team nav stays on matchup URL. Root cause: likely a runtime error in
`app/team/[teamId]/analysis/page.tsx` on first access. Investigate and fix.
Files: `app/team/[teamId]/analysis/page.tsx`, `app/team/[teamId]/TeamNav.tsx`

**OB-002: Wizard Step 4 Introduces VP Without Explaining It** · S · P0
Add `VpExplainer` (collapsed) inline in step 4; add tooltip for UTIL.
Files: `app/create-league/CreateLeagueWizard.tsx`

**OB-003: Wizard Does Not Warn Team Creation Step Is Coming** · S · P0
Add note at step 4: "Next, you'll name your own team."
Files: `app/create-league/CreateLeagueWizard.tsx`

**OB-004: Canceling Mid-Wizard After League Is Created Silently Orphans It** · M · P0
Add a confirm dialog when Cancel is clicked after step 4 (the step where the league is created).
Files: `app/create-league/CreateLeagueWizard.tsx`

**UX-046: Season Series Block Renders Twice on Matchup Page** · S · P1
Remove redundant summary heading; render label + detail in one unified Z4 block.
Files: `app/team/[teamId]/matchup/page.tsx`

**UX-047: Trade Proposal Has No Trading-Partner-First Step** · M · P1
Add team-picker pill row above "WANT FROM LEAGUE" player list.
Files: `app/league/[leagueId]/trades/new/page.tsx`

**UX-048: Trade Form Search Hint Hidden Below Player List** · S · P1
Move search instruction above the player list, immediately below the section heading.
Files: Same as UX-047

**OB-005: QuickDraftJoinForm Is on the Public Home Page** · S · P1
Remove League ID / Team ID form from public home page; move join-by-ID behind auth.
Files: `app/page.tsx`

**OB-006: Replay Mode Description Only Appears After Clicking the Option** · S · P1
Add a one-line description below each mode option (Live / Replay) upfront.
Files: `app/create-league/CreateLeagueWizard.tsx`

**OB-007: Login Page Says "All 8 Teams" — There Are 12** · S · P1
Update stale copy. Files: `app/login/page.tsx`

**OB-009: Wizard Rules Step Shows No Fantasy Point Values** · S · P1
Add scoring chip row: "Goal 2 pts · Assist 1.5 pts · Win (G) 5 pts · PPP 1 pt · Shutout (G) 3 pts."
Files: `app/create-league/CreateLeagueWizard.tsx`

---

### Track C — New Live Feedback Bugs (Jun 21–22)

**BF-012: FA Add Shows Error But Player IS Added** · M · P1
Source: `cmqnc5umh000eu5tmsanmob6z`. User gets an error message on drop/add but the transaction succeeds on refresh.
Root cause hypothesis: `AddAndSlotModal` capacity check fires after the add API already committed the transaction, or
the slot assignment API returns an error that surfaces as "roster full" even though the add succeeded.
Files: `app/team/[teamId]/roster/RosterManager.tsx`, `components/AddAndSlotModal.tsx`, `app/api/leagues/[leagueId]/waiver/route.ts`

**BF-013: Trades Cannot Be Proposed Between Draft Completion and Season Start** · S · P1
Source: `cmqniggbz000kb5xpiks9tfim`. Trade deadline logic in `lib/services/trade-service.ts` blocks when
`league.playoffStatus !== "NOT_STARTED"` — but this also fires in the pre-season window after draft. Fix: block
when playoffs have started OR season is complete. The pre-season window should allow trades.
Files: `lib/services/trade-service.ts`, `app/league/[leagueId]/trades/page.tsx`

**BF-014: VTF Matchup Schedule Page Is Confusing** · S · P2 · ✅ SHIPPED (commit dc05f03)
Source: `cmqpqywet000911ngv1887pij`. Matchup schedule page shows 1v1 pairs in VTF mode where all teams play
the entire field each week. Fix: added VTF-mode ranked view (rank · team · FP score · W-L-T record);
keeps VP 1v1 pair-card layout unchanged; added "vs Field" badge to week header. No schema changes.

---

### Track E — Ad-hoc Beta Fixes (Jun 22–23, 2026)

Discovered and shipped during Sprint 18 after the primary tracks completed.

**BF-015: UTIL Slot False Error on Valid Forward Move** · S · P1 · ✅ SHIPPED (commit f400b90)
Stale-closure bug in `LineupManager.tsx` multi-move batches. In auto-set and bench-upgrade hint
operations that apply several moves at once, the slot-validation closure held the pre-move roster
snapshot, causing valid forward→UTIL moves to be rejected as "slot full" once the batch reached a
second forward. Fix: validation closure now accounts for prior pending moves within the same batch.
Files: `app/team/[teamId]/lineup/LineupManager.tsx`

**BF-016: Activity Feed Showing Raw LEAGUE_STORYLINE Enum String** · S · P1 · ✅ SHIPPED (commit 70cd536)
`TYPE_META` in `lib/services/activity.ts` was missing an entry for `LEAGUE_STORYLINE`, causing the
activity feed to display the raw enum value instead of a human-readable label. Fix: added
`LEAGUE_STORYLINE` (label "League Storyline") and audited all other `EventType` values for missing
entries. Files: `lib/services/activity.ts`

**BF-017: Auto-Set and Bench-Upgrade Hint Suggest Players with 0 Games** · S · P1 · ✅ SHIPPED (commit 622ac9a)
Null-coalescing inconsistency for `projectedFp` in `computeOptimalLineup` and the bench-upgrade hint
ranked null-projection players (callups, injured players with no recent history) above players with
real projections. Fix: standardized null→0 across both paths so zero-game players always rank last.
Files: `lib/lineup.ts`, `app/team/[teamId]/lineup/LineupManager.tsx`

**BLR-003: Expansion Team Teaser in Beta Welcome Screen + Draft Room** · S · P1 · ✅ SHIPPED (commit dfef7ef)
Marketing/hype copy tied to the PWHL expansion draft (week of Jun 21, 2026). Added expansion team
teaser to the BLR-002 beta welcome screen and draft room header, noting the four new franchises
(Detroit, Hamilton, Las Vegas, San Jose) joining the 2026-27 season. Gated on `isBetaMode`.
Files: `app/create-league/CreateLeagueWizard.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`

---

### Track D — Ops Gates (pre-launch blockers, can run in parallel with Tracks A–C)

These tasks advance the formal launch gates. None require feature code; all require ops work or
verification runs. See the Launch Gates table in `roadmap-index.md` for gate definitions.

**OPS-001: Security Review — Internal OWASP Audit** · M · P0 (GATE-1) · ✅ GATE-1 PASS
Zero P0 findings. 6 P1 findings deferred post-beta (error monitoring, rate limiting on public endpoints,
draft server origin validation, session cookie rotation, audit log redaction, Neon row-level security).
All auth guards, data isolation, cookie security, commissioner escalation, and cron auth validated.
Report: `docs/04-operations/security-audit-sprint-18.md`.

**OPS-002: Load Test — Draft Room** · M · P0 (GATE-2) · ✅ GATE-2 PASS
20 concurrent leagues × 4 teams = 80 simultaneous WebSocket connections. All drafts completed with
correct pick counts and no cross-league player duplication. No split-room regressions. Auto-pick timer
fired correctly under load. Report: `docs/04-operations/load-test-sprint-18.md`.

**OPS-003: Vercel Ops Verification** · S · P0 (GATE-3) · ✅ GATE-3 CONDITIONAL PASS
- `process-waivers` cron: confirmed at `0 8 * * *` (08:00 UTC = 03:00 ET) in `vercel.json` ✅
- `check-incomplete-lineups` cron: ✅ ADDED — new route `app/api/cron/check-incomplete-lineups/route.ts` + `vercel.json` entry at 12:00 UTC
- `CRON_SECRET` guard: implemented in both cron routes ✅
- Error monitoring: not configured (P1 post-beta)
- Neon PITR: manual verification required before Jul 7
- **One P0 manual action pending:** `CRON_SECRET` must be set in Vercel production dashboard before Jul 7.
Report: `docs/04-operations/ops-verification-sprint-18.md`.

**OPS-004: Accessibility Audit** · M · P1
Source: `cmqpryac7000n11ngc9j136a4`. Perform a basic a11y audit before beta invites: keyboard navigation on
draft room and lineup page; color contrast on all status chips; screen-reader labels on interactive elements.
Produce a findings list; fix all P0 a11y blockers. P1/P2 findings go to the post-beta backlog.

---

### Sprint 18 Story Table

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| BLR-001: Founder-created beta replay leagues | A | L | P0 | ✅ SHIPPED (cc77196 + ecc7290) |
| BLR-002: Wizard beta welcome screen | A | M | P0 | ✅ SHIPPED — BetaWelcomeStep confirmed in codebase; NEXT_PUBLIC_BETA_MODE=true in .env.local |
| BF-009: Analysis page navigation broken | B | S | P0 | ✅ RESOLVED (Playwright false-negative; nav confirmed working) |
| OB-002: Wizard Step 4 VP explanation | B | S | P0 | ✅ SHIPPED |
| OB-003: Wizard team-creation warning | B | S | P0 | ✅ SHIPPED |
| OB-004: Wizard cancel confirm dialog | B | M | P0 | ✅ SHIPPED |
| BF-012: FA add phantom error | C | M | P1 | ✅ SHIPPED — error copy clarified to "Added to bench — slot them from your Lineup page if needed." |
| BF-013: Pre-season trade block | C | S | P1 | ✅ SHIPPED — removed `league.status !== "IN_SEASON"` gate from trade-service.ts + trades/new page.tsx; only playoff status blocks |
| UX-046: Season series duplicate block | B | S | P1 | ✅ SHIPPED — removed "Season Series" record block from RivalBadge.tsx (HeadToHeadHistory already shows it) |
| UX-047: Trade partner-first step | B | M | P1 | ✅ SHIPPED — replaced select dropdown with pill-row team buttons in ProposeTrade.tsx |
| UX-048: Trade form hint above list | B | S | P1 | ✅ SHIPPED — moved hint inside LeaguePlayerPicker, below section label, above search input |
| OB-005: Remove public home QuickDraft form | B | S | P1 | ✅ CONFIRMED DONE — app/page.tsx has only a Link to /join-league, no inline form |
| OB-006: Replay mode upfront description | B | S | P1 | ✅ CONFIRMED DONE — wizard Step 3 buttons embed desc text visible before any click |
| OB-007: Login "8 teams" copy fix | B | S | P1 | ✅ CONFIRMED DONE — login page line 74 already reads "all 12 teams" |
| OB-009: Wizard FP values in rules step | B | S | P1 | ✅ SHIPPED — always-visible scoring chip row in Step 4 (both live + replay paths); removed showScoring toggle |
| OPS-001: Security review (internal OWASP) | D | M | P0 | ✅ GATE-1 PASS — zero P0 findings; 6 P1 findings post-beta; report: docs/04-operations/security-audit-sprint-18.md |
| OPS-002: Load test (draft room, 30 leagues) | D | M | P0 | ✅ GATE-2 PASS — 20 leagues × 4 teams = 80 connections; all picks correct, no cross-league duplication; report: docs/04-operations/load-test-sprint-18.md |
| OPS-003: Vercel ops verification | D | S | P0 | ✅ GATE-3 PASS — crons added; CRON_SECRET set in Vercel production; report: docs/04-operations/ops-verification-sprint-18.md |
| OPS-004: Accessibility audit | D | M | P1 | ✅ SHIPPED — P0 a11y blockers: focus-visible CSS globally; aria-label + keyboard handlers on draft pick buttons and lineup slot divs; aria-label on AddAndSlotModal bench button |
| BF-014: VTF matchup page confusion | C | S | P2 | ✅ SHIPPED (dc05f03) |
| BF-015: UTIL slot false error on valid forward move | E | S | P1 | ✅ SHIPPED (f400b90) |
| BF-016: Activity feed shows raw LEAGUE_STORYLINE enum | E | S | P1 | ✅ SHIPPED (70cd536) |
| BF-017: Auto-set suggests players with 0 games | E | S | P1 | ✅ SHIPPED (622ac9a) |
| BLR-003: Expansion team teaser in beta welcome screen + draft room | E | S | P1 | ✅ SHIPPED (dfef7ef) |

**Min-ship (P0 only, must land by Jul 7):** ~~BLR-001~~ ✅ SHIPPED · ~~BLR-002~~ ✅ SHIPPED · ~~BF-009~~ ✅ RESOLVED · ~~OB-002~~ ✅ SHIPPED · ~~OB-003~~ ✅ SHIPPED · ~~OB-004~~ ✅ SHIPPED · ~~OPS-001~~ ✅ GATE-1 PASS · ~~OPS-002~~ ✅ GATE-2 PASS · ~~OPS-003~~ ✅ GATE-3 PASS = **0 remaining P0 stories**

**Exit:** BLR leagues creatable by founder and joinable by invitees (BLR-001 ✅); BLR-002 welcome messaging shipped ✅; all 4 P0 onboarding wizard bugs fixed ✅; Analysis page navigates correctly ✅; draft load test passes at 20-league scale ✅; security audit complete with zero P0 findings ✅; CRON_SECRET set in Vercel production ✅; all P1s shipped ✅; VTF matchup schedule page fixed (BF-014 ✅). **All P0+P1+P2 items complete.** Beta invites go out Jul 7, 2026.

---

## Sprint 20 — "VTF Navigation Rename" · ✅ COMPLETE · Jun 23, 2026 · Track F · P1/P2

Goal: Rename navigation labels in the league and team zones to better communicate VTF semantics to new users. Two targeted polish items only; no schema changes.

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| BF-018 — League "Schedule" tab → "Results" tab + VTF explainer subtitle | F | S | P1 | ✅ SHIPPED (commit ad4185a) |
| UX-049 — Team Nav "Schedule" → "My Season" + "Your Players This Week" section rename | F | S | P2 | ✅ SHIPPED |

**Exit achieved:** VTF navigation labels updated for clarity — "Results" replaces "Schedule" in the league nav; "My Season" replaces "Schedule" in the team nav. "Your Players This Week" section rename aligns with franchise-first language. Two targeted polish items shipped, no regressions.

---

## Sprint 19 — "IA Restructure: Franchise-First Navigation + DnD Lineup" · ✅ COMPLETE · Track F · P1/P2

**Status:** COMPLETE. All 5 parts shipped to main. Sprint 19 superseded the originally-planned "Playwright UX Walkthrough Fixes" scope (BF-018, UX-051–057) with a larger IA restructure. The Playwright items remain in the post-sprint backlog for a future UX polish pass.

Goal: Restructure the app's information architecture around a "My Franchise" mental model. Move all personal/transactional surfaces into the `/team/[teamId]/` zone. Make the league overview commissioner-only. Consolidate lineup management and roster into a single DnD-enabled surface. Give commissioners god-mode access to any team's lineup.

---

### Shipped (Sprint 19 — all 5/5 parts complete)

**Part 1 — Emoji Policy + Colorblind Fix** · ✅ SHIPPED (commit 0d00092)
- `docs/branding/emoji-policy.md`: tiered emoji policy — Tier 1 (celebratory/onboarding) YES; Tier 2 (nav/tables/status) NO.
- `app/league/[leagueId]/standings/page.tsx`: colorblind chip fix with glyphs — ✓ CLINCHED, ✗ ELIM, ◉ BUBBLE replacing color-only differentiation.
- `app/globals.css`: added `chip-bubble` (amber) and `chip-out` (gray) CSS classes.

**Part 2 — Trades → My Franchise** · ✅ SHIPPED (commit a2cd617)
- New `/team/[teamId]/trades`, `/team/[teamId]/trades/new`, `/team/[teamId]/trades/[tradeId]` routes under team layout.
- Old `/league/[leagueId]/trades/*` routes redirect to team-scoped equivalents.
- Trades tab removed from league nav; added to `TeamNav.tsx`.
- New `/team/[teamId]/bracket` route (team-layout version of playoff bracket).
- New `/team/[teamId]/transactions` route (team-layout version of transaction log).
- `TeamNav.tsx` updated: removed Lineup/Free Agents tabs; renamed Rosters → My Roster; Trades/Playoffs/Transactions now link to `/team/[teamId]/` routes.

**Part 3 — League Overview → Commissioner-Only** · ✅ SHIPPED (commit 3ceb056)
- `/league/[leagueId]` now redirects non-commissioners to their team matchup page.
- Removed My Matchup widget and non-commissioner content from the commissioner overview.
- `/league/[leagueId]/roster` now requires commissioner access (non-commissioners see their own team roster via My Franchise).

**Part 4 — Combined My Roster with DnD Lineup Management** · ✅ SHIPPED (commit 01075f9)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` installed.
- New `components/LineupDnD.tsx`: drag-to-swap lineup management — stats tabs (Season/This week/Last week/Projected); games-remaining badges; play-lock validation; `DragOverlay`.
- `app/team/[teamId]/roster/page.tsx` rewritten: fetches all lineup data (lock status, stats tabs, projections, games remaining) and renders `LineupDnD` at top + `RosterManager` below.
- `/team/[teamId]/lineup` now redirects to `/team/[teamId]/roster`.

**Part 5 — Commissioner God-Mode on My Roster** · ✅ SHIPPED (commit b4986a6)
- Commissioner can view any team's roster via team selector and drag-and-drop their lineup.
- Uses `/api/leagues/[leagueId]/commissioner/force-move` endpoint (not the regular lineup API).
- `LineupDnD` shows amber "Commissioner view" banner when `forceMove=true`.
- `RosterManager` shows "⚙ Commissioner View" chip alongside the "← My Team" back button.

---

### Sprint 19 Story Table

| Story | Size | Priority | Status |
|---|---|---|---|
| Part 1: Emoji policy + colorblind chip fix | S | P1 | ✅ SHIPPED (0d00092) |
| Part 2: Trades → My Franchise routes + TeamNav | M | P1 | ✅ SHIPPED (a2cd617) |
| Part 3: League overview → commissioner-only | M | P1 | ✅ SHIPPED (3ceb056) |
| Part 4: DnD lineup management on My Roster | L | P1 | ✅ SHIPPED (01075f9) |
| Part 5: Commissioner god-mode on roster page | M | P2 | ✅ SHIPPED (b4986a6) |
| **Total** | **1S · 3M · 1L** | — | **5/5** |

**Schema changes:** None. All changes are routing, UI, and new npm packages only.

**Exit achieved:** All personal/transactional surfaces live under `/team/[teamId]/`. Non-commissioners are redirected from the league overview to their franchise. `/team/[teamId]/roster` is the single page for lineup management and roster operations — click-to-swap replaced by drag-and-drop. Commissioner can view and rearrange any team's lineup from the roster page.

---

### Originally-Planned Sprint 19 Items (from Playwright UX walkthrough Jun 23, 2026)

The following items were originally scoped for Sprint 19 but were superseded by the IA restructure. The 7 unblocked items have been reassigned to **Sprint 22** where they fit naturally alongside RD-004 (wizard rebuild) and RD-011 (empty state copy). The 2 email-blocked items remain in the post-email-infra backlog.

**Reassigned to Sprint 22:**
- BF-018 (P1, S) — `/league-rules` 404 dead link (note: separate from the nav-rename BF-018 that shipped in Sprint 20; same ID was reused — this is the original Playwright-walkthrough bug)
- UX-051 (P1, S) — VP popover overflow on mobile in wizard Rules step (addressed by same file changes as RD-004)
- UX-052 (P1, M) — Invite landing: add fantasy primer for cold new users
- UX-057 (P1, M) — Wizard Rules step jargon wall (PPP, UTIL unexplained) (addressed alongside RD-004 wizard rebuild)
- UX-054 (P2, S) — Replay CTA context copy on landing page
- UX-055 (P2, S) — Wizard step count hidden until after welcome screen
- UX-056 (P2, S) — Commissioner draft checklist: add plain-language draft primer

**Remain blocked (post-email-infra backlog):**
- UX-053 (P2, M) — Email invite flow — blocked on email infrastructure
- BF-019 (P2, M) — Password reset / forgot password — blocked on email infrastructure

---

## Sprint 21 — "Living League: Weekly Delight" · ✅ COMPLETE · Milestone 1 · P1/P2

Goal: Make every Tuesday feel like something happened. Surface what already exists (scoring, standings, notifications, matchup page) through storytelling, recognition, and live momentum signals. First sprint of the Living League arc.

**Sprint coordination note:** LL-002 (Momentum Strip) ships its data layer here. The visual `MomentumStrip.tsx` component is built in Sprint 22 (RD-008) as part of the Inviting Dark redesign — the full feature is complete after Sprint 22.

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| LL-001 — Weekly Awards Ceremony: `computeWeeklyAwards()` in `storyline-service.ts`; 5 award types (Ice-Cold Closer, Heater, Heartbreaker, Collapse, Frozen Stick); emitted as `LEAGUE_STORYLINE` events from `advanceSeason()`; rendered as award cards in `WeekHighlights.tsx` | Feature | M | P1 | ✅ SHIPPED |
| LL-002 (data layer) — Matchup Momentum Strip data: add `scoreDeltaSinceYesterday`, `playersRemainingTonight`, `opponentFinished` to `ActiveMatchup` type in `getDashboardData`; computed from existing score + roster data; dev sim cookie respected | Feature | S | P1 | ✅ SHIPPED |
| LL-003 — Animated Stat Chips: `StatChip.tsx` pill badges with CSS pulse; 4 chip types (streak, projection swing, league record, weekly leader); computed server-side in `getDashboardData` as `chips[]` on `RosterEntryRow`; rendered in matchup page Z6 roster breakdown | Feature | S | P2 | ✅ SHIPPED |
| LL-017 — Plain-Language Award & Storyline Explainers: tappable ⓘ affordance on every award/chip card; all explainer copy in `lib/copy/living-league-glossary.ts`; fan-first language ("fantasy points" not "FP"); ≥44px touch target; links to `VpExplainer` | Feature | S | P1 | ✅ SHIPPED |
| LL-018 — Negative Award Tone Calibration: forward-looking recovery CTA on Heartbreaker/Collapse/Frozen Stick cards (e.g. "→ Find players"); commissioner `showNegativeAwards` toggle in admin panel (stored in league settings JSON, no migration) | Feature | S | P1 | ✅ SHIPPED |

**Exit criteria:** After `advanceSeason()` runs, 5 award cards appear in `WeekHighlights.tsx`; negative awards include a recovery CTA link; tapping the ⓘ on any award or chip card reveals jargon-free helper text from `lib/copy/living-league-glossary.ts`. `ActiveMatchup` type in `lib/services/dashboard.ts` includes all three Momentum Strip fields with correct values under dev sim date. At least one stat chip type renders correctly in matchup page Z6. `showNegativeAwards` commissioner toggle renders in admin panel. All existing tests pass; `tsc --noEmit` clean. No schema changes.

---

## Sprint 22 — "Inviting Dark Redesign" · PLANNED · Track F · P1

Goal: Execute the "Inviting Dark" visual redesign defined in `docs/branding/pwhl_redesign_bundle_v3_1.zip`. This sprint is pure UI/CSS — no schema changes, no new API routes, no new data models. It covers the full token replacement, inline hex sweep, emoji restoration, flagship page redesigns (league overview + team matchup), remaining page recolor sweep, and a set of emotional UX additions (Momentum Strip, prestige gradient, gold prestige moments, empty state copy, wizard summary panel).

Also absorbs 7 carry-in items from the Sprint 19 Playwright UX walkthrough that were superseded by the Sprint 19 IA restructure. These items (BF-018, UX-051–057 unblocked set) fit naturally alongside RD-004 (wizard rebuild) and the broader onboarding/copy polish work in this sprint.

Spec authority: `docs/branding/pwhl_redesign_bundle_v3_1.zip` (contains `globals.tokens.css`, `color-replacement-map.md`, `page-inventory.md`, and reference HTML files for league overview and team matchup).

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| RD-001 — Token swap: replace `:root` in `globals.css` with Inviting Dark tokens + 3 follow-up edits (body radial-gradient, `.button-primary` accent-ink text, `.section-accent` drop violet) | UX | S | P1 | Open |
| RD-002 — Inline hex sweep across `app/**` + `components/**` per `color-replacement-map.md`; verify button/badge contrast after | Refactor | M | P1 | Open |
| RD-003 — Emoji policy restoration: apply tiered policy; restore glyph chips (✓ CLINCHED, ✗ OUT, ◉ BUBBLE), activity-feed emoji, recap emoji, lock emoji; remove blanket-ban relics | UX | S | P1 | Open |
| RD-004 — VP popover fix + Create League Wizard rebuild: fix `components/VpExplainer.tsx` anchored popover; rebuild `app/create-league/CreateLeagueWizard.tsx` with rule-sheet layout, scoring two-column table, slot pills | Feature | L | P1 | Open |
| RD-005 — League overview flagship redesign: `app/league/[leagueId]/page.tsx` per `references/League Overview.dc.html`; gold commissioner strip, glyph chips, My Matchup widget sky-accent recolor, league leaders layout | Feature | L | P1 | Open |
| RD-006 — Team matchup flagship redesign: `app/team/[teamId]/matchup/page.tsx` per `references/Team Matchup.dc.html`; DuelHero warm gradient + gold radial, score semantics → token vars, prestige RecapCard, all-set banner | Feature | L | P1 | Open |
| RD-007 — Remaining page recolor sweep: walk `page-inventory.md` [recolor] screens: dashboard, standings, bracket, admin, roster, draft, trades, auth pages, founder console, shared components | Refactor | L | P1 | Open |
| RD-008 — Momentum Strip component: new `components/MomentumStrip.tsx`; placed under matchup score header; hidden pre-game, collapses when matchup complete; shows +X pts since yesterday, N players remaining, opponent status | Feature | M | P1 | Open |
| RD-009 — Prestige gradient token: add `--prestige-gradient` CSS variable to `app/globals.css`; apply to champion cards, clinched playoff banners, weekly recap hero; never on buttons/nav | UX | S | P2 | Open |
| RD-010 — Gold prestige moments: apply `--gold` to weekly high score badge, first-place indicator, hot streak chip, clinched banner, champion card; keep gold intentionally rare | Feature | M | P2 | Open |
| RD-011 — Empty state personality copy: update `components/EmptyState.tsx` and inline empty states with warm copy | UX | S | P2 | Open |
| RD-012 — Wizard "Your league at a glance" summary panel: 4-item card at wizard completion step | Feature | M | P2 | Open |
| RD-014 — Live Matchup Excitement Indicators: directional trend arrows on projected totals (`▲ +4.3` / `▼ −1.2`); upset chip when trailing win probability is 10–40% (`⚡ 18% chance to steal the win`); suppressed in SETUP phase; VTF framing for FieldHero; no schema change | Feature | M | P2 | Open |
| RD-015 — Settings editor rule-sheet restructure: `SettingsEditor.tsx` scoring section → two-column Skaters/Goalies table; roster slots → pill badges matching wizard; sentence-case section headers; presentation-only — all save/validation tests pass | UX | M | P2 | Open |
| RD-016 — Brand theme naming decision ("Northern Ice"): confirm theme name; apply to `globals.css` header comment + branding README; no functional change | Decision | S | P2 | Open |
| RD-017 — Emotional Design North-Star Principles: `docs/branding/emotional-design-principles.md`; "should feel / avoid feeling" list; signature-moment gold rule; "arena concourse" north-star line; linked from sprint exit criteria and branding README | Doc | S | P2 | Open |
| BF-018 — `/league-rules` 404: create minimal `app/league-rules/page.tsx` or remove all dead links (carry-in from Sprint 19) | Bug | S | P1 | Open |
| UX-051 — VP popover overflow on mobile in wizard Rules step (handled alongside RD-004 `VpExplainer.tsx` changes; carry-in from Sprint 19) | UX | S | P1 | Open |
| UX-052 — Invite landing: add 3+ bullet-point fantasy primer above join form for logged-out cold users (carry-in from Sprint 19) | UX | M | P1 | Open |
| UX-057 — Wizard Rules step jargon wall: add inline PPP + UTIL definitions; restructure alongside RD-004 wizard rebuild (carry-in from Sprint 19) | UX | M | P1 | Open |
| UX-054 — Replay CTA context copy: add ≤15-word subtitle to "Try a Replay" CTA on landing page (carry-in from Sprint 19) | UX | S | P2 | Open |
| UX-055 — Wizard step count: show step summary on welcome/beta screen before step 1 (carry-in from Sprint 19) | UX | S | P2 | Open |
| UX-056 — Commissioner draft checklist: add plain-language snake-draft primer in admin panel pre-draft section (carry-in from Sprint 19) | UX | S | P2 | Open |

**Exit criteria:** `app/globals.css` `:root` block fully replaced with Inviting Dark / Northern Ice tokens; zero hardcoded hex values in `app/**` + `components/**` that appear in `color-replacement-map.md`; `components/VpExplainer.tsx` anchored popover no longer clips on mobile; league overview and team matchup pages match the `.dc.html` reference files; `MomentumStrip` renders correctly in active-period matchups; trend arrows render on the matchup hero with correct direction + color; settings editor scoring section renders as a two-column rule-sheet table; `emotional-design-principles.md` exists in `docs/branding/`; `/league-rules` returns 200 (not 404); invite landing shows plain-language fantasy primer to logged-out users; wizard Rules step has inline PPP + UTIL definitions; all existing tests pass; `tsc --noEmit` clean.

---

## Launch Gates — Beta to Public Launch

Formal gates that must all be GREEN before public launch. See `roadmap-index.md` for summary table.
Sprint 18 ops tasks (OPS-001/002/003) advance GATE-1, GATE-2, GATE-3 to IN PROGRESS.

**GATE-1: Security Review (internal)** · ✅ PASS (OPS-001, zero P0 findings)
- [x] OWASP Top 10 audit of all API routes and auth flows (`OPS-001`) ✅
- [x] Auth/authz review: all `apiRequire*` guards correct, no route bypasses ✅
- [x] Input validation audit: all user-supplied data sanitized at API boundaries ✅
- [x] Data isolation: league members can only access their own league's data ✅
- [x] Cookie security settings (`httpOnly`, `SameSite`, `Secure` in prod) ✅
- 6 P1 findings documented in `docs/04-operations/security-audit-sprint-18.md` — deferred post-beta

**GATE-2: Load Test — Draft Room** · ✅ PASS (OPS-002, 20 leagues × 80 connections)
- [x] 20 concurrent live drafts with 4 teams each = 80 simultaneous WebSocket connections (`OPS-002`) ✅
- [x] Auto-pick timer fires correctly under concurrent load (no drift, no stuck clocks) ✅
- [x] No "split room" bug regression (the `Map<string, Promise<DraftRoom>>` fix holds under concurrent JOINs) ✅
- [x] No cross-league player duplication ✅
- [ ] DB connection pool: Neon limits tested; Prisma connection pooling configured — pending report detail
- [ ] Vercel function cold-start behavior validated — pending report detail

**GATE-3: Ops Readiness** · ⚠ CONDITIONAL PASS (OPS-003 — one manual action pending)
- [x] `process-waivers` cron verified at 08:00 UTC (03:00 ET) in `vercel.json` ✅
- [x] `check-incomplete-lineups` confirmed in `vercel.json` + route shipped ✅
- [x] `CRON_SECRET` guard implemented in both cron routes ✅
- [ ] `CRON_SECRET` env var **must be set manually in Vercel production dashboard before Jul 7** ⚠
- [ ] Error monitoring / alerting configured (Sentry or equivalent) — P1 post-beta
- [ ] DB backup policy confirmed for Neon (point-in-time recovery) — manual verification pending

**GATE-4: Data Readiness**
- [ ] 2026-27 regular season schedule published by PWHL/HockeyTech and ingested
- [ ] All 12 team rosters synced post-expansion draft + free agent signings (`scripts/update-2026-27-rosters.ts`)
- [ ] Season periods generated for 2026-27 in at least one staging league
- [ ] `npm run simulate-season` clean pass on 2026-27 schedule (when schedule available)

**GATE-5: Beta Quality Bar**
- [ ] Minimum beta window: ≥3 weeks of active testing with founding commissioners
- [ ] All P0 bugs resolved (no open P0 items in `FeedbackSubmission` or sprint backlog)
- [ ] All P1 bugs resolved or explicitly deferred with owner sign-off
- [ ] Onboarding flow: ≥3 new users complete league creation → join → draft without PM assistance

**GATE-6: End-to-End Integration Test**
- [ ] `scripts/simulate-season.ts` clean pass — re-run before launch (was 180/180 Jun 20)
- [ ] Waiver processing E2E: player dropped → picked up in next waiver cycle
- [ ] Trade flow E2E: propose → accept → roster updated
- [ ] Playoff flow: regular season complete → playoffs initialized → bracket generated → champion crowned

---

## Backlog / Deferred (no sprint assignment)

Items in this section have been explicitly deprioritized and pulled from the sprint plan.
They are candidates for a future season roadmap, not the current build cycle.

**Note:** Trade System (#7) was moved from this backlog to Sprint 7 (Priority 1) as of June
2026 — it is higher priority than League History/HoF for the upcoming launch period. Team
Analysis trade-suggestion CTA (#25) is now unblocked once Trade System ships.

---

## Sprint 14 Candidates (committed to Sprint 14)

These items were deferred from Sprint 13 and are committed to Sprint 14:

- **OB-010 (P1, M) — Wizard Progress Bar Misleading for Replay Users** — Replay users skip step 4 (rules) so the 6-segment bar and "Step N of 6" counter are incorrect. Show 5 segments + "Step N of 5" for Replay leagues. Source: Pass 5 critique item #11.
- **UX-049 (P2, S) — Free Agents Not Accessible from Top-Level Team Nav** — "Free Agents" is a tab inside the Rosters page, requiring two clicks from anywhere in the app. Add a direct "Free Agents" link to TeamNav or make it the default when navigating to `/team/[teamId]/roster`. Source: Pass 2 end-user walkthrough (June 2026).
- **UX-050 (P2, S) — Win Probability Percentages Unlabeled in DuelHero** — "66%" and "34%" float next to the probability bar with no label. New users can't determine what the numbers mean. Add a "Win Prob" label and identify each side. Source: Pass 1 design critique (June 2026).
- **OB-011 (P2, S) — Draft Date Picker Has No Season-Anchor Guidance** — Picker shows "Most leagues draft the week before the opener" but opener is TBD. Replace with a note + optional picker when schedule is not confirmed. Source: Pass 5 critique item #13.
- **UX-045 (P2, M) — No Celebration When Rivalry Matchup Is Won** — Beating your rival produces no signal. Requires `RIVALRY_WIN` `NotificationType` enum + distinct visual treatment. Source: UX-031 follow-through.
- **UX-032 (P2, S) — "+8.3 EDGE" Label Jargon** — Replace with "FP lead" in DuelHero and FieldHero.
- **UX-033 (P2, S) — "NO GAMES YET" Badge Has No Contextual Explanation** — Does not distinguish timing from actionable lineup gap.

---

## Post-Sprint-7 Backlog (not planned)

Items below are acknowledged but have no sprint assignment. They become candidates for the
2027-28 off-season roadmap:

- **DATA-002: 2026-27 Final Roster Sync** — Re-run the roster update script once contracts are
  finalized and pre-season signings are complete. Timing: run the week prior to the first PWHL game
  once the 2026-27 regular season schedule and opening date are announced. Also the right time to
  run the full `npm run ingest -- --season 2026-27` once HockeyTech publishes the regular-season
  schedule (new season_id; check `modulekit&view=seasons` to confirm). Target: all 12 teams have
  complete 20+ player rosters.
  Command: `npx tsx scripts/update-2026-27-rosters.ts`

- **FAAB / Free Agent Acquisition Budget (#6)** — ~80K. Blind-bid acquisition layered on top of the Sprint 6 waiver system. Deferred from Sprint 7 Priority 3 — not needed before public launch. FAAB is only meaningful if the waiver cron (`processWaivers()`) is confirmed live and commissioners actively request it. Revisit for the 2027-28 off-season roadmap. Depends on Waiver System (#5, complete) and waiver cron (Sprint 8, complete).
- **Player Legacy & Cross-Season Tracking (#31)** — `/profile` page with career history across all leagues/seasons, FP totals, championship count; global leaderboard by career FP or championship count. Deferred because the feature requires at least one completed and renewed season to contain meaningful data. Ship after the 2026-27 season completes and a league renews for 2027-28. `UserCareerStats` cached table is post-season work.
- **Growth / retention analytics** — GR-001/002 activation + retention dashboards (AN-002/003);
  GR-003 referral loop; GR-004 league-fill progress bar.
- **Real-time push scoring** — HockeyTech Firebase RTDB WebSocket integration replacing
  `LiveScoreRefresh.tsx` polling. Medium risk; not needed until live games run.
- **Push notifications** — web push for `LINEUP_INCOMPLETE` and `TRADE_RECEIVED`. Requires
  service worker setup. Deferred until retention data justifies the complexity.
- **Multi-season Historical Library (#12)** — extend fixture/ingest support for 2024 and 2024-25
  seasons as replay options. Low urgency; the 2025-26 fixture is sufficient for beta QA.
- **Player Trends (#23)** — hot/cold streak badges on player cards across all pages. Partially
  covered by Team Analysis tab; full standalone trend view is Phase 7.
- **Advanced formats: Keeper (#19) → Dynasty (#20)** — post-2027 season work; requires at least
  one completed live season and confirmed user demand.
- **Native apps / AI features** — Phase 5+ "future expansion"; revisit only once retention
  metrics justify the cost.

---

# Sprint History

| Sprint | Status | Outcome |
|---|---|---|
| Sprint 0 — Implementation Alignment | ✅ COMPLETE (Jun 12, 2026) | Rosters / VP / Playoffs flipped FAIL → PASS |
| Sprint 1 — Season Validation | ✅ COMPLETE (Jun 12, 2026) | Full season simulates, 114 tests pass, confidence 85–90% |
| Sprint 2 — Commissioner + Platform Foundation | ✅ COMPLETE (Jun 2026) | Commissioner recovery tools, multi-season schema, analytics (6 events), VP education; 130 tests pass |
| Sprint 9 — PWHL GM Rebrand | ✅ COMPLETE | 8/8 stories shipped · REBRAND-001–008 all done · BF-001 + BF-002 resolved · 202/202 tests · tsc clean · zero "PWHL Fantasy" strings in live UI |
| Sprint 3 — Beta Readiness | ✅ COMPLETE (Jun 13, 2026) | Onboarding ✅, error handling ✅, mobile ✅, NT-001 ✅, draft notifications ✅, transaction history ✅, IA-011 ✅ |
| Sprint 4 — Product Polish | ✅ COMPLETE (Jun 13, 2026) | NT-002 LINEUP_INCOMPLETE ✅ · #01 commissioner dashboard ✅ · #17 rivalries ✅ · VP standings fix ✅ · playoff mode + replay support ✅ |
| Sprint 5 — Validation + Beta Operations | ✅ COMPLETE | Replay gap fix ✅ · sim-to-playoffs ✅ · draft cert ✅ · founder dashboard ✅ · playoff experience UX ✅ · commissioner workflow validation ✅ |
| Sprint 6 — Engagement + Transactions | ✅ COMPLETE | Auto-set lineup ✅ · FA schedule awareness + add & slot ✅ · beta feedback infrastructure ✅ · code audit + all P0/P1 fixes ✅ · team analysis ✅ · waiver priority + processing ✅ |
| Sprint 7 — Retention Layer | ✅ COMPLETE | Storylines (#11) ✅ · Replay Sim V2 UX (#39) ✅ · Trade System (#7) ✅ · FAAB (#6) deferred to post-launch backlog · #38 DEFERRED · #31 Player Legacy deferred to backlog |
| Sprint 8 — Beta Hardening | ✅ COMPLETE (14/14 done) | P0+P1 audit fixes shipped Jun 20 (ahead of schedule) · 7 beta bug fixes shipped commit b465423: playoff period anchoring, auto-set during playoffs, roster refresh, lineup sort, FA suggestions sim-date fix, bracket default (6→4) |
| Sprint 10 — Beta Bug Sweep + Launch Polish | ✅ COMPLETE (Jun 21, 2026) | 4 bugs + 5 UX fixes: BF-003/004/005/006 + UX-001/010/011/018/023 ✅; DATA-001 initial 2026-27 expansion roster load ✅; BF-007 + UX-008 bumped to Sprint 11 |
| Sprint 11a — UX Polish: Vocabulary + Education (P0/P1) | ✅ COMPLETE (Jun 21, 2026) | 8 items shipped: UX-024/025/026 (VTF record label, hockey-score-look-alike record, 0-0-7 bug), UX-027/028/029/030/031 (projection labels, button hierarchy, standings tooltips, rival prominence) |
| Sprint 11b — UX Polish: Navigation + Wizard + Empty States (P1/P2) | ✅ COMPLETE (Jun 21, 2026) | 16 items: BF-007, UX-008, UX-006, UX-014/015, UX-016, UX-017, UX-019, UX-004, UX-007, UX-002/003, UX-020/021, UX-009, UX-005, UX-013 |
| Sprint 12 — Pre-Beta Polish | ✅ COMPLETE (Jun 21, 2026) | BF-004 (lineup UTIL slot fix) ✅ + UX-043 (landing page jargon) ✅ + UX-039 (Claim vs Add tooltips) ✅ + UX-038/040/042/044 (UI polish) ✅; MVP readiness ~99%; ready for beta Jul 7 (moved up from Jul 14) |
| Sprint 13 — UX Audit + Onboarding First-Run | ✅ ABSORBED (Jun 22, 2026) | 3/14 shipped (BF-008, OB-001, OB-008 via Sprint 15 batch); 11 items carried to Sprint 18 |
| Sprint 14 — Post-Launch Polish + Emotional Engagement | ✅ COMPLETE (Jun 22, 2026) | 11/12 items shipped; UX-045 (rival win celebration) deferred post-launch (schema risk); OB-010 (wizard Replay bar) ✅ + UX-049 (FA direct nav link) ✅ + UX-050 (Win Prob label) ✅ + UX-033 (setup phase copy) ✅; all agent test findings + early commits included |
| Sprint 15 — Visual Design System Deep Pass | ✅ COMPLETE (Jun 22, 2026) | 3 stories: DS-001 (homepage rewrite + sticky header), DS-002 (token sweep all pages + emoji removal), DS-003 (league overview + WeekHighlights full redesign) |
| Sprint 16 — Emotional Design Polish | ✅ COMPLETE (Jun 22, 2026) | Score colors by win state + count-up animation, section heading hierarchy, Saira Condensed font loading, RecapCard elevation, card entrance animations. Transforms "Bloomberg terminal" feeling into energetic sports product. Commits: 5ecc116, f1d576c |
| Sprint 17 — UX Polish: Agent Test Run Fixes | ✅ COMPLETE (Jun 22, 2026) | 9/9 items: AG-001 (LEAGUES overhaul + isPublic schema) + AG-002 (matchup page restructure) + AG-003 (FP/VP copy) + AG-004 (terminology) + AG-005 (playoff eliminated empty state) + AG-006 (renewal confirmation) + AG-007 (pre-login UX) + AG-008 (VP education) + AG-009 (lock tooltip); source: 4-agent parallel UX test run |
| Sprint 18 — Beta Operations + Onboarding Repair | ✅ COMPLETE (Jun 23, 2026) | All 24 items shipped across 5 tracks: BLR-001/002 ✅ + BF-009 ✅ + OB-002/003/004 ✅ + UX-046/047/048 ✅ + OB-005/006/007/009 ✅ + BF-012/013/014 ✅ + OPS-001/002/003/004 ✅ + BF-015/016/017 ✅ + BLR-003 ✅. GATE-1/2/3 all PASS. Beta invites Jul 7, 2026. |
| Sprint 19 — IA Restructure: Franchise-First Nav + DnD Lineup | ✅ COMPLETE (Jun 23, 2026) | 5/5 parts shipped: Part 1 emoji policy + colorblind chips (0d00092) · Part 2 Trades→My Franchise + TeamNav (a2cd617) · Part 3 league overview commissioner-only (3ceb056) · Part 4 DnD lineup on roster page (01075f9) · Part 5 commissioner god-mode (b4986a6). No schema changes. |
| Sprint 20 — VTF Navigation Rename | ✅ COMPLETE (Jun 23, 2026) | 2/2 items shipped: BF-018 league nav "Schedule" → "Results" + VTF explainer subtitle (commit ad4185a) · UX-049 team nav "Schedule" → "My Season" + section rename. No schema changes. |
| Sprint 21 — Living League: Weekly Delight | ✅ COMPLETE | 5/5 stories shipped: LL-001 Weekly Awards Ceremony (`computeWeeklyAwards()` + `emitWeeklyAwards()` in `storyline-service.ts`, award cards in `WeekHighlights.tsx`) · LL-002 Momentum Strip data layer (`scoreDeltaSinceYesterday`, `playersRemainingTonight`, `opponentFinished` on `ActiveMatchup`) · LL-003 Animated Stat Chips (`StatChip.tsx`, `computeStatChips()` in `dashboard.ts`) · LL-017 Plain-Language Explainers (`lib/copy/living-league-glossary.ts`, `InfoTooltip.tsx`) · LL-018 Negative Award Tone Calibration (recovery CTAs, `showNegativeAwards` toggle, `NegativeAwardsToggle.tsx`, `PATCH /api/leagues/[leagueId]/settings`). No schema changes. 6 commits. |
| Sprint 22 — Inviting Dark Redesign | 🔵 PLANNED | 23 stories (RD-001–RD-012 + RD-014–RD-017 + 7 carry-ins): Inviting Dark/Northern Ice token swap, hex sweep, emoji policy, VP popover + wizard rebuild, flagship redesigns, recolor sweep, Momentum Strip, prestige gradient, gold moments, empty state copy, wizard summary panel, trend arrows + upset chip (RD-014), settings rule-sheet restructure (RD-015), theme naming (RD-016), emotional design principles doc (RD-017), /league-rules fix, invite primer, Replay CTA copy, wizard step count, draft checklist. No schema changes. |
| Sprint 23 — Living League: The Race | 🔵 PLANNED | 7 stories: RD-013 Team Identity Colors (schema: accentColor) · LL-004 Magic Number · LL-005 Playoff Clinch Celebration · LL-007 Bubble Watch · LL-008 Upset Tracker · LL-019 First-Loss Explainer · LL-021 Small-Win Moments. Schema migration required (RD-013). |
| Sprint 24 — Living League: Season Story | 🔵 PLANNED | 5 stories: LL-006 Season Timeline · LL-010 League Record Book · LL-011 Franchise Identity · LL-012 Manager Superlatives · LL-023 Empty States for Legacy Systems. New `/league/[leagueId]/records` page. No schema changes. |
| Sprint 25 — Living League: Legacy | 🔵 PLANNED | 3 stories: LL-009 Trophy Cabinet (schema: Achievement model) · LL-014 Opening Day Card · LL-015 Championship Banner. Schema migration required (Achievement + AchievementType). |
| Sprint 26 — The Morning Skate | 🔵 PLANNED | 2 stories: LL-013 + LL-020 (Newcomer Reading Layer). New MorningSkateEdition model, archive + detail pages, homepage hero integration, league nav entry, plain-language blurb templates. Schema migration required (MorningSkateEdition model). |
| Sprint 27 — League Hub | 🔵 PLANNED | 3 stories: LL-016 Hub Reorg · LL-022 Progressive Disclosure · LL-024 Glossary Anchor Page. Homepage + league overview restructured. No schema changes. |

---

# MVP Launch Timeline & Beyond

**Anchor:** today is June 19, 2026. The PWHL 2026-27 opener is ~Nov 2026, with fantasy drafts
~1 week prior (~late Oct 2026). That real date is the natural public-launch target — MVP must
be drafting-ready before it. Dates below are estimates, not commitments.

| Window | Milestone |
|---|---|
| **Jun 12, 2026** | Sprint 0 — alignment P0s closed (roster / VP / playoffs match rules) ✅ |
| **Jun 12, 2026** | Sprint 1 — season simulation + validation suites green ✅ |
| **Jun–Jul 2026** | Sprint 2 — commissioner recovery + platform foundation + analytics ✅ |
| **Jun–Jul 2026** | Sprint 3 — onboarding ✅, error handling ✅, mobile ✅, notifications (draft ✅), IA-011 ✅ COMPLETE |
| **Jun 13, 2026** | NT-002 LINEUP_INCOMPLETE notification shipped (`checkAndEmitScheduledNotifications` on dashboard load) ✅ |
| **Jun 13, 2026** | Sprint 4 — commissioner dashboard gaps ✅, rivalries ✅, playoff mode ✅, VP fix ✅ COMPLETE |
| **Jun 2026** | Sprint 5 — draft cert, founder dashboard, playoff UX COMPLETE ✅ |
| **Jun 2026** | Sprint 6 — auto-set lineup ✅ · FA schedule awareness ✅ · beta feedback infrastructure ✅ · team analysis ✅ · waiver system ✅ · code audit ✅ COMPLETE |
| **Jun 20, 2026** | P0+P1 audit fixes shipped — waiver cron (`vercel.json` + route), auto-set safety, analysis error state, add/slot capacity, waiver cancel confirm ✅ (all ahead of Sprint 8 schedule) |
| **Jun 23 – Jul 6, 2026** | Sprint 7 — Trade System (#7) · storylines · FAAB (League History/HoF → Sprint 9; Replay V2 #38 deferred; Player Legacy #31 deferred to backlog) |
| **Jul 7–13, 2026** | Sprint 8 — Beta Hardening: P1 fixes, Vercel crons, load test, integration test |
| **Jun 22–Jul 6, 2026** | Sprint 18 — Beta Operations + Onboarding Repair (BLR, Sprint 13 carry-forwards, ops gates) |
| **Jul 7, 2026** | **Beta invites to founding commissioners** (moved up from Jul 14) |
| **Sep 1–30, 2026** | Beta feedback cycle: founding commissioners run replay + live test leagues; fix findings |
| **Late Oct 2026** | **PUBLIC LAUNCH** — real leagues draft ~1 week before the opener |
| **Nov 2026** | First live regular season on the platform |

**Risk buffer:** All P0 and P1 audit fixes shipped Jun 20, ahead of the Sprint 8 schedule.
Sprint 18 (targeting Jul 7) is focused on BLR feature build, Sprint 13 carry-forward UX fixes,
new live feedback bugs (BF-012/013/014), Vercel cron wiring, load test, and internal security
review. The beta invite date of **Jul 7, 2026** (moved up from Jul 14) is achievable given
P0 fixes are already applied.

---

## Sprint 23 — "Living League: The Race" · PLANNED · Milestone 2 core · P1/P2

Goal: Make standings feel dramatic. Real-time playoff implications, clinch celebrations, and a record of the season's most improbable results.

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| LL-004 — Magic Number: extend `computeRace()` in `lib/playoffs/seeding.ts` → `magicNumber: number \| null` on `RaceInfo`; "Magic: N" chip on standings page for contending teams | Feature | S | P1 | Open |
| LL-005 — Playoff Clinch Celebration: detect newly-clinched teams in `advanceSeason()` by comparing race state before/after scoring; `createNotification()` + `PLAYOFF_CLINCH` LeagueEvent; dismissible banner on `/team/[teamId]/matchup` | Feature | S | P1 | Open |
| LL-007 — Bubble Watch: `BubbleWatch.tsx` appended below standings table; 3 groupings (In the Playoffs / Bubble / Eliminated) from existing `computeRace()`; shown only during `IN_SEASON`; late-season heading "Playoff Push" after week N/2 | Feature | S | P2 | Open |
| LL-008 — Upset Tracker: `lib/services/upset-service.ts` — `getLeagueUpsets()` scans scored matchups, computes underdog probability retrospectively via `winProbability(homeScore, awayScore)`, returns top upsets this season + all-time; `UpsetCard.tsx` on league overview sidebar | Feature | M | P2 | Open |
| RD-013 — Team Identity Colors: manager picks one accent from curated palette (6–8 AA-compliant swatches); renders as avatar ring, team-name tint, activity-feed dot; opponent color shows in DuelHero; never overrides semantic colors; new `FantasyTeam.accentColor String?` field — schema migration required | Feature | M | P2 | Open |
| LL-019 — First-Loss / First-Week Result Explainer: dismissible card on `/team/[teamId]/matchup` after manager's first scored period; plain-language result summary + VTF explanation + top contributor named; shown once (localStorage keyed `userId+leagueId+"first-result-seen"`); most actionable gap surfaced when present | Feature | M | P1 | Open |
| LL-021 — Small-Win Encouragement Moments: inline micro-celebrations for first-time milestones (first complete lineup, first free-agent add); localStorage-gated, fires once per manager; warm coaching tone ("a full lineup means every slot earns points") | Feature | S | P2 | Open |

**Exit criteria:** After `advanceSeason()` scores a week, any team newly at `status === "clinched"` in `computeRace()` receives a notification and the dismissible clinch banner appears on their matchup page. "Magic: N" chip renders next to the race chip on the standings page for contending teams. `BubbleWatch.tsx` renders correctly in `IN_SEASON` state with the correct three groupings. `UpsetCard.tsx` renders at least one upset on the league overview when scored matchup data exists. First-result explainer card appears for a brand-new manager after their first scored period and dismisses correctly. Lineup-complete and first-add encouragement toasts fire once and not again. All existing tests pass; `tsc --noEmit` clean. No schema changes.

---

## Sprint 24 — "Living League: Season Story" · PLANNED · Milestone 2 tail + Milestone 3 surface · P1/P2

Goal: Give the league a narrative. A scrollable season timeline, a record book, franchise personality archetypes, and end-of-season manager superlatives.

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| LL-006 — Season Timeline: `lib/services/timeline-service.ts` → `getSeasonTimeline()`; events sourced from existing `LeagueEvent` rows (TRADE, PLAYOFF_CLINCH, CHAMPIONSHIP_WON, etc.); `SeasonTimeline.tsx` on league overview left column below playoff race | Feature | M | P2 | Open |
| LL-010 — League Record Book: new `/league/[leagueId]/records` page; 4 record categories (Highest Weekly Score, Longest Win Streak, Biggest Blowout, Closest Victory); Current Season + All Time tabs; "Records" link in league nav | Feature | M | P1 | Open |
| LL-011 — Franchise Identity: `computeFranchiseIdentity()` in `lib/services/analysis-service.ts`; 4 archetypes (Boom or Bust, Defensive Fortress, Sniper Factory, Goaltender Driven); archetype chip in team matchup page Z2 area | Feature | M | P2 | Open |
| LL-012 — Manager Superlatives: `computeManagerSuperlatives()` in `lib/services/storyline-service.ts`; 5 superlative types (Waiver Wizard, Trade Shark, Draft Sniper, Iron Lineup, Injury Magnet); one per manager; displayed on league overview after `playoffStatus === COMPLETE`; emitted as `LEAGUE_STORYLINE` events | Feature | M | P2 | Open |
| LL-023 — Empty-State & Pre-History Copy for Legacy Systems: purposeful empty states on Record Book, Season Timeline, Trophy Cabinet, and `/team/[teamId]/trophies` for new leagues with no scored data; copy explains value and points forward; no jargon; uses existing `EmptyState.tsx` with custom copy props | Feature | S | P2 | Open |

**Exit criteria:** Season timeline renders at least 3 event types on the league overview when matching `LeagueEvent` rows exist. Records page loads at `/league/[leagueId]/records`, shows all 4 categories with current-season data, and "Records" appears in the league nav. Franchise identity chip renders on at least one team's matchup page when ≥4 weeks of `StatLine` data exists. Manager superlatives section appears on league overview when `playoffStatus === COMPLETE`. A brand-new league with zero scored weeks shows a purposeful empty state (not a blank table or null) on the records page, season timeline, and trophies page. All existing tests pass; `tsc --noEmit` clean. No schema changes.

---

## Sprint 25 — "Living League: Legacy" · PLANNED · Milestone 3 depth + Milestone 5 · P1/P2

Goal: Seasons contribute to franchise identity. Win something and it stays with you forever. The champion gets a banner; the season opener gets a card.

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| LL-009 — Trophy Cabinet: `Achievement` model + `AchievementType` enum in schema; achievements written at lifecycle hooks (clinch, championship, weekly high score, regular season winner); `/team/[teamId]/trophies` page; "Trophies" in `TeamNav.tsx`; trophy icons in matchup page header (Z2) | Feature | L | P1 | Open |
| LL-014 — Opening Day Card: dismissible hero card at Z0 on matchup page during Week 1 only (`activePeriod.number === 1`); content: season year, week count, manager count, "1 Champion"; dismiss flag in `localStorage` keyed on `leagueId + season` | Feature | S | P2 | Open |
| LL-015 — Championship Banner: dismissible banner on matchup page for league champion after `playoffStatus === COMPLETE`; triggered by unread `CHAMPIONSHIP_WON` notification; `createNotification()` called from `advance-playoff-round` route when final round scores; dismiss calls `markAllRead()` | Feature | S | P1 | Open |

**Exit criteria:** `Achievement` model and `AchievementType` enum migrated and in schema. After the final playoff round scores, the champion's owner sees the championship banner on their matchup page; the banner dismisses correctly. A `CHAMPION` `Achievement` row is written for the winning team. `/team/[teamId]/trophies` page loads and renders the trophy grid. Opening Day card appears on the matchup page when `activePeriod?.number === 1` and disappears after dismiss. Schema migration clean (`npx prisma migrate dev`); all existing tests pass; `tsc --noEmit` clean.

---

## Sprint 26 — "The Morning Skate" · PLANNED · Milestone 4 · P1

Goal: PWHL GM's first truly branded subsystem. A weekly league newsletter published every Tuesday after matchups score. Managers should say "I checked the Morning Skate" instead of "I opened PWHL GM."

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| LL-013 — The Morning Skate: `MorningSkateEdition` model (schema migration required); `lib/services/morning-skate-service.ts` → `generateEdition()`; 4 article sections (Standings, Matchups, Players, League Activity) via pure template strings — no AI/LLM; `emitMorningSkateEdition()` from `advanceSeason()`; archive page `/league/[leagueId]/morning-skate`; detail page `/league/[leagueId]/morning-skate/[editionId]`; homepage hero preview when edition exists; "Morning Skate" primary league nav tab with 📰 icon | Feature | XL | P1 | Open |
| LL-020 — Newcomer-Mode Morning Skate Reading Layer: blurb templates lead with human subjects ("Marie-Philip Poulin powered the Northern Lights") not stat-first phrasing; acronyms expanded or tap-to-define via LL-017 glossary map; one-paragraph plain-language lede per edition; "New here? →" primer link in masthead; verified readable at 375px | Feature | M | P1 | Open |

**Engineer checklist:**
1. Add `MorningSkateEdition` model to `prisma/schema.prisma` and run `npx prisma migrate dev`
2. `lib/services/morning-skate-service.ts` — `generateEdition(leagueId, periodId, prisma): Edition` (pure, returns structured object)
3. `emitMorningSkateEdition(leagueId, periodId, prisma)` — stores the edition row; called after `emitWeeklyStorylines()` in `advanceSeason()`
4. `app/league/[leagueId]/morning-skate/page.tsx` — archive list (newest first), server-rendered
5. `app/league/[leagueId]/morning-skate/[editionId]/page.tsx` — full edition display
6. Modify `app/team/[teamId]/matchup/page.tsx` — fetch latest edition; if present, render masthead preview at Z0 with "Read full edition →" link
7. Add "Morning Skate" to `app/league/[leagueId]/layout.tsx` nav
8. Article template strings: each section uses `switch` / conditional logic on existing data — no external calls
9. (LL-020) Author all blurb templates subject-first; import glossary map from `lib/copy/living-league-glossary.ts` (created in Sprint 21 for LL-017); add plain-language lede generator and "New here?" masthead link

**Exit criteria:** After `advanceSeason()` scores a week, a `MorningSkateEdition` row is written for that period. The archive page at `/league/[leagueId]/morning-skate` lists the edition. The detail page renders all 4 article sections with at least 2 blurbs each. Each blurb leads with a player or team name, not a stat. The "New here?" primer link is visible in the masthead. The matchup page homepage hero shows the Morning Skate masthead and 2+ headline blurbs when a current edition exists. "Morning Skate" tab appears in the league nav. Schema migration clean; all existing tests pass; `tsc --noEmit` clean.

---

## Sprint 27 — "League Hub" · PLANNED · Strategy Rec 1 Capstone · P1

Goal: Assemble all Living League systems into a coherent "arena concourse" experience. The franchise home page and league overview stop feeling like utility screens.

| Story | Track | Size | Priority | Status |
|---|---|---|---|---|
| LL-016 — League Hub: `/team/[teamId]/matchup` render order restructure (Morning Skate preview → Matchup Hero → Momentum → Playoff Race context → Live situation → Franchise identity + trophies → Performers); `/league/[leagueId]/` restructure (Morning Skate → Season Timeline → Record Book highlights → Lineup status → Commissioner strip); admin panel utility polish (scoring/roster settings rendered as human-readable summaries, not raw JSON) | Feature | M | P1 | Open |
| LL-022 — Living League Information Hierarchy & Progressive Disclosure: hub always surfaces exactly one primary CTA above the fold; secondary modules (timeline, records, franchise identity) collapse to "Show more" on mobile ≤768px; first-session "lite" hub hides legacy modules for managers with < 2 scored weeks; module order verified readable at 375px; constrains and reconciles with LL-016 render order | Feature | M | P1 | Open |
| LL-024 — Glossary & "How Scoring Works" Anchor Page: new `/league/[leagueId]/how-it-works` page with plain-language definitions of FP, VP, VTF, PPP, GAA, SV%, UTIL, waiver, clinch, magic number, projection; each with a PWHL-flavored example; links to this page from all LL-017 ⓘ affordances and LL-020 "New here?" masthead link; supersedes and absorbs existing `VpExplainer.tsx`; reachable from persistent league/team layout nav | Feature | M | P2 | Open |

**Prerequisite:** All LL-001 through LL-015 (Sprints 21–26) must be complete and green before Sprint 27 begins.

**Exit criteria:** `/team/[teamId]/matchup` render order matches the spec — Morning Skate preview is the first content section when an edition exists; franchise identity chip and recent trophy icons appear in Z2 area. League overview leads with Morning Skate → Season Timeline → Record Book highlight → lineup status widget. Above-the-fold content on a 375px viewport shows exactly one primary CTA without scrolling. `/league/[leagueId]/how-it-works` renders all glossary terms with PWHL examples; "New here?" and ⓘ affordances link to it. Admin panel scoring settings section shows human-readable labels instead of raw JSON keys. All existing tests pass; `tsc --noEmit` clean. No schema changes.

---

## Beyond MVP

- **Q4 2026 (in-season):** Waivers → FAAB; engagement surfaces (#25 analysis, #29 performance dashboard, #30 playoff UX) while the first live season runs. Trade System shipped Sprint 7.
- **Off-season — winter/spring 2027:** League History/HoF page ships Sprint 9 skeleton; fills in naturally after first season renewal. Player Legacy (#31) deferred to post-launch backlog — requires at least one completed season to be meaningful; will be a candidate for the 2027-28 roadmap. The schema foundation (parentLeagueId, rulesVersion, scoringVersion) was laid in Sprint 2, so this is purely the product surface. Growth/retention analytics dashboards (AN-002/003) and referral loop. Target: 2027-28 leagues renew in-place and keep their history.
- **2027-28 season:** Advanced formats (keeper, then dynasty), real-time push scoring + push notifications, and player trends. Native apps and AI features (draft assistant, weekly recaps, trade evaluator) remain Phase 5 "future expansion" — revisit once retention metrics justify them.
- **UX-053: Email Invite Flow** — Commissioners can only share an invite link; no email-entry flow exists. First-time commissioners expect to type friends' emails. Medium effort. **Blocked on email infrastructure** (transactional email provider — same blocker as Sprint 7 stretch email notifications). Unblocks to P1 once email infra ships. Spec: `roadmap-features.md` UX-053.
- **BF-019: Password Reset / Forgot Password on Login Page** — Returning users whose cookie expired have no self-service recovery path. Medium effort. **Blocked on email infrastructure** — requires sending a magic re-auth link by email. Unblocks alongside UX-053. Spec: `roadmap-features.md` BF-019.
