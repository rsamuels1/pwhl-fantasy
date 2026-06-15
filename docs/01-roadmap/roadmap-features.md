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

Status: Not Implemented

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

# Phase 2: Fantasy Essentials

Goal: Reach feature parity with major fantasy platforms.

Priority: HIGH

---

## 5. Waiver Wire System

Status: Partially Implemented — Sprint 6

Estimated tokens: ~110K (new schema columns, waiver service, processing job, commissioner UI)

Immediate free-agent add/drop ships today (`POST /api/leagues/[leagueId]/waiver` +
roster page free-agent panel; roster-size enforced; emits a `LeagueEvent`). What's
missing is the actual *waiver* layer.

Remaining:

- Waiver priority ordering
- Waiver processing jobs (batched claim resolution)
- Commissioner waiver settings

Acceptance Criteria:

- Players can be claimed ✅ (immediate add/drop)
- Claims process correctly (priority/batched resolution still TODO)
- Replay leagues supported

Dependencies:

- Transaction system

---

## 6. Free Agent Acquisition Budget (FAAB)

Status: Not Implemented — Sprint 7

Estimated tokens: ~80K (depends on #5; bidding logic + UI + budget tracking)

Features:

- Blind bidding
- Budget tracking
- Tie-breaking logic

Acceptance Criteria:

- Commissioner can enable FAAB
- Claims resolve automatically

Dependencies:

- Waiver system

---

## 7. Trade System

Status: Not Implemented — DEFERRED (lowest priority / someday maybe)

Sprint: None — moved to backlog as of June 2026

Estimated tokens: ~130K (new domain — schema tables, API routes, proposal/review/approval UI; plan a dedicated session)

Note: Deprioritized June 2026. Beta cohort is small enough for out-of-band trades. Revisit
only if founding commissioners surface strong demand before public launch.

Features:

- Trade proposals
- Trade review
- Commissioner approval
- Trade history

Acceptance Criteria:

- Managers can exchange players
- Transactions recorded

Dependencies:

- Transaction system

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

Sprint: 7 (league-wide storylines)

Status: Partially Implemented

Per-team storyline chip ("🔥 X is leading your team…") and a weekly recap card are live.
League-wide auto-generated storylines are scheduled for Sprint 7.

Features:

- Biggest upset — not built (league-wide)
- Closest matchup — not built (league-wide)
- League leader highlights — partial (activity feed)

Acceptance Criteria:

- Automatically generated league insights (per-team done; league-wide TODO)

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

Status: Not Implemented

Estimated tokens: ~85K (new page, per-position-group aggregation queries; all reads on existing data)

Goal: add an "Analysis" tab to the matchup dashboard that turns the team's data into
actionable advice.

Features:

- What's working / what's not — flag over- and under-performing rostered players vs their
  projection and vs replacement level.
- Position-group trend breakdown — week-over-week fantasy output by position group (F / D / G)
  vs league average, so the manager can see where they keep losing (e.g. "your defense has
  been bottom-3 for three straight weeks").
- Free-agent recommendations — rank available free agents by projected FPTS, weighted toward
  the team's weakest position group ("consider adding X over your benched Y").
- Trade suggestions — propose mutually beneficial trades by matching this team's surplus/
  deficit position groups against other teams' rosters.

Implementation notes:

- Trend data: aggregate scored `Matchup` / `StatLine` history per scoring period, bucketed by
  position group, compared against league per-week averages. Cache per period — it only changes
  when a week is scored.
- Free-agent ranking reuses the roster page's free-agent query + season-aggregate FP, scored
  with the league's scoring settings, then ranked by projected FPTS for the weakest group.
- "What's working" = actual FP vs the `projectPlayer` baseline per rostered player over recent
  weeks.
- Trade suggestions depend on the Trade System (#7) — ship the analysis + free-agent half first;
  a suggestion can pre-fill a trade proposal once #7 lands.
- Move heavy aggregation to a background job / cached table as history grows (see Background Jobs).
- Degrade gracefully early in a season when there's little history yet.

Acceptance Criteria:

- Matchup dashboard has an Analysis tab.
- Position-group trend view shows weekly output vs league baseline.
- Free-agent recommendations ranked by fit + projection.
- Trade suggestions generated (once Trade System exists).

Dependencies:

- Projections engine (exists)
- Scored matchup / stat history (exists)
- Trade System (#7) — trade-suggestion portion only

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

## 39. Replay Season Simulator v2 — Week-by-Week Progression UX

Sprint: 7

Priority: MEDIUM

Status: ✅ Implemented

Goal: Improve the replay season experience by pausing at week boundaries and making simulator controls accessible from the league overview and commissioner matchup page. Commissioners can now step through a replay season week-by-week with natural moments to adjust lineups before the next week begins.

Builds on: `isReplay` / `replayCurrentDate` / `getReplayNow()` / existing `/api/leagues/[leagueId]/season` endpoints.

Features:

- **Week-boundary pauses** — When a matchup week is scored, the simulator pauses at the week boundary, giving commissioners a clear moment to adjust lineups before starting the next week. No automatic jump to the next week's games.
- **Persistent simulator controls** — `ReplaySimulatorControls` component renders on `/league/[leagueId]/` (sticky footer at bottom of viewport) and `/team/[teamId]/matchup/` (inline panel above matchup hero). Only commissioners see these controls.
- **Smart button set** — Buttons change based on season state:
  - **During a week:** "+1 Day" (step forward 24h), "End Week Now" (score and pause at next week boundary), "Jump to date" (arbitrary date picker)
  - **Between weeks:** "Start Week N" (begin the week), "Skip to Playoffs" (score all remaining regular-season weeks), "Jump to date"
  - **During playoffs:** All buttons disabled (playoff advancement via existing season admin page)
- **Date picker modal** — "Jump to date" opens a date picker allowing commissioners to jump to any ISO date; weeks between the current date and jump target are auto-scored in one operation.

Implementation notes:

- No schema changes; reuses existing `isReplay` and `replayCurrentDate` columns
- No new API routes; reuses existing `/api/leagues/[leagueId]/season` POST (with `action: "advance"`) and `/season/advance` endpoints
- All existing tests pass (154 tests); TypeScript strict mode clean; production build successful
- Old `SeasonControls.tsx` (v1) on `/league/[leagueId]/season/` page remains but is superseded; can be deprecated/removed in future refactor once v2 is validated in production

Acceptance Criteria:

- ✅ Sticky footer visible on league overview when `isReplay && isCommissioner`
- ✅ Inline panel visible on commissioner matchup page above `MatchupHero`
- ✅ Button set changes correctly based on `SeasonState` (ACTIVE vs between-weeks)
- ✅ "Start Week" advances to week start; "End Week" scores and pauses; "+1 Day" steps 24h
- ✅ "Jump to date" opens modal, auto-scores skipped weeks
- ✅ All buttons disabled during `playoffStatus === "IN_PROGRESS"` with informational tooltip
- ✅ Regular team owners never see simulator controls

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

Sprint: 2 (schema + renewal); Sprint 7 (history/UX layer)

Priority: P1 — foundational; unlocks the entire retention layer

Status: Schema + renewal shipped Sprint 2 (MS-001/002/003/004 ✅); history views (Sprint 7)

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
  (MS-005), League Hall of Fame (#18), Player Legacy (#31), and Keeper/Dynasty (#19/#20).

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

Sprint: 7 (combined with #33 — see League History & Hall of Fame)

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

# Architectural Rules

Design for the live season first. Replay is a testing tool, so:

- New features must work for live leagues.
- New features should not crash or corrupt replay leagues, but they do not need to be
  designed around replay, and replay constraints must not block or delay live-season work.
- Where it's cheap to stay replay-compatible (e.g. reading "now" from a helper rather than
  the wall clock), do so — it keeps the testing harness usable. Where replay support would
  add real cost or complexity, prefer the live-season-correct implementation.

Replay-compatibility is a nice-to-have that protects our QA loop, not a gate on shipping.
