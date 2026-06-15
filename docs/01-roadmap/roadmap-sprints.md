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
- **Commissioner workflow validation** — rolled into ongoing Sprint 6 polish.
- **Weekly Performance Dashboard (#29)** — shipped Sprint 6; see below.
- **Beta Feedback Infrastructure** — deferred: cohort small enough for out-of-band channels. Revisit once founding commissioners are active.

**Exit:** commissioner can run a league start-to-finish with no engineering help; founder can monitor platform health without DB access; founding commissioner cohort can be invited. ✅ ACHIEVED

## Sprint 6 — "Engagement + Transactions" · ~2 wks · Track F · P1 ← CURRENT

Goal: Ship the features founding commissioners will notice during the closed beta. All five
items here are read-heavy or isolated new domains — none touch the draft or standings core.

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

**Remaining Sprint 6:**

**Priority 3 — Code Review & Pre-Beta Audit (#37)**
A staff-engineer-level review of the full codebase before beta launch. Focus areas:
architectural issues, duplicate logic, state machine correctness, test gaps, and operational
risks. Output: prioritized findings doc (P0/P1/P2), with P0/P1 issues fixed before the beta
cohort is invited. Findings committed to `docs/04-operations/` or `docs/02-engineering/`.

User story: As the founding engineer, I want a comprehensive code audit before opening the
beta so that we catch architectural issues and operational risks before real users hit them.

Acceptance criteria: audit complete, P0 findings resolved, findings doc committed.

**Priority 4 — Team Analysis & Insights (#25)** · ~85K
Spec: `docs/02-engineering/team-analysis-spec.md`
New "Analysis" tab on the matchup page. Player hot/cold verdicts vs projection baseline;
position-group trend vs league median (last 4 weeks); top 3 FA upgrade suggestions for the
weakest group. All reads on existing data. Trade suggestion CTA deferred until Trade System
(#7) ships.

**Priority 5 — Waiver Priority + Processing (#5)** · ~110K
Spec: `docs/02-engineering/waiver-spec.md`
The fairness layer on top of existing instant add/drop: rolling priority order, 48h waiver
window for dropped players, daily batch processing at 03:00 ET. `WaiverClaim` +
`WaiverPriority` schema tables; `processWaivers()` idempotent service; claim submission +
status UI on the roster page. Commissioner controls reuse existing recovery tools.

**Exit:** founding commissioners can auto-set lineups ✅, see their weekly performance history ✅, add a FA with immediate slot-in flow ✅, submit feedback visible in founder console ✅, code audit complete with P0 findings resolved, and team analysis shipped.

---

## Sprint 7 — "Retention Layer" · ~2 wks · Track F · P2

Goal: Cement the multi-season story before the season ends. These features build on the
schema foundation laid in Sprint 2 (parentLeagueId, rulesVersion, scoringVersion) and the
engagement surfaces from Sprint 6.

**Priority 1 — League History & Hall of Fame (#33 / #18)** · ~50K
Spec: `docs/02-engineering/league-history-spec.md`
New `/league/[leagueId]/history` page walking the `parentLeagueId` chain. Past season cards:
champion, top-4 standings. Hall of Fame section: all past champions + two all-time records
(highest single-week FP, most VP in a season). Nav tab hidden in season 1. No schema changes.

**Priority 2 — League-Wide Matchup Storylines (#11)** · ~50K
Spec: `docs/02-engineering/matchup-storylines-spec.md`
`getLeagueStorylines()` service + `/api/leagues/[leagueId]/storylines` route + `StorylinesCard`
component on the league overview sidebar. Ships: closest matchup, biggest blowout, weekly point
leader, biggest rank climber, top scoring player. No schema changes.

**Priority 3 — FAAB (#6)** · ~80K
Blind-bid acquisition budget layered on top of the Sprint 6 waiver system. Commissioner enables
per league; managers submit sealed bids with claims; highest bid wins ties broken by waiver
priority. Depends on Waiver System (#5) being complete.

**Priority 4 — Player Legacy & Cross-Season Tracking (#31)** · ~95K
`/profile` page with career history (all leagues/seasons, FP totals, championship count). Global
leaderboard ranked by career FP or championship count. Requires at least one completed and
renewed season to be meaningful; ship the page skeleton with single-season data and let it fill
in naturally. `UserCareerStats` cached table is post-season work.

**Priority 5 — Replay Simulation V2 — Accelerated & Scheduled Playback (#38)**
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

**Exit:** founding commissioners can view their league history; the league overview shows weekly
storylines; leagues with active waivers can use FAAB; replay commissioners can run accelerated
simulations with progress visibility. The platform is retention-ready for the 2027-28 off-season
renewal window.

---

## Backlog / Deferred (no sprint assignment)

Items in this section have been explicitly deprioritized and pulled from the sprint plan.
They are candidates for a future season roadmap, not the current build cycle.

**Trade System (#7)** · ~130K · LOWEST PRIORITY — SOMEDAY MAYBE
Spec: `docs/02-engineering/trade-spec.md`
Deprioritized as of June 2026. Trade System is a large, self-contained new domain (~130K
tokens, new `Trade`/`TradeOffer` schema tables, proposal/accept/reject flow, commissioner
review gate, 3 new notification types, full audit log). The beta cohort is small enough that
informal trades can happen out-of-band. Revisit only if founding commissioners surface demand
strong enough to justify the implementation cost before public launch.

Team Analysis trade-suggestion CTA (`#25`) remains deferred as well — it was gated on Trade
System being complete.

---

## Post-Sprint-7 Backlog (not planned)

Items below are acknowledged but have no sprint assignment. They become candidates for the
2027-28 off-season roadmap:

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
| Sprint 3 — Beta Readiness | ✅ COMPLETE (Jun 13, 2026) | Onboarding ✅, error handling ✅, mobile ✅, NT-001 ✅, draft notifications ✅, transaction history ✅, IA-011 ✅ |
| Sprint 4 — Product Polish | ✅ COMPLETE (Jun 13, 2026) | NT-002 LINEUP_INCOMPLETE ✅ · #01 commissioner dashboard ✅ · #17 rivalries ✅ · VP standings fix ✅ · playoff mode + replay support ✅ |
| Sprint 5 — Validation + Beta Operations | ⏳ CURRENT | Replay gap fix ✅ · sim-to-playoffs ✅ · draft cert ✅ · founder dashboard ✅ · playoff experience UX ✅ · commissioner workflow validation + weekly perf dashboard pending |
| Sprint 6 — Engagement + Transactions | ⏳ IN PROGRESS | Auto-set lineup ✅ · FA schedule awareness + add & slot ✅ · beta feedback infrastructure ✅ · code review audit · team analysis · waiver priority |
| Sprint 7 — Retention Layer | ⏳ PLANNED | League history + HoF · storylines · FAAB · player legacy · Replay Sim V2 (#38) |

---

# MVP Launch Timeline & Beyond

**Anchor:** today is June 13, 2026. The PWHL 2026-27 opener is ~Nov 2026, with fantasy drafts
~1 week prior (~late Oct 2026). That real date is the natural public-launch target — MVP must
be drafting-ready before it. Dates below assume ~2-week sprints, solo + Claude. They are
estimates, not commitments.

| Window | Milestone |
|---|---|
| **Jun 12, 2026** | Sprint 0 — alignment P0s closed (roster / VP / playoffs match rules) ✅ |
| **Jun 12, 2026** | Sprint 1 — season simulation + validation suites green ✅ |
| **Jun–Jul 2026** | Sprint 2 — commissioner recovery + platform foundation + analytics ✅ |
| **Jun–Jul 2026** | Sprint 3 — onboarding ✅, error handling ✅, mobile ✅, notifications (draft ✅), IA-011 ✅ COMPLETE |
| **Jun 13, 2026** | NT-002 LINEUP_INCOMPLETE notification shipped (`checkAndEmitScheduledNotifications` on dashboard load) ✅ |
| **Jun 13, 2026** | Sprint 4 — commissioner dashboard gaps ✅, rivalries ✅, playoff mode ✅, VP fix ✅ **COMPLETE** |
| **Late Aug 2026** | Sprint 5 — draft cert, founder dashboard, playoff UX ✅ complete; commissioner workflow validation + weekly perf dashboard pending |
| **Mid–Late Aug 2026** | Sprint 6 — auto-set lineup ✅ · FA schedule awareness ✅ · beta feedback infrastructure ✅ shipped; team analysis, waivers remaining ← current |
| **Early Sep 2026** | **MVP code-complete — all launch gates pass** |
| **Sep – mid Oct 2026** | Closed beta: founding commissioners run replay + small live test leagues; fix findings |
| **Late Oct 2026** | **PUBLIC LAUNCH** — real leagues draft ~1 week before the opener |
| **Nov 2026** | First live regular season on the platform |

**Risk buffer:** if a sprint slips, the Sep–Oct beta window absorbs ~3–4 weeks before the hard
late-Oct draft date. Earliest *credible* MVP code-complete is early Sep 2026; the latest safe
code-complete before public drafts is early Oct 2026.

## Beyond MVP

- **Q4 2026 (in-season):** Waivers → FAAB; engagement surfaces (#25 analysis, #29 performance dashboard, #30 playoff UX) while the first live season runs. Trade System deprioritized — revisit if demand warrants.
- **Off-season — winter/spring 2027:** Multi-Season UX layer — League History views, Hall of Fame, Player Legacy. The schema foundation (parentLeagueId, rulesVersion, scoringVersion) was laid in Sprint 2, so this is purely the product surface. Growth/retention analytics dashboards (AN-002/003) and referral loop. Target: 2027-28 leagues renew in-place and keep their history.
- **2027-28 season:** Advanced formats (keeper, then dynasty), real-time push scoring + push notifications, and player trends. Native apps and AI features (draft assistant, weekly recaps, trade evaluator) remain Phase 5 "future expansion" — revisit once retention metrics justify them.
