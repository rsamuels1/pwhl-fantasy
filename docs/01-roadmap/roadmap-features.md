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

Status: OPEN

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

Status: OPEN

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

# Architectural Rules

Design for the live season first. Replay is a testing tool, so:

- New features must work for live leagues.
- New features should not crash or corrupt replay leagues, but they do not need to be
  designed around replay, and replay constraints must not block or delay live-season work.
- Where it's cheap to stay replay-compatible (e.g. reading "now" from a helper rather than
  the wall clock), do so — it keeps the testing harness usable. Where replay support would
  add real cost or complexity, prefer the live-season-correct implementation.

Replay-compatibility is a nice-to-have that protects our QA loop, not a gate on shipping.
