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

## Sprint 7 — "Retention Layer" · ~2 wks · Track F · P2 ← CURRENT

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

**Priority 3 — Replay Season Simulator v2 — UX Overhaul (#39)** · ✅ SHIPPED
Complete replacement of v1 SeasonControls. Commissioners can now step through replay seasons
week-by-week with natural pauses for lineup adjustments. Controls persist on league overview
(sticky footer) and commissioner matchup page (inline panel), eliminating the need to navigate
to a separate admin page. Button set changes based on season state (during week vs between weeks).
Reuses existing `/api/leagues/[leagueId]/season` endpoints; no schema changes.
Shipped June 14, 2026. Spec: `docs/02-engineering/replay-season-simulator-spec.md`.

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

## Sprint 8 — "Beta Hardening" · ~1 wk · Jul 7–13, 2026 · Track V+F · P0/P1

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

## Sprint 9 — "PWHL GM Rebrand" · ~2 wks · Track F · P1/P2

Goal: Execute the planned PWHL Fantasy → PWHL GM rebrand. All strategy, mockups, copy, and implementation checklists are finalized in `docs/branding/`. This sprint ships the identity layer — names, logo, voice consistency, design tokens, and page-level visual upgrades — without touching any product logic.

**Trigger criteria (all must be true before starting):**
- Sprint 8 Beta Hardening complete and beta invites sent
- No P0 bugs open
- Founding commissioners have completed at least one draft
- Team has capacity for a polish sprint

**Sprint capacity:** ~40 points across 8 stories

**P1 — Minimum shippable rebrand (~8 hours, matches `BRANDING-DEFERRED.md` estimate):**

**Priority 1 — REBRAND-001: Core Identity (Name, Logo, Hero)** · 5 pts · P1
`docs/branding/04-implementation-checklist.md` Phase 1. Global "PWHL Fantasy" → "PWHL GM" find-replace across all `.tsx` files; new `components/LogoShield.tsx` shield+GM SVG (purple gradient, white GM text, 32px nav / 512px PWA); `public/favicon.ico` and `public/manifest.json` updated; home page hero rewrite ("Think Like a GM.", management sub-copy, "How it works" steps reframed); hero eyebrow color `--green` → `--accent`.
Files: `app/layout.tsx`, `app/page.tsx`, `public/favicon.ico`, `public/manifest.json`, `components/LogoShield.tsx` (new). Zero logic changes.

**Priority 2 — REBRAND-002: Voice Consistency** · 3 pts · P1
`04-implementation-checklist.md` Phase 2. Welcome flow title/eyebrow/card descriptions; dashboard "Your Franchises"; login pitch copy; admin nav "Admin" → "Front Office"; invite and register page copy.
Files: `components/WelcomeFlow.tsx`, `app/dashboard/page.tsx`, `app/login/page.tsx`, `app/league/[leagueId]/layout.tsx`, `app/register/page.tsx`, `app/invite/[leagueId]/page.tsx`.

**Priority 3 — REBRAND-003: Detail Polish ("Fantasy" Modifiers + Docs)** · 3 pts · P2
`04-implementation-checklist.md` Phase 3. Remove "fantasy pts" from `RosterManager.tsx`; update draft room header to "PWHL GM — Draft Room"; "PWHL Fantasy" strings in `app/leagues/page.tsx`; `CLAUDE.md` and `README.md` product name updates; link `03-terminology-guide.md` from `CLAUDE.md`.
Files: `app/team/[teamId]/roster/RosterManager.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`, `app/league/[leagueId]/roster/page.tsx`, `app/leagues/page.tsx`, `CLAUDE.md`, `README.md`.

**Priority 4 — REBRAND-008: QA Sprint** · 3 pts · P1
Run the manual testing path from `04-implementation-checklist.md` Phase 4 after all P1 PRs merge. Verify: no "PWHL Fantasy" strings in live UI; no "HF" placeholder visible; shield logo in header and favicon; full user journey (home → login → dashboard → draft → matchup → standings → admin); mobile at 390px; `npm test` and `npx tsc --noEmit` pass. Monitor error logs 24h post-deploy.

**P2 — Visual redesign layer (depends on REBRAND-004 token foundation):**

**Priority 5 — REBRAND-004: Design Token System Upgrade** · 5 pts · P2
Extend `app/globals.css` `:root` with the v2 token vocabulary from `docs/branding/pwhl-gm-matchup-mockup-v2.html`: card surface tokens (`--navy-card`, `--navy-card-border`, `--navy-card-hover`), indigo variant palette (`--indigo-dim`, `--indigo-border`, `--indigo-glow`, `--indigo-text`), semantic state dim+border tokens (amber/red/green), position color tokens (`--pos-fwd/def/goal/util`), text scale (`--text-primary/secondary/muted/dim`), shape tokens (`--radius-card`, `--radius-sm`, `--radius-pill`). Add Google Fonts import for Syne (display headings, 700/800) and DM Mono (stats/scores); wire `--font-display` and `--font-mono` vars. Add subtle radial glow to body background; add `backdrop-filter: blur(16px) saturate(1.4)` to site header. All existing tokens remain; no regressions.
Files: `app/globals.css`, `app/layout.tsx` (font import).
Blocks: REBRAND-005, 006, 007.

**Priority 6 — REBRAND-005: Matchup Page Visual Redesign** · 8 pts · P2
Upgrade `app/team/[teamId]/matchup/` to v2 design standard: Syne font on hero score numbers, DM Mono for FP values in stat columns, `--navy-card` surface on all card sections, position color tokens (`--pos-fwd/def/goal/util`) on roster player rows, indigo win-probability bar fill, amber swing-players label, `--radius-card` corners throughout. Analysis tab (`components/AnalysisTab.tsx`): navy-card table rows, amber WEAK highlight uses `--amber-dim`/`--amber-border`. No server or data changes. Visual parity with `docs/branding/mockups/03-my-matchup.html` at 1280px desktop and 390px mobile.
Depends On: REBRAND-004.

**Priority 7 — REBRAND-006: Draft Room Visual Redesign** · 8 pts · P2
Upgrade `app/draft/[leagueId]/DraftRoom.tsx` to mockup standard: DM Mono countdown clock, `--indigo-border` glow ring on current pick cell, position-color coded NeedsPanel slot rows, green/amber concentration fills in `TeamSpreadPanel`, `--navy-card` hover rows in `PlayerPanel`, `--indigo` active position-filter pills. Mobile tabbed layout preserved; visual upgrade only. No WebSocket or logic changes. Visual parity with `docs/branding/mockups/02-draft-room.html` at 1440px desktop.
Depends On: REBRAND-004, REBRAND-001.

**P3 — Secondary pages (lower priority, can defer to Sprint 10):**

**Priority 8 — REBRAND-007: Secondary Pages (Lineup, Roster, Standings, Bracket, Overview)** · 8 pts · P3
Apply v2 visual language to remaining weekly-loop pages. Lineup (`LineupManager.tsx`): selected player `--indigo-border` ring, games-remaining `--indigo-dim` badge, zero-games warning `--amber-dim` background. Roster (`RosterManager.tsx`): DM Mono FP values, `--amber-dim` waiver badge. Standings: user row `--indigo-dim`, clinch `--green-dim`, elim `--red-dim` chips. Bracket: champion card `--indigo-glow`, round labels Syne font. League overview: race table `--navy-card`, commissioner strip `--amber-dim`.
Depends On: REBRAND-004.

**Priority 9 — League History & Hall of Fame (#33 / #18)** · ~50K · P3
Spec: `docs/02-engineering/league-history-spec.md`
Moved from Sprint 7 Priority 1 to end of Sprint 9 — pushed to make room for Trade System
in Sprint 7. New `/league/[leagueId]/history` page walking the `parentLeagueId` chain. Past
season cards: champion, top-4 standings. Hall of Fame section: all past champions + two
all-time records (highest single-week FP, most VP in a season). Nav tab hidden in season 1.
No schema changes. Meaningful only after at least one completed and renewed season; ship the
page skeleton now and let it fill in naturally.

**Sprint 9 Point Totals:**
| Story | Points | Priority | Depends On |
|---|---|---|---|
| REBRAND-001: Core Identity | 5 | P1 | — |
| REBRAND-002: Voice Consistency | 3 | P1 | REBRAND-001 global pass done |
| REBRAND-003: Detail Polish | 3 | P2 | REBRAND-001 |
| REBRAND-008: QA Sprint | 3 | P1 | All P1s merged |
| REBRAND-004: Design Tokens | 5 | P2 | — |
| REBRAND-005: Matchup Page | 8 | P2 | REBRAND-004 |
| REBRAND-006: Draft Room | 8 | P2 | REBRAND-004, REBRAND-001 |
| REBRAND-007: Secondary Pages | 8 | P3 | REBRAND-004 |
| League History & HoF (#33/#18) | ~50K | P3 | Sprint 2 (parentLeagueId chain); Trade System (#7) |
| **Total** | **43 pts + HoF** | — | — |

**Minimum shippable rebrand (P1 stories only):** REBRAND-001 + REBRAND-002 + REBRAND-008 = 11 points · ~8 hours. Ships name, logo, and voice consistency as planned in `BRANDING-DEFERRED.md`. REBRAND-003 (3 pts) is low-risk detail polish that can run same-day. Visual redesign stories (P2/P3) follow as a second pass.

**Dependency order for parallel execution:**
- REBRAND-001, 002, 003 can run in parallel (all copy/text)
- REBRAND-008 runs last (QA after everything merges)
- REBRAND-004 is independent of copy stories; can run in parallel with 001–003
- REBRAND-005, 006, 007 can run in parallel with each other after REBRAND-004 merges

**Exit:** The product is visibly "PWHL GM" across all user-facing surfaces. Shield logo in browser tab. "Think Like a GM." on the home page. "Your Franchises" on the dashboard. "Front Office" in commissioner nav. Matchup and draft room pages match the approved mockups at 1280px desktop and 390px mobile. All tests green. Zero "PWHL Fantasy" strings in the live UI. League History/HoF page skeleton live (fills in after first season renewal).

---

## Backlog / Deferred (no sprint assignment)

Items in this section have been explicitly deprioritized and pulled from the sprint plan.
They are candidates for a future season roadmap, not the current build cycle.

**Note:** Trade System (#7) was moved from this backlog to Sprint 7 (Priority 1) as of June
2026 — it is higher priority than League History/HoF for the upcoming launch period. Team
Analysis trade-suggestion CTA (#25) is now unblocked once Trade System ships.

---

## Post-Sprint-7 Backlog (not planned)

Items below are acknowledged but have no sprint assignment. They become candidates for the
2027-28 off-season roadmap:

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
| Sprint 9 — PWHL GM Rebrand | Planned | 8 stories · 43 pts · P1 name+logo+voice; P2 tokens+page redesigns; P3 secondary pages |
| Sprint 3 — Beta Readiness | ✅ COMPLETE (Jun 13, 2026) | Onboarding ✅, error handling ✅, mobile ✅, NT-001 ✅, draft notifications ✅, transaction history ✅, IA-011 ✅ |
| Sprint 4 — Product Polish | ✅ COMPLETE (Jun 13, 2026) | NT-002 LINEUP_INCOMPLETE ✅ · #01 commissioner dashboard ✅ · #17 rivalries ✅ · VP standings fix ✅ · playoff mode + replay support ✅ |
| Sprint 5 — Validation + Beta Operations | ✅ COMPLETE | Replay gap fix ✅ · sim-to-playoffs ✅ · draft cert ✅ · founder dashboard ✅ · playoff experience UX ✅ · commissioner workflow validation ✅ |
| Sprint 6 — Engagement + Transactions | ✅ COMPLETE | Auto-set lineup ✅ · FA schedule awareness + add & slot ✅ · beta feedback infrastructure ✅ · code audit + all P0/P1 fixes ✅ · team analysis ✅ · waiver priority + processing ✅ |
| Sprint 7 — Retention Layer | ⏳ IN PROGRESS (2/3) | Storylines (#11) ✅ · Replay Sim V2 UX (#39) ✅ · Trade System (#7) · FAAB (#6) deferred to post-launch backlog · #38 DEFERRED · #31 Player Legacy deferred to backlog |
| Sprint 8 — Beta Hardening | ✅ COMPLETE (14/14 done) | P0+P1 audit fixes shipped Jun 20 (ahead of schedule) · 7 beta bug fixes shipped commit b465423: playoff period anchoring, auto-set during playoffs, roster refresh, lineup sort, FA suggestions sim-date fix, bracket default (6→4) |

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
| **Jul 14, 2026** | **Beta invites to founding commissioners** |
| **Sep 1–30, 2026** | Beta feedback cycle: founding commissioners run replay + live test leagues; fix findings |
| **Late Oct 2026** | **PUBLIC LAUNCH** — real leagues draft ~1 week before the opener |
| **Nov 2026** | First live regular season on the platform |

**Risk buffer:** All P0 and P1 audit fixes shipped Jun 20, ahead of the Sprint 8 schedule.
Sprint 8 (Jul 7–13) is now focused on Vercel cron wiring (`CRON_SECRET` env var must be set),
load testing, integration testing, P2 notification gaps, and UX polish. The beta invite date of
Jul 14 remains the target; it is now lower risk given the P0 fixes are already applied.

## Beyond MVP

- **Q4 2026 (in-season):** Waivers → FAAB; engagement surfaces (#25 analysis, #29 performance dashboard, #30 playoff UX) while the first live season runs. Trade System shipped Sprint 7.
- **Off-season — winter/spring 2027:** League History/HoF page ships Sprint 9 skeleton; fills in naturally after first season renewal. Player Legacy (#31) deferred to post-launch backlog — requires at least one completed season to be meaningful; will be a candidate for the 2027-28 roadmap. The schema foundation (parentLeagueId, rulesVersion, scoringVersion) was laid in Sprint 2, so this is purely the product surface. Growth/retention analytics dashboards (AN-002/003) and referral loop. Target: 2027-28 leagues renew in-place and keep their history.
- **2027-28 season:** Advanced formats (keeper, then dynasty), real-time push scoring + push notifications, and player trends. Native apps and AI features (draft assistant, weekly recaps, trade evaluator) remain Phase 5 "future expansion" — revisit once retention metrics justify them.
