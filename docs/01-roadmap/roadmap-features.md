# PWHL Fantasy Features — Phases 0–7

---

## How To Read This Document

This document contains all feature specifications, grouped into phases. Phase 0 is implementation alignment (correctness fixes); Phases 1–7 are feature builds.

For the build queue, sprint plan, and launch timeline, see [roadmap-sprints.md](roadmap-sprints.md).

For a high-level briefing, see [roadmap-index.md](roadmap-index.md).

---

# Phase 0: Implementation Alignment (Launch Blockers)

Goal: the app must behave exactly as the approved v1 rules describe. No feature work should jump ahead of an open P0 here. Full detail: `docs/03-validation/implementation-alignment/audit.md`.

Priority: CRITICAL (P0 items are hard launch blockers)

---

## IA-001. Roster Defaults → 3F / 2D / 1UTIL / 1G / 6 Bench (13)

Status: ✅ DONE

Priority: P0

Canonical roster is now `{ forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 }` = 13 slots, all drafted, no IR default. Updated: league create API, seed-draft, seed-replay, seed-playoff, auto-draft, set-optimal-lineups, replay-week, CLAUDE.md, schema default.

---

## IA-002. Victory Points = Authoritative Standings

Status: ✅ DONE

Priority: P0

`computeVpStandings` is the single authoritative source in all standings surfaces. `scoringMode @default("VP")` in schema. Removed all `isVpMode` / `scoringMode` branching from standings page, standings service, and playoff service. 28 VP unit tests in `tests/vp.test.ts`.

VP model: Win 2 / Tie 1 / Loss 0, plus a weekly bonus of +2 (highest weekly score) /
+1 (second highest) → max 4 VP per week.

---

## IA-003. Simplify Playoff Defaults → 4 teams, no byes, single-week

Status: ✅ DONE

Priority: P0

`lib/playoffs/lifecycle.ts` defaults updated to `teamsInPlayoff: 4, topSeedsWithBye: 0`. Bracket generation bug fixed — now correctly pairs best-vs-worst (1v4, 2v3). Schema default updated. 18 playoff tests verify format. `scripts/simulate-season.ts` runs full Create → Draft → Score → Playoffs → Champion flow.

---

## IA-004. Fantasy Season Ends Before PWHL Playoffs

Status: ✅ DONE

Priority: P0

`validateSeasonBoundary(periods, pwhlPlayoffStartMs)` in `lib/season/lifecycle.ts` checks that
all scoring periods end before the PWHL postseason. Called in `startSeason()` when
`FantasyLeague.pwhlPlayoffStartsAt` is set. `pwhlPlayoffStartsAt` is nullable — blocking is
opt-in until the official date is known for 2026-27. 3 tests in `tests/season-lifecycle.test.ts`.

---

## IA-005 → IA-011 (Product consistency, education, scope control)

- **IA-005** · Recommend 8-team leagues at creation — ✅ DONE ("Recommended" label + green highlight at 8 teams on creation form)
- **IA-006** · VP education UI — ✅ DONE (`components/VpExplainer.tsx` on standings page; inline "?" toggle)
- **IA-007** · Rebalance auto-draft for 3F demand (simulation-tested) — ✅ DONE (Sprint 0)
- **IA-008** · Finalize waiver spec (duration, priority, reset, processing schedule) — Sprint 6 (captured in waiver-spec.md)
- **IA-009** · Finalize VP tiebreakers: VP → matchup wins → H2H → total FP → random draw — Post-Sprint-7 backlog
- **IA-010** · Stat-correction policy (cutoff window, playoff/championship handling) — Post-Sprint-7 backlog
- **IA-011** · Hide advanced non-v1 features (byes, multi-round config, experimental scoring) — ✅ DONE
  Bracket page hides bye text when `topSeedsWithBye === 0`; fixed default 2→0; settings page renders scoring/roster/playoff as human-readable rows (not raw JSON). Checklist: `docs/02-engineering/ia-011-checklist.md`

---

# Phase 1: Beta Completion

Goal: Make the product stable enough for external users.

Priority: CRITICAL

---

## 1. Commissioner Dashboard

Status: Implemented ✅

Sprint: 2–4

The admin panel (`app/league/[leagueId]/admin/`) is the central commissioner interface:
team management, draft setup + auto-draft, replay-aware season controls (advance/score
week, sim-date stepping), announcements, and a setup checklist. Permissions are enforced
via `requireCommissioner`.

Shipped in Sprint 4 (commit eb65449): pause/restart replay shortcut; force-draft-start CTA;
lineup lock override (`POST .../commissioner/unlock-player`); pre-draft settings editor;
all actions write to audit log.

Acceptance Criteria:

- Single dashboard for all commissioner actions ✅
- Permissions enforced ✅
- All four recovery actions available and audit-logged ✅

**Sprint 5/6 validation complete:** async params fixed in 4 commissioner routes (Next.js 15 compat); null-check guard added to undo-transaction to return 503 when `LeagueEvent` schema not pushed; force-move same-slot no-op documented inline; runbook updated with VP Model A values, playoff initialization/advancement UI, season renewal UI path, reconnect backoff, champion banner, replace-manager edge case, and per-tool operational detail. Findings recorded in `docs/02-engineering/commissioner-workflow-validation-plan.md`.

---

## 2. League Onboarding

Status: Implemented ✅

Spec: `docs/onboarding-spec.md`

Four surfaces guide a new user from first login to a drafted league.

- **Welcome flow** — `components/WelcomeFlow.tsx`; shown on `/dashboard` for users with zero teams and no `onboardingCompletedAt`; 3 orientation cards + dismiss.
- **League setup wizard** — `app/create-league/CreateLeagueWizard.tsx`; 6 steps (name → size → schedule/mode → rules confirmation → invite → done); session-auth–aware API; draft date picker; replay shortcut.
- **Manager draft prep guide** — checklist on `app/league/[leagueId]/page.tsx` when `status === 'PRE_DRAFT'` and viewer is not commissioner; VP explainer inline, draft queue link, countdown.
- **Replay explanation** — inline in wizard step 3 when "Replay" is selected.
- **Schema:** `User.onboardingCompletedAt DateTime?`; `POST /api/user/onboarding` sets it (idempotent).

Acceptance Criteria:

- ✅ User can create first league without documentation
- ✅ Replay mode clearly explained
- ✅ 8-team default recommended in wizard
- ✅ Manager checklist visible on league overview before draft

---

## 3. Mobile Optimization

Status: Implemented ✅

Estimated tokens: ~75K

All core pages are now usable on a 390px phone without horizontal scrolling. Touch targets meet 44px minimum. Spec: `docs/02-engineering/mobile-optimization-spec.md`.

**Shipped:**
- **Draft room** — `useIsMobile(900)` hook collapses three-column layout into tabbed Pick/Board/Needs view at ≤900px; secondary stat columns hidden at ≤480px via `stat-secondary` class
- **Touch targets** — `minHeight: 44px` on all Drop/Add (RosterManager), Pick/star/queue/position-filter (DraftRoom), slot cards + Cancel (LineupManager)
- **BottomNav** — `env(safe-area-inset-bottom)` for iPhone 15 home indicator
- **Standings** — `minWidth: 520` → `380`
- **Matchup** — swing player names get ellipsis truncation; hero score font uses `clamp()`

---

## 4. Error Handling

Status: Implemented ✅

Sprint: 3

Estimated tokens: ~65K (many small localized touches across all core pages)

Shipped: `components/ErrorState.tsx`, `EmptyState.tsx`, `LoadingState.tsx`; `loading.tsx` + `error.tsx` for 11 routes; draft room raw-error display fixed; empty-state copy standardised; pre-season standings empty state. Spec: `docs/02-engineering/error-handling-spec.md`.

Acceptance Criteria:

- No uncaught UI errors ✅
- All API failures handled gracefully ✅

---

## 26. League Overview Redesign

Status: Implemented ✅

Sprint: 4

Two-column `.overview-grid` layout. Left column: playoff race table using the shared
`computeRace` from `lib/playoffs/seeding.ts` with clinch / eliminated / bubble / games-back
chips, plus a compact current-week matchup grid below it. Right column: my matchup compact
widget, per-team lineup status widget (`✓ Set` / `⚠ N issues`), and the league activity feed.
Commissioner action strip (amber) surfaces contextual CTAs — draft setup / week ready to
score / regular season complete. Inline `AnnouncementForm` on the overview replaces the
admin-panel-only editing UX.

---

## 27. Roster Page UX Overhaul

Status: Implemented ✅

Sprint: 4

Priority: HIGH

What was built: Sortable table as the default view (FP desc), replacing cards as the
default. Full column set for skaters (GP G A PTS PPP SOG HIT BLK FP) and goalies
(GP W SV% GA SO FP) — HIT, BLK, and GA were previously missing. Team selector
dropdown (`?view=<teamId>`) lets the manager browse any other team's roster read-only
from the same page, with a "← My Team" escape hatch. Nav tab in `TeamNav.tsx` renamed
from "Roster" to "Rosters". Both the roster table and the free-agent table are sortable
by any column.

---

## 28. Lineup Stats Tab: "Matchup Proj" Rename & Default Polish

Status: Implemented ✅

Sprint: 3 (unplanned positive addition)

Priority: MEDIUM

Estimated tokens: ~25K (single component edit — label rename + conditional tab hiding)

Goal: Clean up the stats toggle on the lineup page. We have a "Projected" tab (showing
upcoming-week projected FP) but the label and default behavior can be improved.

Changes:

- Rename "Projected" tab label to "Matchup Proj" to make the intent clearer
  (it projects the *upcoming matchup week*, not just any projection).
- Between weeks, default to "Matchup Proj" tab (already done) and add a brief subtitle
  explaining methodology ("rolling 5-game avg × scheduled games").
- Evaluate removing "This week" tab once "Matchup Proj" is established — it overlaps
  partially with projected and its value drops once a week starts. For now keep it, but
  consider hiding it when between weeks (no active period) since it will always be empty.

Acceptance Criteria ✅:

- ✅ "Projected" tab is labelled "Matchup Proj".
- ✅ Between-weeks: "Matchup Proj" is default and "This week" is hidden (no active period).
- ✅ Label clarity: users understand what the projection represents.

---

## 32. Draft Room: Team Distribution Panel

Status: Implemented ✅

Sprint: 3 (unplanned positive addition)

Priority: MEDIUM

Estimated tokens: ~30K (client-only panel; derived from existing state, no server changes)

What was built: Inline `TeamSpreadPanel` component in `DraftRoom.tsx`. Shows pick count per
PWHL team for the current manager, color-coded neutral (1–2), amber (3), red (4+). The
`playerTeams` ref was added following the `playerNames`/`playerPositions` pattern, seeded
from `initialStats` and updated on each `available` WebSocket broadcast. Panel sits between
NeedsPanel and MyPicks in the right column.

Goal: During the draft, show each manager a live breakdown of how many players they've
drafted per PWHL team, so they can avoid over-concentrating on one team.

Features:

- A panel in the draft room (alongside NeedsPanel / MyPicks) showing the current manager's
  pick count grouped by PWHL team abbreviation.
- Color-code by concentration: 1–2 players neutral, 3 amber, 4+ red.
- Shown for the current manager only (not all managers' distributions).
- Updates live after every pick.

Implementation notes:

- Derived client-side from `myPicks` (already tracked in the draft room) by grouping on
  player's PWHL team. Player → team mapping is in `playerTeams` ref (already maintained).
- No server change needed; pure client computation.

Acceptance Criteria:

- Draft room shows a "Team spread" panel with pick counts per PWHL team.
- High concentration (3+) visually flagged.

---

## 37. Code Review & Pre-Beta Audit

Sprint: 6

Priority: HIGH — pre-beta launch gate

Status: ✅ DONE — findings in `docs/04-operations/pre-beta-audit.md`; all P0 + P1 findings resolved. Go/No-Go: GREEN.

Goal: A staff-engineer-level review of the full codebase before the beta cohort is invited.
The audit should surface architectural issues, duplicate logic, state machine correctness
gaps, test coverage blind spots, and operational risks that are easier to fix now than after
real user data exists.

Focus areas:
- Duplicate or inconsistent logic across the scoring, lineup, draft, and playoff domains
- State machine correctness (draft engine, season lifecycle, playoff bracket advancement)
- API route auth guard coverage — any missing `apiRequireAuth` / `apiRequireCommissioner`
- Test gaps relative to P0 business logic (scoring, VP standings, playoff seeding)
- Operational risks: error paths that could silently corrupt league state; missing indexes;
  foreign-key constraints that block safe recovery from stuck states

Output: a prioritized findings document in `docs/04-operations/` or `docs/02-engineering/`
with P0 / P1 / P2 labels. P0 findings (correctness bugs, data corruption risks, auth gaps)
must be resolved before the beta cohort is invited. P1 findings (architectural improvements,
test gaps) resolved before public launch.

User story: As the founding engineer, I want a comprehensive code audit before opening the
beta so that we catch architectural issues and operational risks before real users hit them.

Acceptance Criteria:

- Audit complete with findings categorized as P0 / P1 / P2
- Findings document committed to `docs/04-operations/` or `docs/02-engineering/`
- All P0 findings resolved and verified before beta invites go out

---

## 40. Beta Hardening

Sprint: 8

Priority: P0/P1 — beta launch gate

Status: ✅ COMPLETE — all P0, P1, and beta bug fixes shipped. Commit b465423 closes the final 7 items.

Goal: Close the gap between "code-complete" and "production-ready for real users." Sprint 8 is a dedicated hardening week. The P0 and P1 findings from the staff-level code audit (Sprint 6's #37) were resolved immediately after Sprint 6 — ahead of the Sprint 8 window.

Verdict from audit: **GO TO BETA** — no showstoppers.

**P0 items — DONE (shipped Jun 20):**

- **P0-1/P0-4 Waiver cron** ✅ — `app/api/cron/process-waivers/route.ts` iterates all `IN_SEASON` leagues; calls `processWaivers()`. `vercel.json` cron entry at `0 8 * * *` (08:00 UTC = 03:00 ET). Auth-gated by `CRON_SECRET` header in production; open in dev via `ALLOW_SEASON_ADVANCE`. Ops: `CRON_SECRET` env var must be set in Vercel.
- **P0-2 Auto-set projection safety** ✅ — projection fetch in `lineup/page.tsx` wrapped in try/catch; `projectionsAvailable: boolean` prop passed to `LineupManager`; Auto-set button disabled with tooltip and "Matchup Proj" tab disabled when unavailable.
- **P0-3 Waiver priority init** ✅ — verified: `lib/draft/server.ts` calls `startSeason()` unconditionally for all leagues. No code change required.

**P1 items — DONE (shipped Jun 20):**

- **P1-A Analysis tab error state** ✅ — `getTeamAnalysis()` failure returns `null`; `AnalysisTab` renders "Analysis data unavailable. Try refreshing." when `null`.
- **P1-B Auto-set between-weeks UX** ✅ — `computeOptimalLineup()` sort in `lib/lineup.ts` falls back to `gamesThisPeriod` when all `projectedFp` are `null`.
- **P1-C Add/Slot capacity validation** ✅ — `components/AddAndSlotModal.tsx` shows "roster is full, drop a player first" and hides slot picker at max roster size.
- **P1-E Waiver cancel confirmation** ✅ — `components/WaiverWirePanel.tsx` two-step inline confirm ("Confirm cancel?" + "Keep").
- **P1-F Analysis scoring settings freshness** ✅ — verified: `lib/services/analysis-service.ts` already fetches fresh `scoringSettings` on every call. No code change required.
- **P1-D Schedule badge timezone** ✅ — resolved as part of Sprint 8 tail polish.

**Beta bug fixes — DONE (commit b465423):**

- **BUG-1 / PLAYOFF-1** ✅ — Anchor playoff periods to last game in replay leagues; fixes scoring periods that ended prematurely in replay mode.
- **BUG-2 / PLAYOFF-2** ✅ — Auto-resolved by BUG-1; no separate code change needed.
- **BUG-3A / PLAYOFF-3** ✅ — Enable auto-set during playoffs; `computeOptimalLineup()` now finds the correct period window during playoff rounds.
- **BUG-4 / ROSTER-1** ✅ — Fix roster refresh after adding FA; `RosterManager.tsx` `handleAdd` now calls `router.refresh()` to reload stats (not `setRoster(data.roster!)` which wiped stats).
- **BUG-5A / LINEUP-1** ✅ — Demote zero-games players in lineup sort; `computeOptimalLineup()` in `lib/lineup.ts` deprioritizes players whose team has zero games remaining in the period.
- **BUG-5B / FA-SUGG-1** ✅ — Fix fa-suggestions with sim-date + games filter; `GET /api/leagues/[leagueId]/fa-suggestions` respects `pwhl_dev_sim_date` cookie and applies correct games-remaining filter.
- **PLAYOFF-BUG-001 / BRACKET-1** ✅ — Fix bracket default 6 → 4; `app/league/[leagueId]/bracket/page.tsx` `teamsInPlayoff ?? 6` corrected to `?? 4`; bracket race banner now shows "4 teams qualify" for default leagues. Resolves the P1 item from PLAYOFF-AUDIT-001 (Sprint 7).

**Test status (Jun 20):** 174/174 tests pass. Zero new TypeScript errors.

**P2 items (address before public launch):**

- **P2-A No cron for `LINEUP_INCOMPLETE` notifications** — the check fires on dashboard page load only, not on a schedule. Real beta users may not visit the dashboard and will miss lineup deadline warnings.
- **P2-B No notification when waiver claim is awarded/denied** — managers have no in-app signal when their claim resolves. Add `WAIVER_CLAIM_AWARDED` / `WAIVER_CLAIM_DENIED` notification types wired from `processWaivers()`.
- **P2-C Analysis queries not indexed for scale** — acceptable post-launch; flag for production monitoring.

**Deferred to operations phase (pre-launch):**

- End-to-end integration test: full season sim with waivers + scoring across multiple leagues simultaneously.
- Vercel cron wiring: confirm `CRON_SECRET` set in Vercel staging; `check-incomplete-lineups` entry added to `vercel.json`; both crons confirmed firing before beta invite.
- Load test: 10+ concurrent leagues drafting/scoring simultaneously.
- P2-A/B notification gaps (can slip to first post-beta fix if time-constrained).

Acceptance Criteria:

- P0-1: ✅ Vercel cron confirmed live; `processWaivers()` runs automatically at 03:00 ET across all IN_SEASON leagues. `CRON_SECRET` env var confirmed set in Vercel before public launch.
- P0-2: ✅ Auto-set button disabled and error state shown when projections are unavailable.
- P1 items A, B, C, D, E, F: ✅ all resolved.
- Beta bug fixes (commit b465423): ✅ all 7 resolved.
- Load test passes: 10+ concurrent leagues draft and score without data corruption. (deferred to ops)
- Integration test: full season with waivers resolves correctly end-to-end. (deferred to ops)

---

## BF-001. Fix False "Duplicate Tab" Eviction in Draft Room

Sprint: 9

Priority: P1 — blocks founding commissioners from entering the draft room

Status: ✅ DONE

Source: Beta feedback submission `cmqn6ppib0037ayqco2pgk62g` (2026-06-21). User reports receiving the "You opened the draft in another tab / Switch to that tab to continue drafting." screen on first load, with no other tabs open.

**Root cause hypothesis:** The server sends close code 4001 when a new WebSocket connection for the same `(leagueId, teamId)` pair evicts an older one. If a prior connection from the same browser session didn't cleanly close before the next navigation (stale socket left in the server's `sockets` map), a fresh page load will evict itself. This can happen on a hard refresh, a router navigation that unmounts and remounts `DraftRoom`, or a mobile browser backgrounding the tab.

**What the code does today:**
- `lib/draft/server.ts:77` closes any existing socket for `(leagueId, teamId)` with code 4001 before registering the new one.
- `hooks/useDraftSocket.ts:100–103`: on close code 4001, `shouldReconnectRef.current = false` and `setEvicted(true)` — rendering the "another tab" screen permanently.
- The reconnect backoff in `onclose` is skipped entirely when evicted.

**Fix options (in order of preference):**
1. On code 4001, wait 500ms and attempt one silent reconnect before showing the eviction screen — if the eviction was self-caused (stale prior socket), the reconnect will succeed and the manager lands normally.
2. Add a session identifier (e.g. `tabId` generated once and stored in `sessionStorage`) to the JOIN message; the server only evicts if the `tabId` differs from the stored one.
3. Show an actionable error: "Having trouble connecting? [Rejoin draft]" link instead of the dead-end "Switch to that tab" message.

The most conservative fix is option 3 (no server change); option 1 is recommended as it handles the false-positive case transparently.

User story: As a manager trying to open the draft room, I want to reach the live draft on first load so that I'm not locked out of my own draft by a stale connection.

Acceptance Criteria:
- AC-001: Opening `/draft/<leagueId>?team=<teamId>` in a fresh browser tab (no other draft tabs open) reaches the draft room, not the eviction screen.
- AC-002: Opening the draft room in a second tab while a first tab is active still shows the eviction screen in the second tab.
- AC-003: Hard-refreshing an existing draft tab reconnects successfully (no eviction screen).
- AC-004: `tsc --noEmit` clean; existing 180 tests still pass.

Effort: Backend S · Frontend S · Testing S

---

## BF-002. Performance Tab Shows "Week 1" When Season Is Already Mid-Season

Sprint: 9

Priority: P1 — misinformation during the live season loop

Status: ✅ DONE

Source: Beta feedback submission `cmqmn2ffl0001rdpgj8tt1c2z` (2026-06-20). User reports: "The Performance tab says it's Week 1, but the badge at the top says Week 11." User also flags the tab name as unclear.

**Two issues in one report:**

**Issue A — Week number mismatch:**
The "Week {weekNumber} of {totalWeeks}" badge in `GMCommandCenter.tsx` (line 55, 170) derives `weekNumber` as `activePeriod?.week || nextPeriod?.week || 1`. The fallback `|| 1` fires when the GM Command Center is rendered in SETUP phase (between weeks, no active period) even if the season is mid-year. The `nextPeriod` prop is passed from `app/league/[leagueId]/sim/page.tsx` — if that prop is incorrectly null or stale, the badge falls back to 1. Separately, the Performance tab itself always shows rows in reverse-chronological order via `weeklyPerf.reverse()` in the service; the first visible row should be the most recent (highest) week, not Week 1.

**Issue B — Tab name clarity:**
User says the tab name "Performance" is not obviously about their fantasy points history. The tab lives at `/team/[teamId]/schedule` (renamed from "PWHL Schedule" to "Performance" in Sprint 6). A more descriptive name like "Season Stats" or "My Season" would reduce confusion. This is a P2 polish item — fix the week number bug first.

User stories:
- As a manager on the Performance tab mid-season, I want the week badge to reflect the current week so I'm not confused about where in the season I am.
- As a manager, I want the nav tab label to clearly describe what the page shows so I don't have to guess.

Acceptance Criteria:
- AC-001: The "Week N of M" badge in the GM Command Center header shows the correct current week number at all phases (SETUP between weeks, ACTIVE mid-week, RECAP after week ends, mid-season).
- AC-002: When `activePeriod` is null (between weeks), the badge shows the last completed week number, not 1.
- AC-003: The Performance tab's week rows are ordered most-recent-first; the first visible row matches the badge.
- AC-004: (P2) Tab label review: confirm whether "Performance" is the clearest option or if "My Season" / "Season Stats" is better; update `TeamNav.tsx` accordingly. Can be deferred to Sprint 9 polish pass.
- AC-005: `tsc --noEmit` clean; 180 tests pass.

Effort: Backend XS · Frontend S · Testing XS

---

# Phase 2: Fantasy Essentials

Goal: Reach feature parity with major fantasy platforms.

Priority: HIGH

---

## 5. Waiver Wire System

Status: ✅ DONE — Sprint 6

Estimated tokens: ~110K (new schema, waiver service, processing job, commissioner UI)

**What shipped:**

- **Schema** — 3 new models: `WaiverEntry` (48h window per player per league), `WaiverClaim` (one row per team claim), `WaiverPriority` (rolling reverse-standings order); `WaiverStatus` enum (`PENDING` / `AWARDED` / `DENIED` / `CANCELLED`); 4 new `EventType` values (`WAIVER_CLAIM_SUBMITTED` / `WAIVER_CLAIM_AWARDED` / `WAIVER_CLAIM_DENIED` / `WAIVER_CLAIM_CANCELLED`); `waiverWindowHours Int @default(48)` on `FantasyLeague`.
- **Service** (`lib/services/waiver-service.ts`) — `initializeWaiverPriority()` (reverse VP-standings order; falls back to reverse draft order pre-season); `enterWaiverWire()` (idempotent upsert; called after every DROP); `getPlayerWaiverStatus()` (checks active waiver window); `submitClaim()` (validates + snapshots priority at submission); `processWaivers()` (idempotent batch processor; awards to lowest-priority-number claimant, moves winner to last, denies all others).
- **API routes** — `GET/POST/DELETE /api/leagues/[leagueId]/waivers` (wire state, submit claim, cancel claim); `POST /api/leagues/[leagueId]/waivers/process` (commissioner-only manual trigger).
- **Modified waiver/drop route** (`app/api/leagues/[leagueId]/waiver/route.ts`) — POST checks waiver status and returns 409 if player is on waivers; DELETE calls `enterWaiverWire()` after dropping.
- **UI** — `components/WaiverWirePanel.tsx`: wire table (player, pos, team, countdown), pending claims with cancel, priority order panel. Integrated as "Waiver Wire" tab in `app/team/[teamId]/roster/RosterManager.tsx`. "On Waivers" badge in free-agent table; redirect toast when blocked.
- **Ops** — `scripts/process-waivers.ts` cron script with `--dry-run` / `--league` flags; "Process Waivers" button in founder console (`app/founder/leagues/[leagueId]/LeagueDetailTabs.tsx`).
- **Season integration** — `startSeason()` in `lib/season/index.ts` now calls `initializeWaiverPriority()`.
- **Transaction feed** — "Waivers" filter tab in `TransactionFeed.tsx`; four new event types enriched in `lib/services/activity.ts`.
- **Tests** — 13 new tests in `tests/waiver.test.ts`; all passing (174 total). Zero new TypeScript errors.

**Scoped out (explicitly deferred):**

- FAAB (Free Agent Acquisition Budget) — that is feature #6, a separate Sprint 7 item.
- Waiver priority customization (static vs. rolling) — defaulting to rolling for now; revisit if commissioners request it.

**Production cron — RESOLVED (Jun 20):**

`app/api/cron/process-waivers/route.ts` ships the production trigger. The handler iterates all
`IN_SEASON` leagues and calls `processWaivers()`. `vercel.json` schedules it at `0 8 * * *`
(08:00 UTC = 03:00 ET daily). Auth-gated by `CRON_SECRET` header in production; open in dev
via `ALLOW_SEASON_ADVANCE`. Ops: `CRON_SECRET` env var must be set in Vercel before public launch.

Acceptance Criteria:

- Players can be claimed ✅ (immediate add/drop)
- Claims process correctly via rolling priority and 48h window ✅
- Replay leagues supported ✅

Dependencies:

- Transaction system ✅

---

## 6. Free Agent Acquisition Budget (FAAB)

Status: Not Implemented — Deferred post-launch (no sprint assignment)

Sprint: Post-launch backlog — deferred from Sprint 7 Priority 3. Not needed before public launch; revisit for the 2027-28 off-season roadmap once commissioners actively request it and the waiver cron is confirmed live and stable in production.

Estimated tokens: ~80K (depends on #5; bidding logic + UI + budget tracking)

Features:

- Blind bidding
- Budget tracking
- Tie-breaking logic

Acceptance Criteria:

- Commissioner can enable FAAB
- Claims resolve automatically

Dependencies:

- Waiver system (#5) — complete
- Waiver cron (P0-1, Sprint 8) — complete. Must be confirmed live and stable before FAAB is enabled in any league. If `processWaivers()` is not running automatically, bids will accumulate without resolution.

---

## 7. Trade System ✅

Status: Complete — Sprint 7

Sprint: 7 — shipped June 2026

Features implemented:

- Multi-player two-team trade proposals with message
- Full state machine: PROPOSED → ACCEPTED → PENDING_REVIEW → EXECUTED (or REJECTED/CANCELLED/COUNTERED/EXPIRED/REVERSED)
- Counter-offer flow (new Trade row linked via `counterOfId`)
- Commissioner veto window (`tradeReviewHours`, `requireCommissionerTradeApproval` on `FantasyLeague`)
- Roster legality enforced at propose AND execute (position eligibility + slot capacity)
- Play-lock parity: players who have played in active scoring period cannot be traded
- Stale deal detection: re-validates at execution — auto-fails with STALE if player no longer on expected team
- Trade deadline: blocked once playoffs begin
- 6 notification types: `TRADE_RECEIVED`, `TRADE_ACCEPTED`, `TRADE_REJECTED`, `TRADE_EXECUTED`, `TRADE_VETOED`, `TRADE_REVIEW_PENDING`
- Analytics: `trade_proposed`, `trade_responded`, `trade_executed`, `trade_vetoed`
- Activity feed: TRADE events emitted for both teams at execution
- Trade Center UI at `/league/[leagueId]/trades` (Incoming / Sent / League History tabs)
- Propose Trade flow at `/league/[leagueId]/trades/new` with live player picker
- Trade detail page with approve/veto/accept/reject/cancel actions
- Trade Settings section in admin panel (review hours, commissioner approval toggle)
- Pending Review list in admin panel for commissioner action
- "Trades" link in league nav
- 22 tests in `tests/trade.test.ts` covering engine validation, state machine, and roster apply

Schema additions:
- `Trade` model with `TradeStatus` enum (9 states)
- `TradeItem` model
- `tradeReviewHours Int @default(24)` on `FantasyLeague`
- `requireCommissionerTradeApproval Boolean @default(false)` on `FantasyLeague`
- 6 new `NotificationType` values

---

## 8. Transaction History

Status: Implemented ✅

Sprint: 3

Estimated tokens: ~55K (standalone; built on existing CT-002 audit log foundation — no schema changes)

Shipped: Paginated API + `/league/[leagueId]/transactions` page with type/team filters, replay guard, infinite scroll.

Features:

- Adds ✅
- Drops ✅
- Trades — pending Trade System (#7)
- Waiver claims ✅

Acceptance Criteria:

- League transaction log available ✅

---

# Phase 3: Matchup & Season Experience

Goal: Increase engagement throughout the season.

Priority: HIGH

Status: Largely Shipped — the team-scoped Matchup page (`/team/[teamId]/matchup`) is now
the primary in-season destination. The items below are remaining polish and new engagement surfaces.

---

## 9. Live Matchup Center

Status: Implemented

Features:

- Top performers ✅ (storyline chip + per-player breakdown)
- Team comparisons ✅ (`DuelHero` / `FieldHero` roster breakdown)
- Position battles — not built as a dedicated view
- Remaining players ✅ ("Playing tonight" + swing players)

Acceptance Criteria:

- Matchups become primary user destination ✅

---

## 10. Win Probability Engine

Status: Implemented

Features:

- Projected scores ✅ (`lib/projections` rolling-average projection)
- Win percentages ✅ (`winProbability` logistic, shown on hero)
- Historical comparison ✅ (season-long rivalry record in 1v1 mode)

Acceptance Criteria:

- Matchups display projected outcomes ✅

Dependencies:

- Statistical modeling layer (basic rolling-average model; richer modeling is future work)

---

## 11. Matchup Storylines

Sprint: 7

Status: ✅ DONE

Per-team storyline chip ("🔥 X is leading your team…") and a weekly recap card are live.
League-wide storylines shipped in Sprint 7: `computeWeeklyStorylines()` + `emitWeeklyStorylines()`
in `lib/services/storyline-service.ts`; `LEAGUE_STORYLINE` event type in `prisma/schema.prisma`;
`components/WeekHighlights.tsx` renders cards on the league overview; storylines emitted after
each week scores via `advanceSeason()` in `lib/season/index.ts` (fire-and-forget); 173-line
test suite in `tests/storyline.test.ts`. Note: the spec called for a standalone
`GET /api/leagues/[leagueId]/storylines` route — storylines are instead fetched server-side
directly in `app/league/[leagueId]/page.tsx` via `leagueEventModel.findMany`, which is
architecturally equivalent and avoids an extra HTTP round trip.

Features:

- Closest matchup ✅ (smallest margin across scored matchups for the week)
- Weekly point leader / high score ✅ (highest single-team score)
- Top scoring player ✅ (player standout — player with most FP from active roster slots)
- League leader highlights ✅ (activity feed + WeekHighlights card on overview)

Acceptance Criteria:

- Automatically generated league insights ✅ (both per-team chip and league-wide WeekHighlights card)

---

## 24. Lineup Management v2

Status: Implemented ✅

Features implemented:

- **Projected FPTS tab** ("Matchup Proj") — rolling 5-game avg FP × scheduled next-period
  games per player, with a starter-total bar and bench-upgrade hint.
- **Between-weeks lineup nudge** — amber banner on the matchup page when
  `activeMatchup.status === "upcoming"`, linking to the lineup page with projected scores.
- **Mobile compact stats** — `.stat-secondary` CSS class hides SOG/HIT/BLK (skaters) and
  SV/GA/SO (goalies) on screens ≤480px, keeping key stats readable.

---

## 35. FA Schedule Awareness + Add & Slot

Sprint: 6

Priority: P1

Status: Implemented ✅

Commit: `6a6b40f`

Goal: Surface games-remaining data on the free-agent panel so managers can make informed add decisions, and streamline slotting a new pickup into the active lineup in one flow.

What shipped:

- **Games-remaining "Wk" badge on FA panel** — each free-agent row in `app/team/[teamId]/roster/page.tsx` and `RosterManager.tsx` shows games left in the current scoring period, powered by the same batch query used by the lineup page. Sortable column in the FA table.
- **AddAndSlotModal** (`components/AddAndSlotModal.tsx`) — after a successful FA add, a modal offers eligible active slots (F/D/G/UTIL) for the new player. Selecting a slot calls `PUT /api/leagues/[leagueId]/lineup`. "Bench for now" dismisses without slotting. Locked FAs skip the modal entirely.
- **Bonus fixes (same commit)** — lineup nudge on matchup page now respects roster settings slot count (no longer hardcoded); lineup alert in `dashboard.ts` checks `gamesPlayedPerTeam` to avoid false positives for players who have already scored.

Acceptance Criteria:

- FA panel shows games-remaining badge per player in the current period ✅
- After adding a FA, manager is offered active slot choices before landing on bench ✅
- Locked FAs skip the slot modal ✅
- Lineup nudge count and dashboard alerts are accurate ✅

---

## 36. Beta Feedback Infrastructure

Sprint: 6

Priority: P1

Status: Implemented ✅

Spec: `docs/02-engineering/beta-feedback-spec.md`

What shipped:

- **Schema** — `FeedbackSubmission` model (`id`, `userId`, `leagueId?`, `type FeedbackType`, `body`, `createdAt`); `FeedbackType` enum (`BUG`, `SUGGESTION`, `OTHER`); `BetaStatus` enum (`NONE`, `INVITED`, `ACCEPTED`, `ACTIVE`, `RENEWED`); `betaStatus BetaStatus @default(NONE)` field on `FantasyLeague` for cohort lifecycle tracking.
- **Feedback Widget** (`components/FeedbackWidget.tsx`) — fixed bottom-right floating button opens a modal with Bug/Suggestion/Other type selector, a textarea for the body, and a submit button. Rendered via `ReactDOM.createPortal` into `document.body` to escape stacking contexts. Mounted in league layout, team layout, and founder layout so it is available on all authenticated surfaces.
- **API routes** — `POST /api/feedback` (auth-gated; validates type + body; writes `FeedbackSubmission` row); `GET /api/founder/feedback` (founder-only; returns last 100 submissions ordered by `createdAt` desc); `PATCH /api/founder/leagues/[leagueId]/beta-status` (founder-only; updates `FantasyLeague.betaStatus`).
- **Founder Console additions** — `app/founder/feedback/page.tsx`: feed table showing all submissions with type chip, user email, league, body, and timestamp. New "Feedback" nav link in `app/founder/layout.tsx`. New "Beta" tab in `app/founder/leagues/[leagueId]/LeagueDetailTabs.tsx` with a `betaStatus` dropdown to manage cohort lifecycle per league.

Acceptance Criteria:

- Founding commissioners can submit feedback from any league or team page ✅
- Feedback type, body, user, and league are captured in the DB ✅
- Founder can view all submissions in the Founder Console ✅
- Founder can track and update each league's beta cohort status ✅

---

## 34. Auto-Set Lineup

Sprint: 6

Priority: P1

Status: Implemented ✅

Estimated tokens: ~60K

Shipped (commits 3e6bbd0, f83468f, 1f06c9a): `computeOptimalLineup()` in `lib/lineup.ts`; "Auto-set" button in `LineupManager.tsx` (purple, disabled when no projections); staged save model (pending changes shown before commit); `beforeunload` guard; playoff period fallback for games-remaining badges during playoffs; `GET /api/leagues/[leagueId]/fa-suggestions` returning top 10 unrostered players by projected FP. Spec: `docs/02-engineering/auto-set-lineup-spec.md`.

Features:

- One-click optimal lineup fill ✅ (greedy algorithm: fill active slots by position priority using projected FP, respecting locks)
- Staged save model ✅ (user reviews diff before persisting)
- FA suggestions panel ✅ (top 10 by projected FP with games-remaining count)
- Playoff period fallback ✅ (uses playoff matchup window when no scoring periods exist)

Acceptance Criteria:

- Auto-set button computes and stages an optimal lineup without saving it ✅
- Locked (period-locked and play-locked) players are not moved ✅
- FA suggestions show top upgrades ranked by projected FP ✅

---

## 25. Team Analysis & Insights Tab

Sprint: 6

Priority: HIGH (trade-suggestion portion gated by Trade System #7)

Status: ✅ DONE

Estimated tokens: ~85K (new page, per-position-group aggregation queries; all reads on existing data)

Goal: add an "Analysis" tab to the matchup dashboard that turns the team's data into
actionable advice.

What shipped:

- **`lib/services/analysis-service.ts`** — `getTeamAnalysis()` with 4 DB queries: computes
  player hot/cold/on-track/new trends (rolling 5-game avg vs season avg), position-group FP
  per week vs league median, and FA upgrade cards for the single weakest position group.
- **`app/api/leagues/[leagueId]/analysis/route.ts`** — GET handler with `apiRequireLeagueMember` auth.
- **`components/MatchupTabs.tsx`** — "use client" tab switcher (Matchup | Analysis); page.tsx
  stays a server component.
- **`components/AnalysisTab.tsx`** — three-section display: Player Trends table, Position Groups
  table with amber "WEAK" highlight, FA Upgrade cards.
- **`app/team/[teamId]/matchup/page.tsx`** (modified) — `getDashboardData` and `getTeamAnalysis`
  run in parallel via `Promise.all`; matchup content wrapped in `<MatchupTabs>`; hero, alerts,
  and replay controls stay always-visible above tabs.

Scoped out (not shipped):

- **Trade suggestions** — deferred until Trade System (#7, Sprint 7) ships.

Acceptance Criteria:

- ✅ Matchup dashboard has an Analysis tab.
- ✅ Position-group trend view shows weekly output vs league baseline.
- ✅ Free-agent recommendations ranked by fit + projection.
- Trade suggestions — deferred (requires Trade System #7).

Dependencies:

- Projections engine (exists) ✅
- Scored matchup / stat history (exists) ✅
- Trade System (#7) — trade-suggestion portion only (deferred)

---

## 29. Weekly Performance Dashboard (Schedule Tab Replacement)

Sprint: 5

Status: ✅ DONE

Priority: MEDIUM

Estimated tokens: ~65K (new page + server-side aggregation; all data exists, no schema changes)

Goal: Replace the current Schedule tab (`/team/[teamId]/schedule`) with a richer
week-over-week performance table — less about upcoming games, more about how teams
and players are trending across the season.

What shipped (commit 5757cc7):

- `lib/services/performance-service.ts` — `getWeeklyPerformance()` reads scored `Matchup` rows for past weeks and calls `computeAllTeamScores` live for the active period; returns per-week FP, rank, wins, losses, ties.
- `app/team/[teamId]/schedule/page.tsx` — overhauled to show full performance history: each completed/active week shows FP total, rank chip (1st / 2nd / Nth of N), VP W-L-T record, and the existing PWHL game schedule below.
- `app/team/[teamId]/TeamNav.tsx` — tab renamed "PWHL Schedule" → "Performance".
- No schema changes.

---

## 30. Playoff Experience UX

Sprint: 5

Priority: HIGH (once playoffs start)

Status: ✅ DONE

Goal: Make the playoff period feel distinct and exciting. The bracket is built; what's
missing is a coherent playoff-mode UI experience.

What shipped (across Sprint 4 + Sprint 5):

- **Bracket as primary navigation** — `/league/[leagueId]/` redirects to `/bracket` when
  `playoffStatus === "IN_PROGRESS"`; bracket is the default landing during active playoffs.
- **Elimination / clinch activity events** — `PLAYOFF_CLINCH`, `PLAYOFF_ELIMINATION`,
  `CHAMPIONSHIP_WON` added to the `EventType` Prisma enum and `LeagueEventType` union in
  `lib/services/activity.ts`; `advance-playoff-round` route emits these events after each round.
- **DuelHero with win probability** — 1v1 playoff matchup hero on the franchise page;
  eliminated-team detection in `getPlayoffDashboardData`.
- **Champion banner** — `ChampionInfo` on `DashboardData`; champion card on matchup page;
  league overview banner when `playoffStatus === "COMPLETE"`.
- **Between-round nudge** — `playoffPending` state on matchup page when between playoff rounds.
- **"View bracket →" link** in `DuelHero`; rich mini bracket summary in league overview.
- **Commissioner action strip playoff awareness** — contextual CTA surfaces on overview.
- TypeScript narrowing fix: `playoffStatus` local const; dead `IN_PROGRESS` branches removed.

Acceptance Criteria: ✅ all met

- Bracket is visually prominent during playoffs; league overview reflects playoff state. ✅
- Champion is celebrated on the overview and team pages. ✅
- Managers are prompted to set lineups between playoff rounds. ✅
- `DuelHero` shows elimination stakes clearly. ✅

---

# Phase 4: Historical Replay Expansion

Goal: Strengthen replay only as far as it serves user testing and dev iteration.

Priority: LOW — replay is a QA/testing tool, not a flagship. Build only the minimum needed
to test the live-season loop; do not invest in replay as a destination product. Items 14
(Alternate History Drafts) and 15 (Replay Analytics) are speculative and should stay
de-prioritized unless they directly unblock testing or a clear user request emerges.

---

## 12. Multi-Season Historical Library

Status: Desired

Support:

- 2024 inaugural season
- 2024-25 season
- 2025-26 season
- Future archived seasons

Acceptance Criteria:

- League creator selects season

---

## 13. Replay Simulation Speed Controls

Status: Partially Implemented ✅ (core controls shipped; see Sprint 5 fixes)

Features:

- Advance day ✅ ("+1 Day →" button in `SeasonControls.tsx`)
- Advance week ✅ ("▶ Score week N" button in `SeasonControls.tsx`)
- Simulate season ✅ ("⏩ Sim to playoffs" button — scores all remaining regular-season weeks in one click; `advanceSeason` already handles multi-week scoring, no API changes needed)
- Gap-week handling ✅ (fixed in Sprint 5: `targetPeriod` now falls back to UPCOMING when no ACTIVE or SCORING_PENDING period exists, so mid-season breaks like the Jan 31→Feb 21 all-star break no longer hide the "Score week N" button)

Acceptance Criteria:

- Commissioners can control pace ✅
- Sim correctly bridges multi-week calendar gaps ✅

---

## 38. Replay Simulation V2 — Accelerated & Scheduled Playback

Sprint: 7

Priority: MEDIUM

Status: Not Implemented

Goal: Enhance the replay experience so commissioners can run faster, more automated
simulations that keep their league engaged. V1 advances one day at a time via the
`ReplayDayBar`. V2 adds speed controls, a jump-to-week shortcut, a progress summary card,
and notification trigger points so managers receive league updates during replay without
the commissioner having to chase them down.

Builds on: `isReplay` / `replayCurrentDate` / `getReplayNow()` / `ReplayDayBar`
(`lib/devTime.ts`, `scripts/seed-replay.ts`, `app/league/[leagueId]/season/SeasonControls.tsx`).

Features:

- **Configurable playback speed** — commissioner can select "advance N days per click" (e.g.
  1 / 3 / 7) or enable an auto-advance timer that scores the next scoring unit on an interval.
  Implemented as a control on the replay day bar; persisted in `FantasyLeague.replaySettings`
  (a JSON field, no schema migration required if embedded in the existing settings column) or
  as a client-side preference cookie.
- **Jump to week N** — a dropdown in the season controls listing all scoring periods by name
  ("Week 1", "Week 2", …). Selecting a target week calls `advanceSeason` with a simulated date
  set past that period's `endsAt`, scoring all intermediate weeks in one operation. Same
  code path as the existing "Sim to playoffs" button; no API changes needed.
- **Replay progress summary card** — a new card in the league overview right sidebar (visible
  when `isReplay === true` and `replayCurrentDate` is set). Shows: current simulated date,
  team's W-L record, standings position, top scorer this replay so far. Derived entirely from
  existing `Matchup` + `StatLine` + `computeVpStandings` data; no schema changes.
- **Notification trigger points** — when the commissioner advances past a scoring period
  boundary, the `advanceSeason` flow (or a new `advanceReplayWeek` wrapper) calls
  `createNotification` for each team owner with a `REPLAY_WEEK_COMPLETE` type (new enum
  value), body "Week N is complete — check your standings!", and a `dedupeKey` of
  `replay-{leagueId}-week-{N}` to prevent duplicates on repeated advances. Uses the existing
  `createNotification` / `NotificationBell` infrastructure.

Implementation notes:

- All data is available without schema changes. The only potential schema addition is a new
  `NotificationType` enum value (`REPLAY_WEEK_COMPLETE`), which requires `npx prisma db push`.
- Speed control can live entirely client-side in `ReplayDayBar` if N-days-per-click is
  implemented as a local preference. Auto-advance on a server timer is out of scope for V2.
- Jump-to-week reuses `advanceSeason` which already handles multi-week gaps; no new API route.
- The progress summary card is a read-only server component; no client-side data fetch needed.

Acceptance Criteria:

- Speed control UI allows advancing N days per click; N is configurable by the commissioner
- "Jump to week N" scores all weeks from the current position to the selected week in one action
- Replay progress summary card shows current date, W-L, standing, and top scorer on the league overview
- At least one notification is sent per manager per scored week, with a dedupeKey preventing duplicates

---

## 39. GM Command Center — Replay Season Simulator Rebuild

Sprint: 7–8

Priority: MEDIUM

Status: ✅ Implemented

Goal: Replace the scattered 3-surface replay simulator (sticky footer, inline panel, admin page) with a single dedicated "GM Command Center" experience modeled on sports franchise games (Madden, Front Office Football). Commissioners progress through explicit phases with one clear action per phase.

Previous v2 (June 14, 2026): Day-by-day and week-by-week buttons on sticky footer + inline panel. Over-engineered, confusing UX.

**Current v3 (June 20, 2026 — Rebuild Complete):**

Route: `/league/[leagueId]/sim` (commissioner-only, 404 for non-commissioners or non-replay leagues)

**5-Phase State Machine (all deterministic):**

1. **PRE_SEASON** — No periods started → "▶ Start Season" button
2. **SETUP** — Active period exists → "⚡ Simulate Week N" button + lineup editor link
3. **RECAP** — Last period scored, next period upcoming (no active) → "▶ Start Week N+1" button + results display
4. **SEASON_COMPLETE** — All periods scored → "▶ Start Playoffs" button
5. **PLAYOFFS** — playoff status IN_PROGRESS → link to bracket view

Phase derivation: Pure function of `SeasonState` on every page load. No extra DB flag needed. RECAP phase emerges naturally after simulation.

**Architecture:**

- `app/league/[leagueId]/sim/page.tsx` — Server page with auth, phase derivation, data fetching
- `components/sim/GMCommandCenter.tsx` — Client phase router + transient loading overlay
- `components/sim/WeekSetup.tsx` — SETUP phase UI (lineup summary, matchup preview, simulate button)
- `components/sim/WeekRecap.tsx` — RECAP phase UI (WIN/LOSS/TIE hero, scores, activity, next week button)
- `components/sim/SeasonComplete.tsx` — SEASON_COMPLETE phase (start playoffs)
- `components/sim/PlayoffsPanel.tsx` — PLAYOFFS phase (link to bracket)
- `app/api/leagues/[leagueId]/sim/route.ts` — POST endpoint with 4 actions:
  - `"simulate"` — score active week, move to RECAP
  - `"advance"` — start next week, move to SETUP
  - `"start"` — start season, move to SETUP
  - `"skip-to-playoffs"` — bypass remaining regular season

**Deleted (v1 + v2 cleanup):**

- `components/ReplayDayBar.tsx` — day-by-day bar in league layout
- `components/ReplaySimulatorControls.tsx` — 574-line sticky footer + inline panel
- `components/DevTimeClear.tsx` — dev cookie clear button
- `app/league/[leagueId]/season/SeasonControls.tsx` — control panel with dev labels
- `app/league/[leagueId]/season/SeasonView.tsx` — client wrapper
- `app/api/leagues/[leagueId]/replay/advance-day/route.ts`
- `app/api/leagues/[leagueId]/replay/restart/route.ts`
- `app/api/leagues/[leagueId]/simulate/route.ts`
- `lib/replay/gameDays.ts`

**Implementation notes:**

- No schema changes; reuses existing `isReplay` and `replayCurrentDate` columns
- API uses `league.replayCurrentDate` (database source of truth) instead of cookie
- All existing tests pass (202 tests); TypeScript strict mode clean
- Spec: `docs/02-engineering/replay-season-simulator-spec.md`
- **Playoff start date fix (June 20, 2026):** Previously calculated from historical Game.startsAt; now correctly derives from actual end time of last regular season matchup week. Ensures playoffs schedule for correct week relative to league's simulated timeline.

Acceptance Criteria:

- ✅ Phase derivation works for all 5 phases
- ✅ PRE_SEASON → SETUP transition on "Start Season"
- ✅ SETUP → RECAP transition on "Simulate Week"
- ✅ RECAP → SETUP transition on "Start Week N+1"
- ✅ SEASON_COMPLETE → PLAYOFFS transition on "Start Playoffs"
- ✅ Non-commissioners see 404 at `/league/[id]/sim`
- ✅ Non-replay leagues see 404 at `/league/[id]/sim`
- ✅ All other pages respect sim date correctly (lineup, matchup, standings, etc.)
- ✅ Full end-to-end flow: Start Season → Simulate weeks → Complete season → Start Playoffs

---

## 14. Alternate History Drafts

Features:

- Historical player pools
- Fantasy redrafts

Example:

"What if Sarah Fillier went 5th overall?"

Acceptance Criteria:

- Historical draft sandbox

---

## 15. Replay Analytics

Features:

- Historical fantasy rankings
- Draft value analysis
- League retrospectives

Acceptance Criteria:

- Replay leagues generate reports

---

# Phase 5: Retention & Community

Goal: Keep users active between seasons.

Priority: MEDIUM

---

## 33. Multi-Season League Architecture (`parentLeagueId`)

Sprint: 2 (schema + renewal); Sprint 9 (history/UX layer — moved from Sprint 7 to make room for Trade System)

Priority: P1 — foundational; unlocks the entire retention layer

Status: Schema + renewal shipped Sprint 2 (MS-001/002/003/004 ✅); history views (Sprint 9)

Spec: `docs/06-architecture/implement-parentleagueid.md` (Story MS-001)

Estimated tokens: ~90K (new `ParentLeague` model + schema migration, renewal service/API,
historical views; touches league creation everywhere)

Goal: separate **league identity** from **league season** so a league persists year over
year. Every seasonal `League` belongs to a `ParentLeague`; renewing creates a new season
linked by `parentLeagueId` instead of a brand-new league.

What it introduces:

- **`ParentLeague`** record (identity, commissioner group, historical continuity) plus
  `League.parentLeagueId` + `seasonYear` / `rulesVersion` / `scoringVersion` (ties to MS-002/003).
- **Renewal flow** — at season completion the commissioner renews: create a new League, copy
  eligible settings, link via `parentLeagueId`, reset seasonal data, re-invite managers.
- **Carry forward:** league name, manager membership (with confirmation), commissioner, rules
  config (editable before draft). **Reset:** standings, VP totals, matchup/playoff results.
  **Historical-only:** draft results.
- **Historical views** on the parent league: seasons list, champions by year, and (future)
  record books (most points, best season, most championships).
- **API:** `GET /api/parent-leagues/:id` (metadata + season list) and
  `POST /api/leagues/:id/renew` (creates the linked next season).

Acceptance criteria (from spec):

- New leagues automatically create a parent league; every league stores `parentLeagueId`.
- Commissioners can renew; renewed leagues stay historically connected.
- Historical seasons are immutable; season standings don't affect future seasons.

Dependencies / unlocks:

- Pairs with MS-002 `rulesVersion` and MS-003 `scoringVersion`.
- Prerequisite for Season Renewal (MS-004, `docs/season-renewal-system.md`), League History
  (MS-005, Sprint 9), League Hall of Fame (#18, Sprint 9), Player Legacy (#31), and Keeper/Dynasty (#19/#20).

---

## 16. League Chat

Features:

- Commissioner announcements
- Team discussion
- Trade negotiations

Acceptance Criteria:

- Real-time messaging

---

## 17. Rivalries

Status: Implemented ✅

Sprint: 4

Season-long head-to-head records computed via `getHeadToHeadRecord` in `lib/playoffs/seeding.ts`.
Rival badge and H2H history view shipped Sprint 4 (commit cbe8374).

Features:

- Head-to-head records ✅
- Rival badge ✅ (most-played opponent, tie-break by W-L record)
- Historical matchups ✅ (last 5 matchups on matchup page: dates, scores, outcomes)

Acceptance Criteria:

- Rival badge visible with season series W-L-T record ✅
- H2H history view on matchup page ✅

---

## 18. League Hall of Fame

Sprint: 9 (combined with #33 — moved from Sprint 7 to Sprint 9 tail to make room for Trade System)

Status: Not Implemented

Features:

- Champions
- Records
- Best seasons

Acceptance Criteria:

- League legacy preserved

---

## 31. Player Legacy & Cross-Season Tracking

Sprint: 7

Priority: MEDIUM

Estimated tokens: ~95K (new /profile page, career aggregation queries, leaderboard; may need cached stats table)

Goal: Give managers a persistent identity and historical record that spans teams, leagues,
and seasons — similar to how Madden tracks coaching legacy across careers.

Features:

- **Personal career dashboard** — `/profile` page showing every league the user has
  participated in, with their team name, final standing, champion indicator, and season FP
  totals.
- **Career stats** — aggregate fantasy scoring totals across all seasons: total FP earned,
  total wins, championship count, best single-week score, best season.
- **Global leaderboard** — rank all users by career FP, championship count, or win% across
  all leagues on the platform.
- **Season-over-season comparison** — chart showing a user's total FP and rank percentile
  across each season they've played.

Implementation notes:

- Career stats are derivable from existing `Matchup` + `FantasyTeam` + `FantasyLeague` data;
  no new schema needed initially. A cached `UserCareerStats` table may be warranted later.
- Global leaderboard requires careful scoping: only count leagues with real play (not
  empty/test leagues); consider a minimum games threshold.
- Ties naturally to retention — managers come back to defend their ranking.

Acceptance Criteria:

- `/profile` shows career history across all leagues and seasons.
- Global leaderboard ranks all users by configurable career metrics.
- Career FP, wins, and championships displayed prominently.

---

# Phase 6: Advanced League Formats

Goal: Increase long-term retention.

Priority: MEDIUM

---

## 19. Keeper Leagues

Features:

- Protected players
- Draft penalties
- Commissioner controls

Acceptance Criteria:

- Carry players between seasons

---

## 20. Dynasty Leagues

Features:

- Multi-year rosters
- Rookie drafts
- Long-term ownership

Acceptance Criteria:

- League persists indefinitely

---

# Phase 7: Live Season Enhancements

Goal: Improve real-time engagement.

Priority: MEDIUM

---

## 21. Live Scoring

Status: Partially Implemented

`components/LiveScoreRefresh.tsx` polls and refreshes active-matchup scores client-side
(~60s). True real-time push (HockeyTech Firebase RTDB WebSockets, per CLAUDE.md) is not
yet wired in.

Features:

- Real-time game updates — polling only (no push yet)
- Fantasy score updates ✅ (recomputed on refresh)

Acceptance Criteria:

- Scores update during games ✅ (via polling; real-time push is the next step)

---

## 22. Push Notifications

Features:

- Goal alerts
- Lineup reminders
- Waiver results
- Trade offers

Acceptance Criteria:

- User-configurable notifications

---

## 23. Player Trends

Features:

- Hot streaks
- Cold streaks
- Breakout candidates

Acceptance Criteria:

- Trends displayed on player pages

---

# Phase 8: Rebranding — PWHL Fantasy → PWHL GM — COMPLETE ✅

Goal: Reposition the product from "fantasy sports" framing to "professional sports management." All 8 stories shipped in Sprint 9. The product is now fully rebranded as PWHL GM.

Priority: P1 (post-MVP; execute before public launch or immediately after, depending on beta feedback)

Strategy: Ship incrementally, not all at once. Copy-and-naming changes first (lowest risk, immediate identity shift), then logo and visual token upgrades, then page-level redesigns. Pages can be upgraded one at a time without blocking each other.

References:
- Brand strategy: `docs/branding/01-branding-brief.md`
- Gap analysis: `docs/branding/02-brand-assessment.md`
- Terminology reference: `docs/branding/03-terminology-guide.md`
- Execution checklist: `docs/branding/04-implementation-checklist.md`
- Mockups: `docs/branding/mockups/01-rebrand-showcase.html`, `02-draft-room.html`, `03-my-matchup.html`
- v2 matchup mockup: `docs/branding/pwhl-gm-matchup-mockup-v2.html`

---

## REBRAND-001. Core Identity — Name, Logo, and Hero

Sprint: 9

Priority: P1

Status: ✅ DONE

Points: 5

Goal: Establish the PWHL GM brand in the highest-visibility surfaces. These are text substitutions and one SVG asset — zero product risk.

What this includes:

- Global product name replace: "PWHL Fantasy" → "PWHL GM" across all `.tsx` files, `app/layout.tsx` `<title>`, meta description, nav header wordmark
- New `components/LogoShield.tsx`: shield + GM SVG (purple gradient fill, white GM text, 32px at nav, scales to 512px); replace "HF" placeholder in `app/layout.tsx` `.site-brand span`
- `public/favicon.ico` and `public/manifest.json` icons updated to shield logo
- Home page hero rewrite in `app/page.tsx`:
  - Eyebrow: "PWHL Fantasy Hockey" → "PWHL General Manager"
  - Headline: "Draft your team. Set your lineup. Win every week." → "Think Like a GM."
  - Sub-copy: management platform framing per `02-brand-assessment.md` §2.3
  - "How it works" steps: "Create League / Draft Players / Set Your Lineup / Win Matchups" → "Form Your League / Scout & Draft / Manage Your Roster / Lead Your Franchise"
  - Hero CTA: "Ready to build your team?" → "Ready to run your franchise?"
- Hero eyebrow color: `--green (#22c55e)` → `--accent (#6366f1)` in `.hero-eyebrow` CSS class

Files: `app/layout.tsx`, `app/page.tsx`, `public/favicon.ico`, `public/manifest.json`, `components/LogoShield.tsx` (new)

Acceptance Criteria:

- Browser tab reads "PWHL GM" on every page
- Shield + GM logo renders at 32px in header, 16px as favicon, without layout shift
- Home page hero displays "Think Like a GM." headline
- Hero eyebrow is indigo, not green
- "How it works" steps use management language
- `npm test` passes — no logic regressions
- Mobile: logo + hero text readable at 390px width

Related Mockups: `docs/branding/mockups/01-rebrand-showcase.html`, `docs/branding/mockups/02-draft-room.html`

---

## REBRAND-002. Voice Consistency — Welcome Flow, Dashboard, Login, Admin Nav

Sprint: 9

Priority: P1

Status: ✅ DONE

Points: 3

Goal: Reinforce the GM/executive framing on the highest-traffic secondary surfaces after the core identity lands. These are copy-only changes — no UI structure changes.

What this includes:

- `components/WelcomeFlow.tsx`: title "Welcome to PWHL Fantasy" → "Welcome to PWHL GM"; eyebrow "Fantasy hockey for the PWHL" → "Think Like a GM."; 3 orientation card descriptions rewritten in management framing (see `04-implementation-checklist.md` Phase 2)
- `app/dashboard/page.tsx`: section header "Your teams" → "Your Franchises"
- `app/login/page.tsx`: left-column pitch copy rewritten per `02-brand-assessment.md` §2.6
- `app/league/[leagueId]/layout.tsx`: admin nav label "Admin" → "Front Office"
- `app/register/page.tsx`: any "PWHL Fantasy" references updated to "PWHL GM"
- `app/invite/[leagueId]/page.tsx`: any "PWHL Fantasy" references updated

Files: `components/WelcomeFlow.tsx`, `app/dashboard/page.tsx`, `app/login/page.tsx`, `app/league/[leagueId]/layout.tsx`, `app/register/page.tsx`, `app/invite/[leagueId]/page.tsx`

Acceptance Criteria:

- New user sees "Welcome to PWHL GM" on first dashboard visit
- Dashboard heading reads "Your Franchises"
- Login page pitch uses management/franchise language
- League nav shows "Front Office" for commissioners (replacing "Admin")
- All "PWHL Fantasy" strings removed from user-visible copy on these pages
- Text does not overflow on 390px mobile at any breakpoint

Depends On: REBRAND-001 (name is already updated globally before voice consistency pass)

Related Mockups: `docs/branding/mockups/01-rebrand-showcase.html`

---

## REBRAND-003. Detail Polish — "Fantasy" Modifier Removal and Docs

Sprint: 9

Priority: P2

Status: ✅ DONE

Points: 3

Goal: Remove remaining "fantasy" modifiers from UI labels and update internal documentation. Lowest-risk items; can run in the same PR as REBRAND-002 or as a follow-up.

What this includes:

- `app/team/[teamId]/roster/RosterManager.tsx`: "fantasy pts" label → "pts"
- `app/league/[leagueId]/roster/page.tsx`: any "fantasy" language in headers/descriptions
- `app/api/leagues/[leagueId]/teams/[teamId]/owner/route.ts`: check for "fantasy" strings in user-facing responses
- `app/draft/[leagueId]/DraftRoom.tsx`: draft room header "PWHL Fantasy Draft" → "PWHL GM — Draft Room" (if present)
- `app/leagues/page.tsx`: any "PWHL Fantasy" references
- `CLAUDE.md` section headers and descriptions: update product name references; add link to `docs/branding/03-terminology-guide.md` as the copy standard for future development
- `README.md`: update product name references
- Verify analytics event metadata does not surface "fantasy" strings to external tools

Files: `app/team/[teamId]/roster/RosterManager.tsx`, `app/league/[leagueId]/roster/page.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`, `app/leagues/page.tsx`, `CLAUDE.md`, `README.md`

Acceptance Criteria:

- No "fantasy pts" label visible anywhere in the live app UI
- Draft room header uses "PWHL GM" branding
- `CLAUDE.md` references "PWHL GM" as product name
- Full test suite passes (`npm test`, `npx tsc --noEmit`)
- Manual QA: full user journey produces zero "PWHL Fantasy" strings on user-visible surfaces

Depends On: REBRAND-001

---

## REBRAND-004. Design Token System Upgrade

Sprint: 9

Priority: P2

Status: ✅ DONE

Points: 5

Goal: Upgrade `app/globals.css` to the richer token vocabulary shown in `pwhl-gm-matchup-mockup-v2.html`. This unlocks consistent card surfaces, typography scale, and subtle background glows across the redesigned pages in REBRAND-005/006/007. Component pages can reference these tokens without one-off inline values.

What this includes:

- Extend `:root` in `app/globals.css` to add the v2 token set:
  - Card surfaces: `--navy-card`, `--navy-card-border`, `--navy-card-hover`
  - Indigo variants: `--indigo`, `--indigo-light`, `--indigo-text`, `--indigo-dim`, `--indigo-border`, `--indigo-glow`
  - Semantic state colors: `--green-dim`, `--green-border`, `--red-dim`, `--red-border`, `--amber-dim`, `--amber-border`
  - Position colors: `--pos-fwd (#60a5fa)`, `--pos-def (#34d399)`, `--pos-goal (#f59e0b)`, `--pos-util (#a78bfa)`
  - Text scale: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-dim`
  - Shape tokens: `--radius-card (20px)`, `--radius-sm (8px)`, `--radius-pill (999px)`
  - Typography: add Google Fonts import for Syne (display headlines, 700/800) and DM Mono (stats/scores); `--font-display`, `--font-mono`, `--font-body` vars
- Body background: add the subtle radial glow from v2 (`rgba(99,102,241,0.07)` ellipse at top, `rgba(6,182,212,0.04)` at bottom-right) — gives the "lit ice surface" feel
- Header: add `backdrop-filter: blur(16px) saturate(1.4)` to `.top-nav` / `.site-header` to match v2 frosted glass effect
- All existing tokens remain in place and aliased — `--accent` stays, now also accessible as `--indigo`. No regressions.
- Wire `--font-display` to the `<h1>` and hero headline elements in `app/page.tsx` and `app/layout.tsx`

Files: `app/globals.css`, `app/layout.tsx` (font import), `app/page.tsx` (headline font)

Acceptance Criteria:

- All new CSS tokens are defined in `:root` and documented with a comment block
- Existing pages load without visual regressions (existing components that don't use new tokens are unaffected)
- Syne font renders on home page hero headline and display headings
- Body background shows the subtle indigo glow at top
- Header has frosted glass blur effect
- Position color tokens render correctly when used in the matchup page roster breakdown (spot-check)
- `npx tsc --noEmit` clean; `npm test` passes

Related Mockups: `docs/branding/pwhl-gm-matchup-mockup-v2.html` (token definitions at top of `<style>` block)

Blocks: REBRAND-005, REBRAND-006, REBRAND-007 (pages reference new tokens)

---

## REBRAND-005. Matchup Page Visual Redesign

Sprint: 9

Priority: P2

Status: ✅ DONE

Points: 8

Goal: Bring the matchup page (`app/team/[teamId]/matchup/`) up to the v2 mockup standard. This is the highest-traffic in-season page — the most important page to redesign after the core identity lands.

What this includes:

- **Score hero (`MatchupHero` / `DuelHero` / `FieldHero`)**: upgrade to v2 card style — `--navy-card` background, `--indigo-border` ring, Syne font for score display, rounded corners at `--radius-card`; win probability bar uses `--indigo` fill with `--navy-card` track
- **Storyline chip**: use pill style with `--indigo-dim` background and `--indigo-text` color; Syne font for player name
- **Playing Tonight section**: player rows use `--navy-card` surface; position tags use `--pos-fwd/def/goal/util` color tokens
- **Swing Players section**: card grid with `--navy-card` background, `--radius-card` corners; "swing" label uses `--amber` token
- **Roster Breakdown**: both-team comparison cards; position column uses color tokens; FP column uses `--font-mono` (DM Mono) for score values
- **Lineup alert strip**: keep red/amber semantic colors; upgrade background to `--red-dim` / `--amber-dim` with matching border tokens
- **Analysis tab** (`components/AnalysisTab.tsx`): upgrade table rows to `--navy-card` style; WEAK highlight uses `--amber-dim` background + `--amber-border`
- **Mobile (≤640px)**: stacked single-column; score hero score values `clamp(32px, 8vw, 52px)`; all touch targets remain ≥44px
- **No server/data changes** — this is purely the visual layer of existing components

Files: `app/team/[teamId]/matchup/page.tsx` (CSS classes), `components/MatchupTabs.tsx`, `components/AnalysisTab.tsx`, any inline styles in matchup-related components

Acceptance Criteria:

- Matchup hero score uses Syne display font at ≥52px on desktop
- Win probability bar uses indigo fill with correct dark track
- Position tags on roster rows use color-coded tokens (blue F, green D, amber G, purple UTIL)
- FP values in stat columns use DM Mono font
- Visual parity with `docs/branding/mockups/03-my-matchup.html` and `docs/branding/pwhl-gm-matchup-mockup-v2.html` at 1280px desktop viewport
- Mobile (390px): hero scores, roster rows, and analysis tab all display without overflow
- `npm test` passes; no TypeScript errors

Depends On: REBRAND-004 (token system)

Related Mockups: `docs/branding/mockups/03-my-matchup.html`, `docs/branding/pwhl-gm-matchup-mockup-v2.html`

---

## REBRAND-006. Draft Room Visual Redesign

Sprint: 9

Priority: P2

Status: ✅ DONE

Points: 8

Goal: Bring the draft room (`app/draft/[leagueId]/`) up to the mockup standard. The draft is the highest-stakes session in the product — it needs to feel polished and professional.

What this includes:

- **Header**: shield logo replaces "HF" (covered by REBRAND-001); draft title centered in header; team name + "On the Clock" chip in accent color; clock uses `--font-mono` (DM Mono) for the countdown number
- **PickBoard grid**: cells use `--navy-card` surface; drafted cells use team color indicator or indigo fill; current pick cell has `--indigo-border` glow ring
- **PlayerPanel** (Available tab): table rows use `--navy-card` on hover; position filter pills use `--navy-card` base, `--indigo` active state; stat column headers use `--text-muted`; FP and stat values use `--font-mono`
- **PlayerPanel** (Queue tab): draggable rows with `--navy-card` surface; pick button uses `--indigo` fill
- **NeedsPanel**: slot rows use position color tokens for the badge; filled slots use `--green-dim` background; 1-remaining uses `--amber-dim`
- **TeamSpreadPanel**: team abbreviation chips color-coded using existing concentration logic; 3-player threshold amber (`--amber`), 4+ red (`--red`)
- **RecentPicks**: picks list uses `--navy-card` rows with DM Mono for pick number; auto-pick gets `--text-muted` styling
- **Mobile (≤900px)**: existing tabbed layout (PickBoard / Available / Queue / Needs) is preserved; upgrade tab bar to use `--indigo` active underline; each tab content uses new card styles
- **No WebSocket or logic changes** — purely visual layer

Files: `app/draft/[leagueId]/DraftRoom.tsx`, `app/draft/[leagueId]/page.tsx` (CSS class updates only), any inline styles in draft room components

Acceptance Criteria:

- Draft clock countdown uses DM Mono font
- PickBoard shows `--indigo-border` glow on current pick cell
- NeedsPanel slot rows color-code by position using token values
- PlayerPanel Available tab: position filter pills have correct active/inactive states
- Visual parity with `docs/branding/mockups/02-draft-room.html` at 1440px desktop viewport
- Mobile (900px): tab bar active state uses `--indigo` underline; all content legible without overflow
- Draft functions identically — WebSocket connection, picks, clock, auto-pick all unaffected
- `npm test` passes; no TypeScript errors

Depends On: REBRAND-004 (token system), REBRAND-001 (logo in header)

Related Mockups: `docs/branding/mockups/02-draft-room.html`

---

## REBRAND-007. Secondary Pages — Lineup, Roster, Standings, Bracket

Sprint: 9

Priority: P3

Status: ✅ DONE

Points: 8

Goal: Apply the v2 visual language to the remaining core pages. These are lower-traffic than the matchup page and draft room but are still part of the weekly loop. Can be executed as a single pass after REBRAND-005 and REBRAND-006 land.

What this includes:

- **Lineup page** (`app/team/[teamId]/lineup/`):
  - `LineupManager.tsx`: active slot cards use `--navy-card` background, `--indigo-border` ring on selected player
  - Bench section uses subtler `--navy-card` with reduced opacity border
  - Lock indicator (🔒) uses `--text-muted`; "Played" badge uses `--green-dim` / `--green-border`
  - Games-remaining badge uses `--indigo-dim` fill with `--indigo-text`
  - Stats toggle tab bar uses `--navy-card` base, `--indigo` active underline (not background fill)
  - Zero-games warning banner: `--amber-dim` background, `--amber-border` border
  - Auto-set button: upgrade to Syne font label "Auto-Set" at 14px; keep purple fill

- **Roster page** (`app/team/[teamId]/roster/`):
  - `RosterManager.tsx`: table rows use `--navy-card-hover` on hover; column headers use `--text-muted`; FP column values use `--font-mono`
  - "On Waivers" badge: `--amber-dim` background
  - Drop/Add buttons: keep existing size; update border-radius to `--radius-sm`
  - WaiverWirePanel: countdown chip uses `--amber` color; awarded claim chip uses `--green-dim`

- **Standings page** (`app/league/[leagueId]/standings/`):
  - Table rows: highlighted user row uses `--indigo-dim` background; clinched row uses `--green-dim`; eliminated row uses `--red-dim`
  - Clinched/eliminated chips use semantic color tokens
  - Column headers: `--font-mono` for numeric columns (VP, FP, W-L-T)

- **Bracket page** (`app/league/[leagueId]/bracket/`):
  - Matchup cards: `--navy-card` background, `--radius-card` corners
  - Champion card: `--indigo-glow` background glow
  - Round labels: Syne font

- **League Overview** (`app/league/[leagueId]/`):
  - Race table: cards use `--navy-card` surface; bubble row uses `--amber-dim` left border accent
  - Compact matchup row: score values use `--font-mono`
  - Commissioner action strip: upgrade to `--amber-dim` background with `--amber-border`

Files: `app/team/[teamId]/lineup/LineupManager.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/league/[leagueId]/standings/page.tsx`, `app/league/[leagueId]/bracket/page.tsx`, `app/league/[leagueId]/page.tsx`, `components/WaiverWirePanel.tsx`

Acceptance Criteria:

- Lineup page: selected player card has indigo border ring; lock indicator visible without competing with card content
- Roster page: FP values in table use DM Mono; "On Waivers" badge is amber-tinted
- Standings: user's own row highlighted in indigo-dim; clinch/elim chips use green/red token colors
- Bracket: champion card has indigo glow; round labels use Syne font
- All pages pass mobile check at 390px: no overflow, touch targets ≥44px
- `npm test` passes; no TypeScript errors; `npx tsc --noEmit` clean

Depends On: REBRAND-004 (token system)
Blocks: None

---

## REBRAND-008. QA Sprint — Full User Journey Verification

Sprint: 9

Priority: P1

Status: ✅ DONE

Points: 3

Goal: Verify no regressions after all rebrand PRs land. Run the manual testing path from `docs/branding/04-implementation-checklist.md` Phase 4, plus automated suite. This is a coordination and validation story, not a development story — one session with a test checklist.

What this includes:

- Execute the 30-minute manual testing path (Phase 4 of `04-implementation-checklist.md`): home → login → welcome flow → dashboard → create league → draft room → matchup → standings → admin panel
- Verify mobile breakpoints: 390px iPhone-class, 768px tablet, 1280px desktop
- Check no "PWHL Fantasy" strings remain visible in the app UI (browser DevTools text search)
- Check no "HF" placeholder logo remains visible
- Verify all tests pass: `npm test`, `npx tsc --noEmit`
- Monitor error logs for 24h post-deploy

Files: No code changes — this is a QA execution story

Acceptance Criteria:

- Full user journey completes without functional regressions
- Zero "PWHL Fantasy" strings visible on any user-facing surface
- Shield + GM logo visible in header and favicon on all pages
- All tests pass; no TypeScript errors
- Zero JS console errors on the critical path pages (home, login, dashboard, draft, matchup)
- Post-deploy monitoring shows no spike in error logs

Depends On: REBRAND-001 through REBRAND-007 all merged

---

# Phase 8b: Visual Design System Application — COMPLETE ✅

Goal: Apply the established PWHL GM design system tokens (from REBRAND-004) site-wide across all remaining pages. Zero logic, API, or schema changes — pure visual layer.

Sprint: 15

---

## DS-001. Homepage Rewrite + Sticky Full-Width Header

Sprint: 15

Priority: P1

Status: ✅ DONE

Points: L

Goal: Complete homepage visual redesign matching the PWHL GM branding mockup, with a sticky full-width header that extends edge-to-edge.

What this includes:

- `app/page.tsx`: complete rewrite with two-column hero (1.05fr/0.95fr), mini matchup preview card, trust strip (Draft/Manage/Compete/Win pillars), 6-card features grid with SVG icon badges, 3-step how-it-works, radial-glow CTA band. All icons as inline JSX SVG — no emoji.
- `app/layout.tsx`: header moved outside `.page-width` container for full-width sticky effect. New `.site-header` / `.site-header-inner` CSS classes.
- `app/globals.css`: `.site-header`, `.site-header-inner`, homepage responsive breakpoints added.

Files: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

Acceptance Criteria:

- AC-001: Homepage renders two-column hero with mini matchup preview card at desktop widths
- AC-002: Header is sticky and spans full browser width (not constrained to `.page-width`)
- AC-003: No emoji icons on any homepage surface — all iconography is inline SVG
- AC-004: Features grid renders 6 cards with SVG icon badges and correct REBRAND-004 color tokens
- AC-005: `tsc --noEmit` clean; no regressions in existing tests

Depends On: REBRAND-004 (design token system)

---

## DS-002. Design Token Sweep: All Remaining Pages

Sprint: 15

Priority: P1

Status: ✅ DONE

Points: M

Goal: Eliminate all remaining old color tokens from Sprint 9 REBRAND that weren't caught in the initial pass — specifically the old green/red win/loss colors and all emoji on UI surfaces.

What this includes:

- Win color: `#34d399` / `rgba(52,211,153,...)` → `#5fa98c` / `rgba(95,169,140,...)` everywhere
- Loss color: `#f87171` / `rgba(248,113,113,...)` → `#d18b7f` / `rgba(209,139,127,...)` everywhere
- All emoji removed from UI surfaces; replaced with SVG icons or colored text chips
- `TransactionFeed`: replaced emoji `TYPE_ICONS` map with `TYPE_META` record of colored text chips

Files: `app/league/[leagueId]/standings/page.tsx`, `components/PlayoffBracket.tsx`, `app/league/[leagueId]/bracket/page.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/league/[leagueId]/transactions/TransactionFeed.tsx`, `app/create-league/CreateLeagueWizard.tsx`, `app/join-league/page.tsx`

Acceptance Criteria:

- AC-001: No `#34d399`, `rgba(52,211,153`, `#f87171`, or `rgba(248,113,113` hex/rgba values remain in any touched file
- AC-002: No emoji characters appear on standings, bracket, roster, transaction, wizard, or join-league surfaces
- AC-003: Win/loss color treatment is visually consistent with `#5fa98c` / `#d18b7f` across all pages
- AC-004: `tsc --noEmit` clean; existing tests pass

Depends On: REBRAND-004 (design token system)

---

## DS-003. League Overview Full Visual Redesign

Sprint: 15

Priority: P1

Status: ✅ DONE

Points: M

Goal: Bring the league overview page and WeekHighlights component fully in line with the REBRAND-004 design system — card surfaces, typography, section labels, and the My Matchup widget.

What this includes:

- `app/league/[leagueId]/page.tsx`:
  - `card` constant: `rgba(255,255,255,0.04)` / `borderRadius:20` → `var(--card)` / `var(--border)` / `borderRadius:16`
  - `sectionTitle` constant removed; replaced with `cardLabel()` helper (section-accent bar + uppercase label) for left-column primary headers and `sideLabel()` for sidebar card headers
  - My Matchup widget: plain card → `linear-gradient(135deg,#1b1346,#121829)` gradient + `font-stats` 40px score + win/loss-colored record text + win-rate progress bar + full-width purple CTA button
  - Activity feed: emoji `ICONS` map → `ACT_META` colored text chips (Add/Drop/Draft/Playoff/Perf/Story)
  - Lineup status chips: `⚠ N issues` → `N issues` (amber), `✓ Set` → `Set` (green `#5fa98c`)
  - Announcement: emoji span removed; label-only header
  - Champion card: `🏆` → inline SVG trophy
  - Playoff bracket header: emoji stripped; plain round label
  - Race chips: `✓ CLINCHED` → `CLINCHED`, `✗ ELIM` → `ELIM`
  - DraftPrepItem: old green tokens → `#5fa98c` / `rgba(95,169,140,...)`
- `components/WeekHighlights.tsx`:
  - Emoji ICONS map removed; section-accent bar header
  - Each card gets colored left-border accent (purple/gold/green by kind)

Files: `app/league/[leagueId]/page.tsx`, `components/WeekHighlights.tsx`

Acceptance Criteria:

- AC-001: League overview card surfaces use `var(--card)` and `var(--border)` tokens, not inline rgba values
- AC-002: My Matchup widget renders gradient card with `font-stats` score and win-rate progress bar
- AC-003: Activity feed uses colored text chips (no emoji) for all event types
- AC-004: WeekHighlights cards render with colored left-border accent by storyline kind
- AC-005: No `🏆`, `📣`, `✓`, `✗`, or other emoji remain on the league overview surface
- AC-006: `tsc --noEmit` clean; existing tests pass

Depends On: DS-002 (token sweep establishes win/loss color conventions)

---

# Technical Priorities

These should be addressed whenever relevant work is occurring.

---

## Audit Logging

Track:

- Draft picks
- Trades
- Waivers
- Commissioner actions

---

## Test Coverage

Priority Areas:

1. Draft engine
2. Replay advancement
3. Matchup scoring
4. Playoff generation

Target:

- 80%+ coverage for business logic

---

## Background Jobs

Move heavy operations into workers.

Candidates:

- Replay advancement
- Waiver processing
- Notifications
- Analytics generation

---

# Sprint 10 Bug Tickets — Beta Feedback (Jun 21, 2026)

Source: `FeedbackSubmission` records from founding commissioner beta cohort.
All bugs logged by the same founding commissioner during replay testing on Jun 21, 2026.

---

## BF-003. Activity Feed Shows Raw "LEAGUE_STORYLINE" Event Type

Sprint: 10

Priority: P0

Status: ✅ DONE — Sprint 10

Summary: The league activity feed on `/league/[leagueId]/` renders the raw string
`"LEAGUE_STORYLINE"` for storyline entries instead of the storyline headline. Root cause:
`getLeagueActivity()` in `lib/services/activity.ts` reads `data.description` as its fallback
before falling back to `e.type`, but `emitWeeklyStorylines()` in
`lib/services/storyline-service.ts` never writes a `description` field — it writes
`{ week, kind, headline, detail, value }`.

Fix options (choose one):
- A (preferred): Add `description: storyline.headline` to the `data` object in
  `emitWeeklyStorylines()`. No change to the activity renderer.
- B: Add a `LEAGUE_STORYLINE` special-case in `getLeagueActivity()` that maps `data.headline`
  → `description`.

Option A is preferred because it co-locates the description with the emitter and keeps the
renderer generic.

Files: `lib/services/storyline-service.ts`

Acceptance Criteria:
- AC-001: After a week scores, the league activity feed shows the storyline headline (e.g.
  "Closest Match: Team A vs Team B — 47.2–46.9") not the string "LEAGUE_STORYLINE".
- AC-002: Existing storyline events already in the DB (with no `description` key) continue
  to render gracefully — fall back to `data.headline` if `data.description` is absent.

---

## BF-004. Lineup Move Returns "UTIL Slot Is Full" When Moving Bench Forward to Empty Forward Seat

Sprint: 10 (fixed Sprint 12)

Priority: P0

Status: ✅ DONE — Sprint 12; refactored seatedActive calculation in `LineupManager.tsx`

Summary: Beta user reports: "my lineup says i need another forward, when i try to move one
off the bench — I get this error 'UTIL SLOT IS FULL (1/1). Move someone out first' but there's
an empty spot on the active side that I should be able to put a player into."

This implies that when a bench Forward is selected and the user clicks on an empty FORWARD
seat, the click handler is either: (a) computing the wrong `targetSlot` value (sending "UTIL"
when the user clicked a FORWARD seat), or (b) the `seatedActive` array in `LineupManager.tsx`
has a slot label mismatch where an empty FORWARD row is labeled as a UTIL row in the rendered
seat data.

Investigation path:
1. In `LineupManager.tsx`, trace how `seatedActive` is constructed from `rosterSettings`.
   Confirm that FORWARD seats come before UTIL in the array so that when iterating for render,
   the FORWARD seats render as FORWARD rows, not UTIL rows.
2. In `moveTo(slot, ...)`, confirm that the `slot` passed in matches the `key={slot-index}`
   of the seat that was clicked.
3. In `validateSlotMove`, confirm the error message correctly identifies which slot is full.

Files: `app/league/[leagueId]/lineup/LineupManager.tsx`, `lib/lineup.ts`,
`app/api/leagues/[leagueId]/lineup/route.ts`

Acceptance Criteria:
- AC-001: A bench Forward can be moved to an empty FORWARD seat without error when the FORWARD
  slot has capacity available.
- AC-002: The UTIL slot validation error only appears when the user attempts to move a player
  to the UTIL slot and it is genuinely full.
- AC-003: The fix is tested with the canonical 3F/2D/1G/1UTIL/6BN roster configuration.

---

## BF-005. Draft Room Shows "Opened in Another Tab" With No Other Tab Open

Sprint: 10

Priority: P1

Status: ✅ DONE — Sprint 10; `reconnectAttemptedAfter4001Ref` ref added in `useDraftSocket.ts`; second 4001 within short window sets `evicted(true)` and stops reconnect loop

Summary: Beta user opened the draft room URL and immediately saw the eviction overlay ("You
opened the draft in another tab. Switch to that tab to continue drafting.") with no other
draft tab open.

Root cause analysis:
- Sprint 9's BF-001 fix added one silent reconnect attempt 500ms after receiving close
  code 4001 from the server.
- However, `setEvicted(true)` is never called anywhere in `useDraftSocket.ts`. The `evicted`
  state remains `false`, so the `EvictedOverlay` at `DraftRoom.tsx:861` cannot render via the
  current code path.
- This means the user is either hitting a cached pre-BF-001 build, or the overlay has a
  different trigger path not yet identified.
- Additionally: the "one reconnect on 4001" logic has a flaw — if the user's stale socket
  fires a reconnect, that reconnect causes the server to evict the active (newly opened) tab's
  socket with another 4001. The active tab's `onclose(4001)` then fires its own reconnect,
  creating a loop. Neither side ever stabilizes as "the winner."

Full fix: Add a `reconnectAttemptedAfter4001Ref` boolean ref. On first 4001, set it true and
attempt one reconnect. On second 4001 (within the same effect lifecycle), call
`setEvicted(true)` and stop reconnecting. This gives the server's last-in-wins policy time to
settle without creating a permanent eviction loop.

Files: `hooks/useDraftSocket.ts`, `app/draft/[leagueId]/DraftRoom.tsx`

Acceptance Criteria:
- AC-001: Opening the draft room in a fresh tab does not show the eviction overlay.
- AC-002: Opening the draft room in a second tab correctly evicts the first tab (which shows
  the overlay) while the second tab remains connected.
- AC-003: Hard refreshing the draft room does not trigger the eviction overlay.

---

## BF-006. Bench Upgrade Hint Recommends Player With Zero Games Remaining

Sprint: 10

Priority: P1

Status: ✅ DONE — Sprint 10; `gamesThisPeriod > 0` guard added to bench upgrade hint in `LineupManager.tsx`

Summary: The starter-total summary bar on the lineup page's "Matchup Proj" view shows
"Consider starting [Player] (X.X proj) over [Starter]" when [Player] has zero games remaining
in the current matchup period. The hint computes the best bench upgrade by finding the bench
player with the highest `projectedFp` — but does not filter out players whose
`gamesThisPeriod === 0`.

Fix: In `LineupManager.tsx`, in the bench upgrade hint computation (approximately lines 536–548),
add a `gamesThisPeriod > 0` guard when finding the best bench candidate. Mirror the same guard
already used in `zeroGameStarters` and `computeOptimalLineup()`.

Files: `app/league/[leagueId]/lineup/LineupManager.tsx` (starter-total bar section)

Acceptance Criteria:
- AC-001: The bench upgrade hint never recommends a player whose `gamesThisPeriod === 0`.
- AC-002: When no bench player has games remaining AND projects higher than the weakest
  starter, the hint does not appear.
- AC-003: The fix does not affect the hint when valid upgrade candidates exist.

---

## BF-007. "Performance" Tab Name Unclear to Beta Users

Sprint: 11

Priority: P2

Status: ✅ DONE — Sprint 11b; tab renamed to "Record" in `TeamNav.tsx`

Summary: Beta user feedback: "I don't like the name of this tab cause it's not really about
performance." The TeamNav tab links to `/team/[teamId]/schedule` but the content is a weekly
FP scorecard and VP record — a historical results view, not a forward-looking performance
analysis. "Performance" was an improvement over the old "PWHL Schedule" but still ambiguous.

Candidate names: "Record", "History", "Scorecard", "Season Log."
Recommended: "Record" — short, unambiguous, communicates W-L outcome tracking. Distinguishes
cleanly from the "Analysis" tab which IS about forward-looking performance insights.

Files: `app/team/[teamId]/TeamNav.tsx`, `app/team/[teamId]/schedule/page.tsx` (page `<h1>`)

Acceptance Criteria:
- AC-001: The tab label in TeamNav reads "Record" (or the approved alternative).
- AC-002: The page `<h1>` is updated to match.
- AC-003: No test hard-codes the old tab name in a way that would break.

---

# UX / Design Polish

Source: `docs/branding/Pass 1 — Design Critic.md` — full-app UX audit conducted June 2026.
Sprint assignments: Sprint 10 (P0/P1 quick wins) and Sprint 11 (P1/P2 polish).

---

## UX-001. Landing Page Trust Copy Position and Weight

Sprint: 10
Priority: P1
Effort: S
Status: ✅ DONE — Sprint 10

As a first-time visitor, I want the trust signals ("Free-to-Play, Pure Strategy") to appear
near the headline so that I'm reassured before I reach the CTA buttons.

Files: `app/page.tsx`

Acceptance Criteria:
- AC-001: Trust copy reads "Free-to-Play, Pure Strategy."
- AC-002: Trust copy renders above or immediately adjacent to the CTA buttons, not below them.
- AC-003: Trust copy font size is ≥ 0.95rem (not fine print).

---

## UX-002. Login/Register Card Dead Zone and Faint Timing Signal

Sprint: 11
Priority: P2
Effort: M
Status: ✅ DONE

As a first-time visitor on the auth page, I want the season timing information to be clearly
visible and the form to start near the top of the card so that I'm not confronted with dead
space or hidden critical information.

Files: `app/login/page.tsx`, `app/register/page.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: Top padding on auth card content area is ≤ 10% of card height.
- AC-002: "Season starts November 2026 · Draft week TBD" (or equivalent) renders as a visible
  chip or badge near the form title, not as a faint footer.

---

## UX-003. Register Page Optional Field Hint Looks Like Validation Error

Sprint: 11
Priority: P2
Effort: S
Status: ✅ DONE

As a new user filling in the registration form, I want the "(optional)" hint on the Display
Name field to appear inline with the label so that I don't mistake it for a form error.

Files: `app/register/page.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: "(optional)" appears as a muted inline modifier within the `<label>` element, not
  as a separate `<p>` below the field.
- AC-002: No existing validation error styling is used for hint text.

---

## UX-004. Nav Auth Indicator Uses Raw Display Name

Sprint: 11
Priority: P2
Effort: S
Status: ✅ DONE

As a logged-in user, I want the nav auth indicator to use a fixed label (e.g., "Account" or
a monogram) so that it can't visually collide with league-specific nav elements that happen
to share my display name.

Files: `app/layout.tsx`

Acceptance Criteria:
- AC-001: The nav auth link label is fixed ("Account" or monogram), never the user's raw display name.
- AC-002: The change does not affect the Logout link behavior.

---

## UX-005. "Front Office" Logo Subtext Behaves Like a Dead Nav Item

Sprint: 11
Priority: P2
Effort: S
Status: ✅ DONE

As a commissioner, I want the "Front Office" subtext in the logo area to either link to
the admin panel or be removed so that it doesn't confuse me into thinking it's a navigation
item.

Files: `components/LogoShield.tsx`, `app/league/[leagueId]/layout.tsx`

Acceptance Criteria:
- AC-001: Either the subtext is removed, or it links to `/league/[leagueId]/admin` for
  commissioners and is hidden for non-commissioners.
- AC-002: No non-commissioner user sees a non-functional "Front Office" link.

---

## UX-006. League Nav Tab Visual Language Differs from Team Nav

Sprint: 11
Priority: P1
Effort: M
Status: ✅ DONE

As a user navigating between league and team pages, I want the navigation tabs to use the
same visual language so that the app feels consistent and I can tell at a glance which page
is active.

Files: `app/league/[leagueId]/layout.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: League nav active tab uses white text + 2px `--accent` bottom border, matching the
  pattern in `app/team/[teamId]/TeamNav.tsx`.
- AC-002: Inactive league nav items use muted gray text (same as team nav inactive state).
- AC-003: No visual difference remains between the league and team nav tab patterns.

---

## UX-007. "Front Office" Commissioner Link Icon Implies Add, Not Settings

Sprint: 11
Priority: P2
Effort: S
Status: ✅ DONE

As a commissioner, I want the nav link to my admin panel to use a settings icon (not ⊕)
and a clear label like "Admin" so that I understand its purpose without clicking.

Files: `app/league/[leagueId]/layout.tsx`

Acceptance Criteria:
- AC-001: The commissioner admin link icon is a settings/gear or briefcase icon, not ⊕.
- AC-002: The label reads "Admin" or "Commissioner Panel."
- AC-003: Non-commissioners do not see the link (already gated; verify unchanged).

---

## UX-008. Commissioner Announcement Form Is Above-the-Fold on League Overview

Sprint: 11
Priority: P1
Effort: S
Status: ✅ DONE

As a league member visiting the overview page, I want to see standings and race context first
so that I get immediate value from the page, not a commissioner tool textarea.

Files: `app/league/[leagueId]/page.tsx`

Acceptance Criteria:
- AC-001: `AnnouncementForm` renders after the playoff race table and matchup sections.
- AC-002: The commissioner can still access and edit the announcement from the overview page.
- AC-003: No existing announcement display behavior changes.

---

## UX-009. Duplicate League Name on Overview Page

Sprint: 11
Priority: P2
Effort: S
Status: ✅ DONE

As a user on the league overview, I want to see the league name once so that the page doesn't
look like a layout mistake.

Files: `app/league/[leagueId]/page.tsx`

Acceptance Criteria:
- AC-001: The league name appears in the layout breadcrumb/header only — the body-level `<h1>`
  league name is removed or replaced with a contextual section label (e.g., "League Overview").

---

## UX-010. "Go to Admin Panel" CTA Visible to Non-Commissioners

Sprint: 10
Priority: P0
Effort: S
Status: ✅ DONE — Sprint 10

As a league member (non-commissioner), I want the standings empty state to not show me a
link to the admin panel so that I'm not sent to a page I can't access.

Files: `app/league/[leagueId]/standings/page.tsx`

Acceptance Criteria:
- AC-001: The "Go to admin panel →" CTA only renders when `user.id === league.commissionerId`.
- AC-002: Non-commissioners see a neutral pre-season empty state with no admin link.

---

## UX-011. Standings Table Headers Appear at Bottom of Bracket Page

Sprint: 10
Priority: P0
Effort: S
Status: ✅ DONE — Sprint 10

As a user on the Bracket/Playoffs page, I want the standings table column headers to appear
at the top so that I can read the table correctly.

Files: `app/league/[leagueId]/bracket/page.tsx`, `components/PlayoffBracket.tsx`

Acceptance Criteria:
- AC-001: "W–L," "PF," and other column headers render above the data rows, not below.
- AC-002: The fix is verified with a dev playoff simulation using the replay simulator.

---

## UX-012. "Regular Season" Badge on Playoffs Page Is Contradictory (Design Backlog)

Sprint: Design Backlog (requires design pass before implementation)
Priority: P2
Effort: L

As a user on the Playoffs / Bracket page, I want the page header to accurately reflect what
phase I'm in so that I'm not confused by competing labels.

Immediate fix (S, can land in Sprint 10 alongside UX-011):
- Move the "Regular Season" badge out of the H1 line into a subtitle row.
- Reword to "Season phase: Regular Season" or replace with "X weeks until playoffs."

Longer-term (L, Design Backlog):
- Evaluate merging the Standings page and Bracket page into a single "Season" page.
  Pre-playoffs state: standings-primary. During playoffs: bracket-primary (matches the
  existing redirect from `/league/[leagueId]/` to `/bracket` when `playoffStatus === IN_PROGRESS`).
  This eliminates the contradiction and reduces top-level nav items by one.

Files: `app/league/[leagueId]/bracket/page.tsx`, `app/league/[leagueId]/standings/page.tsx`,
`app/league/[leagueId]/layout.tsx`

---

## UX-013. Wizard Card Doesn't Fill the Viewport

Sprint: 11
Priority: P3
Effort: S
Status: ✅ DONE

As a new user creating a league, I want the setup wizard to feel anchored and spacious so
that it doesn't look like a broken layout with half the screen empty.

Files: `app/create-league/CreateLeagueWizard.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: Wizard card has `min-height: 60vh` or equivalent so it fills a meaningful portion
  of the viewport without dead space below.

---

## UX-014. Wizard "Next" Button Is Outside the Card Boundary

Sprint: 11
Priority: P1
Effort: M
Status: ✅ DONE

As a user stepping through the league creation wizard, I want the navigation buttons to be
inside the card so that the layout feels intentional and standard.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: "Next →" and "← Back" buttons are visually inside the card container.
- AC-002: Button click behavior is unchanged.

---

## UX-015. Wizard Progress Indicator Is a Hairline Bar with Text Label

Sprint: 11
Priority: P1
Effort: M
Status: ✅ DONE

As a user in the league creation wizard, I want a clear visual progress indicator (numbered
dots or segmented bar) so that I know how many steps remain without counting mentally.

Files: `app/create-league/CreateLeagueWizard.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: Progress indicator is a segmented bar (6 segments) or numbered dot row.
- AC-002: The current step segment/dot is filled with `--accent`.
- AC-003: Completed step segments/dots show a filled or checkmark state.
- AC-004: Progress indicator is visible without scrolling.

---

## UX-016. Pre-Season Empty States Lack Context and Next Actions

Sprint: 11
Priority: P1
Effort: M
Status: ✅ DONE

As a new user exploring the app before the season starts, I want each empty page to explain
what it will show and what I should do next so that I don't think the app is broken.

Files: `app/team/[teamId]/matchup/page.tsx`, `app/league/[leagueId]/standings/page.tsx`,
`app/team/[teamId]/schedule/page.tsx`, `app/team/[teamId]/analysis/page.tsx`

Acceptance Criteria:
- AC-001: Each of the four pages above has a page-specific empty state message (not the
  same generic text).
- AC-002: At least one page-appropriate CTA or link is present on each empty state.
- AC-003: `EmptyState.tsx` `cta` prop is used (not custom one-off markup).

---

## UX-017. Register Page Headline Contradicts "Start Your Franchise" CTA

Sprint: 11
Priority: P1
Effort: S
Status: ✅ DONE

As a first-time visitor who clicks "Start your franchise →" on the landing page, I want the
register page to continue the franchise/management framing so that I'm not confused by
copy that says "Join the league. Pick your team."

Files: `app/register/page.tsx`

Acceptance Criteria:
- AC-001: The register page `<h1>` does not use "Join the league" or "Pick your team" framing.
- AC-002: The headline reads something like "Create your account to get started" or "Join PWHL GM" — consistent with the REBRAND-001/002 voice.
- AC-003: No change to form fields or submit behavior.

---

## UX-018. Lineup Instruction Banner Tells User to Tap Players That Don't Exist

Sprint: 10
Priority: P0
Effort: S

As a user with an empty roster (pre-draft), I want the lineup page to tell me what to do
next so that I'm not instructed to "tap a player to select them" when there are no players.

Files: `app/team/[teamId]/lineup/LineupManager.tsx`

Acceptance Criteria:
- AC-001: When the roster is empty (zero `RosterEntry` rows), the instruction banner is replaced with: "Your roster is empty. Draft players first, then come back to set your lineup." with a link to the league overview or draft room.
- AC-002: The click-to-swap instruction banner only appears when at least one player is on the roster.
- AC-003: Existing interaction behavior is unchanged for users with players on their roster.

---

## UX-019. Free Agent Add Button Appears Pre-Draft With No Context

Sprint: 11
Priority: P1
Effort: S
Status: ✅ DONE

As a pre-draft user on the Roster page, I want to know that free agent adds are not
available until after the draft so that I don't click "Add" and get an unexpected result
or cryptic error.

Files: `app/team/[teamId]/roster/RosterManager.tsx`

Acceptance Criteria:
- AC-001: When `league.status === "PRE_DRAFT"`, the Free Agents tab shows a contextual banner: "Free agent adds open after the draft. Players are added by waiver claim during the season."
- AC-002: During the season (`IN_SEASON`), the banner reads: "Players dropped within 48 hours are on waivers. Others are immediate adds."
- AC-003: Add buttons remain visible (do not hide them); the banner provides context so a mis-click produces an understandable error.

---

## UX-020. "Free Agents" and "Waiver Wire" Tabs Have No Inline Explanation

Sprint: 11
Priority: P2
Effort: S
Status: ✅ DONE

As a first-time user on the Roster page, I want to understand the difference between the
"Free Agents" and "Waiver Wire" tabs so that I know which one to use and why.

Files: `app/team/[teamId]/roster/RosterManager.tsx`

Acceptance Criteria:
- AC-001: "Free Agents" tab has a visible subtitle or inline tooltip: "Players not on any team — immediate add during the season."
- AC-002: "Waiver Wire" tab has a visible subtitle or inline tooltip: "Recently dropped players — claimed by priority order over 48 hours."
- AC-003: Subtitles render without layout overflow at 390px mobile.

---

## UX-021. Dashboard Skeleton Shows Logged-Out Nav During Hydration

Sprint: 11
Priority: P2
Effort: M
Status: ✅ DONE

As a user who just logged in, I want the top nav to show my auth state immediately so
that I'm not briefly shown a "Login" link that makes me wonder if my login worked.

Files: `app/layout.tsx`

Acceptance Criteria:
- AC-001: After a successful login, the top nav never displays "Login" for an authenticated user — not even during the server→client hydration window.
- AC-002: If auth state is truly unknown during render, a neutral placeholder (e.g., a skeleton chip) is shown instead of the unauthenticated "Login" link.
- AC-003: The fix does not affect the actual login/logout flow or redirect behavior.

---

## UX-022. Team Nav "Record" Tab and League Nav "Schedule" Tab Sound Similar

Sprint: Design Backlog
Priority: P3
Effort: S
Status: ✅ DONE — commit 972362d (TeamNav label corrected to "Schedule" matching /schedule URL; resolves naming ambiguity after BF-007 + UX-006 landed)

As a user navigating between league and team pages, I want the tab labels for the matchup
schedule (league-level) and my weekly history (team-level) to be clearly distinct so that
I don't explore the wrong tab first.

Note: BF-007 renames the team-nav tab from "Performance" to "Record," which reduces the
ambiguity. UX-006 (league nav tab alignment) improves visual distinction between nav zones.
This story tracks any residual naming confusion after both of those ship. Defer to Design
Backlog — evaluate after BF-007 and UX-006 land.

Files: `app/team/[teamId]/TeamNav.tsx`, `app/league/[leagueId]/layout.tsx`

Acceptance Criteria:
- AC-001: After BF-007 and UX-006 ship, the team nav "Record" tab and league nav "Schedule" tab are clearly distinct by label, visual zone, and context.
- AC-002: No user in a usability test confuses the two tabs for the same thing.

---

## UX-023. Trade Center Has No Visible CTA to Propose a Trade

Sprint: 10
Priority: P1
Effort: S

As a league member on the Trade Center page, I want a clear "Propose Trade →" button in
the page header so that I can start a trade without hunting for the entry point.

Files: `app/league/[leagueId]/trades/page.tsx`

Acceptance Criteria:
- AC-001: A "Propose Trade →" button (or equivalent) appears prominently in the Trade Center page header.
- AC-002: The button links to `/league/[leagueId]/trades/new`.
- AC-003: The button is visible to all league members (any manager can propose a trade).
- AC-004: The button renders correctly on 390px mobile without overflow.

---

# Design Critique Findings — Pass 3 & 4 (June 2026)

Source: `docs/branding/mockups/Pass34-design-critic.md` — Pass 3 (active-season design critic) and Pass 4 (fantasy newcomer click-through). Twenty net-new issues identified that are not covered by existing Sprint 10/11 tickets.

**Summary:** Three P0 tickets address actively misleading UI that reads like bugs or misattribution to new users (VTF record looks like 0-7 season loss, season record looks like hockey score, 0-0-7 tie display looks broken). Eight P1 tickets add missing labels and education for core UX surfaces (standings tooltips, projection stat labels, button hierarchy, rival prominence). Remaining 12 P2–P3 items are polish and localization deferred to post-launch backlog.

---

## UX-024. VTF Weekly Record Is Unlabeled on the Dashboard Team Card

Sprint: 11
Priority: P0
Effort: S
Status: ✅ DONE — Sprint 11a

Issue: The most prominent number on a struggling manager's dashboard card is a bold red "0-7." To anyone unfamiliar with Victory Points, this reads as a season record (zero wins, seven losses). The label "vs field" appears as secondary text with no tooltip or callout.

User story: As a first-time manager, I want the weekly record on my dashboard card to be clearly labeled as "this week vs the field" so that I don't think I've lost seven games.

Files: `app/dashboard/page.tsx`, `components/TeamMatchupCard.tsx` (or equivalent dashboard card)

Acceptance Criteria:
- AC-001: The W-L record on the dashboard team card includes a visible label: "This week vs field" or equivalent.
- AC-002: On hover (desktop) or tap (mobile), a tooltip explains the VTF format in one sentence.
- AC-003: The label renders without overflow at 390px mobile.

---

## UX-025. Fantasy Season Record Reads as a Hockey Score in the Matchup Hero

Sprint: 11
Priority: P0
Effort: S
Status: ✅ DONE — Sprint 11a

Issue: The matchup hero displays "3-2" (or similar) floating next to the team name with no label. A PWHL fan immediately parses this as a period score, not a fantasy win-loss record. Nothing signals that the number is a season record.

User story: As a PWHL fan on the matchup page, I want my season fantasy record to be clearly labeled as a W-L record so that I don't confuse it with a hockey score.

Files: `app/team/[teamId]/matchup/page.tsx`, `components/FieldHero.tsx`, `components/DuelHero.tsx`

Acceptance Criteria:
- AC-001: The season record in the matchup hero is preceded by a label: "Record: 3-2" or displayed as "3W-2L".
- AC-002: The label is visible at the font size used in the hero card without requiring hover.
- AC-003: The change applies to both DuelHero and FieldHero components.

---

## UX-026. "0-0-7" Tied Display at Week Start Looks Like a Bug

Sprint: 11
Priority: P0
Effort: S
Status: ✅ DONE — Sprint 11a

Issue: At the start of a week before any PWHL games are played, every team has 0 FP, so all VTF matchups show as "tied." The W-L-T display renders "0–0–7". First-time users assume the app is broken when they see the Season tab showing "0–0–7" in the current week row.

User story: As a manager on the Season tab at the start of a new week, I want the current week's record to show "In progress" or "No games yet" so that I don't think the scoring system is broken.

Files: `app/league/[leagueId]/season/page.tsx`, `components/SeasonControls.tsx`

Acceptance Criteria:
- AC-001: When the current week's VTF record is 0-0-N (all ties, no games played yet), the Season tab renders "Week in progress" or "No games yet" instead of "0-0-7".
- AC-002: Once at least one game has been played, the W-L-T display resumes normally.
- AC-003: The fix applies to the Season tab period table and any other surface showing the current-week VTF record.

---

## UX-027. Lineup Page Projection Stats Are Unlabeled (PROJ, PPG, x2)

Sprint: 11
Priority: P1
Effort: S
Status: ✅ DONE — Sprint 11a

Issue: Each player card on the lineup page shows three numbers in a row — "10.8 / 5.4 / x2" — with no labels, tooltips, or explanation. "PROJ" is inferable; "PPG" (points per game) and "x2" (games this week) are opaque without prior fantasy knowledge.

User story: As a first-time manager on the lineup page, I want the projection stat abbreviations to be labeled so that I understand what I'm looking at.

Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

Acceptance Criteria:
- AC-001: Each of the three projection fields has a visible label or tooltip: "Proj FP", "Avg FP/game", "2 games this week".
- AC-002: Labels do not require hover to read on mobile.
- AC-003: The "x2" multiplier notation includes a brief tooltip: "Projected games for this scoring period".

---

## UX-028. "Starters Projected" Total Is Below the Fold on the Lineup Page

Sprint: 11
Priority: P1
Effort: S
Status: ✅ DONE — Sprint 11a

Issue: The "Starters projected: 43.3 pts" summary bar appears at the bottom of the active-slot column, below all player cards. This is the most actionable output of the projection system (does my lineup look competitive?) but requires scrolling to see it.

User story: As a manager reviewing my lineup, I want to see my starters' total projected score at the top of the active column so that I can judge lineup strength at a glance.

Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

Acceptance Criteria:
- AC-001: The starter total summary bar (projected FP + bench upgrade hint) renders above the first active player card, not below the last.
- AC-002: On desktop ≥768px, the summary bar is visible without vertical scrolling.
- AC-003: On mobile 390px, the summary bar is the first element in the active column.

---

## UX-029. Auto-Set and Save Lineup Button Hierarchy Is Inverted

Sprint: 11
Priority: P1
Effort: S
Status: ✅ DONE — Sprint 11a

Issue: "Auto-set" is the large purple primary button. "Save Lineup" is the smaller dark secondary button. But "Auto-set" only stages a suggestion; "Save Lineup" commits changes. The visual hierarchy is backwards.

User story: As a manager who has rearranged my lineup, I want the "Save Lineup" button to be visually primary so that I don't leave without saving my changes.

Files: `app/league/[leagueId]/lineup/LineupManager.tsx`

Acceptance Criteria:
- AC-001: "Save Lineup" uses the primary button style (large, `--accent` fill).
- AC-002: "Auto-set" uses the secondary button style (smaller, outlined, or different weight).
- AC-003: "Auto-set" retains its disabled state when projections are unavailable.
- AC-004: On mobile, both buttons are ≥44px touch targets and reachable without horizontal scrolling.

---

## UX-030. Standings Column Headers Lack Tooltips (MTCH VP, RNK VP, VP)

Sprint: 11
Priority: P1
Effort: M
Status: ✅ DONE — Sprint 11a

Issue: The standings table has eight columns in all-caps abbreviated jargon: VP, W-L-T, MTCH VP, RNK VP, PF, STREAK, GAP. The subheader explains the VP model in one compressed line of small gray text. A new user cannot distinguish "MTCH VP" (matchup win bonus) from "RNK VP" (weekly rank bonus) without reading the rules.

User story: As a new user on the standings page, I want hovering or tapping a column header to explain what that column means so that I can understand the standings without external documentation.

Files: `app/league/[leagueId]/standings/page.tsx`

Acceptance Criteria:
- AC-001: All abbreviated column headers have a tooltip (desktop) or tap-to-expand label (mobile).
- AC-002: "MTCH VP" tooltip: "VP earned from winning your head-to-head matchup this week (+2 VP)".
- AC-003: "RNK VP" tooltip: "VP earned from your weekly fantasy score rank (1st = +2 VP, 2nd = +1 VP)".
- AC-004: "VP" (total) tooltip: "Total Victory Points this season. VP determines playoff seeding".
- AC-005: Tooltips do not obscure adjacent data on 390px mobile.

---

## UX-031. Rival Matchup Is Buried in a Collapsed Accordion

Sprint: 11
Priority: P1
Effort: M
Status: ✅ DONE — Sprint 11a (structural fix: rival callout surfaced in/below matchup hero, collapsed accordion removed; celebration notification NOT included — see UX-045)

Issue: The rivalry feature — the most emotionally resonant moment in the product — is hidden behind a collapsed accordion at the bottom of the matchup page. A manager who wins their rivalry matchup has no celebration moment, no notification, no badge. Winning your rivalry is a high-emotion event rendered as an optional footnote.

User story: As a manager with a season-long rival, I want my rivalry matchup result to be surfaced prominently in or near the matchup hero so that beating my rival feels like a meaningful moment.

Files: `app/team/[teamId]/matchup/page.tsx`, `components/FieldHero.tsx`, `components/DuelHero.tsx`

Acceptance Criteria:
- AC-001: When the user has a defined rival and the current week is a rivalry matchup, a rivalry callout appears in or directly below the matchup hero.
- AC-002: The callout reads: "Your rival this week — you're 2-1 against them this season" (or result-aware: "Last week: beat your rival 48.2–41.7").
- AC-003: The collapsed accordion is removed or replaced with an always-visible inline card.
- AC-004: The "season series" record only displays after at least one completed matchup (show "First meeting" when 0-0-0).

---

## UX-032. "+8.3 EDGE" Label Is Unexplained Jargon in the Matchup Hero

Sprint: 14
Priority: P2
Effort: S
Status: ✅ SHIPPED — commit 972362d (changed "+X edge" to "+X pt edge" in FieldHero projected-lead label)

Issue: "PROJECTED: +8.3 EDGE" appears as the label for a projected FP lead. "Edge" is not standard fantasy sports vocabulary. The label adds confusion without clarity.

User story: As a manager reviewing my matchup, I want the projected lead displayed in plain language.

Files: `components/FieldHero.tsx`, `components/DuelHero.tsx`

Acceptance Criteria:
- AC-001: "EDGE" is replaced with "FP lead" or equivalent: "+8.3 FP lead" or "Leading by 8.3 projected pts".
- AC-002: The change applies to both DuelHero and FieldHero.

---

## UX-033. "NO GAMES YET" Badge Has No Contextual Explanation

Sprint: 14
Priority: P2
Effort: S

Issue: The "NO GAMES YET" badge floats in the matchup hero with no context for whether it means "your players have no games scheduled" (actionable) or "games haven't started today" (timing only).

User story: As a manager seeing the "NO GAMES YET" badge, I want to know whether I have a lineup problem or just a timing issue so that I can decide whether to act.

Files: `components/FieldHero.tsx`, `components/DuelHero.tsx`

Acceptance Criteria:
- AC-001: The badge or adjacent caption distinguishes between "no games scheduled for your players" vs "games scheduled but not started yet".
- AC-002: When timing-based: "Games start at [time]" or "Your players are live tonight".
- AC-003: When zero games scheduled: the lineup alert strip (Z1) fires — hero badge is not the primary signal.

---

## UX-034. Position Badge and Slot Label Are Visually Identical in Playing Tonight

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: In the Playing Tonight section, the roster slot label (e.g., "G") and the player's position (e.g., "G") appear side-by-side with identical styling: "Aerin Frankel G · G BOS" reads as a duplicate or typo.

User story: As a manager scanning Playing Tonight, I want the roster slot and player position to be visually distinct so that I tell them apart at a glance.

Files: `components/RosterStatusWidget.tsx` or equivalent

Acceptance Criteria:
- AC-001: The roster slot uses one visual treatment (badge, pill, or color); the player position uses a different treatment (plain text, italic, or different color).
- AC-002: The two labels do not appear as identical adjacent strings.

---

## UX-035. Game Times Are Hardcoded to Eastern Time

Sprint: Post-launch backlog
Priority: P3
Effort: M

Issue: Game start times display as "12:00 PM EST" everywhere — hardcoded to ET. A user in Vancouver or London has to convert every game time. Low-priority daily friction for non-EST users.

User story: As a user in a non-Eastern timezone, I want game times displayed in my local timezone so that I can see when my players are actually playing.

Files: `app/team/[teamId]/matchup/page.tsx`, `app/team/[teamId]/schedule/page.tsx`, and any other game-time display surfaces

Acceptance Criteria:
- AC-001: Game times are rendered using the user's browser timezone via `Intl.DateTimeFormat` or `date-fns-tz`.
- AC-002: The timezone abbreviation displays alongside the time: "12:00 PM ET" → "9:00 AM PT" for a Pacific user.
- AC-003: No hardcoded "EST" or "ET" strings remain in user-visible game time displays.

---

## UX-036. Roster Stat Column Headers Have No Tooltips for Hockey Newcomers

Sprint: Post-launch backlog
Priority: P2
Effort: M

Issue: The roster table has nine columns (GP, G, A, PTS, PPP, SOG, HIT, BLK, FPTS) with no hover tooltips. Standard hockey abbreviations are invisible to casual PWHL fans. FPTS is not hockey vocabulary at all. A first-time user stops at PTS and misses FPTS entirely.

User story: As a casual PWHL fan on the roster page, I want to hover or tap any stat column header to see its full name.

Files: `app/team/[teamId]/roster/RosterManager.tsx`

Acceptance Criteria:
- AC-001: All nine column headers have tooltip text: "PPP — Power Play Points", "SOG — Shots on Goal", "FPTS — Fantasy Points", etc.
- AC-002: Tooltips are accessible on mobile via tap.
- AC-003: The same tooltip pattern applies to the free-agent table.

---

## UX-037. FPTS Is the Rightmost Column but the Most Important One

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: The natural left-to-right reading order leads through six hockey stats before reaching FPTS — the actual reason a player is on or off the roster. A first-time user stops at PTS and misses FPTS.

User story: As a manager scanning the roster table, I want the Fantasy Points column near the left so that the most relevant number is the first thing I see.

Files: `app/team/[teamId]/roster/RosterManager.tsx`

Acceptance Criteria:
- AC-001: FPTS column appears immediately after GP (second column), not as the last column.
- AC-002: The column order change applies to both the roster table and the free-agent table.
- AC-003: Sort behavior is unchanged — FPTS remains sortable.

---

## UX-038. "WK" Games-Remaining Circles Have No Column Header in the FA List

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: Purple numbered circles (1, 2, 3) in the Free Agents list show games remaining this week. There is no "WK" or "Games" column header above them. The circles are visually distinctive but unlabeled.

User story: As a manager browsing free agents, I want the games-remaining column to have a visible header so that I understand what the circled number means.

Files: `app/team/[teamId]/roster/RosterManager.tsx`

Acceptance Criteria:
- AC-001: The games-remaining column in the FA table has a visible header label: "Wk" or "Games".
- AC-002: A tooltip on the header reads: "Games remaining for this player's PWHL team in the current scoring period".

---

## UX-039. "Claim" vs "Add" Button Distinction Is Unexplained in the FA List

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: Some players show "On Waivers" with a "Claim" button; others show "Add". There is no inline explanation of what happens differently. Existing UX-019 and UX-020 address pre-draft banners and tab subtitles, but the specific "Claim" vs "Add" button distinction remains unexplained within the FA row itself.

User story: As a manager adding a free agent, I want the "Claim" and "Add" buttons to clarify what happens differently so that I understand whether my pickup happens immediately or after a waiting period.

Files: `app/team/[teamId]/roster/RosterManager.tsx`

Acceptance Criteria:
- AC-001: Rows with "Claim" display a one-line tooltip: "On waivers — your claim will be processed in priority order within 48 hours".
- AC-002: Rows with immediate "Add" display no additional note (or a tooltip: "Immediate — added to your roster now").
- AC-003: The distinction is visible without navigating to the Waiver Wire tab.

---

## UX-040. Standings "Games Back" Copy Uses Basketball Idiom

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: The standings banner reads "2.0 games clear of the bubble." "Games back" and "the bubble" are basketball/March Madness vocabulary. These terms mean nothing to someone without heavy sports media consumption.

User story: As a first-time fantasy player reading the standings page, I want the playoff bubble banner to describe my situation in plain language.

Files: `app/league/[leagueId]/standings/page.tsx`

Acceptance Criteria:
- AC-001: "Games back" / "games clear" / "the bubble" phrasing is replaced with VP-based language: "You're 3rd — 2 VP ahead of the cutoff. Top 4 make playoffs".
- AC-002: The banner does not use sport-idiom language without explanation.
- AC-003: The replacement copy is 25 words or fewer.

---

## UX-041. Analysis Tab "vs Median" Numbers Have No Unit Label

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: The Position Groups table shows "+6.3" for Goalie vs median with no unit label. Six-point-three what? FP this week? Per game? Users have to guess.

User story: As a manager reading the Analysis tab, I want the vs-median deltas to include a unit so that I know what the number is measuring.

Files: `app/team/[teamId]/analysis/page.tsx`

Acceptance Criteria:
- AC-001: Each delta displays a unit suffix or column header: "+6.3 FP" or a column header "vs Median (FP this week)".
- AC-002: The unit label is correct for the time window shown.

---

## UX-042. Negative FP Values in Player Trends Have No Explanation

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: The Player Trends table shows negative values (e.g., "-3.5 in Week 2") with no explanation. First-time users assume this is a bug, not intentional scoring behavior.

User story: As a manager seeing a negative FP value, I want a brief explanation of why negative scores are possible so that I don't think there's a bug.

Files: `app/team/[teamId]/analysis/page.tsx`

Acceptance Criteria:
- AC-001: A note near or on hover of the Player Trends table explains: "Some scoring categories can contribute negative points (e.g., goals allowed for goalies)".
- AC-002: The note renders without overflow at 390px mobile.

---

## UX-043. Landing Page "Work the Wire" Jargon Is Opaque to Newcomers

Sprint: Post-launch backlog
Priority: P2
Effort: S

Issue: The landing page "How it works" reads "Build rosters, set lineups, work the wire." "The wire" is waiver-wire jargon — opaque to the PWHL-curious newcomer the landing page recruits.

User story: As a first-time visitor on the landing page, I want the "How it works" steps to use plain language so that I understand what I'm signing up for.

Files: `app/page.tsx`

Acceptance Criteria:
- AC-001: "Work the wire" is replaced with plain language: "Pick up free agents to strengthen your roster" or "Add and drop players during the season".
- AC-002: No other fantasy jargon in the "How it works" list appears without definition.

---

## UX-044. "Season Series: 0-0" Shows Before Any Matchup Has Been Played

Sprint: Post-launch backlog
Priority: P3
Effort: S

Issue: The matchup page displays "0-0 season series" before the two teams have played each other. This creates a false "nothing has happened" signal, especially confusing when the current week IS the matchup.

User story: As a manager during an active rivalry matchup, I want the season series record to show "First meeting this season" or be hidden until a completed result exists.

Files: `app/team/[teamId]/matchup/page.tsx`, `components/DuelHero.tsx`

Acceptance Criteria:
- AC-001: When the H2H record is 0-0-0, the display shows "First meeting this season" or is hidden.
- AC-002: The record appears once at least one completed matchup exists.
- AC-003: Active (in-progress) matchups are not counted in the series record.

---

## UX-045. No Celebration Moment When a Rivalry Matchup Is Won

Sprint: 14
Priority: P2
Effort: M

Issue: Winning a rivalry matchup produces no celebration — no notification, no card, no badge. Defeating your season rival is the most emotionally resonant event in fantasy sports, and the app renders it as a footnote.

User story: As a manager who just beat my season rival, I want a moment of celebration — a notification, a prominent card, or a visual badge — so that the win feels meaningful.

Files: `app/team/[teamId]/matchup/page.tsx`, `lib/services/notification-service.ts`

Acceptance Criteria:
- AC-001: When a rivalry matchup result is final and the user won, a `RIVALRY_WIN` in-app notification is created using the existing `createNotification` infrastructure.
- AC-002: The rivalry result card on the matchup page uses a distinct visual treatment (e.g., amber or green border, "Rivalry Win" chip) when the user won.
- AC-003: The notification includes the rival's name and score: "You beat [Rival] 48.2–41.7 this week".

Note: Requires extending `NotificationType` enum with `RIVALRY_WIN`. Schema delta: `npx prisma db push` to add the enum value. See `lib/services/notification-service.ts` for the call site pattern.

---

# Onboarding & First-Run UX (Pass 5 Design Critique)

Source: `docs/branding/pass5-design-critic.md` — first-time user walkthrough of the league-creation flow, June 2026. Thirteen friction points identified; ten result in new stories (three others are already covered by prior UX tickets or deferred).

**Coverage notes before reading stories below:**
- Critique #10 (Display name "(optional)" in label) is covered by UX-003 ✅ DONE.
- Critique #12 (login pitch "8 teams" count) → OB-007 below.
- Critique #13 (draft date picker anchor) → OB-011 below.

---

## OB-001. "Start Your Franchise" CTA Routes to /login Instead of /register

Sprint: 13

Priority: P0

Effort: S

As a first-time visitor who clicks "Start your franchise →" on the landing page, I want to land on /register (not /login) so that I reach the account creation form directly instead of having to find the "Don't have an account? Create one →" small link.

Issue: `app/page.tsx` links "Start your franchise →" to `/login?returnTo=/create-league`. First-timers don't have an account — the login page is the wrong destination. They should land on `/register?returnTo=/create-league`.

Files: `app/page.tsx`

Acceptance Criteria:
- AC-001: "Start your franchise →" button on the landing page links to `/register?returnTo=/create-league`.
- AC-002: Logged-in users clicking this CTA are redirected directly to `/create-league` (existing behavior for authenticated users is preserved).
- AC-003: The `/login` page still accepts `returnTo=/create-league` for returning users who navigate to it directly.

---

## OB-002. Wizard Step 4 Introduces VP Without Explaining It

Sprint: 13

Priority: P0

Effort: S

Status: ✅ SHIPPED — Sprint 18; `VpExplainer` component added inline to VP row (both replay + live paths); UTIL relabeled to "UTIL (any skater: F or D)"; custom `vpOpen` toggle removed.

As a first-time user on the rules-confirmation step of the league wizard, I want a brief explanation of Victory Points and UTIL so that I understand what I'm agreeing to before I commit.

Issue: Step 4 of the wizard shows "Victory Points — win your matchup AND be a top scorer each week" and "3 F · 2 D · 1 UTIL · 1 G · 6 Bench = 13 slots" with no tooltips or expansion. The `VpExplainer` component exists in `components/VpExplainer.tsx` but only appears on the standings page — first-time users see VP here first, in the wizard, with no context. UTIL is unexplained for new fantasy players.

Files: `app/create-league/CreateLeagueWizard.tsx`, `components/VpExplainer.tsx`

Acceptance Criteria:
- AC-001: Step 4 renders the `VpExplainer` component inline (collapsed by default, expandable) so users can read the VP scoring rules before confirming.
- AC-002: A tooltip or inline note explains "UTIL — any skater (F or D)" adjacent to the roster slot display.
- AC-003: The expansion does not require navigating away from the wizard step.
- AC-004: The `VpExplainer` in the wizard is the same component as on the standings page — no divergence in content.

---

## OB-003. Wizard Does Not Warn That Step 5 (Team Creation) Is Coming

Sprint: 13

Priority: P0

Effort: S

Status: ✅ SHIPPED — Sprint 18; "Next up" callout updated to "Next, you'll name your own team before inviting others." and moved above the scoring toggle for visibility.

As a new commissioner stepping through the league setup wizard, I want to know that creating a team for myself is part of the flow so that I'm not surprised when a "Create your team" step appears after I thought I was done.

Issue: The wizard's step 4 button says "Create league →". After clicking it, a new step appears: "Create your team." The progress bar already shows the user at step 4 of 6, so the new step feels unannounced. The wizard never mentions that the commissioner must also create a personal team. This produces a "surprise screen" feel.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: Step 4 (rules confirmation) includes a visible note: "Next, you'll name your own team before inviting others."
- AC-002: The progress bar segment count accounts for the team-creation step — either add a 7th visible segment for it, or relabel step 4 as "Step 4 of 7" and step 5 as "Step 5 of 7."
- AC-003: The step change does not alter any form field behavior or API call timing.

---

## OB-004. Canceling Mid-Wizard After League Is Created Silently Orphans It

Sprint: 13

Priority: P0

Effort: M

Status: ✅ SHIPPED — Sprint 18; `window.confirm()` dialog message updated to spec copy; fires correctly when `createdLeagueId && !createdTeamId`.

As a new commissioner who changes their mind mid-wizard, I want to be warned that canceling after step 4 will leave a real (but unfinished) league in my account so that I don't accumulate orphaned leagues or get confused later.

Issue: The wizard's "Cancel" link navigates to `/dashboard` at any point. But the league is created when the user transitions from step 4 to step 5 (the `POST /api/leagues/create` call). If the user cancels after that point, a real `FantasyLeague` row exists in the DB with no team, no members, and no draft date. The dashboard will show this orphaned league. There is no "are you sure?" prompt and no cleanup.

Files: `app/create-league/CreateLeagueWizard.tsx`, optionally `app/api/leagues/[leagueId]/route.ts` (DELETE)

Acceptance Criteria:
- AC-001: If the user has completed step 4 and clicks "Cancel", a confirm dialog appears: "Your league was created. Canceling will leave it in your account without a team or members. You can finish setup later from your dashboard. Continue anyway?"
- AC-002: "Continue anyway" navigates to `/dashboard`; "Stay" dismisses the dialog.
- AC-003: The dialog does not appear before step 4 (before the league is created in the DB).
- AC-004: The confirm dialog is implemented as a `window.confirm()` or an inline modal — not a separate page navigation.

---

## OB-005. QuickDraftJoinForm Is on the Public Home Page

Sprint: 13

Priority: P1

Effort: S

Status: OPEN — carried into Sprint 18 Track B

As a first-time visitor on the landing page, I want the homepage to explain the product and invite me to start — not ask me for League IDs and Team IDs I don't have.

Issue: `app/page.tsx` renders a `QuickDraftJoinForm` (or equivalent) in the "Running a league?" section that asks for League ID and Team ID directly. First-time visitors have no idea what these are. This is a power-user tool sitting in the main marketing flow.

Files: `app/page.tsx`

Acceptance Criteria:
- AC-001: The QuickDraftJoinForm (or the section containing it) is removed from the public home page.
- AC-002: If the join-via-ID functionality is needed, it is moved behind auth (e.g., to the dashboard or admin panel).
- AC-003: The home page CTA structure is simplified: "Start your franchise →" and "Join a league →" are the only primary actions.

---

## OB-006. Replay Mode Description Only Appears After Clicking the Option

Sprint: 13

Priority: P1

Effort: S

Status: OPEN — carried into Sprint 18 Track B

As a first-time user on step 3 of the league wizard, I want to see the Replay mode description before clicking on it so that I can make an informed choice between "Live" and "Replay."

Issue: In `CreateLeagueWizard.tsx`, step 3 shows two options: "Live (2026-27 season)" and "Replay (2025-26 season)." The amber explanation box describing what Replay mode does only appears after the user clicks the Replay option. A curious user might click to explore, only to find themselves unexpectedly committed to that path. The description should be visible upfront.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: A one-line description of Replay mode is visible below the "Replay" option label before the user clicks it: "Play through a completed 2025-26 season — great for testing before your live league drafts."
- AC-002: The fuller amber explanation still appears after selecting Replay; the one-liner is an additional upfront hint, not a replacement.
- AC-003: Live mode also has a one-line description: "Draft real PWHL players and compete during the 2026-27 season."

---

## OB-007. Login Page Pitch Says "All 8 Teams" When There Are 12

Sprint: 13

Priority: P1

Effort: S

Status: OPEN — carried into Sprint 18 Track B

As a PWHL fan visiting the login page, I want the player count and team count in the pitch copy to be accurate so that I trust the app's data.

Issue: The login page left-column pitch reads "Real PWHL players — Every skater and goalie from all 8 teams." The 2026-27 season has 12 teams (4 expansion teams were added: Detroit, Hamilton, Las Vegas, San Jose). This stale copy erodes trust with informed PWHL fans.

Files: `app/login/page.tsx`

Acceptance Criteria:
- AC-001: The copy reads "all 12 teams" (or equivalent), not "all 8 teams."
- AC-002: Any other season-specific claim in the login pitch is reviewed for accuracy at the same time.
- AC-003: No change to form fields or login behavior.

---

## OB-008. Registration Form Has Redundant "Confirm Password" Field

Sprint: 13

Priority: P1

Effort: S

As a new user registering for PWHL GM, I want a single password field with a show/hide toggle so that I'm not slowed down by a redundant confirmation step that provides no real security benefit.

Issue: `app/register/page.tsx` has four fields: Email, Display name, Password, Confirm password. The "confirm password" pattern is an outdated UX convention. A single password field with a visibility toggle (eye icon) is the modern standard (used by Shopify, Stripe, most 2024+ auth flows). The redundant field adds friction without safety benefit — the user can just toggle the field visible if they want to verify.

Files: `app/register/page.tsx`

Acceptance Criteria:
- AC-001: The registration form has three fields: Email, Display name (optional), Password.
- AC-002: The Password field has a show/hide toggle (eye icon) on the right side of the input.
- AC-003: Server-side validation is unchanged; client-side "passwords must match" logic is removed.
- AC-004: The tab order and mobile keyboard behavior remain correct after removing the confirm field.

---

## OB-009. Wizard Rules Step Shows No Fantasy Point Values

Sprint: 13

Priority: P1

Effort: S

Status: OPEN — carried into Sprint 18 Track B

As a first-time user confirming league rules in step 4 of the wizard, I want to see at least one concrete example of how points are scored (e.g., "Goal = 2 pts") so that I understand the scoring engine before I commit to a league.

Issue: Step 4 shows the roster format and standings format but never explains how fantasy points are earned. A new user has no way to evaluate "should I draft a forward or a defender?" without knowing the relative point value. The scoring details exist in `league-rules-v1.md` and in the `scoringSettings` JSON but are never surfaced to users at signup.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: Step 4 shows a compact scoring table or chip row with at least the top-5 scoring categories: "Goal 2 pts · Assist 1.5 pts · Win (G) 5 pts · PPP 1 pt · Shutout (G) 3 pts."
- AC-002: The values shown match the league's actual `scoringSettings` defaults, not hardcoded copy.
- AC-003: A "Full scoring rules →" link points to `/league/[leagueId]/admin` or a modal with the complete scoring table — but the compact view is visible without clicking.

---

## OB-010. Wizard Progress Bar Is Misleading for Replay Users

Sprint: 14

Priority: P1

Effort: M

As a commissioner creating a Replay league, I want the wizard's step counter and progress bar to reflect my actual path so that the numbers make sense as I step through the flow.

Issue: Replay users skip step 4 (rules) and the wizard jumps from step 3 to step 5. The 6-segment progress bar fills a segment for the skipped step, making the bar's filled state inconsistent with the user's actual progression. A user going name → size → season → (skipped rules) → team → invite sees segment 4 of 6 filled when they expected step 3 of 5.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: For Replay leagues, the progress bar shows 5 segments (skipping the rules step) and the counter reads "Step N of 5."
- AC-002: For Live leagues, the progress bar is unchanged at 6 segments.
- AC-003: No regression in Live league wizard flow or step transition timing.

---

## OB-011. Draft Date Picker Has No Season-Anchor Guidance

Sprint: 14

Priority: P2

Effort: S

Status: ✅ SHIPPED — commit 972362d (helper text updated to "Try late November 2026 (when the PWHL season opens)")

As a commissioner setting a draft date in step 3 of the wizard, I want actionable guidance on when to draft so that I can choose a date confidently without knowing the PWHL schedule.

Issue: Step 3 shows a date picker with helper text "Most leagues draft the week before the season opener." The opener is "November 2026" with no specific date known yet. A user picking a date in June 2026 has no idea what to aim for. The picker invites action before enough information exists to act.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: When no PWHL season opener date is confirmed, the draft date section shows: "The PWHL season opener is expected in November 2026. You can set the exact date from the admin panel once the schedule is announced."
- AC-002: The date picker is still visible and usable for commissioners who want to set a tentative date, but it is styled as optional/secondary.
- AC-003: Once `FantasyLeague.draftStartsAt` is set, the wizard shows the selected date on the done step (already existing behavior — verify it still works).

---

## BF-008. Activity Feed Shows Negative Timestamps in Replay Leagues

Sprint: 12

Priority: P0

Status: ✅ SHIPPED — Sprint 15 batch commit 4b67b44; `Math.max(0, ...)` guard in `TransactionFeed` ensures timestamps never display negative

Summary: In replay leagues, the activity feed shows relative timestamps like "-243731m ago" for events
such as "homoveralls dropped Jocelyne Larocque." The negative value occurs because `LeagueEvent.createdAt`
stores the real-world wall-clock time (e.g. June 2026, when the seed script ran), but the relative
timestamp formatter uses `replayCurrentDate` (e.g. Jan 3 2026) as "now." A real date in the future
relative to the simulated date appears as a negative duration.

Root cause: The time-ago renderer subtracts `Date.now()` from `event.createdAt`, but the "now" passed
to that helper is the replay simulation date, not the actual current time. Any event created after
`replayCurrentDate` will show negative.

Fix: Activity feed timestamps should use the real wall-clock `Date.now()` for rendering "X min ago,"
not the simulated date. The simulated date controls what game data to show, not when real-world app
actions occurred. Identify the time-ago helper (likely in `lib/services/activity.ts` or the component
that renders `LeagueActivity`) and ensure the reference point is always `new Date()`, never the
replay/sim date.

User story: As a replay league manager viewing the activity feed, I want timestamps to read "3d ago" or
show a real date so I understand when transactions actually happened.

Acceptance Criteria:
- AC-001: In a replay league, activity feed entries show a non-negative relative time (e.g. "3d ago," "1w ago," or an absolute date string).
- AC-002: In a live league, activity feed timestamps are unchanged.
- AC-003: The fix does not affect any other sim-date logic (period scoring, games remaining, lock state).
- AC-004: `tsc --noEmit` clean.

Effort: Backend XS · Frontend S

Files: `lib/services/activity.ts`, the activity feed component (possibly `components/LeagueActivity.tsx` or inline in matchup/league overview pages)

---

## BF-009. Analysis Page Navigation Broken: Click Stays on Matchup URL

Sprint: 12

Priority: P0

Status: ✅ CONFIRMED RESOLVED — Sprint 18 investigation; Playwright confirmed navigation works correctly (URL changes to `/analysis`, 200 RSC fetch). Original audit false-negative caused by `waitForLoadState('networkidle')` resolving before Next.js App Router RSC fetch completes. No code change required.

Summary: Clicking the "Analysis" tab in the team nav from the matchup page does not navigate to
`/team/[teamId]/analysis`. After the click, the URL remains at `/team/[teamId]/matchup` and the
page continues to show matchup content.

Confirmed by Playwright audit: the Analysis link exists (`href="/team/homoveralls-iyhl/analysis"`)
and the click fires, but `waitForLoadState('networkidle')` resolves still on the matchup URL.

Root cause candidates:
1. The `app/team/[teamId]/analysis/page.tsx` route fails to compile or throws on first render in dev
   (Next.js lazy compilation silently returns the previous page instead of showing an error).
2. A navigation interceptor in the team layout catches the route change and cancels it.
3. The Analysis link in `TeamNav.tsx` has a broken `href` computed path (e.g., missing the `teamId`
   segment at runtime).

Investigation steps: (1) Navigate directly to `/team/[teamId]/analysis` in a browser and check for
compile errors in the terminal. (2) Open Network tab and see if a request to the analysis route is
made. (3) If a 404/500 appears, check `app/team/[teamId]/analysis/page.tsx` for the root cause.

Fix: Once root cause is confirmed, either patch the page component to render without error, or fix the
href if it is malformed at runtime.

User story: As a manager, I want to click "Analysis" in the nav and land on the Analysis page so I can
view my team's projected scores and FA recommendations without manually typing a URL.

Acceptance Criteria:
- AC-001: Clicking the "Analysis" tab from any team page navigates to `/team/[teamId]/analysis` and renders the Analysis content.
- AC-002: Direct navigation to `/team/[teamId]/analysis` renders without error.
- AC-003: No console errors thrown during the navigation.
- AC-004: `tsc --noEmit` clean.

Effort: Backend XS · Frontend S · Testing S (add one Playwright navigation smoke test)

Files: `app/team/[teamId]/analysis/page.tsx`, `app/team/[teamId]/TeamNav.tsx`

---

## UX-046. Season Series Block Renders Twice on Matchup Page

Sprint: 12

Priority: P1

Status: OPEN

Source: Pass 2 end-user walkthrough (June 2026). Text content of the matchup page contains
"SEASON SERIES\n1-0" immediately followed by "SEASON SERIES VS TEST TEAM ASZC\n1-0\nW\nDec 5\n24.7 – 16.75."
The heading and the detail block appear to be two separate renders of the same data — one is a
summary label, the other is the full H2H row — with no visual separation that would tell a user
they are two distinct sections.

The duplication confuses users who expect to see a concise rivalry summary. The redundancy also
wastes vertical space on the matchup page.

Fix: Audit the Z4 section (Rival badge + H2H history) in `app/team/[teamId]/matchup/page.tsx`. Identify
whether the "SEASON SERIES" heading and the row below it are separate components or a single component
rendering twice. Remove the duplicate and ensure the section renders: (a) the label "Season Series" and
(b) the W/L record and last-game detail, in a single unified block.

User story: As a manager on my matchup page, I want to see my H2H record against today's rival once,
cleanly, without repeated headings.

Acceptance Criteria:
- AC-001: The "Season Series" label appears exactly once on the matchup page.
- AC-002: The H2H record and last matchup detail (date, scores) are shown in one unified row below the label.
- AC-003: When no prior H2H history exists, the section shows "No prior matchups" (or is hidden).
- AC-004: `tsc --noEmit` clean.

Effort: Frontend S

Files: `app/team/[teamId]/matchup/page.tsx` (Z4 section), any component rendering the rivalry/recap card

---

## UX-047. Trade Proposal Flow Has No Trading-Partner-First Step

Sprint: 12

Priority: P1

Status: OPEN

Source: Pass 2 end-user walkthrough (June 2026). The Propose Trade page (`/league/[leagueId]/trades/new`)
shows "HOMOVERALLS GIVES" on the left and "WANT FROM LEAGUE" on the right. Under "WANT FROM LEAGUE" are
approximately 80 player buttons from all opposing teams, unsorted by team. A search box exists but the
instructional hint ("Search by player name or team name") appears below the 80-button list — below the
fold — meaning most users never see the hint before they're already overwhelmed.

Every major fantasy platform (Yahoo, ESPN, Sleeper) requires the proposer to select a trading partner
team before displaying that team's roster. Without this constraint, the proposer must mentally model all
teams simultaneously and cannot build a coherent offer around one opponent's roster.

Fix: Add a team-picker step above the "WANT FROM LEAGUE" player list. Options:
- (a) A horizontal pill row of opponent team names. Selecting a team filters "WANT FROM LEAGUE" to only
  that team's players. Default: "All teams" shows everyone (preserves backward compat for users who
  want to browse broadly).
- (b) A required team-picker modal/step before the player list renders.

Option (a) is preferred — it's additive and doesn't break the current behavior for experienced users.

User story: As a manager proposing a trade, I want to select a trading partner team first so I can see
their specific players and build a coherent offer without scrolling through the whole league.

Acceptance Criteria:
- AC-001: A team picker (pill row or select) appears above the "WANT FROM LEAGUE" section.
- AC-002: Selecting a team filters the player list to only that team's rostered players.
- AC-003: An "All teams" option (or no selection) restores the full list.
- AC-004: The search input still works when a team is selected (searches within the filtered list).
- AC-005: `tsc --noEmit` clean; trade proposal can still be submitted successfully.

Effort: Frontend M

Files: `app/league/[leagueId]/trades/new/page.tsx` (or the ProposeTradeForm client component)

---

## UX-048. Trade Form Search/Filter Hint Hidden Below Player List

Sprint: 12

Priority: P1

Status: OPEN

Source: Pass 2 end-user walkthrough (June 2026). The instructional text "Search by player name or team
name and click a player to start building your trade" appears below the scrollable list of 80+ player
buttons — meaning users encounter the player list before they see the instruction. The intended
interaction model (type a name to filter, then click) is only revealed after confusion.

Fix: Move the hint text above the player list, immediately below the "WANT FROM LEAGUE" heading and
above the search input. The hint should be visible before the user scrolls into the player list.

Note: This fix partially overlaps with UX-047 — if UX-047's team picker is implemented, the hint copy
should also update to reflect the team-first workflow: "Select a team above, then click players to add
them to your offer."

User story: As a manager on the propose trade form, I want to see the usage instructions before the
player list so I understand how to interact with the form.

Acceptance Criteria:
- AC-001: The search/filter hint appears above the player list, below the "WANT FROM LEAGUE" heading.
- AC-002: The hint is visible on initial render without scrolling.
- AC-003: If UX-047 is also shipped, the hint copy references the team-picker workflow.

Effort: Frontend S

Files: Same as UX-047 (ProposeTradeForm or `trades/new/page.tsx`)

---

## UX-049. "Free Agents" Not Accessible from Top-Level Team Nav

Sprint: 14

Priority: P2

Status: OPEN

Source: Pass 2 end-user walkthrough (June 2026). The user attempted to "add a free agent from the
Analysis tab" — the task failed because the Analysis tab didn't load, but the underlying product gap
is that there is no direct path to adding a free agent from any persistent nav element.

The team nav shows: Matchup · Lineup · Rosters · Trades · Standings · Record · Analysis.
"Free Agents" is a tab inside the Rosters page, requiring two clicks (Rosters → Free Agents tab).
Adding players is the most frequent in-season action in fantasy sports — it should be one click
from anywhere in the app.

Fix options:
- (a) Add "Free Agents" as a standalone tab in TeamNav between "Rosters" and "Trades."
- (b) Rename the "Rosters" tab to "Roster & FAs" and make the Free Agents tab the default when
  navigating from the team nav URL `/team/[teamId]/roster`.
- (c) Add a floating "+Add Player" button to the lineup page (contextually visible when a starter
  has zero games remaining this week).

Option (a) is the clearest but makes the nav wider. Option (c) is contextually the most useful.
Recommend (a) for MVP, (c) for post-launch polish.

User story: As a manager during the season, I want to reach the free agent pool in one click from any
team page so I can add a player without hunting through tabs.

Acceptance Criteria:
- AC-001: A "Free Agents" link is accessible from the team nav or as a prominent in-page CTA.
- AC-002: The link navigates to the roster page with the Free Agents tab pre-selected.
- AC-003: `tsc --noEmit` clean.

Effort: Frontend S

Files: `app/team/[teamId]/TeamNav.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`

---

## UX-050. Win Probability Bar Percentages Are Unlabeled in DuelHero

Sprint: 14

Priority: P2

Status: OPEN

Source: Pass 1 design critique (June 2026). The DuelHero shows two percentage numbers (e.g. "66%"
and "34%") flanking the win probability bar. No label identifies these as win probabilities. A new
user seeing "66%" and "34%" next to scores has no way to know what those numbers mean — they could
be ownership percentage, roster percentage, or something else entirely.

Fix: Add a "Win Prob" label above the probability bar, or label the two ends with "Me" and "Opp"
plus a tooltip explaining the calculation basis ("Based on projected scores and historical variance").

Note: This issue is related to an existing deferred story (UX-025, "H2H Season Series stats label")
but is a distinct problem — the label is missing entirely, not just unclear.

User story: As a manager looking at my matchup, I want the win probability percentages labeled so I
understand what I'm looking at without needing to guess.

Acceptance Criteria:
- AC-001: A "Win Probability" or "Win Prob" label appears above or adjacent to the probability bar.
- AC-002: The two percentage values are identifiable as "mine" and "opponent's" (via position, label, or color).
- AC-003: `tsc --noEmit` clean.

Effort: Frontend S

Files: `components/DuelHero.tsx`

---

# Agent Integration Test Findings — Sprint 12 Backlog

Stories derived from a two-agent end-to-end playthrough (June 2026): commissioner + member agent drafted, managed lineups, made trades, and simmed through playoffs. Logged wherever either agent was confused.

---

## BF-010. Goalie Locked Into BENCH Before Manager Can Move Her to Active Slot

Issue: A goalie was locked into the BENCH slot from period day 1 because her PWHL team played a game at exactly `period.startsAt`. The period lock fires when `team played any game >= period.startsAt`, which is true the instant the period opens if a game is scheduled that morning. The manager couldn't move her to the GOALIE slot for the entire week. No warning was shown.

User story: As a manager, I want to be warned when one of my starting slots is unplayable because a player is already locked into BENCH, so I can fix my lineup before the period starts.

Acceptance Criteria:
- AC-001: The lineup page shows an alert when an active slot's assigned player is locked in BENCH (i.e., `lockedAt` is set and slot is BENCH).
- AC-002: The alert names the affected player(s) and links to the lineup page.
- AC-003: The alert does not fire after the period has already started (would be too late to act).
- AC-004: `tsc --noEmit` clean.

Effort: Frontend S

Files: `app/team/[teamId]/lineup/page.tsx`, `LineupManager.tsx`

---

## BF-011. FA Suggestions Return Empty in Replay / Historical Leagues

Issue: `GET /api/leagues/[leagueId]/fa-suggestions` filters suggestions by `gamesThisPeriod > 0`, where "games remaining" is computed as `startsAt > nowMs`. In replay leagues, `nowMs` defaults to real `Date.now()` (June 2026), so all 2025-26 fixture games appear to be in the past and every player has `gamesThisPeriod = 0`. The endpoint always returns an empty array, making the FA add flow completely non-functional during replay.

User story: As a manager in a replay league, I want the Free Agent suggestions panel to show me relevant players, so I can make informed add/drop decisions during the replay season.

Acceptance Criteria:
- AC-001: `fa-suggestions` reads `nowMs` from `getDevNowFromRequest(req)` (the sim-date cookie), matching the pattern already used by lineup and matchup API routes.
- AC-002: In replay mode with a simulated date, `gamesThisPeriod` is computed relative to the sim date, not real `Date.now()`.
- AC-003: FA suggestions return results during a replay test run (verified with `npm run seed-fixture`).
- AC-004: `tsc --noEmit` clean.

Effort: Backend S

Files: `app/api/leagues/[leagueId]/fa-suggestions/route.ts`

---

## TR-002. Trade Auto-Rejection Is Silent — No Notification to Proposer

Issue: When a trade was auto-rejected because the proposing manager dropped an offered player after proposing the trade, the trade silently moved to `REJECTED` status with a `resolvedReason` string, but no in-app notification was sent to the proposing manager. The manager only discovers this by checking the Trade Center and reading the status badge.

User story: As a manager whose trade was auto-rejected, I want to receive an in-app notification explaining why, so I don't wonder why my trade disappeared.

Acceptance Criteria:
- AC-001: When `processExpiredTrades` or stale-player validation rejects a trade, a `TRADE_REJECTED` notification is sent to the proposing team's owner.
- AC-002: The notification body includes the `resolvedReason` string (e.g., "a player is no longer on the expected team").
- AC-003: The Trade Center detail page surfaces the `resolvedReason` in the UI for rejected trades.
- AC-004: `tsc --noEmit` clean.

Effort: Backend S + Frontend S

Files: `lib/services/trade-service.ts`, `app/league/[leagueId]/trades/[tradeId]/page.tsx`

---

## TR-003. Trade Skips PROPOSED State When Commissioner Review Is Required

Issue: When `tradeReviewHours > 0`, calling `POST /trades` (propose) immediately creates the trade in `PENDING_REVIEW` status — bypassing the `PROPOSED` state entirely. The receiving team never sees the trade as something they need to explicitly accept or reject before commissioner review. Calling the `/accept` endpoint returns "can't accept in PENDING_REVIEW state." This means the receiver is never consulted before the commissioner reviews the deal.

User story: As a trade receiver, I want to explicitly accept or reject a trade before it goes to commissioner review, so I have a chance to decline deals I don't want to proceed.

Acceptance Criteria:
- AC-001: When `tradeReviewHours > 0 || requireCommissionerTradeApproval`, newly proposed trades land in `PROPOSED` state (not `PENDING_REVIEW`).
- AC-002: The receiver must call `/accept` to advance to `PENDING_REVIEW`. Only then does the commissioner review window open.
- AC-003: The Trade Center "Incoming" tab shows `PROPOSED` trades to the receiver with Accept/Reject/Counter buttons.
- AC-004: Existing 22 trade engine tests pass; new test covers the PROPOSED→PENDING_REVIEW transition path.
- AC-005: `tsc --noEmit` clean.

Effort: Backend M + Frontend S

Files: `lib/services/trade-service.ts`, `lib/trades/engine.ts`, `app/league/[leagueId]/trades/`

---

## DRC-002. Draft Pick Timer Does Not Resume After Server Restart

Issue: When the WebSocket draft server crashes and restarts mid-draft, `buildEngineState` reconstructs the draft state from DB but sets `expiresAt: null`. The server-side `setTimeout` never fires and the draft halts indefinitely. The only recovery path is a commissioner sending PAUSE followed by RESUME, which resets the timer. This was confirmed empirically in two separate automated test runs.

User story: As a commissioner, I want the draft pick timer to resume automatically after a server restart, so a crash doesn't permanently stall the draft.

Acceptance Criteria:
- AC-001: `buildEngineState` computes a valid `expiresAt` when draft status is `IN_PROGRESS` — either by reading a persisted `expiresAt` from the DB or by setting it to `now + remainingPickSecs`.
- AC-002: Draft continues auto-picking without a PAUSE/RESUME intervention after server restart.
- AC-003: The existing `tests/draft.test.ts` suite (32+ tests) passes.
- AC-004: `tsc --noEmit` clean.

Effort: Backend M

Files: `lib/draft/server.ts` (`buildEngineState`), possibly `prisma/schema.prisma` (persist `expiresAt`)

---

## DS-004. Emotional Design Polish — Matchup Page Energy

Sprint: 16
Priority: P2
Effort: M
Status: ✅ DONE (Jun 22, 2026)

As a user viewing a live matchup, I want the page to feel energetic and responsive to game state, not like a financial data terminal, so that I'm emotionally engaged in the moment.

User story: When my team is winning, I want to *see* that visually (green score). When I'm losing, the red score tells that story. Animations should give the page motion and life. Typography should have hierarchy so section titles feel navigable, not like data labels.

Files: `app/globals.css`, `app/team/[teamId]/matchup/page.tsx`, `components/ScoreDisplay.tsx`

**Implementation:**

1. **Score colors by win state** — `getScoreColor(myScore, oppScore)` returns green (#34d399) for leading score, red (#f87171) for trailing, white (#f6f7fb) for tied. Applied in both DuelHero (1v1) and FieldHero (vs-field).

2. **Score count-up animation** — `ScoreDisplay` client component animates from 0 → final value over 1.2s on active-matchup page load using `requestAnimationFrame` timing. Only animates on active matchups; upcoming/setup phases display static values.

3. **Section heading hierarchy** — Primary section headings ("Playing tonight", "Swing players", "Top performers", "Underperforming", "League leaders", "Roster status") upgraded from `.sectionHead` (12px uppercase, dim) to `.section-title` (14px normal case, full-bright text). Data table column headers remain `.sectionHead` for visual distinction.

4. **Font loading** — Saira Condensed 700 imported from Google Fonts in globals.css and applied to all `.font-stats` elements (scores, projected FP, stats columns). Replaces fallback Inter with sports-data-display typeface.

5. **RecapCard elevation** — Last-result card borders and score display now respond to win state: green border+score for wins, red for losses, neutral for ties. Copy elevated from flat outcome text to contextual narratives ("Took down {opponent}" vs "Tough week"). Score displays at 28px with matching color.

6. **Card entrance animations** — `@keyframes fadeSlideUp` animates cards from `opacity: 0; translateY: 12px` to `opacity: 1; translateY: 0` over 0.6s with staggered delays (0.05s per nth-child). Gives the page a sense of assembly on load.

7. **Win probability bar animation** — `.win-prob-bar` applies `transition: width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)` — spring easing that feels snappy and confident instead of flat linear fill.

Acceptance Criteria:
- AC-001: Score colors correctly reflect win state — leading green, trailing red, tied white.
- AC-002: Scores animate smoothly from 0 to final value on active-matchup load (not on upcoming/setup).
- AC-003: Section headings render at 14px normal case with full-bright color; data table headers remain 12px uppercase.
- AC-004: Saira Condensed loads from Google Fonts (status 200 in DevTools Network) and applies to `.font-stats` elements.
- AC-005: RecapCard borders and score display colors respond to game state (green/red/neutral).
- AC-006: Card entrance animations execute on hard refresh with visible stagger.
- AC-007: Win probability bar fills with spring easing, not linear.
- AC-008: No regressions on prior animations (card entrance, live score polling).
- AC-009: `tsc --noEmit` clean. 149 tests pass.

---

# Sprint 17 Features — UX Polish: Agent Test Run Fixes

Source: 4-agent parallel UX test run (`docs/03-validation/agent-run-findings-2026-06-22.md`), Jun 22, 2026. 6 Blockers + 13 Friction + 5 Minor items identified. Sprint 17 implements all Blocker and high-priority Friction items.

---

## AG-001. LEAGUES Page Overhaul + Public League Directory

Sprint: 17
Priority: P0
Effort: L
Status: ✅ COMPLETE

Redesign the leagues discovery page from a bare list into a two-zone showcase. Zone 1 shows "What's Happening This Week": top weekly performers, biggest blowout matchup, a sample matchup card. Zone 2 is an open-league directory: human-readable status labels (e.g., "Drafting Oct 30" not "PRE_DRAFT"), league size, commissioner name, and a Join CTA.

Requires `isPublic Boolean @default(false)` on `FantasyLeague`. Add a public/private toggle to the league creation wizard (step 1 or 2) and to the commissioner admin panel. Default is private so existing leagues are not exposed without opt-in.

Schema change: `FantasyLeague.isPublic Boolean @default(false)`

Acceptance Criteria:
- AC-001: Leagues discovery page renders a "What's Happening" showcase section with at least top weekly performers and biggest blowout from the most recently scored week.
- AC-002: Open-league directory shows only leagues where `isPublic === true` with human-readable status, league size, commissioner name, and a functional Join CTA.
- AC-003: League creation wizard includes a public/private toggle defaulting to private.
- AC-004: Commissioner admin panel includes the same public/private toggle.
- AC-005: Existing leagues default to private (`isPublic = false`) — no unintended exposure.
- AC-006: `tsc --noEmit` clean. All existing tests pass.

Files: `app/leagues/page.tsx`, `app/create-league/CreateLeagueWizard.tsx`, `app/league/[leagueId]/admin/page.tsx`, `prisma/schema.prisma`

---

## AG-002. Matchup Page Restructure — Move League-Scope Sections

Sprint: 17
Priority: P0
Effort: M
Status: ✅ COMPLETE

The My Franchise matchup page currently hosts Z7 (top/underperforming performers), Z8 (league leaders this week), and Z9 (league activity feed) — all league-scope data that does not belong on a personal franchise page. Restructure:

- Move Z7 (top performers / disappointments) to the Analysis tab.
- Move Z8 (league leaders) and Z9 (activity feed) to `app/league/[leagueId]/page.tsx` (league overview).
- Remove the embedded weekly standings table from FieldHero — it duplicates the standings page.
- Add a positive "all set" lineup state: when no lineup alerts exist and there are no active-slot players with zero games remaining, render a brief "Your lineup is set — nothing to do right now" message so the alert strip area does not leave a blank gap.

Acceptance Criteria:
- AC-001: Matchup page renders no league-leader or activity-feed sections.
- AC-002: Analysis tab includes the top/underperforming performers section previously at Z7.
- AC-003: League overview page renders league leaders and activity feed in its right column.
- AC-004: FieldHero contains no embedded weekly standings table.
- AC-005: When no lineup alerts fire, a positive "all set" state renders in the alert strip location.
- AC-006: No regressions on existing Analysis tab content (hot/cold trends, position groups, FA upgrades).

Files: `app/team/[teamId]/matchup/page.tsx`, `lib/services/dashboard.ts`, `app/league/[leagueId]/page.tsx`, `components/FieldHero.tsx`

---

## AG-003. FP/VP Scoring Comprehension Copy

Sprint: 17
Priority: P0
Effort: S
Status: ✅ COMPLETE

New users cannot connect FP (fantasy points earned from real stats) to VP (victory points earned from weekly rankings). The systems feel disconnected. Three targeted copy fixes:

1. Add a bridging sentence to the dashboard MatchupHero: "Your FP total determines your VP this week — score more than your opponents to earn VP."
2. Change the FieldHero "vs the field" indicator from a `title` attribute (tooltip-only) to visible text: "vs the field" rendered inline next to the score or section header.
3. Fix "0.0" displaying instead of "—" on the dashboard action card during the setup phase (before any games have been played). This is a parallel bug to the already-fixed matchup page hero `isSetupPhase` guard.

Acceptance Criteria:
- AC-001: Dashboard MatchupHero renders a VP bridge sentence visible without interaction.
- AC-002: FieldHero renders "vs the field" as visible text, not only as a tooltip.
- AC-003: Dashboard action card renders "—" (not "0.0") during setup phase / pre-first-game state.
- AC-004: No regressions on existing matchup page `isSetupPhase` guard (already fixed).

Files: `components/FieldHero.tsx`, `app/dashboard/page.tsx`, `lib/services/dashboard.ts`

---

## AG-004. Terminology Standardization — FP Everywhere, Glossary Open

Sprint: 17
Priority: P0
Effort: S
Status: ✅ COMPLETE

"FPts" appears in stat tables across the app while all other UI surfaces use "FP". Standardize:

1. All stat table column headers (lineup page, roster page, draft room, FA panel) use "FP" not "FPts".
2. `VpExplainer.tsx` gains an FP/VP relationship sentence: "Your FP total determines your VP tally each week."
3. Lineup page gains a slot legend above the active-slots grid: F = Forward, D = Defense, G = Goalie, UTIL = Any skater (F or D).
4. Draft stat glossary (`DraftRoom.tsx`) opens by default (remove the collapsed initial state). Users who have seen it can collapse it; first-time openers see it immediately.

Acceptance Criteria:
- AC-001: No "FPts" strings visible in any stat table header across the app.
- AC-002: `VpExplainer` renders the FP/VP relationship sentence.
- AC-003: Lineup page slot legend renders above the active-slots grid.
- AC-004: Draft stat glossary is open (not collapsed) on initial page load.

Files: `components/VpExplainer.tsx`, `app/team/[teamId]/lineup/LineupManager.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`

---

## AG-005. Non-Qualifying Playoff Empty State

Sprint: 17
Priority: P0
Effort: S
Status: ✅ COMPLETE

Teams that missed the playoffs currently see "Season hasn't started" on their My Franchise matchup page — the same empty state as the pre-draft period. This is factually incorrect and discouraging. Fix `lib/services/dashboard.ts` to detect the eliminated-during-playoffs condition and return a specific empty state with:

- "You finished Nth in the regular season" (derive rank from `computeVpStandings` on the last regular-season period).
- A link to the bracket page: "See how the playoffs are going →".
- No score hero (render no FieldHero or DuelHero).

The matchup page renders this alternative view when `dashboard.playoffEliminated === true`.

Acceptance Criteria:
- AC-001: When `league.playoffStatus === IN_PROGRESS` and the viewing team has no active playoff `Matchup` row, the matchup page renders the eliminated empty state (not "Season hasn't started").
- AC-002: The empty state includes the team's regular-season finish rank.
- AC-003: The empty state includes a functional link to the bracket page.
- AC-004: Teams that ARE in the playoffs continue to see their normal playoff DuelHero.
- AC-005: The pre-draft "Season hasn't started" state is unaffected.

Files: `lib/services/dashboard.ts`, `app/team/[teamId]/matchup/page.tsx`

---

## AG-006. Season Renewal Two-Step Confirmation + Invite Step

Sprint: 17
Priority: P0
Effort: S
Status: ✅ COMPLETE

`RenewLeagueForm` currently triggers league renewal on a single button click with no confirmation. Users expect "renew" to reset the current league in-place; the actual behavior creates a new child league with a fresh invite flow. Two changes:

1. Two-step confirmation modal: step 1 shows a clear explanation ("This creates a new 2027-28 league. Rosters reset, history carries over. All managers need to re-join.") + a Continue button; step 2 is the final Confirm button. Cancel is available on both steps.
2. Post-renewal invite step: after successful renewal, show the new league's invite link with a "Copy link" button and copy "Share this with your league to get everyone back for next season" before redirecting to the admin panel.

Acceptance Criteria:
- AC-001: Renewal requires two explicit user actions (step 1 → step 2) before `POST /api/leagues/[leagueId]/renew` fires.
- AC-002: Step 1 renders the full explanation of what renewal does (new league, roster reset, re-join required).
- AC-003: After successful renewal, the invite link for the new league is displayed before redirect.
- AC-004: Cancel on either step aborts without side effects.
- AC-005: Existing renewal API behavior and idempotency are unchanged.

Files: `components/RenewLeagueForm.tsx`

---

## AG-007. Pre-Login UX Improvements

Sprint: 17
Priority: P1
Effort: M
Status: ✅ COMPLETE

Landing page features grid subcopy uses insider terminology ("VTF scoring", "VP standings") that PWHL fans new to fantasy sports will not understand. Three improvements:

1. Rewrite features grid subcopy in plain language: under 12 words per card, zero acronyms on first mention, no "VP" or "VTF" without a plain-language companion.
2. Add a "Try a Replay League" secondary CTA to the landing page (below the primary "Create a League" CTA) and a small link on the login/register pages ("Not sure? Try a replay league first — no commitment").
3. Update the invite-link landing page (`app/join-league/`) to show the league's draft date (if set) and a two-sentence fantasy explainer above the join form for users who followed a friend's link and have never played fantasy sports.

Acceptance Criteria:
- AC-001: Landing page features grid contains no unexplained acronyms (VP, VTF, FP) in card subcopy.
- AC-002: Landing page renders a secondary "Try a Replay" CTA.
- AC-003: Login and register pages each render a small replay CTA link.
- AC-004: Join-league page renders the league's draft date and a two-sentence fantasy explainer when a valid invite code is present.

Files: `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/join-league/page.tsx`

---

## AG-008. VP Education Reinforcement on Matchup/Dashboard

Sprint: 17
Priority: P1
Effort: S
Status: ✅ COMPLETE

`VpExplainer` is only reachable from the standings page. Users first encounter VP on the matchup page (FieldHero shows a VP record like "3W–1L–0T") and on the dashboard action cards, but neither surface explains what VP is. Add a compact inline callout:

- In `FieldHero`: a small "What is VP?" link below the record that expands a one-sentence inline explanation ("VP = victory points; earn 2 for a win, 1 for a tie") or routes to the standings page explainer.
- On the dashboard matchup action card: a single-line "Your VP record" label next to the record display, with a tooltip or expand link.

Acceptance Criteria:
- AC-001: FieldHero renders a VP explanation trigger (link or tooltip) adjacent to the weekly record.
- AC-002: Dashboard matchup card labels the VP record with at least a "VP" abbreviation + expand trigger.
- AC-003: The expand/tooltip content matches the copy in `VpExplainer.tsx`.
- AC-004: `VpExplainer` content on the standings page is unchanged.

Files: `components/FieldHero.tsx`, `app/dashboard/page.tsx`, `components/VpExplainer.tsx`

---

## AG-009. Lineup Lock Contextual Tooltip

Sprint: 17
Priority: P1
Effort: S
Status: ✅ COMPLETE

When a player is in a locked state (lock indicator visible), tapping or hovering the lock icon shows nothing. Users cannot tell why the player is locked or what it means for their team. Add a tooltip or inline label that explains the lock reason in plain language.

Proposed copy: "Locked — [Player's team] played on [day]. Can't bench a player after they've contributed this week."

The explanation should be visible on hover (desktop) and on tap (mobile). It should not be a modal — a tooltip or a small inline reveal is sufficient.

Acceptance Criteria:
- AC-001: Lock indicator on the lineup page renders a tooltip or inline label on hover/tap.
- AC-002: Tooltip copy names the player's PWHL team and states the reason (team played this week).
- AC-003: Tooltip is accessible via keyboard focus on the lock element.
- AC-004: Existing lock logic and validation behavior are unchanged.

Files: `app/team/[teamId]/lineup/LineupManager.tsx`

---

# Sprint 18 Features — Beta Operations + Onboarding Repair

Source: Live feedback audit (Jun 22, 2026) + Sprint 13 carry-forwards + ops gate requirements.
Target: Ship before Jul 7, 2026 beta invite date.

---

## BLR-001. Founder-Created Beta Replay Leagues

Sprint: 18

Priority: P0 — must land before Jul 7 beta invites

Status: ✅ SHIPPED — commits cc77196 + ecc7290 (Jun 22, 2026)

A founder-console UI to create a pre-configured 8-team replay league using 4 curated weeks from
the 2025-26 season plus a 2-round playoff bracket (top 4 of 8 teams — semifinals + final). This
is the primary onboarding vehicle for beta invitees: rather than asking them to create their own
league from scratch, the founder creates the league and sends a join link.

What shipped:
- `POST /api/founder/beta-leagues` — creates the pre-configured replay league
- `POST /api/founder/beta-signups` and `POST /api/founder/leagues/[leagueId]/beta-users` — invite-link mechanics and user assignment
- `GET/PUT /api/leagues/[leagueId]/draft/queue` — draft queue API for beta participants
- `scoreVtfWeek` beta week mapping in `lib/scoring/matchups.ts` — ensures 4-week subset scores correctly
- Beta season generation in `lib/season/index.ts` via `pickRandomWeeks(20, 4)` — selects 4 periods from the 2025-26 fixture
- Founder leagues page: "Create Beta League" form + "Beta" filter tab
- Founder league detail: "Beta Users" tab showing invited users and join status
- Beta banner rendered in league and team layouts for participants
- TeamNav: "Draft Queue" tab visible pre-draft so managers can queue players before the draft starts
- `/team/[teamId]/draft-prep` — new route: player rankings + queue manager for pre-draft preparation

Engineering risk notes (not yet mitigated — verify before first beta draft):
- `pickRandomWeeks(20, 4)` hardcodes `total: 20`. If the 2025-26 season fixture has a different number of periods, the random selection may be miscalibrated. This should derive the actual period count dynamically from the fixture data rather than using a hardcoded constant.
- `computeSeasonState` may show unexpected period statuses when a beta league has only 4 `ScoringPeriod` rows but the underlying game dates span the full 2025-26 season. Specifically, periods outside the 4-week window could appear as UPCOMING or SCORING_PENDING when they should be invisible to the league. Verify the season page, matchup page, and lineup page all display correct state before inviting the first beta cohort.

Acceptance Criteria (all met):
- AC-001: Founder can create a BLR league from the Founder Console ✅
- AC-002: BLR league is pre-configured with 4 weeks and a 2-round playoff bracket ✅
- AC-003: Join link routes invitee to registration and then directly to their team ✅
- AC-004: Beta participants can queue players in "Draft Queue" TeamNav tab pre-draft ✅

Effort: Backend L · Frontend M · Testing M

---

## BLR-002. Wizard Beta Welcome Screen

Sprint: 18

Priority: P0 — must land before Jul 7 beta invites

Status: ✅ SHIPPED — BetaWelcomeStep confirmed in `CreateLeagueWizard.tsx` line 220; `NEXT_PUBLIC_BETA_MODE=true` added to `.env.local`

---

### Overview

A "step 0" welcome screen inserted at the very top of `app/create-league/CreateLeagueWizard.tsx`,
shown only when `NEXT_PUBLIC_BETA_MODE=true`. It appears before the progress bar and before step 1
("Name your league"). It orients founding GMs: what the beta is, why the season is compressed, and
where to send feedback. When the user clicks the CTA, the step counter advances to 1 and the normal
wizard flow begins.

---

### Display Condition — Option A (RECOMMENDED)

**Use `NEXT_PUBLIC_BETA_MODE=true`** — an env var read client-side.

Rationale:
- **No schema changes.** `betaStatus` on `FantasyLeague` is already used for the founder-console
  cohort management UI. Reusing it here would require the wizard to fetch the user's beta status
  before rendering, creating a loading state and a round-trip on the very first screen. That is
  the wrong trade-off for what is essentially a one-time splash.
- **No conflict with `onboardingCompletedAt`.** That flag suppresses `WelcomeFlow.tsx` on the
  dashboard. The beta welcome screen is structurally different (it lives inside the wizard, not
  on the dashboard) and fires before `onboardingCompletedAt` is written — the wizard already
  calls `POST /api/user/onboarding` on mount (see `useEffect` in `CreateLeagueWizard.tsx`).
  Reusing `onboardingCompletedAt` would make it impossible to dismiss the welcome flow without
  also killing the beta screen, or vice versa.
- **Time-bounded.** Remove the env var at public launch. No migration, no cleanup. The wizard
  reverts to step 1 automatically.

Implementation note for the engineer: gate the step-0 render on
`process.env.NEXT_PUBLIC_BETA_MODE === "true"`. When that env var is absent or false, `step`
starts at 1 as today, and the `goNext()` call from step 0 simply doesn't exist.

---

### Placement

**Step 0, inside the existing wizard card** — not a full-screen overlay.

Rationale: A full-screen overlay breaks the visual continuity between sign-up and first action.
The wizard card (`dashboard-panel` with `min-height: 60vh`) already provides a comfortable canvas
for three short info cards plus a CTA. Using the card also means the Cancel button in the progress
header is not yet visible (step 0 suppresses the progress bar entirely — see behavioral spec below),
keeping the experience focused.

The step-0 screen should feel visually distinct from step 1 — richer, more celebratory — but use
the same container so it does not jarr when transitioning forward. Use the purple accent treatment
from `app/beta/page.tsx` (badge, gradient heading, indigo CTA) rather than the plain form styling
of steps 1–6.

---

### Copy

**Eyebrow badge (reuse the pulse treatment from `/beta/page.tsx`)**
```
Beta · Replay Season
```

**Heading** (max 8 words — 6 here)
```
You're in. Welcome, Founding GM.
```

**Intro paragraph** (3 sentences — sets context before they touch any form field)
```
You're one of a small group helping us shape PWHL GM before the live 2026-27 season.
Your league runs on four real weeks from the 2025-26 PWHL season — same players, same
stats, compressed into a ~4-week format so you can experience a full season before
opening night. Everything you try, break, or love goes directly into what we build next.
```

**3 orientation cards** (max 12 words each — use icon + title + one-line body format matching `WelcomeFlow.tsx`)

Card 1 — How the beta works
- Icon: replay / clock (e.g. a loop or hourglass icon, or literal "⏪")
- Title: `Real PWHL stats. Condensed timeline.`
- Body: Four weeks of 2025-26 data, full snake draft, weekly head-to-head VP scoring.

Card 2 — Your most important job
- Icon: speech bubble or lightning bolt (e.g. "💬")
- Title: `Send us feedback. All of it.`
- Body: Use the feedback button in the bottom-right corner. Bugs, confusion, missing features — we read every one.

Card 3 — What comes next
- Icon: calendar or flag (e.g. "🏒")
- Title: `Founding GMs get first access in November.`
- Body: When the live 2026-27 season opens, you get early invites and skip the waitlist.

**CTA button label**
```
Build my league →
```
(Imperative, ownership-forward. Echoes "Think Like a GM." — "build" signals agency without being vague.)

**Secondary link (optional — recommended yes)**
```
What's a replay league?
```
Links to an anchor on the `/league-rules` page or a lightweight tooltip. This is a real question
beta users will have when they first hit the wizard — proactively answering it prevents confusion
at step 3 (the "Season mode" step where Replay vs Live is shown). If a separate FAQ page does not
exist, render a short inline tooltip on the link click instead of navigating away.

---

### Behavioral Spec

**Does the CTA advance to step 1 or set a flag first?**
The CTA calls `setStep(1)` directly — no async operation, no flag. The `NEXT_PUBLIC_BETA_MODE`
env var is already the gate; no per-user flag needs to be written. (If the product later wants
"show only once", that can be layered in via `localStorage` at the engineer's discretion — but
for beta, showing on every `/create-league` visit is fine, since beta users create one league.)

**Is the step skippable?**
No. There is no Skip button and no Cancel button on step 0. The only action is the CTA. This
keeps the beta context front-of-mind — the user should not be able to bypass orientation by
accident. (The Cancel button in the progress header renders on `step < TOTAL_STEPS`; because
step 0 is not a numbered step inside the wizard's `TOTAL_STEPS = 7` range, Cancel is simply
not rendered on this screen.)

**What happens to `stepLabels` and the progress bar?**
The progress bar and the "Step N of N" counter are **hidden on step 0**. Both are rendered inside
the existing `step === 1 ... step <= TOTAL_STEPS` conditional block in the wizard. The engineer
should wrap the entire progress indicator block in a `step > 0 &&` guard (or equivalently
`step >= 1` since the current wizard already starts at 1 — change the initial state from
`useState(1)` to `useState(isBetaMode ? 0 : 1)` and add `{step > 0 && <progressBlock />}`).

Step 0 does not count toward "Step N of N". The user sees no "Step 0 of 6". When they click
"Build my league →", the label jumps directly to "Step 1 of 6" (or 5 for Replay). No animation
is required for this jump; the step counter appearing for the first time is itself a visual cue
that they have entered the form.

**Does this affect replay mode or live mode?**
Step 0 is display-condition-gated on `NEXT_PUBLIC_BETA_MODE`, not on `isReplay`. It appears
regardless of which mode the user subsequently picks in step 3. The mode choice has no effect
on step 0 content.

**`onboardingCompletedAt` interaction:**
No change. The wizard already calls `POST /api/user/onboarding` on mount (marks `onboardingCompletedAt`),
which suppresses `WelcomeFlow.tsx` on the dashboard going forward. Step 0 does not add a new
flag — it is gated by the env var only. If the user navigates away from step 0 and returns later,
they see step 0 again; that is acceptable behavior for a limited-cohort beta.

---

### User Stories

- As a first-time beta invitee opening the wizard, I want to immediately understand what this league
  is (replay format, 4 weeks) and why it exists (to help shape the product) so I am not confused
  when the season ends in 4 weeks.
- As a beta participant, I want to know exactly where to send feedback before I even name my league,
  so I don't finish the experience wondering how to report issues.
- As a Founding GM, I want to feel celebrated for being early — not just onboarded — so the act of
  creating a league feels meaningful, not transactional.

---

### Acceptance Criteria

- AC-001: When `NEXT_PUBLIC_BETA_MODE=true`, visiting `/create-league` renders the step-0 welcome
  screen (eyebrow badge, heading, 3 orientation cards, CTA) before any form field appears.
- AC-002: When `NEXT_PUBLIC_BETA_MODE` is unset or false, the wizard starts at step 1 ("Name your
  league") with no visible change — zero regression for non-beta users.
- AC-003: The progress bar ("Step N of N" + filled segments + stepLabels) is completely hidden on
  step 0; it appears only from step 1 onward.
- AC-004: Clicking "Build my league →" advances `step` from 0 to 1, revealing the progress bar and
  the league-name input. No async call is made; no loading spinner appears.
- AC-005: There is no Skip button and no Cancel button on step 0.
- AC-006: `tsc --noEmit` clean; no existing wizard or onboarding tests regress.
- AC-007: The "What's a replay league?" secondary link renders. (Target: tooltip or `/league-rules`
  anchor — engineer's choice, but must not be a dead link.)

---

### Open Questions (RESOLVED by this spec)

- Q1 (copy for beta vs standard wizard): Answered — Option A env var gates step 0 in the existing
  wizard; standard wizard users never see it.
- Q2 (suppress/modify 6-step wizard entirely): Answered — No. Step 0 precedes the existing wizard;
  the 6-step flow is unchanged. Beta users go through the same wizard as standard users.
- Q3 (`onboardingCompletedAt` interaction): Answered — No conflict. Wizard writes
  `onboardingCompletedAt` on mount (existing behavior); step 0 is gated by env var only.

---

Effort: Backend S (env var only, no API changes) · Frontend M · Testing S
Depends on: BLR-001

---

## BF-012. FA Add Confirms Success But Shows Error Modal

Sprint: 18

Priority: P1

Status: OPEN

Source: FeedbackSubmission `cmqnc5umh000eu5tmsanmob6z` (Jun 21, 2026). User reports: "When you
try to add a free agent and select which player to drop for her, you get an error message that
your team is full and she can't be added but upon refresh and returning to your roster, the
original player was dropped successfully and the new player was added."

The transaction completes in the DB but the UI shows an error. Root cause hypothesis: the
`AddAndSlotModal` capacity check fires on the component side AFTER the waiver/add API has already
committed the transaction. Alternatively, the API returns a 4xx code for the slot assignment (post-add)
even though the add itself succeeded. The user sees an error but the data is correct.

Investigation path:
1. Trace the `handleAdd` flow in `RosterManager.tsx` — does it call the add API and then separately
   call the lineup API for slotting? If the lineup call fails, does it surface as "roster full"?
2. Check whether `AddAndSlotModal` validates roster capacity before or after the add API call fires.
3. Check whether `router.refresh()` is called before or after the error is shown — if before, it
   may re-render with the correct data while still displaying a stale error state.

Acceptance Criteria:
- AC-001: When a FA add completes successfully, the UI shows success (or the slot modal) — not an error.
- AC-002: If the slot assignment step fails after a successful add, the error message accurately describes
  the slot issue (not "roster is full").
- AC-003: No phantom error is shown when the DB state is correct.
- AC-004: `tsc --noEmit` clean; existing waiver tests pass.

Effort: Backend S · Frontend M · Testing S
Files: `app/team/[teamId]/roster/RosterManager.tsx`, `components/AddAndSlotModal.tsx`,
       `app/api/leagues/[leagueId]/waiver/route.ts`

---

## BF-013. Trades Cannot Be Proposed Between Draft Completion and Season Start

Sprint: 18

Priority: P1

Status: OPEN

Source: FeedbackSubmission `cmqniggbz000kb5xpiks9tfim` (Jun 21, 2026). User reports: "in my
2026-2027 season, after the draft has been completed but before the season starts, there's no
'propose trade' button. team owners should be able to propose trades as soon as their draft is over."

Root cause: `proposeTrade()` in `lib/services/trade-service.ts` blocks when
`league.playoffStatus !== "NOT_STARTED"`. However, the intent of the trade deadline was to block
trades *during and after playoffs*, not during the pre-season window after a draft completes.
The correct deadline logic is: block when `league.status === "COMPLETE"` (season done) OR when
`league.playoffStatus !== "NOT_STARTED"` (playoffs started or complete). The pre-season period
(draft done, season not yet started) should allow trades.

Note: The Trade Center page also hides the "Propose Trade" CTA when `league.status !== "IN_SEASON"`.
Both the service-level block and the UI-level hide need to be fixed together.

Acceptance Criteria:
- AC-001: After a draft completes but before the season starts, team owners can propose trades.
- AC-002: Trades are still blocked once playoffs begin (`playoffStatus !== "NOT_STARTED"`).
- AC-003: Trades are still blocked once the season is complete (`status === "COMPLETE"`).
- AC-004: The Trade Center "Propose Trade" CTA is visible in all trade-allowed windows.
- AC-005: `tsc --noEmit` clean; existing trade engine tests pass.

Effort: Backend S · Frontend S · Testing S
Files: `lib/services/trade-service.ts` (`proposeTrade` deadline check),
       `app/league/[leagueId]/trades/page.tsx` (CTA visibility)

---

## BF-014. VTF Matchup Schedule Page Is Confusing in Vs-The-Field Mode

Sprint: 18 (P2 — spec before implementing)

Priority: P2

Status: OPEN — Spec needed before implementation

Source: FeedbackSubmission `cmqpqywet000911ngv1887pij` (Jun 22, 2026). User notes that when
playing VTF (vs-the-field), the matchup schedule page showing 1v1 pairings doesn't make sense
because in VTF you play everyone every week. The page was designed for head-to-head leagues and
its framing does not adapt to VTF mode.

The correct fix is a VTF-mode variant of the matchup schedule page that explains the weekly
standings-based format and shows VP earned vs the field rather than 1v1 pairs.

Open questions (resolve before implementing):
- Q1: Should VTF mode show a "standings snapshot by week" table instead of matchup pairs?
- Q2: Is the matchup schedule page the right URL for this view, or should it redirect to standings?
- Q3: Does the schedule page need a new VTF-specific data shape from the API?

Acceptance Criteria (provisional):
- AC-001: In VTF mode, the matchup schedule page does not show 1v1 pairs as if they are the scoring mechanism.
- AC-002: The page either shows weekly VP standings or clearly explains that all teams compete together weekly.
- AC-003: Non-VTF leagues (if added later) continue to show the 1v1 schedule view.

Effort: Backend M · Frontend M · Testing S
Spec needed before implementation.

---

# Phase 1c: Playwright UX Walkthrough Findings — Jun 23, 2026

Source: Live Playwright UX walkthrough of the PWHL GM beta site, June 23, 2026. 11 raw findings deduplicated to 8 net-new items. P0 wizard "Create" 401 omitted — being fixed by engineering concurrently.

---

## BF-018. `/league-rules` 404 — Dead Internal Link on Every Dashboard Load

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough; superseded by Sprint 19 IA restructure)

Priority: P1

Effort: S

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. A dead internal link to `/league-rules` fires a 404 on every dashboard load. The route does not exist. The link is also referenced in the BLR-002 wizard beta welcome screen copy as a secondary link ("What's a replay league?").

Fix options (choose one):
- A (preferred): Create a minimal `/league-rules` route that renders the key rules from `docs/league-rules-v1.md` in a readable format. Doubles as a useful reference page for new users.
- B: Replace all `/league-rules` references with a tooltip, an anchor on an existing page (e.g., the standings `VpExplainer`), or remove the dead link entirely.

Files: `app/league-rules/page.tsx` (new, if option A); all files that reference `/league-rules` (search: `grep -r "league-rules" app/`).

Acceptance Criteria:
- AC-001: No 404 is returned when navigating to `/league-rules` or when any internal link points to it.
- AC-002: If option A: the page renders the key fantasy scoring rules in readable form, referencing `docs/league-rules-v1.md` content.
- AC-003: If option B: all links to `/league-rules` are removed or redirected to a valid destination.
- AC-004: `tsc --noEmit` clean; no new TypeScript errors.

---

## UX-051. VP Popover Overflows Viewport Bottom on Mobile (Wizard Rules Step)

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough; addressed alongside RD-004 wizard rebuild)

Priority: P1

Effort: S

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. Screenshot confirms: the VP "?" explainer popover in the wizard's Rules confirmation step (Step 4 in live mode) breaks the card layout and spills past the viewport bottom on mobile. This is the highest-value teaching moment in the entire product — the spot where users learn how VP scoring works — and it is currently visually broken on mobile.

The `VpExplainer` component renders a popover/tooltip that lacks overflow-scroll and upward-repositioning logic. On a 390px phone viewport, the popover renders below its anchor and clips.

Fix: Add `max-height: 60vh; overflow-y: auto; scroll-behavior: smooth` to the popover container, and add positioning logic to detect when the popover would overflow the bottom of the viewport and flip it above the anchor instead. No schema changes. No logic changes.

Files: `components/VpExplainer.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: On a 390px mobile viewport, triggering the VP "?" popover in wizard Step 4 does not overflow past the viewport bottom.
- AC-002: The popover is scrollable when its content exceeds available height.
- AC-003: The full VP explanation content is readable — nothing is clipped or hidden.
- AC-004: Desktop behavior (no overflow) is unchanged.
- AC-005: `tsc --noEmit` clean.

---

## UX-052. Invite Landing Page Has Insufficient Fantasy Primer for Cold New Users

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough)

Priority: P1

Effort: M

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. The logged-out invite landing page (`/join-league/[code]`) is the most common new-user entry point — a fan receives a link from a friend and opens it cold with no prior context. The current page shows a "Sign in / Start your franchise" prompt. AG-007 (Sprint 17) added a two-sentence fantasy explainer (AC-004), but the Jun 23 walkthrough found the experience still insufficient: a brand-new PWHL fan has no understanding of what fantasy hockey is, what they're joining, or why it's fun.

What's needed is a more substantial primer above the join form: 3–4 plain-language bullet points explaining what PWHL GM is, what a fantasy league involves, and what will happen next (join → draft → compete). This is the product's single best acquisition moment and it needs to earn the click.

Note: AG-007 is SHIPPED. This is a gap in the scope of what was shipped, not a regression.

Files: `app/join-league/page.tsx` (or `app/invite/[leagueId]/page.tsx` — whichever handles the public invite landing)

Acceptance Criteria:
- AC-001: The invite landing page renders a "What is PWHL GM?" primer section above the join form when the user is logged out.
- AC-002: The primer uses plain language with zero unexplained acronyms (no VP, FP, VTF on first mention without definition).
- AC-003: The primer is ≥ 3 bullet points or equivalent short-form explanation.
- AC-004: The primer is visible without scrolling on a 390px mobile viewport.
- AC-005: Logged-in users (returning to join a second league) do not see the primer — show it only when `!user`.
- AC-006: Existing join form behavior (invite code validation, team creation) is unchanged.

---

## UX-054. Replay CTA on Landing Page Has No "Why Would I Want This?" Explanation

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough)

Priority: P2

Effort: S

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. AG-007 (Sprint 17) added a "Try a Replay" secondary CTA button to the landing page (AC-002, shipped). The finding from the Jun 23 walkthrough is that the button floats with no emotional context — a first-time visitor has no idea what a "Replay" is, why they would want one, or why it's compelling. The button needs a one-line descriptor that communicates the value: learn the game risk-free before the live season begins.

Fix: Add a short subtitle (≤15 words) immediately below or adjacent to the Replay CTA. Example: "Try a full PWHL season risk-free using 2025-26 stats — no commitment needed." Copy-only change; no logic or schema changes.

Files: `app/page.tsx`

Acceptance Criteria:
- AC-001: The "Try a Replay" CTA on the landing page has a visible subtitle explaining the value (no prior knowledge of "Replay" required to understand it).
- AC-002: The subtitle is ≤15 words and contains no unexplained acronyms.
- AC-003: Desktop and mobile layouts render the subtitle without overflow or wrapping issues.
- AC-004: No other landing page behavior changes.

---

## UX-055. Wizard Doesn't Show Step Count Until After the Welcome Screen

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough)

Priority: P2

Effort: S

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. The "STEP N OF N" progress indicator in the league creation wizard only appears after the user leaves the welcome/beta screen (step 0 in beta mode) or from step 1 onward in normal mode. Users entering the flow don't know how long the wizard is, which creates uncertainty. In beta mode, the `BetaWelcomeStep` component hides the progress bar entirely (`{step > 0 && ...}`).

Fix: Show a step-count summary ("6 steps · ~3 minutes" for live mode; "5 steps · ~2 minutes" for replay mode) on the welcome screen or immediately below the wizard card title from step 1. For the BetaWelcomeStep, add a compact step summary below the heading. This does not require changing the existing step counter — it is a supplemental hint.

Files: `app/create-league/CreateLeagueWizard.tsx`, `components/BetaWelcomeStep.tsx` (or inline in wizard if no separate file)

Acceptance Criteria:
- AC-001: A user entering the wizard in any mode can see how many steps the flow has before completing step 1.
- AC-002: Beta mode (BetaWelcomeStep at step 0) shows a step summary below the heading.
- AC-003: Non-beta mode shows the step count from step 1 (no change to existing progress bar; supplement it).
- AC-004: The step count is accurate for both live mode (6 steps) and replay mode (5 steps).

---

## UX-056. Commissioner Draft Setup Checklist Has No Draft Primer

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough)

Priority: P2

Effort: S

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. The "Draft set up" step in the commissioner pre-draft checklist (admin panel and/or wizard done screen) shows a checklist item with no explanation of what a draft involves or what the commissioner needs to do. First-time commissioners don't know whether they need to configure anything, what "snake draft" means, or that they are the one who starts the draft timer.

Fix: Add a one-paragraph primer adjacent to the "Draft" section in the admin panel pre-draft checklist. Content: what a snake draft is (managers take turns picking real PWHL players), that the commissioner starts the draft when everyone is ready, that auto-pick fires if someone goes over the clock, and a link to the draft room. Copy-only addition; no schema changes.

Files: `app/league/[leagueId]/admin/page.tsx` (pre-draft checklist section), or `app/create-league/CreateLeagueWizard.tsx` (done screen) depending on where the checklist lives.

Acceptance Criteria:
- AC-001: A first-time commissioner viewing the pre-draft admin panel sees a plain-language explanation of what a draft is and what their role is.
- AC-002: The primer is ≤5 sentences and contains no unexplained jargon.
- AC-003: The primer includes a link to the draft room (`/draft/[leagueId]`).
- AC-004: Experienced commissioners are not penalized — the primer does not take up disproportionate space; it can be collapsed or positioned below the primary checklist action.

---

## UX-057. Wizard Rules Step Is a Jargon Wall (VP, PPP, UTIL Unexplained)

Sprint: 22 (carry-in from Sprint 19 Playwright walkthrough; addressed alongside RD-004 wizard rebuild)

Priority: P1

Effort: M

Status: Open

Source: Playwright UX walkthrough, Jun 23, 2026. The wizard Rules confirmation step (Step 4 in live mode) introduces VP, FP, PPP, and UTIL simultaneously on the same screen — the point in the flow where users are least equipped to process acronyms. OB-009 (Sprint 18, shipped) added a scoring chip row ("Goal 2 pts · Assist 1.5 pts · Win (G) 5 pts · PPP 1 pt · Shutout (G) 3 pts"), which improved FP values. The Jun 23 walkthrough found that PPP and UTIL still appear without plain-language definition, and the overall page overwhelms new users with density.

This is P1 because the Rules step is a commitment gate — users who can't parse it may abandon the wizard or create a league without understanding how it works.

Fix:
- Add inline definitions for PPP ("power play points — goals or assists on the power play") and UTIL ("utility — a flex slot that accepts any skater").
- Reorder copy to lead with plain language before the acronym (e.g., "Power Play Points (PPP)" not just "PPP").
- Consider hiding or deferring the playoff format detail to a collapsed expandable — it adds cognitive load for users who don't yet have a league to worry about.
- Requires copy + light layout review. No schema changes.

Note: This partially overlaps with OB-009 (FP values chip row, shipped Sprint 18) but addresses a broader jargon problem that OB-009 did not fix.

Files: `app/create-league/CreateLeagueWizard.tsx` (Step 4 / Rules step), `app/globals.css` (if tooltip styles needed)

Acceptance Criteria:
- AC-001: A first-time user with no fantasy sports background can read the Rules step without encountering an unexplained abbreviation.
- AC-002: PPP is defined inline (in parentheses or tooltip) on first appearance.
- AC-003: UTIL is defined inline (in parentheses or tooltip) on first appearance.
- AC-004: VP is either defined inline or the `VpExplainer` toggle is prominently visible and open by default on this step.
- AC-005: The step does not increase in total height — any new copy must be concise or replace existing dense text.
- AC-006: `tsc --noEmit` clean; existing wizard tests pass.

Effort: Backend 0 · Frontend M · Testing S

---

## UX-053. Email Invite Flow — Type-In Friends' Emails (Blocked on Email Infra)

Sprint: Post-email-infra backlog

Priority: P2

Effort: M

Status: Blocked — requires email infrastructure

Blocker: Email infrastructure is deferred post-beta per Sprint 7 stretch item ("Email Notifications" in `roadmap-sprints.md` Sprint 7 Stretch section). No transactional email provider (Resend or equivalent) is wired up. This item unblocks when email infra ships.

Source: Playwright UX walkthrough, Jun 23, 2026. Commissioners can only share a league invite link; there is no email-entry invite flow. First-time commissioners expect to type their friends' email addresses directly into the app (consistent with Yahoo, ESPN, Sleeper). This is a meaningful friction point for league fill — not every commissioner knows how to share a link effectively.

What it requires once email infra is available:
- An email-entry form in the commissioner admin panel / invite section: text input for email addresses (one per line or comma-separated), "Send Invites" button.
- Backend: sends an invite email with the league join link via the transactional email provider.
- Each email generates one `LeagueInvite` row (or reuses the existing invite link mechanism) and sends a formatted email with the league name, commissioner name, draft date, and join link.
- No new schema beyond what email infra requires; can reuse the existing invite link and `JOIN_CODE` mechanism.

Acceptance Criteria (for when unblocked):
- AC-001: Commissioner can enter 1–N email addresses in the admin panel and send invites in one action.
- AC-002: Each invitee receives an email with the league name, commissioner, draft date, and a direct join link.
- AC-003: Sending to an address that is already a league member produces a clear error, not a silent failure.
- AC-004: The existing share-link mechanism remains available alongside the email flow.

---

## BF-019. No Password Reset / Forgot Password on Login Page (Blocked on Email Infra)

Sprint: Post-email-infra backlog

Priority: P2

Effort: M

Status: Blocked — requires email infrastructure

Blocker: Same as UX-053. Email infrastructure is deferred post-beta. Password reset requires sending a reset link or magic link by email.

Source: Playwright UX walkthrough, Jun 23, 2026. Returning beta users who forget their password (or whose `pwhl_user_email` cookie has expired) have no self-service recovery path. The login page has no "Forgot password?" link. The app uses email-only cookie auth (`pwhl_user_email`, 30-day session). In this model, "password reset" means resending a magic link to the user's email or providing a re-auth flow.

Fix (when email infra ships):
- Add a "Forgot your access link?" link below the login form.
- Clicking it renders an email-entry field where users type their address.
- Backend sends a new magic-link email (same flow as initial registration, or a dedicated "re-auth" email).
- No password hashing or storage — this is purely a magic-link delivery flow.

Acceptance Criteria (for when unblocked):
- AC-001: The login page renders a "Forgot your access link?" link below the login form.
- AC-002: Submitting a valid email address sends a re-auth email with a new magic link.
- AC-003: Submitting an unrecognized email shows a friendly message without confirming or denying whether the address exists.
- AC-004: The existing login flow is unchanged.

---

# Sprint 18 Ad-hoc Beta Fixes — Jun 22–23, 2026

Source: Beta site bugs discovered during Sprint 18 (Jun 22–23, 2026) after the primary sprint tracks shipped. All four items shipped as atomic commits.

---

## BF-015. UTIL Slot False Error on Valid Forward Move

Sprint: 18 (ad-hoc)

Priority: P1

Status: ✅ SHIPPED — commit f400b90 (Jun 22, 2026)

Source: Regression discovered during Sprint 18 validation. In multi-move batches (e.g. auto-set
or bench-upgrade hint applying several moves at once), a stale closure in `LineupManager.tsx`
held the pre-move roster state for validation. When a forward was moved to UTIL, subsequent moves
in the same batch saw the UTIL slot as still filled and returned a false "slot full" error even
though the earlier move had vacated it.

Fix: updated the slot-validation closure to derive available capacity from the in-flight pending
moves rather than the snapshot roster state, so each move in a batch correctly accounts for
prior moves within the same operation.

Files: `app/team/[teamId]/lineup/LineupManager.tsx`

Acceptance Criteria:
- AC-001: Moving a forward to UTIL followed by a second forward to active in the same multi-move batch does not produce a false "slot full" error.
- AC-002: Single-move validation behavior is unchanged.

---

## BF-016. Activity Feed Shows Raw LEAGUE_STORYLINE Enum String

Sprint: 18 (ad-hoc)

Priority: P1

Status: ✅ SHIPPED — commit 70cd536 (Jun 22, 2026)

Source: Beta site observation. The activity feed in the league overview was rendering the raw
`LEAGUE_STORYLINE` string from the `EventType` enum instead of a human-readable label (e.g.
"League Storyline"). `TYPE_META` in `lib/services/activity.ts` was missing an entry for
`LEAGUE_STORYLINE`, causing the fallback display logic to expose the internal enum value.

Fix: added `LEAGUE_STORYLINE` to `TYPE_META` with label "League Storyline" and an appropriate
icon; added any other missing enum entries to prevent future regressions.

Files: `lib/services/activity.ts`

Acceptance Criteria:
- AC-001: Activity feed items with type `LEAGUE_STORYLINE` render a human-readable label, not the raw enum string.
- AC-002: All `EventType` enum values have a corresponding `TYPE_META` entry (no fallback to raw string for any valid type).

---

## BF-017. Auto-Set and Bench-Upgrade Hint Suggest Players with 0 Games

Sprint: 18 (ad-hoc)

Priority: P1

Status: ✅ SHIPPED — commit 622ac9a (Jun 22, 2026)

Source: Beta site observation. The auto-set optimal lineup function (`computeOptimalLineup` in
`lib/lineup.ts`) and the bench-upgrade hint in `LineupManager.tsx` were ranking players by
`projectedFp`, which could be `null` for players with no recent game history. Null-coalescing
logic treated `null` as `0` in some paths and as a large positive number in others, causing
zero-game players (new callups, injured players with no recent data) to surface as top suggestions
ahead of active players with real projections.

Fix: standardized null-coalescing for `projectedFp` across both the optimizer and the hint
calculation so `null` always resolves to `0` (i.e., ranks last, not first).

Files: `lib/lineup.ts`, `app/team/[teamId]/lineup/LineupManager.tsx`

Acceptance Criteria:
- AC-001: `computeOptimalLineup` never ranks a player with `projectedFp === null` above a player with `projectedFp > 0`.
- AC-002: Bench-upgrade hint does not suggest a swap to a player who projects 0 FP for the upcoming period.
- AC-003: Existing auto-set tests pass; no regression to players with valid projections.

---

## BLR-003. Expansion Team Teaser in Beta Welcome Screen + Draft Room

Sprint: 18 (ad-hoc)

Priority: P1

Status: ✅ SHIPPED — commit dfef7ef (Jun 22, 2026)

Source: Marketing/hype opportunity tied to the PWHL expansion draft happening the week of Jun 21,
2026. Four new teams (Detroit Hockey Team, Hamilton Hockey Team, Las Vegas Hockey Team, San Jose
Hockey Team) were publicly announced. Adding a teaser in the beta experience (welcome screen and
draft room header) provides context for why the live 2026-27 season will be significantly larger
than the 2025-26 replay data and builds excitement for the November live launch.

What shipped:
- Expansion team teaser copy added to the BLR-002 beta welcome screen (Step 0 in
  `CreateLeagueWizard.tsx`), noting that the live season will feature all 12 teams including the
  four new franchises.
- Draft room header in `app/draft/[leagueId]/page.tsx` updated with a contextual note about the
  2026-27 expansion, visible to beta participants during the replay draft.
- No schema changes. No new API routes.

Files: `app/create-league/CreateLeagueWizard.tsx`, `app/draft/[leagueId]/DraftRoom.tsx` (or `page.tsx`)

Acceptance Criteria:
- AC-001: Beta welcome screen (step 0) includes a visible reference to the four expansion teams or the 12-team 2026-27 season.
- AC-002: Draft room header includes expansion context copy for beta leagues.
- AC-003: Expansion teaser is gated on `isBetaMode` — does not appear in non-beta league creation or non-beta draft rooms.
- AC-004: No TypeScript errors; `tsc --noEmit` clean.

---

---

# Sprint 19: IA Restructure — Franchise-First Navigation + DnD Lineup

Status: ✅ COMPLETE (Jun 23, 2026)

Sprint: 19

All 5 parts shipped. No schema changes.

---

## Sprint 19 · Part 1 — Emoji Policy + Colorblind Fix

Status: ✅ COMPLETE (commit 0d00092)

Priority: P1

Established a tiered emoji policy for the codebase: Tier 1 (celebratory/onboarding contexts) YES; Tier 2 (navigation, tables, status chips) NO. Applied the policy immediately by fixing colorblind-accessibility gaps in the standings page status chips — replaced color-only differentiation with glyph+color: ✓ CLINCHED, ✗ ELIM, ◉ BUBBLE.

Files: `docs/branding/emoji-policy.md` (new), `app/league/[leagueId]/standings/page.tsx`, `app/globals.css` (added `chip-bubble` amber and `chip-out` gray CSS classes)

---

## Sprint 19 · Part 2 — Trades → My Franchise

Status: ✅ COMPLETE (commit a2cd617)

Priority: P1

Moved the entire trades surface from the league zone (`/league/[leagueId]/trades/`) into the franchise zone (`/team/[teamId]/trades/`). Old routes redirect to the team-scoped equivalents. Added a `/team/[teamId]/bracket` route and a `/team/[teamId]/transactions` route so all personal/transactional surfaces live under one URL prefix. Updated `TeamNav.tsx`: removed Lineup and Free Agents tabs (consolidated into roster); renamed Rosters → My Roster; Trades, Playoffs, and Transactions now all link to `/team/[teamId]/` routes. Removed Trades tab from the league nav.

Files: `app/team/[teamId]/trades/` (new route tree), `app/team/[teamId]/bracket/` (new), `app/team/[teamId]/transactions/` (new), `app/league/[leagueId]/trades/*` (redirect stubs), `app/team/[teamId]/TeamNav.tsx`

---

## Sprint 19 · Part 3 — League Overview → Commissioner-Only

Status: ✅ COMPLETE (commit 3ceb056)

Priority: P1

The `/league/[leagueId]` overview now redirects non-commissioner members directly to their team matchup page (`/team/[teamId]/matchup`). The league overview is now a commissioner dashboard — My Matchup widget and non-commissioner content removed. `/league/[leagueId]/roster` (the "All Rosters" communal view) similarly requires commissioner access; non-commissioners use `/team/[teamId]/roster` (My Roster) for their own roster and can browse other teams' rosters via the team selector on that page.

Files: `app/league/[leagueId]/page.tsx`, `app/league/[leagueId]/roster/page.tsx`

---

## Sprint 19 · Part 4 — Combined My Roster with DnD Lineup Management

Status: ✅ COMPLETE (commit 01075f9)

Priority: P1

Replaced the click-to-swap lineup manager with a drag-and-drop experience built on `@dnd-kit`. The new `LineupDnD.tsx` component lives at the top of the roster page and shows active slots, bench, and IR with drag handles. Features: stats tabs (Season/This week/Last week/Projected); games-remaining badges; play-lock validation; `DragOverlay` for touch support. `app/team/[teamId]/roster/page.tsx` was rewritten to fetch all lineup data server-side (lock status, stats tabs, projections, games remaining) and render `LineupDnD` above `RosterManager`. The old `/team/[teamId]/lineup` route now redirects to `/team/[teamId]/roster`.

New dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

Files: `components/LineupDnD.tsx` (new), `app/team/[teamId]/roster/page.tsx` (rewritten), `app/team/[teamId]/lineup/page.tsx` (redirect stub)

---

## Sprint 19 · Part 5 — Commissioner God-Mode on My Roster

Status: ✅ COMPLETE (commit b4986a6)

Priority: P2

Commissioners can now view and rearrange any team's roster from the roster page. When a commissioner uses the team selector to view another team, `LineupDnD` renders in `forceMove` mode — drag-and-drop calls `/api/leagues/[leagueId]/commissioner/force-move` instead of the regular lineup API, bypassing the ownership check while still enforcing slot eligibility and play-lock rules. An amber "Commissioner view" banner appears in `LineupDnD` when `forceMove=true`. `RosterManager` shows a "⚙ Commissioner View" chip alongside the existing "← My Team" back button to make the mode explicit.

Files: `components/LineupDnD.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/team/[teamId]/roster/page.tsx`

---

# Sprint 22 — "Inviting Dark" Redesign

Spec authority: `docs/branding/pwhl_redesign_bundle_v3_1.zip`

No schema changes. No new API routes. Pure UI/CSS.

---

## RD-001. Token Swap — Replace `:root` with Inviting Dark Tokens

Sprint: 22
Priority: P1
Effort: S
Status: Open
Source: `globals.tokens.css` in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Replace the existing `:root` block in `app/globals.css` with the Inviting Dark token set from `globals.tokens.css`. Three follow-up edits ship in the same PR: (1) body radial-gradient updated to the new background value, (2) `.button-primary` text color set to `--accent-ink` (dark text on bright accent), (3) `.section-accent` drops the violet tint and inherits the new accent color.

Files: `app/globals.css`

Acceptance Criteria:
- AC-001: Given the updated `globals.css`, when any page loads, the background radial-gradient uses the Inviting Dark values from the spec.
- AC-002: `.button-primary` renders with dark `--accent-ink` text instead of white.
- AC-003: `.section-accent` no longer applies a violet background.
- AC-004: `tsc --noEmit` clean and all existing tests pass.

---

## RD-002. Inline Hex Sweep — `app/**` + `components/**`

Sprint: 22
Priority: P1
Effort: M
Status: Open
Source: `color-replacement-map.md` in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Walk every file in `app/**` and `components/**` and replace hardcoded hex values with their CSS token equivalents per `color-replacement-map.md`. After the sweep, manually verify that all buttons and status badges still meet WCAG AA contrast requirements against their new background tokens.

Files: All files under `app/**` and `components/**` containing hardcoded hex colors listed in `color-replacement-map.md`

Acceptance Criteria:
- AC-001: No hardcoded hex values from `color-replacement-map.md` remain in `app/**` or `components/**`.
- AC-002: All buttons and badges pass WCAG AA contrast check after replacement.
- AC-003: `tsc --noEmit` clean; no visual regressions on core pages (matchup, standings, draft).

---

## RD-003. Emoji Policy Restoration

Sprint: 22
Priority: P1
Effort: S
Status: Open
Source: Tiered emoji policy section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

The Sprint 15 DS-002 token sweep removed all emoji from the UI with a blanket ban. The Inviting Dark design handoff restores a tiered policy: Tier 1 contexts (celebratory moments, onboarding, recap cards) SHOULD use emoji for warmth; Tier 2 contexts (nav, tables, status chips) SHOULD NOT. Apply the tiered policy: restore glyph chips (✓ CLINCHED, ✗ OUT, ◉ BUBBLE) where they were removed, restore activity-feed emoji, recap emoji, and the lock emoji on lineup locked players. Remove any remaining blanket-ban relics.

Files: `app/league/[leagueId]/standings/page.tsx`, `app/team/[teamId]/matchup/page.tsx`, `lib/services/activity.ts`, `components/EmptyState.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: Standings clinched/eliminated/bubble chips render with glyph + color (not color-only).
- AC-002: Activity feed items render with emoji per the tiered policy.
- AC-003: Lineup locked players show the lock emoji on their card.
- AC-004: No emoji appear in primary nav items or sortable table headers.

---

## RD-004. VP Popover Fix + Create League Wizard Rebuild

Sprint: 22
Priority: P1
Effort: L
Status: Open
Source: Wizard rebuild section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Two related changes ship together: (1) Fix the anchored popover in `components/VpExplainer.tsx` — currently clips off the bottom of the viewport on mobile in the wizard Rules step (UX-051). Use a CSS-positioned popover that stays within the viewport bounds. (2) Rebuild `app/create-league/CreateLeagueWizard.tsx` with the rule-sheet layout from the design handoff: scoring displayed in a two-column table (stat on left, points on right), roster slots as pill badges (F F F / D D / G / UTIL / BN×6), and a clean separation between the live and replay paths.

Files: `components/VpExplainer.tsx`, `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: On a 375px wide mobile viewport, the VP popover in the wizard Rules step does not clip below the visible window.
- AC-002: The wizard Rules step displays scoring as a two-column table.
- AC-003: Roster slots are rendered as pill badges.
- AC-004: All existing wizard tests pass; live and replay paths both complete end-to-end.

---

## RD-005. League Overview Flagship Redesign

Sprint: 22
Priority: P1
Effort: L
Status: Open
Source: `references/League Overview.dc.html` in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Redesign `app/league/[leagueId]/page.tsx` to match the reference HTML. Key changes: gold commissioner action strip at the top (replaces amber banner); glyph chips on the playoff race table (consistent with RD-003); My Matchup widget recolored to sky-accent instead of the current indigo; league leaders section uses the new two-column card layout from the reference.

Files: `app/league/[leagueId]/page.tsx`, `app/globals.css` (new `.commissioner-strip` and `.sky-card` utility classes if needed)

Acceptance Criteria:
- AC-001: The commissioner action strip uses the gold token, not amber.
- AC-002: Playoff race table glyph chips match the RD-003 emoji policy.
- AC-003: My Matchup widget uses the sky-accent card background.
- AC-004: Page renders correctly at 375px, 768px, and 1280px viewport widths.

---

## RD-006. Team Matchup Flagship Redesign

Sprint: 22
Priority: P1
Effort: L
Status: Open
Source: `references/Team Matchup.dc.html` in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Redesign `app/team/[teamId]/matchup/page.tsx` to match the reference HTML. Key changes: DuelHero gets a warm gradient background with a gold radial accent behind the score display; score colors use `--score-win` / `--score-loss` / `--score-tied` token vars instead of hardcoded hex; RecapCard gets the prestige treatment (elevated border, contextual emoji copy); all-set banner gets a distinct "you're good" color treatment that does not look like a warning.

Files: `app/team/[teamId]/matchup/page.tsx`, `components/DuelHero.tsx`, `components/FieldHero.tsx`, `app/globals.css`

Acceptance Criteria:
- AC-001: DuelHero renders the warm gradient + gold radial in active-matchup state.
- AC-002: Score colors reference CSS token vars, not hardcoded hex values.
- AC-003: RecapCard uses the prestige border treatment.
- AC-004: The all-set lineup banner uses a distinct non-warning color.

---

## RD-007. Remaining Page Recolor Sweep

Sprint: 22
Priority: P1
Effort: L
Status: Open
Source: `page-inventory.md` in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Walk every route marked `[recolor]` in `page-inventory.md` and apply the Inviting Dark token replacements. Covers: dashboard (`app/dashboard/`), standings (`app/league/[leagueId]/standings/`), bracket (`app/league/[leagueId]/bracket/`), admin (`app/league/[leagueId]/admin/`), roster (`app/team/[teamId]/roster/`), draft room (`app/draft/[leagueId]/`), trades (`app/team/[teamId]/trades/`), auth pages (`app/login/`, `app/register/`), founder console (`app/founder/`), and shared components (`components/`).

Files: All routes and components listed in `page-inventory.md` under `[recolor]`

Acceptance Criteria:
- AC-001: All `[recolor]` pages in `page-inventory.md` use Inviting Dark token vars.
- AC-002: No `[recolor]` page retains any hex values listed in `color-replacement-map.md` after this sweep.
- AC-003: Draft room and standings page render correctly at 375px mobile width.

---

## RD-008. Momentum Strip Component

Sprint: 22
Priority: P1
Effort: M
Status: Open
Source: Emotional UX section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

New `components/MomentumStrip.tsx` — a compact stats bar placed directly under the matchup score header. Shows: +X FP since yesterday, N players still to play today, opponent's current situation. Hidden before any game has been played in the period (pre-game state). Collapses gracefully to a single line when the matchup is complete. Placed in Z2 of the matchup page render order, immediately below the hero score.

Files: `components/MomentumStrip.tsx` (new), `app/team/[teamId]/matchup/page.tsx`, `lib/services/dashboard.ts` (new `momentumData` field on `DashboardData` if needed)

Acceptance Criteria:
- AC-001: `MomentumStrip` is not rendered when `matchup.isUpcoming` is true.
- AC-002: When an active matchup has started, the strip shows FP delta since yesterday, players-remaining count, and opponent status.
- AC-003: When the matchup is complete, the strip collapses to a single summary line.
- AC-004: No schema changes; data derived from existing `StatLine` and `Game` rows.

---

## RD-009. Prestige Gradient Token

Sprint: 22
Priority: P2
Effort: S
Status: Open
Source: Emotional UX section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Add `--prestige-gradient` CSS variable to `app/globals.css`. Apply it to: champion cards (wherever the champion is displayed after playoffs), clinched playoff banners, and weekly recap heroes when the player had a top-3 FP week. Never apply to buttons, nav items, or generic cards — prestige must feel earned.

Files: `app/globals.css`, `app/team/[teamId]/matchup/page.tsx`, `app/league/[leagueId]/bracket/page.tsx`, `app/league/[leagueId]/page.tsx`

Acceptance Criteria:
- AC-001: `--prestige-gradient` is defined in `app/globals.css`.
- AC-002: Champion cards use `--prestige-gradient` as the card background.
- AC-003: Clinched playoff banners use `--prestige-gradient`.
- AC-004: No button, nav item, or generic card uses `--prestige-gradient`.

---

## RD-010. Gold Prestige Moments

Sprint: 22
Priority: P2
Effort: M
Status: Open
Source: Emotional UX section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Apply the `--gold` CSS token (defined in the Inviting Dark token set) to exactly five surfaces: weekly high score badge, first-place standing indicator, hot streak chip, clinched banner, and champion card. Gold must remain rare — do not add it to any other surface without explicit product approval.

Files: `app/league/[leagueId]/standings/page.tsx`, `app/team/[teamId]/matchup/page.tsx`, `app/league/[leagueId]/bracket/page.tsx`, `app/league/[leagueId]/page.tsx`

Acceptance Criteria:
- AC-001: The weekly high score badge uses `--gold`.
- AC-002: The first-place standings indicator uses `--gold`.
- AC-003: The hot streak chip uses `--gold`.
- AC-004: The clinched playoff banner uses `--gold`.
- AC-005: The champion card uses `--gold`.
- AC-006: No other surface in `app/**` or `components/**` references `--gold`.

---

## RD-011. Empty State Personality Copy

Sprint: 22
Priority: P2
Effort: S
Status: Open
Source: Emotional UX section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Update `components/EmptyState.tsx` and inline empty state strings with warm, personality-driven copy. Key replacements: transaction feed empty state → "Quiet week. Nobody's shopping players right now."; draft queue empty state → "Build your wishlist before draft night."; all-set lineup state → "You're all set — sit back and let your stars cook." Audit all empty state strings in the listed files and replace generic "No data" / "Nothing here" copy with context-appropriate warm alternatives.

Files: `components/EmptyState.tsx`, `app/team/[teamId]/matchup/page.tsx`, `app/team/[teamId]/roster/RosterManager.tsx`, `app/league/[leagueId]/transactions/TransactionFeed.tsx`, `app/draft/[leagueId]/DraftRoom.tsx`

Acceptance Criteria:
- AC-001: Transaction feed empty state reads "Quiet week. Nobody's shopping players right now."
- AC-002: Draft queue empty state reads "Build your wishlist before draft night."
- AC-003: All-set lineup state reads "You're all set — sit back and let your stars cook."
- AC-004: No empty state in the listed files reads "No data" or "Nothing here" without context.

---

## RD-012. Wizard "Your League at a Glance" Summary Panel

Sprint: 22
Priority: P2
Effort: M
Status: Open
Source: Emotional UX section in `docs/branding/pwhl_redesign_bundle_v3_1.zip`

Add a 4-item summary card at the wizard completion step (step 6 / final step). The card shows: N Teams (from step 2), 20 Weeks (fixed for 2026-27), Head-to-Head Points (scoring format), Weekly Waivers (transaction mode). Subtitle: "This should take about 2 minutes." The summary card precedes the invite link on step 6; the invite link moves below it. Does not render on the Replay path.

Files: `app/create-league/CreateLeagueWizard.tsx`

Acceptance Criteria:
- AC-001: Wizard completion step shows a 4-item summary card before the invite link.
- AC-002: The team count in the card reflects the size chosen in step 2.
- AC-003: The card subtitle reads "This should take about 2 minutes."
- AC-004: The invite link still appears below the summary panel.
- AC-005: Summary card does not render on the Replay path.

---

## RD-013. Team Identity Colors

Sprint: 23

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: Give each manager a subtle, self-chosen accent color so opponents are recognizable at a glance across matchup, standings, and activity surfaces — without adding visual noise.

Acceptance Criteria:
- Managers can pick one team accent from a small curated palette (6–8 swatches that all pass AA on `--card`); a default is assigned rather than left blank
- The chosen color renders as: avatar ring on the matchup DuelHero/FieldHero; subtle tint behind the team name; avatar dot in standings + activity feed rows
- Team color never overrides semantic colors (win `--green`, loss `--red`, gold prestige) and never fills a full card background, nav, or button
- The opponent avatar in DuelHero uses the opponent's identity color, replacing the current neutral graphite default, so both sides are visually distinct
- Renders correctly at 375px / 768px / 1280px; colorblind-safe because color is always paired with the team name text
- Requires a new persisted field on `FantasyTeam` (e.g. `accentColor String?`); schema migration required

Depends On: RD-002 (hex sweep), RD-006 (matchup redesign), RD-005 (league overview)

---

## RD-014. Live Matchup Excitement Indicators (Trend Arrows + Upset Chip)

Sprint: 22

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: Make the matchup page feel competitive with lightweight live indicators that signal momentum and upset drama beyond the raw score.

Acceptance Criteria:
- Each side's projected total shows a directional trend arrow vs the prior refresh/day (`▲ +4.3 projected` in `--green`, `▼ −1.2 projected` in `--red`); hidden before any game in the period has started
- When win probability for the trailing team is between ~10% and ~40%, an upset chip renders on the hero (`⚡ 18% chance to steal the win`) using `--gold`/`--amber` per the emoji policy (emoji always paired with text label)
- Indicators are suppressed in SETUP phase and after matchup completion (when Momentum Strip collapses)
- In VTF (FieldHero) mode, "steal the win" copy is reframed to a field-rank framing rather than referencing a single opponent
- Mobile: indicators wrap/truncate gracefully and do not push the score off-screen at 375px
- No schema change — derives from existing projection + win-probability data already in `getDashboardData`

**Division of labor note:** RD-008 = Momentum Strip (pts-since-yesterday / players-remaining / opp-status). LL-008 = retrospective upset lore. RD-014 = live per-projection trend arrows + in-the-moment upset chip. These are three distinct UI surfaces sharing the same placement zone; keep them in separate components.

Depends On: RD-006 (matchup redesign), RD-008 (Momentum Strip — shares data layer and placement zone)

---

## RD-015. Settings Editor Rule-Sheet Restructure

Sprint: 22

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: Bring the commissioner Settings editor in line with the wizard's rule-sheet layout so scoring and roster config read as a clean reference card everywhere, not raw JSON in one place and a polished sheet in another.

Acceptance Criteria:
- The scoring section of `SettingsEditor.tsx` renders as the same two-column Skaters / Goalies table used in the wizard Rules step (stat in `--text` left, value in `--green` tabular-nums right)
- Roster slots render as the same pill badges as the wizard (`3 F`, `2 D`, `1 UTIL`, `1 G`, `6 Bench`) with the "UTIL takes any skater (F or D)" sub-line
- Section headers are sentence-case 13–14px `--dim` labels — no ALL-CAPS letter-spaced eyebrows
- Editable fields retain full edit behavior; this is a presentation restructure only — all existing settings save/validation tests pass
- Supersedes the `[recolor]`-only treatment for settings noted in RD-007

Depends On: RD-004 (wizard rule-sheet — reuse its table + pill components)

---

## RD-016. Brand Theme Naming Decision — "Northern Ice"

Sprint: 22

Priority: P2

Effort: S

Status: 🔵 PLANNED

Goal: Lock a memorable name for the new design theme (handoff recommends "Northern Ice" over working title "Inviting Dark") and apply it consistently in user-facing references and docs.

Acceptance Criteria:
- Product decision recorded: chosen theme name confirmed ("Northern Ice" recommended; alternatives considered: Arena Lights, Championship Night, Frozen Gold)
- Any future user-facing theme label (theme picker, marketing copy) uses the chosen name, not "Inviting Dark"
- The chosen name is reflected in the `globals.css` header comment and `docs/branding/` README so engineering and design share one vocabulary
- No functional or color change — naming only; no schema change

Depends On: RD-001 (token swap — same file header)

---

## RD-017. Emotional Design North-Star Principles (Doc Artifact)

Sprint: 22

Priority: P2

Effort: S

Status: 🔵 PLANNED

Goal: Capture the "should feel / avoid feeling" design principles as a standing reference so future decisions have a north star, instead of re-deriving intent from screenshots each time.

Acceptance Criteria:
- A short principles doc at `docs/branding/emotional-design-principles.md` states PWHL GM should feel: Competitive, Welcoming, Premium, Seasonal, Social — and must avoid feeling like: Enterprise SaaS, hockey analytics software, a generic admin dashboard, or a mobile banking app
- Includes the signature-moment rule: gold (`--gold`) reserved for champion / hot streak / weekly high score / clinched / first place — never used for neutral or informational UI
- Includes the product north-star line: "arena concourse between periods, not accounting software"
- Linked from the Sprint 22 exit criteria and the branding README so it is discoverable by future contributors
- Documentation only — no code change; no schema change

Depends On: (none — establishes principles applied by RD-001 through RD-016)

---

# Phase 9: Living League — Delight Mechanics v1

Source: `docs/01-roadmap/living-league-product-strategy.md` + `docs/01-roadmap/living-league-roadmap.md`

Vision: evolve PWHL GM from "fantasy hockey software" into "a living hockey league that remembers things, celebrates accomplishments, and tells stories about itself." Sprints 21–26.

---

## LL-001. Weekly Awards Ceremony

Sprint: 21

Priority: P1

Effort: M

Status: ✅ SHIPPED

Goal: After each week scores, the league automatically generates 5 awards celebrating the week's standout performances. Awards appear on the league overview and in each team's weekly recap. Makes every Tuesday feel like something happened.

Award categories:
- **🏆 Ice-Cold Closer** — highest score in the league this week
- **🔥 Heater Award** — biggest positive score vs projected (outperformed projection by most FP)
- **💀 Heartbreaker** — highest score among teams who lost their matchup
- **📉 Collapse of the Week** — biggest score underperformance vs projection
- **🧊 Frozen Stick** — lowest score in the league this week

Acceptance Criteria:
- `computeWeeklyAwards(leagueId, periodId, prisma)` in `lib/services/storyline-service.ts` returns `WeeklyAward[]` — pure, no IO
- `emitWeeklyAwards(leagueId, periodId, prisma)` called from `advanceSeason()` after `emitWeeklyStorylines()` — fire-and-forget, same pattern
- Each award emitted as a `LEAGUE_STORYLINE` `LeagueEvent` with `data.awardType` discriminator
- `WeekHighlights.tsx` renders award cards visually distinct from storyline cards (different icon + border color)
- Awards appear on league overview after the week's matchup grid
- A manager who wins an award gets an in-app notification (type `LINEUP_INCOMPLETE` reused as `WEEKLY_AWARD` — or add enum value if schema risk is acceptable)
- No schema change (reuses existing `LEAGUE_STORYLINE` EventType + `LeagueEvent` model)

Depends On: existing `storyline-service.ts`, `advanceSeason()` in `lib/season/index.ts`, `WeekHighlights.tsx`

---

## LL-002. Matchup Momentum Strip

Sprint: 21 (data layer) / 22 (visual component — absorbed into RD-008, Sprint 22 Inviting Dark Redesign)

Priority: P1

Effort: S

Status: ✅ SHIPPED (data layer)

Goal: A momentum card beneath the matchup hero shows live score delta vs 24 hours ago, players still to play, and whether the opponent has finished. Makes active matchups feel exciting even when you're behind.

**Sprint coordination note:** Sprint 21 ships the data layer (new `ActiveMatchup` fields in `getDashboardData`). Sprint 22 (RD-008) builds `MomentumStrip.tsx` using those fields and integrates it into the matchup page. The full feature is complete after Sprint 22.

Acceptance Criteria (Sprint 21 — data layer):
- `scoreDeltaSinceYesterday: number | null` added to `ActiveMatchup` in `lib/services/dashboard.ts`, computed by calling `computeTeamScoreDetailed` at `nowMs - 86400000` vs current score; `null` when period age < 24h or setup phase
- `playersRemainingTonight: number` and `opponentFinished: boolean` derived from roster `gamesThisPeriod` data already fetched in `getDashboardData`
- All three fields correct under dev sim date cookie
- No new API route

Acceptance Criteria (Sprint 22 — visual, see RD-008):
- `MomentumStrip.tsx` renders between Z2 and Z3 using the three fields above
- Hidden when `isSetupPhase`, hidden when no active period, collapses after matchup completes

Depends On: `lib/services/dashboard.ts` (`getDashboardData`, `computeTeamScoreDetailed`)

---

## LL-003. Animated Stat Chips

Sprint: 21

Priority: P2

Effort: S

Status: ✅ SHIPPED

Goal: Small animated pill badges highlight exceptional player moments inline on the matchup and lineup pages. Turns raw stats into emotional signals.

Chip types:
- **🔥 N Game Streak** — player has scored FP in N consecutive games
- **⚡ Projection Swing** — player significantly outperformed or underperformed projection this week
- **🏆 League Record** — player holds a current league record (highest single-week FP)
- **⭐ Weekly Leader** — player is the top scorer in the league this period

Acceptance Criteria:
- New `StatChip.tsx` component renders as a small pill badge with icon, label, and a CSS `@keyframes` pulse animation (one-time, not looping)
- Chips computed server-side in `getDashboardData` — each `RosterEntryRow` gets `chips: StatChip[]` (empty array when none apply)
- Streak chip: requires counting consecutive games with FP > 0 from recent `StatLine` history
- Projection swing chip: `|thisWeekFp - projectedFp| > 5` threshold
- League record chip: compare player's period FP to `leagueHighScore` returned by existing data
- Weekly leader chip: player has the highest FP among all active players across all teams this period
- Chips rendered in the roster breakdown section (Z6) on matchup page beside player name
- No schema change

Depends On: `getDashboardData`, existing `StatLine` data, `RosterEntryRow` type

---

## LL-004. Magic Number

Sprint: 23

Priority: P1

Effort: S

Status: 🔵 PLANNED

Goal: Contending teams see exactly what it takes to clinch a playoff berth — N wins or M opponent losses. Makes standings feel like a real playoff race.

Acceptance Criteria:
- `computeRace()` in `lib/playoffs/seeding.ts` extended to add `magicNumber: number | null` to `RaceInfo`
- Formula: number of additional VP wins (or opponent non-wins) needed to mathematically secure a playoff berth vs the last bubble team, accounting for remaining games for both teams
- `null` when: team already clinched (`status === "clinched"`), team already eliminated, or the math is not yet conclusive early in the season (fewer than half the games played)
- "Magic: N" chip displayed on standings page (`app/league/[leagueId]/standings/page.tsx`) next to the existing race chip for teams with `status === "in"` or `"bubble"` where `magicNumber > 0`
- No new API — standings page already calls `computeRace()` server-side
- No schema change

Depends On: `computeRace()` in `lib/playoffs/seeding.ts`, standings page

---

## LL-005. Playoff Clinch Celebration

Sprint: 23

Priority: P1

Effort: S

Status: 🔵 PLANNED

Goal: When a team clinches a playoff berth after a week scores, they receive a one-time celebratory moment — a notification and a dismissible banner on their matchup page.

Acceptance Criteria:
- After `advanceSeason()` scores a week, call `computeRace()` before and after — detect teams whose `status` changed to `"clinched"` in this scoring pass
- For each newly-clinched team: call `createNotification(ownerId, "PLAYOFF_QUALIFICATION", { title: "Playoff Berth Clinched!", body: "Your team has secured a spot in the playoffs. N–M record.", actionUrl: "/team/.../matchup" }, prisma)` — fire-and-forget
- Emit a `PLAYOFF_CLINCH` `LeagueEvent` (already in schema) with `data.seed` and `data.clinchWeek`
- Dismissible banner rendered on `/team/[teamId]/matchup` when a `PLAYOFF_CLINCH` event exists and user hasn't dismissed it — shows "🏒 PLAYOFF BERTH CLINCHED — [Team] is the Nth team to secure a spot" with seed info
- Shown once; dismiss stores flag in `localStorage` keyed on `leagueId + season`
- No schema change — `PLAYOFF_CLINCH` EventType already exists; `PLAYOFF_QUALIFICATION` NotificationType already exists

Depends On: `advanceSeason()`, `computeRace()`, `createNotification()`, `PLAYOFF_CLINCH` EventType

---

## LL-007. Bubble Watch ("If The Season Ended Today")

Sprint: 23

Priority: P2

Effort: S

Status: 🔵 PLANNED

Goal: A "If the season ended today" section on the standings page groups teams into Playoff / Bubble / Eliminated with a simple visual that makes standings feel urgent.

Acceptance Criteria:
- New `BubbleWatch.tsx` server-rendered section appended below the main standings table on `/league/[leagueId]/standings`
- Three groupings derived from existing `computeRace()`: "In the Playoffs" (clinched + in), "Bubble" (bubble), "Eliminated" (eliminated + out)
- Each team row shows: rank, name, record, race status chip (reusing existing `.chip-clinched` / `.chip-bubble` etc. CSS classes)
- Shown only when season is `IN_SEASON` — hidden pre-draft and in playoffs
- Late-season emphasis: section heading changes from "Current Playoff Picture" to "Playoff Push" after week N/2 of the regular season
- No schema change

Depends On: `computeRace()`, existing standings page, existing chip CSS classes

---

## LL-008. Upset Tracker

Sprint: 23

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: Major upsets are remembered and surfaced as league lore — the game where the 10% underdog won, the week a dominant team got knocked off. Makes unlikely victories feel legendary.

Acceptance Criteria:
- New `lib/services/upset-service.ts` — `getLeagueUpsets(leagueId, prisma)` scans all scored matchups and computes the win probability at the time of each matchup (using `winProbability(homeProjected, awayProjected)` from `lib/projections/index.ts`); returns top 3 upsets by underdog probability (this season + all-time)
- An upset is defined as a matchup result where the loser had `winProbability > 0.65` going in
- **Implementation note on win probability**: the current architecture does not store `winProbAtClose` on `Matchup`. Two options: (a) compute retrospectively from final scores using `winProbability(homeScore, awayScore)` as a proxy — fast, no schema change; (b) add `Matchup.winProbAtClose Float?` stored at scoring time — accurate but requires migration. Prefer option (a) for Sprint 22; option (b) is a post-launch improvement if accuracy matters.
- `UpsetCard.tsx` displays the top upset(s): matchup, projected winner, actual result, underdog probability
- Rendered on league overview sidebar (below activity feed or as part of `WeekHighlights`) — only when at least one qualifying upset exists
- No schema change required for option (a)

Depends On: `lib/projections/index.ts` (`winProbability`), scored `Matchup` rows

---

## LL-006. Season Timeline

Sprint: 24

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: The league overview shows a scrollable timeline of the season's most significant moments — trades, clinches, records, and the eventual champion. The league develops a narrative managers can look back on.

Timeline event types:
- Biggest Trade (most players involved, or highest-FP player traded)
- Longest Win Streak (team + count + weeks)
- Playoff Clinch (team + seed + week)
- League Record Broken (category + player/team + value)
- Championship (champion + final score)

Acceptance Criteria:
- New `lib/services/timeline-service.ts` — `getSeasonTimeline(leagueId, prisma)` returns `TimelineEvent[]` sorted by `occurredAt` ascending
- Events sourced entirely from existing `LeagueEvent` rows (TRADE, PLAYOFF_CLINCH, PLAYOFF_ELIMINATION, CHAMPIONSHIP_WON, LEAGUE_STORYLINE with `data.isRecord === true`) — no new schema writes
- New `SeasonTimeline.tsx` component rendered on the league overview left column, below the playoff race module — collapses when fewer than 3 events exist (too early in season)
- Each event shows: date, icon, one-sentence description generated from `LeagueEvent.data`
- No schema change

Depends On: existing `LeagueEvent` rows (TRADE, PLAYOFF_CLINCH, CHAMPIONSHIP_WON), league overview layout

---

## LL-010. League Record Book

Sprint: 24

Priority: P1

Effort: M

Status: 🔵 PLANNED

Goal: Historical records give managers bragging rights beyond a single season. The record book tracks league-wide bests and motivates managers to chase history.

Record categories:
- Highest Single-Week Score (team)
- Longest Win Streak (team, consecutive VP wins)
- Biggest Blowout (largest margin of victory in a single matchup)
- Closest Victory (smallest margin)

Acceptance Criteria:
- New `/league/[leagueId]/records` page — server-rendered, no client JS needed
- Two tabs: "This Season" and "All Time" — "All Time" queries across all leagues in the `parentLeagueId` lineage
- Each record shows: holder name, value, week/date it was set
- Records computed via Prisma queries against `Matchup` and `StatLine` tables — no new schema columns
- "Records" link added to league nav (`app/league/[leagueId]/layout.tsx`)
- Empty state: "Records will appear after the first week scores"

Depends On: `Matchup` table, `StatLine` table, `parentLeagueId` lineage relation

---

## LL-011. Franchise Identity

Sprint: 24

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: Each team automatically earns a personality archetype based on how they actually play — goalies-first, boom-or-bust, defensive fortress. Teams feel emotionally distinct, not just statistically distinct.

Archetypes:
- **🔥 Boom or Bust** — high scoring variance (high stddev in weekly scores)
- **🧱 Defensive Fortress** — above-median goalie FP contribution as % of total roster FP
- **🎯 Sniper Factory** — above-median goal-scorer FP concentration (top 2 skaters dominate total FP)
- **🥅 Goaltender Driven** — goalie FP > 25% of total roster FP

Acceptance Criteria:
- `computeFranchiseIdentity(teamId, scoringPeriods, prisma)` in `lib/services/analysis-service.ts` returns `{ archetype: string, icon: string, description: string } | null` (null when fewer than 4 weeks of data)
- Archetype displayed as a styled chip in the team matchup page header (Z2 area, next to team record)
- Archetype recomputed each time the dashboard loads (no caching needed — derived from existing `StatLine` and `Matchup` data)
- Changes are expected season-to-season as roster composition evolves — this is a feature, not a bug
- No schema change

Depends On: `lib/services/analysis-service.ts`, `lib/services/dashboard.ts`, matchup page Z2 area

---

## LL-012. Manager Superlatives

Sprint: 24

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: After the championship, every manager receives a superlative recognizing their play style over the season. It's a playful end-of-year moment that makes the season feel complete.

Superlative categories:
- **🧠 Waiver Wizard** — most waiver claims submitted across the season
- **💰 Trade Shark** — most trades proposed AND accepted (both sides of the deal)
- **🎯 Draft Sniper** — highest % of rounds where drafted player outperformed draft position by FP (requires prior-season stats)
- **🪨 Iron Lineup** — fewest lineup changes (lowest transaction count overall)
- **😫 Snakebitten** — most lineup-locked players who scored 0 FP in the period they were locked

Acceptance Criteria:
- `computeManagerSuperlatives(leagueId, prisma)` in `lib/services/storyline-service.ts` returns one superlative per manager — each team gets exactly one (their top category)
- Computed only when `playoffStatus === "COMPLETE"` — called from league overview page server-side
- Displayed on league overview below the champion banner — one card per manager with icon, label, and one-line explanation
- Emitted as `LEAGUE_STORYLINE` `LeagueEvent` rows so they persist in the activity feed
- No schema change

Depends On: `LeagueEvent` (PLAYER_ADD, PLAYER_DROP, TRADE, DRAFT_PICK), `playoffStatus === COMPLETE`

---

## LL-009. Trophy Cabinet

Sprint: 25

Priority: P1

Effort: L

Status: 🔵 PLANNED

Goal: Championships, records, and achievements persist across seasons and display on a team's trophy page. Winning something should stay with a franchise forever.

Trophy types:
- `CHAMPION` — league champion for the season
- `REGULAR_SEASON_WINNER` — highest VP at end of regular season
- `WEEKLY_HIGH_SCORE` — set the all-time league high score for a single week
- `LONGEST_WIN_STREAK` — held the longest VP win streak in league history
- `PLAYOFF_BERTH` — qualified for playoffs (lower prestige, still tracked)

Acceptance Criteria:
- New `Achievement` model in `prisma/schema.prisma`: `id String @id @default(cuid())`, `teamId String`, `leagueId String`, `type AchievementType` (new enum), `season String`, `earnedAt DateTime @default(now())`, `data Json @default("{}")`, `@@unique([teamId, leagueId, type, season])`
- `AchievementType` enum: `CHAMPION REGULAR_SEASON_WINNER WEEKLY_HIGH_SCORE LONGEST_WIN_STREAK PLAYOFF_BERTH`
- Achievements written at relevant lifecycle moments: `CHAMPION` / `REGULAR_SEASON_WINNER` after `advance-playoff-round` completes the final round; `PLAYOFF_BERTH` after clinch; `WEEKLY_HIGH_SCORE` / `LONGEST_WIN_STREAK` from `advanceSeason()`
- New `/team/[teamId]/trophies` page — trophy grid showing earned achievements with season labels; empty state "Win something — trophies will appear here"
- "Trophies" added to `TeamNav.tsx` (shown only when team has at least 1 achievement — or always, as an aspiration)
- Achievements display on the team matchup page header (Z2) as small trophy icons linking to the trophies page
- `npx prisma migrate dev` migration required

Depends On: requires schema migration (`Achievement` model), `advanceSeason()`, `advance-playoff-round` route

---

## LL-014. Opening Day Card

Sprint: 25

Priority: P2

Effort: S

Status: 🔵 PLANNED

Goal: The first week of the season feels like a special occasion — a momentary card signals that a new journey is beginning.

Acceptance Criteria:
- Dismissible hero card rendered at Z0 (above lineup alerts) on `/team/[teamId]/matchup` during Week 1 only — i.e., `activePeriod?.number === 1` (or equivalent first-period detection)
- Card content: season year, number of weeks, number of managers, "1 Champion" — e.g., "2027 SEASON BEGINS · 20 Weeks · 8 Managers · 1 Champion"
- Dismiss stores a `localStorage` flag keyed on `leagueId + season` — won't re-appear after dismissed
- Card uses existing `.rebrand-card` CSS class with an accent border
- No schema change; no server-side state

Depends On: `activePeriod.number` from `getSeasonState`, matchup page layout

---

## LL-015. Championship Banner

Sprint: 25

Priority: P1

Effort: S

Status: 🔵 PLANNED

Goal: Winning the championship is a peak emotional moment. The champion should see something unforgettable the first time they open the app after the title is clinched.

Acceptance Criteria:
- Dismissible full-screen overlay (or prominent top banner) displayed on `/team/[teamId]/matchup` for the league champion immediately after `playoffStatus === COMPLETE`
- Content: "🏆 [SEASON] LEAGUE CHAMPION · [Team Name] · [Record]"
- A `CHAMPIONSHIP_WON` `Notification` row (already in schema NotificationType enum) is created for the champion's owner when the final playoff round is scored — use `createNotification()` with a unique `dedupeKey`
- The banner is triggered by the presence of an unread `CHAMPIONSHIP_WON` notification; dismiss calls `markAllRead()` for this league
- Also adds a `CHAMPION` `Achievement` row (LL-009 depends on same sprint — coordinate)
- No new schema changes beyond what LL-009 adds

Depends On: `CHAMPIONSHIP_WON` NotificationType (already in schema), `advance-playoff-round` route, LL-009 (Achievement model if CHAMPION trophy is awarded simultaneously)

---

## LL-013. The Morning Skate

Sprint: 26

Priority: P1

Effort: XL

Status: 🔵 PLANNED

Goal: A weekly league newsletter — published every Tuesday after matchups score — that makes the league feel alive. Managers should say "I checked the Morning Skate" instead of "I opened PWHL GM." The first truly branded subsystem.

Article categories:
- **Standings**: team entered first place / bubble movement / clinched / eliminated
- **Matchups**: biggest upset / closest win / largest blowout
- **Players**: Player of the Week / best goalie / top performer
- **League Activity**: trades / waiver steals / commissioner announcements

Acceptance Criteria:
- New `MorningSkateEdition` model: `id String @id @default(cuid())`, `leagueId String`, `periodId String @unique`, `publishedAt DateTime @default(now())`, `content Json`, `@@index([leagueId, publishedAt])`
- `lib/services/morning-skate-service.ts` — `generateEdition(leagueId, periodId, prisma)` returns structured `Edition` with article sections; each section is an array of `{ headline: string, body: string }` blurbs generated via pure template strings from existing data — no AI, no LLM, no external calls
- `emitMorningSkatEdition()` called from `advanceSeason()` after `emitWeeklyStorylines()` and `emitWeeklyAwards()` — stores the edition row; fire-and-forget
- New `/league/[leagueId]/morning-skate` archive page — server-rendered list of all editions newest-first, each linking to its detail page
- New `/league/[leagueId]/morning-skate/[editionId]` detail page — masthead ("📰 THE MORNING SKATE · Vol. N · Week N · Season 2027"), article sections rendered with section headings, each blurb as a paragraph
- League overview homepage hero (`/team/[teamId]/matchup`) replaced with Morning Skate preview when a current-period edition exists: masthead + 2–3 headline blurbs + "Read full edition →" link
- "Morning Skate" added to league nav as a primary tab (between Overview and Standings), with `📰` as its icon (Tier 1 context per emoji policy)
- `npx prisma migrate dev` migration required for `MorningSkateEdition` model

Depends On: LL-001 (weekly awards exist to reference), LL-004/005 (clinch/magic number data), existing `storyline-service.ts`, `advanceSeason()`, requires schema migration

---

## LL-016. League Hub — Homepage Reorganization

Sprint: 27

Priority: P1

Effort: M

Status: 🔵 PLANNED

Goal: All the new Living League systems (Morning Skate, awards, playoff race, records, timeline, trophies) get assembled into a coherent "arena concourse" experience. The franchise home page stops feeling like a utility screen.

Acceptance Criteria:
- `/team/[teamId]/matchup` render order restructured: Morning Skate preview (Z0, when edition exists) → Matchup Hero (Z1) → Momentum Strip (Z2) → Playoff Race context (magic number + bubble watch compact) (Z3) → Live situation / roster (Z4–Z5) → Franchise identity chip + recent trophies (Z6) → Performer highlights (Z7)
- `/league/[leagueId]/` (commissioner overview) restructured: Morning Skate → Season Timeline → Record Book highlights → Team lineup status → Commissioner strip
- Admin panel utility-screen polish: scoring settings and roster configuration sections replaced with human-readable summaries (not raw JSON) — extends the IA-011 improvement pattern
- No schema changes — this sprint is pure assembly of systems built in Sprints 21–25
- All prior acceptance criteria for LL-001 through LL-015 must already be green

Depends On: all LL-001 through LL-015

---

## LL-017. Plain-Language Award & Storyline Explainers

Sprint: 21

Priority: P1

Effort: S

Status: ✅ SHIPPED

Goal: Every award, storyline, and stat chip surfaced by the Living League systems can be tapped to reveal a one-sentence, jargon-free explanation — so a new fan is never shown a label they can't decode.

Acceptance Criteria:
- Each `WeeklyAward` (LL-001), `StatChip` (LL-003), and `LeagueStoryline` card gets a tappable info affordance (ⓘ icon or tap-to-expand) that reveals plain-language helper text
- Helper text uses fan-first language: e.g. "🔥 Heater Award — Your team scored 18 more fantasy points than we predicted. Your players had a great week." — never "outperformed projection by 18.4 FP"
- "FP" is expanded to "fantasy points" on first use within any explainer; "VP" linked to the existing `VpExplainer`
- All explainer copy lives in a single shared map `lib/copy/living-league-glossary.ts` so wording is consistent across the Morning Skate, awards, and chips — no divergent strings in component files
- Touch target for the info affordance is ≥44px; explainer is keyboard- and screen-reader-accessible
- No schema change

Depends On: LL-001 (Weekly Awards Ceremony), LL-003 (Animated Stat Chips), existing `storyline-service.ts`, `VpExplainer.tsx`

---

## LL-018. New-Fan Tone Calibration for Negative Awards

Sprint: 21

Priority: P1

Effort: S

Status: ✅ SHIPPED

Goal: The "punishment" awards (Heartbreaker, Collapse of the Week, Frozen Stick) are reframed so a brand-new fan having a rough week feels encouraged to come back rather than publicly mocked in front of their friends.

Acceptance Criteria:
- Each negative-valence award card includes a forward-looking, supportive second line linking to a recovery action: e.g. "🧊 Frozen Stick — Quiet week for your squad. Next week resets — check the waiver wire. → Find players"
- Negative award cards link directly to the action that addresses the problem (set lineup / browse free agents)
- A per-league commissioner toggle `showNegativeAwards Boolean @default(true)` (or stored in league settings JSON to avoid a migration) lets a commissioner soften a casual/friends league by suppressing punitive awards
- Copy avoids ridicule language; tone is "tough week, bounce back" throughout
- No schema migration required if stored in existing `scoringSettings` or `rosterSettings` JSON; commissioner toggle exposed in admin panel

Depends On: LL-001 (Weekly Awards Ceremony), free-agent route, lineup route, commissioner admin panel

---

## LL-019. First-Loss / First-Week Result Explainer

Sprint: 23

Priority: P1

Effort: M

Status: 🔵 PLANNED

Goal: The first time a new manager finishes a scoring week — especially a loss or a low "vs the field" finish — they get a one-time, gentle explainer of what just happened, why, and what they can control, so the result feels understandable rather than arbitrary.

Acceptance Criteria:
- After a manager's first scored period, a dismissible card appears on `/team/[teamId]/matchup` explaining the result in plain language: "You finished 6th of 8 this week. Your starters earned 78 fantasy points. Set a full lineup and pick up players with more games next week to climb."
- Explicitly explains "vs the field" / VTF in one sentence for regular-season weeks and links to the existing `FieldHero` explainer — this is the peak confusion moment for managers new to VTF scoring
- Shown once per manager; dismiss flag stored in `localStorage` keyed on `userId + leagueId + "first-result-seen"` (no schema change) or a nullable `User` flag
- Names the top contributing player ("Marie-Philip Poulin led your week with 12 FP") to anchor the abstract score to a real PWHL player the fan cares about
- Surfaces the single most actionable gap (e.g. a starter with 0 games played this period) when one exists
- No schema change if localStorage-keyed

Depends On: `getDashboardData`, `FieldHero` VTF explainer, season lifecycle (first scored period detection)

---

## LL-020. Newcomer-Mode Morning Skate Reading Layer

Sprint: 26

Priority: P1

Effort: M

Status: 🔵 PLANNED

Goal: The Morning Skate is readable and exciting for a fan who doesn't speak fantasy shorthand — headlines lead with real PWHL player and team names, any stat is glossed, and there is always a "new here?" primer — so the league's flagship subsystem doesn't become a jargon wall.

Acceptance Criteria:
- Morning Skate blurb templates (LL-013) lead with human subjects: "Marie-Philip Poulin powered the Northern Lights to the week's top score" rather than "142 FP week tops the field"
- Any acronym used in a blurb (FP, VP, PPP, GAA, SV%) is either expanded inline on first use or wrapped in a tap-to-define span sourced from the LL-017 shared glossary map
- Each edition includes a one-paragraph "What happened this week" lede in plain English aimed at first-time readers, auto-generated from structured data
- A persistent "New here? How to read this →" link in the masthead opens a one-screen primer on standings, scoring, and "vs the field"
- Verified legible on a 375px mobile viewport: headline ≥16px, body ≥14px, no horizontal overflow
- No schema change beyond LL-013's existing `MorningSkateEdition` model

Depends On: LL-013 (The Morning Skate), LL-017 (shared glossary map `lib/copy/living-league-glossary.ts`)

---

## LL-021. Small-Win Encouragement Moments

Sprint: 23

Priority: P2

Effort: S

Status: 🔵 PLANNED

Goal: The delight system celebrates the modest, controllable accomplishments that actually retain new fans — setting a full lineup, making a first add, surviving to a new week — not only the championships and records most newcomers won't reach for months.

Acceptance Criteria:
- Lightweight, non-blocking inline confirmation moments for first-time milestones: "✓ Lineup set for Week N — you're all in!" after first complete lineup; "✓ First free-agent add" after first waiver claim
- These are positive micro-celebrations distinct from the prestige `Achievement` model in LL-009 — they are coaching encouragement, not persistent trophies
- Each milestone fires at most once per manager (localStorage keyed on `userId + leagueId + milestoneType`); never nags
- Tone is warm and fan-first, reinforcing that the action was correct: "Nice — a full lineup means every roster spot earns points this week"
- Reuses existing inline confirmation / toast patterns; no full-screen interruption
- No schema change

Depends On: lineup route, free-agent route, existing toast/confirmation UI patterns

---

## LL-022. Living League Information Hierarchy & Progressive Disclosure

Sprint: 27

Priority: P1

Effort: M

Status: 🔵 PLANNED

Goal: The redesigned franchise hub (LL-016) presents one obvious primary action and a digestible amount of content for a new fan, with richer Living League modules progressively revealed — so the homepage delights rather than overwhelms on a phone.

**Note:** This story constrains and refines LL-016's render-order spec. It must be reconciled with (not bolted onto) the LL-016 implementation.

Acceptance Criteria:
- The franchise hub always surfaces exactly one obvious primary CTA above the fold appropriate to current state (Set your lineup / Read the Morning Skate / See who you're up against) — never a flat stack of six equal-weight modules
- Secondary modules (timeline, records, franchise identity, performer highlights) collapse to a compact summary with "Show more" on mobile (≤768px); they do not all render expanded by default
- First-session "lite" hub: for managers with `onboardingCompletedAt` recent or fewer than 2 scored weeks of history, legacy/records/timeline modules are minimized or hidden until there is meaningful data — avoids empty/confusing modules for newcomers (pairs with LL-023)
- Module order and density verified on a 375px viewport: above-the-fold content answers "what do I do now?" without scrolling
- No schema change; conditional rendering driven by existing `onboardingCompletedAt` and scored period count

Depends On: LL-016 (League Hub), LL-023 (empty states), `User.onboardingCompletedAt`, scored period count from `getSeasonState`

---

## LL-023. Empty-State & Pre-History Copy for Legacy Systems

Sprint: 24

Priority: P2

Effort: S

Status: 🔵 PLANNED

Goal: Every legacy/history surface (Record Book, Trophy Cabinet, Season Timeline, Trophies tab) has a welcoming, instructive empty state in a brand-new league's first season — so a fan exploring the app never hits a blank, confidence-eroding page.

Acceptance Criteria:
- Record Book (LL-010), Trophy Cabinet (LL-009), Season Timeline (LL-006), and `/team/[teamId]/trophies` each render a purposeful empty state when no data exists, not a blank table or raw "No data found"
- Empty-state copy explains what the surface is for and points forward: "No records yet — these fill in as you play. The first big week sets the bar." / "Win a week, clinch a spot, or take the title and your trophies show up here."
- Empty states verified for a freshly created league with one team and zero scored weeks — never expose internal placeholders, zeros, or null
- Copy reviewed against the no-jargon standard (no unexplained FP/VP/VTF in empty-state prose)
- No schema change; uses existing `EmptyState.tsx` component with custom copy props

Depends On: LL-006 (Season Timeline), LL-009 (Trophy Cabinet), LL-010 (League Record Book), existing `EmptyState.tsx`

---

## LL-024. Glossary & "How Scoring Works" Anchor Page

Sprint: 27

Priority: P2

Effort: M

Status: 🔵 PLANNED

Goal: There is one persistent, easy-to-find home for "what do all these terms mean?" — a glossary and scoring primer — that every jargon term across the Living League links back to, so a confused fan always has one reliable place to get un-stuck.

Acceptance Criteria:
- New `/league/[leagueId]/how-it-works` page: plain-language definitions of FP, VP, VTF / "vs the field", PPP, GAA, SV%, UTIL, waiver / free agent, clinch, magic number, projection — each with a one-line PWHL-flavored example sentence
- Every tap-to-define span and explainer across LL-017 and LL-020 links to its anchor on this page
- Reachable from a persistent, discoverable entry point present on both team and league layouts (nav item or footer link) — not buried in admin
- The page is the single source of truth feeding `lib/copy/living-league-glossary.ts` (LL-017) so inline and on-page definitions never drift
- Folds in and supersedes the existing `VpExplainer.tsx` content — the VP explainer links here instead of being standalone
- Verified readable on 375px: anchored sections, ≥16px body text, ≥44px tap targets on the section index
- No schema change

Depends On: LL-017 (shared glossary map), LL-020 (Morning Skate newcomer layer), existing `VpExplainer.tsx`

---

# Architectural Rules

Design for the live season first. Replay is a testing tool, so:

- New features must work for live leagues.
- New features should not crash or corrupt replay leagues, but they do not need to be
  designed around replay, and replay constraints must not block or delay live-season work.
- Where it's cheap to stay replay-compatible (e.g. reading "now" from a helper rather than
  the wall clock), do so — it keeps the testing harness usable. Where replay support would
  add real cost or complexity, prefer the live-season-correct implementation.

Replay-compatibility is a nice-to-have that protects our QA loop, not a gate on shipping.
