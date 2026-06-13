# ROADMAP.md

# PWHL Fantasy Product Roadmap

Last Updated: June 12, 2026

---

# Purpose

This document serves as the source of truth for future development priorities.

When choosing what to build next:

1. Prioritize unfinished items in the current phase before moving to later phases.
2. Favor user-facing functionality over technical optimization unless stability is at risk.
3. Build for the live season first. Historical Replay is a testing/QA tool, not the product —
   don't let replay requirements shape or slow down live-season features.
4. New features should not break replay mode, but they do not need to be designed around it.

---

# Product Vision

PWHL Fantasy is the premier fantasy platform for Professional Women's Hockey League fans.

The flagship experience is the live fantasy season: drafting real players, setting weekly
lineups, and competing in matchups scored from real PWHL games.

The platform should support:

- Live fantasy leagues (the core product)
- Commissioner customization
- Deep roster management
- Long-term league retention

Historical Replay is an internal/QA tool that lets us exercise the full season loop against
completed seasons before live data exists. It is valuable for user testing and dev iteration,
but it is not a user-facing flagship and should not be prioritized as one.

---

# Current State

Implemented systems include:

- Authentication
- User accounts
- League creation
- League management (commissioner admin panel: team management, draft setup, season controls, announcements)
- Draft room (live WebSocket draft, queue, auto-draft, auto-escalation)
- Rosters
- Lineups (locking, play-lock rule, games-remaining badges)
- Lineup Management v2 (projected FPTS tab, between-weeks nudge banner, mobile compact stats)
- Matchups (VTF regular season + 1v1 playoffs)
- Matchup Center / Fantasy Home (hero scores, top performers, swing players, storyline chip, playing-tonight, roster breakdown)
- Projections & Win Probability engine
- Standings (with playoff race clinch/eliminate indicators)
- Playoffs (seeding, bracket, single-elimination)
- Historical Replay
- Season advancement / lifecycle (scoring periods, dev sim controls)
- Schedule management
- Scoring engine (VTF point scoring)
- Victory Point (VP) scoring model (win/placement bonuses, `homeVP`/`awayVP`)
- Free-agent add/drop (immediate, no waiver priority yet)
- Live score polling (client-side refresh during active matchups)
- Season-long head-to-head (rivalry) records
- Commissioner Recovery Tools
  - Force roster move
  - Undo transaction
  - Replace inactive manager
- Commissioner Admin Center
  - Audit log visibility
  - Draft pause visibility
  - Season renewal entry point
- Draft Analytics
  - draft_started
  - draft_completed
  - draft_paused
  - draft_resumed
- League Creation UX
  - 8-team recommendation

These systems should be considered core platform functionality.

---

# How To Read This Roadmap

This document now merges two tracks that must **both** be true before a public beta:

1. **Implementation Alignment (Phase 0)** — make the running code match the approved v1
   product rules (`docs/league-rules-v1.md`, `docs/mvp-definition.md`,
   `docs/backlog/implementation-alignment.md`). These are correctness fixes, not features,
   and they are launch blockers.
2. **Feature Builds (Phases 1–7)** — the product surface area, sequenced by user value and
   by token efficiency for Claude-assisted sessions.

The **Sprint Plan** and **MVP Launch Timeline & Beyond** sections at the end divvy both
tracks into sprints and project a launch date against the real PWHL 2026-27 calendar.

---

# MVP Readiness Scorecard

Snapshot of launch-blocking areas (from `docs/mvp-readiness-scorecard.md`, re-verified
against code on June 12, 2026). **Confidence to launch today: ~95%.**

| Area | Status | Blocker |
|---|---|---|
| League creation | ✅ PASS | — |
| Draft | ⚠️ PASS WITH RISKS | reconnect ✅ · commissioner auth ✅ · auto-pick position-aware ✅ · duplicate-tab unvalidated |
| Rosters | ✅ PASS | — |
| Weekly matchups | ✅ PASS | — |
| VP standings | ✅ PASS | — |
| Weekly lineup lock | ✅ PASS | — |
| Playoffs | ✅ PASS | — |
| Commissioner tools | ✅ PASS | force move, undo transaction, replace manager, audit log all shipped |
| Analytics | ✅ PASS | 6 events instrumented (user_registered, league_created, league_joined, draft_started, draft_completed, lineup_saved) |
| End-to-end season sim | ✅ PASS | — |

**Remaining soft blockers:** draft duplicate-tab handling (unvalidated) · onboarding (Sprint 3).

---

# Phase 0: Implementation Alignment (Launch Blockers)

Goal: the app must behave exactly as the approved v1 rules describe. No feature work should
jump ahead of an open P0 here. Full detail: `docs/03-validation/implementation-alignment/audit.md`.

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
- **IA-007** · Rebalance auto-draft for 3F demand (simulation-tested) — P1
- **IA-008** · Finalize waiver spec (duration, priority, reset, processing schedule) — P2
- **IA-009** · Finalize VP tiebreakers: VP → matchup wins → H2H → total FP → random draw — P2
- **IA-010** · Stat-correction policy (cutoff window, playoff/championship handling) — P2
- **IA-011** · Hide advanced non-v1 features (byes, multi-round config, experimental scoring) — P2
  Acceptance checklist: `docs/02-engineering/ia-011-checklist.md` (6 AC items; bracket page, admin panel settings, JSON → human-readable)

---

# MVP Definition & Launch Gates

MVP proves a league can go **Create → Invite → Draft → Set Lineups → Compete → Make Playoffs
→ Crown Champion** with no commissioner intervention or database surgery. Full scope in
`docs/mvp-definition.md`.

**In scope:** league create / config / invite · snake draft with timer + auto-pick + reconnect
(8- and 10-team) · roster validation · weekly lineup lock + partial-week subs · hybrid H2H +
VP standings · 4-team playoffs ending before PWHL playoffs · commissioner recovery tools
(pause/resume draft, replace manager, force move, undo, audit log) · critical notifications
(draft starting, on the clock, lineup incomplete).

**Out of scope for MVP:** trades, waivers, FAAB (may add pre-launch only if implementation risk
is low) · keeper / dynasty · referral / growth loops · AI features · native apps.

**Launch gates — all must pass:** rules match implementation · draft reliability validated ·
VP standings validated · playoff qualification validated · end-to-end season simulation
completed · commissioner recovery tools available.

---

# Phase 1: Beta Completion

Goal: Make the product stable enough for external users.

Priority: CRITICAL

---

## 1. Commissioner Dashboard

Status: Largely Implemented

The admin panel (`app/league/[leagueId]/admin/`) is the central commissioner interface:
team management, draft setup + auto-draft, replay-aware season controls (advance/score
week, sim-date stepping), announcements, and a setup checklist. Permissions are enforced
via `requireCommissioner`.

Remaining gaps:

- Explicit pause / restart replay-season controls
- Force draft start (currently start happens from the draft room)
- Lock/unlock lineups override
- A consolidated league-settings editor (scoring/roster rules post-creation)

Acceptance Criteria:

- Single dashboard for all commissioner actions ✅ (admin panel)
- Permissions enforced ✅
- Replay controls available ✅ (advance/score; pause/restart still TODO)

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
- **Draft room** — `useIsMobile(900)` hook collapses three-column layout into tabbed Pick/Board/Needs view at ≤900px; secondary stat columns (PPP/SOG/HIT/BLK, SV/GA/SO) hidden at ≤480px via `stat-secondary` class, reducing player table from 560px → 340px; user-friendly connection error (removes raw WS URL)
- **Touch targets** — `minHeight: 44px` on all Drop/Add (RosterManager), Pick/star/queue/position-filter (DraftRoom), slot cards + Cancel (LineupManager); stats tab toggles `minHeight: 36px`
- **BottomNav** — `env(safe-area-inset-bottom)` for iPhone 15 home indicator; `.bottom-nav-pad` uses `calc()`
- **Standings** — `minWidth: 520` → `380` (existing `overflowX: auto` wrapper intact)
- **Matchup** — swing player names get ellipsis truncation; hero score font uses `clamp()` instead of fixed `32|52px`

---

## 4. Error Handling

Status: Needed

Estimated tokens: ~65K (many small localized touches across all core pages)

Improve user trust.

Features:

- Empty states
- Loading states
- Retry actions
- User-friendly error messages

Acceptance Criteria:

- No uncaught UI errors
- All API failures handled gracefully

---

## 26. League Overview Redesign

Status: Implemented ✅

Phase: 1

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

Phase: 1

Priority: HIGH

What was built: Sortable table as the default view (FP desc), replacing cards as the
default. Full column set for skaters (GP G A PTS PPP SOG HIT BLK FP) and goalies
(GP W SV% GA SO FP) — HIT, BLK, and GA were previously missing. Team selector
dropdown (`?view=<teamId>`) lets the manager browse any other team's roster read-only
from the same page, with a "← My Team" escape hatch. Nav tab in `TeamNav.tsx` renamed
from "Roster" to "Rosters". Both the roster table and the free-agent table are sortable
by any column.

---

## 28. Lineup Stats Tab: "Matchup Proj" Rename & Default Polish ✅

Status: Implemented ✅

Phase: 1

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

Phase: 1 (draft room feature)

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

# Phase 2: Fantasy Essentials

Goal: Reach feature parity with major fantasy platforms.

Priority: HIGH

---

## 5. Waiver Wire System

Status: Partially Implemented

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

Status: Not Implemented

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

Status: Not Implemented

Estimated tokens: ~130K (new domain — schema tables, API routes, proposal/review/approval UI; plan a dedicated session)

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

Status: Not Implemented

Estimated tokens: ~55K (standalone; built on existing CT-002 audit log foundation — no schema changes)

Features:

- Adds
- Drops
- Trades
- Waiver claims

Acceptance Criteria:

- League transaction log available

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

Status: Partially Implemented

Per-team storyline chip ("🔥 X is leading your team…") and a weekly recap card ship today.
League-wide auto-generated storylines are not yet built.

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

## 25. Team Analysis & Insights Tab

Phase: 3

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

Phase: 3

Priority: MEDIUM

Estimated tokens: ~65K (new page + server-side aggregation; all data exists, no schema changes)

Goal: Replace the current Schedule tab (`/team/[teamId]/schedule`) with a richer
week-over-week performance table — less about upcoming games, more about how teams
and players are trending across the season.

Features:

- **Week-by-week standings changes** — a table you can page through week by week showing
  each team's rank, FP score, and W/L for that week. Arrow indicators (↑ / ↓ / —) show
  whether each team rose, fell, or held their standing vs the prior week.
- **Rising and falling teams callout** — a brief "hot/cold" highlight at the top: which team
  had the best week, which had the worst, biggest rank climber.
- **Stat breakdown by position group by team** — for the selected week, a table showing each
  team's FP contribution from Forwards, Defense, and Goalies. Helps managers diagnose where
  they won or lost.
- **Week navigation** — prev/next week controls; defaults to the most recent scored week.

Implementation notes:

- All data is already in `Matchup` rows and `StatLine` history; this is a new read-path
  aggregation, no schema changes needed.
- Heavy aggregation (per-position-group weekly FP per team) should be computed server-side
  and cached per scored period.
- The existing PWHL-games progress bar from the schedule tab may be retained as a smaller
  secondary section below the performance table.

Acceptance Criteria:

- Page shows week-by-week team rankings with rise/fall indicators.
- Selectable week navigation.
- Position-group FP breakdown per team per week.
- Current games-remaining schedule info still accessible (secondary).

---

## 30. Playoff Experience UX

Phase: 3

Priority: HIGH (once playoffs start)

Status: Foundation built; UX polish needed

Estimated tokens: ~40K (polish on existing bracket/matchup/overview pages; minimal new logic)

Goal: Make the playoff period feel distinct and exciting. The bracket is built; what's
missing is a coherent playoff-mode UI experience.

Features:

- **Bracket as primary navigation during playoffs** — when `playoffStatus === "IN_PROGRESS"`,
  promote the bracket tab and make it the default landing for `/league/[leagueId]/`. The
  regular-season matchup schedule becomes secondary.
- **Matchup page adapts for playoffs** — the matchup hero already supports 1v1 (`DuelHero`).
  Add: series score (if multi-period playoffs), countdown to elimination, "you're through"
  celebration state when a team clinches.
- **Elimination notifications** — activity feed events when a team is eliminated or clinches
  a round. Promote major milestones (Final matchup, Champion crowned) on the league overview.
- **Champion banner** — when `playoffStatus === "COMPLETE"`, show a champion banner on the
  league overview and the champion's team page.
- **Between-round lineup nudge** — same pattern as the regular-season between-weeks nudge:
  when a playoff round ends and the next begins, prompt managers to set their lineup.

Acceptance Criteria:

- Bracket is visually prominent during playoffs; league overview reflects playoff state.
- Champion is celebrated on the overview and team pages.
- Managers are prompted to set lineups between playoff rounds.
- `DuelHero` shows elimination stakes clearly.

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

Features:

- Advance day
- Advance week
- Simulate season

Acceptance Criteria:

- Commissioners can control pace

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

Phase: 5 (UX / feature layer; schema foundation is Sprint 2)

Priority: P1 — foundational; unlocks the entire retention layer

Status: Schema building in Sprint 2 (MS-001/002/003); renewal UX + history views are Phase 5 post-MVP

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

Status: Partially Implemented

Season-long head-to-head records are already computed (`getHeadToHeadRecord` in
`lib/playoffs/seeding.ts`) and surfaced on the matchup hero in 1v1 mode. Rival badges and
a dedicated historical-matchups view are not yet built.

Features:

- Head-to-head records ✅
- Rival badges — not built
- Historical matchups — not built (dedicated view)

Acceptance Criteria:

- League history persists (H2H records done; persistent rivalry UI TODO)

---

## 18. League Hall of Fame

Features:

- Champions
- Records
- Best seasons

Acceptance Criteria:

- League legacy preserved

---

## 31. Player Legacy & Cross-Season Tracking

Phase: 5

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

---

# What To Build Next

League Overview Redesign (#26), Roster Page UX Overhaul (#27), and Lineup Management v2 (#24)
are shipped. The list below is sequenced by **token efficiency** — each feature's estimated
Claude Pro context cost is shown so sessions can be batched optimally.

**Token sizing:** CLAUDE.md + system overhead uses ~15K tokens of fixed cost per session.
Claude Pro's 200K context window fits 2–3 quick-win features or one heavy lift per session
comfortably. Estimates assume a fresh session starting from the current codebase state.

### Quick wins (< 45K tokens — batch 2–3 per session)

1. **Lineup Stats Tab Polish (#28)** · ~25K ✅
   Rename "Projected" → "Matchup Proj", hide "This week" between weeks. Single-component edit.
2. **Draft Team Distribution Panel (#32)** · ~30K ✅
   Client-only panel in the draft room. No schema changes, derives from existing state.
3. **Playoff Experience UX (#30)** · ~40K
   Bracket prominence, champion banner, between-round nudge. Polish on existing pages; no schema
   changes.

### Standard sessions (60–90K tokens — one feature per session)

4. **Error Handling (#4)** · ~65K
   Empty + loading states across all core pages. Beta prerequisite; many files but each change
   is small and localized.
5. **Weekly Performance Dashboard (#29)** · ~65K
   New page replacing the Schedule tab. Aggregates existing `Matchup` + `StatLine` rows; no
   schema changes.
6. **Mobile Optimization (#3)** · ~75K ✅
   Shipped — draft room tabbed layout (≤900px), 44px touch targets, BottomNav safe-area, standings minWidth fix, matchup score clamp(), swing player truncation.
7. **Team Analysis & Insights (#25)** · ~85K
   New Analysis tab on the matchup page. Complex aggregation but all reads on existing data;
   trade suggestions deferred until #7.

### Heavy lifts (100K+ tokens — plan a fresh session)

8. **League Onboarding (#2)** · ~100K ✅
   Shipped — welcome flow (WelcomeFlow.tsx), 6-step wizard (CreateLeagueWizard.tsx), manager draft prep guide on league overview, replay explanation inline, User.onboardingCompletedAt schema field.
9. **Transaction History (#8)** · ~55K ✅
   Shipped — paginated API + transaction page with type/team filters, replay guard, infinite scroll. No schema changes.
10. **Trade System (#7)** · ~130K
    New domain: schema tables, API routes, proposal/review/approval UI. Plan a dedicated session. Built on top of Transaction History.
11. **Waiver Priority + Processing (#5)** · ~110K
    Waiver priority ordering, batched claim-resolution jobs, commissioner settings.

Stretch (differentiators, not beta blockers): league-wide matchup storylines (#11 · ~50K) and
the rivalry/Hall-of-Fame retention layer (#17–#18). Player Legacy (#31 · ~95K) deferred until
at least one live season completes. Replay work (Phase 4) stays out of this list.

---

# Sprint Plan — Alignment + Validation + Feature Builds

The "What To Build Next" list above sequences feature work by token cost. This section is the
**calendar view**: it interleaves Phase 0 alignment, MVP validation, and feature builds into
sprints. Item IDs reference Phase 0 (IA-*) above and the GPT launch tracks in
`docs/roadmap/roadmap-gpt.md` (DE-*, LC-*, CT-*, TR-*, NT-*, MS-*).

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

## Sprint 3 — "Beta-ready: onboarding, trust, mobile" · ~2–3 wks · Track F (beta prereqs) ← CURRENT

**Progress report:** `docs/01-roadmap/sprint-3-progress.md` (updated June 13, 2026)

- #2 League Onboarding ✅ (welcome flow, setup wizard, draft prep guide, replay explanation; `User.onboardingCompletedAt`; `components/WelcomeFlow.tsx`; `app/create-league/CreateLeagueWizard.tsx`; manager checklist on league overview)
- #4 Error Handling 🔄 (empty / loading / retry across all core pages — draft room, matchup, lineup, standings, roster)
- #3 Mobile Optimization ✅ (draft room tabbed layout at ≤900px, 44px touch targets everywhere, BottomNav safe-area, standings minWidth, matchup score clamp())
- NT-001 / NT-002 Notification framework + critical notifications (draft starting soon, on the clock, lineup incomplete) — spec `docs/02-engineering/notification-framework-spec.md`
  - NT-001 in-app infrastructure ✅ (`lib/services/notification-service.ts`, bell UI, draft server call sites for DRAFT_STARTING + ON_THE_CLOCK)
  - NT-002 LINEUP_INCOMPLETE notification ❌ not yet wired (depends on schema delta below)
  - NT-003 Scheduled trigger decision ✅ resolved June 13, 2026: check-on-dashboard-load + DB-level dedupeKey — see notification spec "NT-003" section
  - Schema delta 🔄 `Notification` model missing `title`, `body`, `actionUrl`, `teamId`, `dedupeKey` + `@@unique([userId, type, dedupeKey])` — documented in notification spec "Schema Delta" section; `npx prisma db push` + `createNotification` caller updates required
- IA-011 Hide advanced non-v1 settings (multi-round playoff config, experimental scoring) — checklist: `docs/02-engineering/ia-011-checklist.md` — ❌ not yet implemented (6 AC items; all frontend-only)
- #8 Transaction History ✅ (paginated API + page with type/team filters, replay guard, infinite scroll)

**Exit:** a brand-new user creates and drafts a league on a phone with no docs. **MVP launch gate.**

→ **MVP CODE-COMPLETE.** Run a closed beta.

## Sprint 4 — "Product polish: lineup, commissioner UX, rivalries" · ~1–2 wks · Track F

Close the in-progress feature gaps before beta. Three features are partially built with no sprint home.

- **#28 Lineup Stats Tab Polish** ✅ — rename "Projected" → "Matchup Proj"; default to it between weeks; hide "This week" tab when no active period; single-component edit
- **#01 Commissioner Dashboard (remaining gaps)** — pause/restart replay shortcut; force-draft-start CTA; lineup lock override (`POST .../commissioner/unlock-player`); settings editor (gated on pre-draft); all actions write to audit log
- **#17 Rivalries (remaining gaps)** — rival badge on team cards (most-played opponent, notable W/L diff); H2H history view on matchup page (per-week scores, built on existing `Matchup` rows + `getHeadToHeadRecord`)

**Exit:** no Phase 1 or Phase 5 feature card enters beta in "partial" state when remaining work is small. All three features ship cleanly or are explicitly deferred with a documented reason.

## Sprint 5 — "Validation + Beta Operations" · ~2 wks · Track V

- Draft reliability certification — duplicate-tab handling, load test concurrent leagues, reconnect stress test; findings documented in `commissioner-runbook.md`
- Founder Operations Console — league explorer (search by league/commissioner/user, view config + draft state + standings), simulation launcher, validation dashboard — spec `docs/02-engineering/founder-ops-console.md`
- Beta Feedback Infrastructure — in-app feedback widget (bug reports, suggestions), founding commissioner tracking (invited → accepted → active → renewed)
- Commissioner workflow validation — end-to-end manual test of all commissioner actions; runbook accuracy review; screenshots added

**Exit:** commissioner can run a league start-to-finish with no engineering help; founder can monitor platform health without DB access; founding commissioner cohort can be invited.

## Sprint 6+ — Post-MVP / Launch features · P1 → P2

Sequenced from "What To Build Next" and the GPT launch phases:

- **Transactions:** #7 Trade System → #5 Waiver priority/processing → #6 FAAB (Transaction History #8 now in Sprint 3)
- **Engagement:** #25 Team Analysis & Insights · #29 Weekly Performance Dashboard · #11 league-wide storylines · #30 Playoff Experience UX polish
- **Multi-season UX layer** (schema laid in Sprint 2 via MS-001/002/003/004): MS-005 League History views · League Hall of Fame (#18) · Player Legacy (#31)
- **Growth / retention:** GR-001/002 activation + retention analytics (AN-002/003 dashboards) · GR-003 referral loop · GR-004 league-fill progress
- **Phases 5–7:** rivalries H2H history · Hall of Fame · player legacy · keeper → dynasty · real-time push scoring · push notifications · player trends

---

# Sprint History

| Sprint | Status | Outcome |
|---|---|---|
| Sprint 0 — Implementation Alignment | ✅ COMPLETE (Jun 12, 2026) | Rosters / VP / Playoffs flipped FAIL → PASS |
| Sprint 1 — Season Validation | ✅ COMPLETE (Jun 12, 2026) | Full season simulates, 114 tests pass, confidence 85–90% |
| Sprint 2 — Commissioner + Platform Foundation | ✅ COMPLETE (Jun 2026) | Commissioner recovery tools, multi-season schema, analytics (6 events), VP education; 130 tests pass |
| Sprint 3 — Beta Readiness | ← CURRENT | Onboarding ✅, error handling, mobile ✅, notifications, transaction history ✅ |
| Sprint 4 — Product Polish | ⏳ PARTIALLY DONE | #28 lineup tab polish ✅, #01 commissioner dashboard gaps, #17 rivalries |
| Sprint 5 — Validation + Beta Operations | ⏳ PLANNED | Draft cert, founder dashboard, beta feedback infra |
| Sprint 6+ — Launch Features | ⏳ PLANNED | Transactions, trade, waivers, growth |

---

# MVP Launch Timeline & Beyond

**Anchor:** today is June 12, 2026. The PWHL 2026-27 opener is ~Nov 2026, with fantasy drafts
~1 week prior (~late Oct 2026). That real date is the natural public-launch target — MVP must
be drafting-ready before it. Dates below assume ~2-week sprints, solo + Claude. They are
estimates, not commitments.

| Window | Milestone |
|---|---|
| **Jun 12, 2026** | Sprint 0 — alignment P0s closed (roster / VP / playoffs match rules) ✅ |
| **Jun 12, 2026** | Sprint 1 — season simulation + validation suites green ✅ |
| **Jun–Jul 2026** | Sprint 2 — commissioner recovery + platform foundation + analytics ✅ |
| **Late Jul 2026** | Sprint 3 — onboarding ✅, error handling, mobile ✅, notifications ← current |
| **Aug 2026** | Sprint 4 — lineup tab polish ✅, commissioner dashboard gaps, rivalries |
| **Late Aug 2026** | Sprint 5 — draft cert, founder dashboard, beta feedback infra |
| **Early Sep 2026** | **MVP code-complete — all launch gates pass** |
| **Sep – mid Oct 2026** | Closed beta: founding commissioners run replay + small live test leagues; fix findings |
| **Late Oct 2026** | **PUBLIC LAUNCH** — real leagues draft ~1 week before the opener |
| **Nov 2026** | First live regular season on the platform |

**Risk buffer:** if a sprint slips, the Sep–Oct beta window absorbs ~3–4 weeks before the hard
late-Oct draft date. Earliest *credible* MVP code-complete is early Sep 2026; the latest safe
code-complete before public drafts is early Oct 2026.

## Beyond MVP

- **Q4 2026 (in-season):** Transaction History → Trade System → Waivers → FAAB; engagement surfaces (#25 analysis, #29 performance dashboard, #30 playoff UX) while the first live season runs.
- **Off-season — winter/spring 2027:** Multi-Season UX layer — League History views, Hall of Fame, Player Legacy. The schema foundation (parentLeagueId, rulesVersion, scoringVersion) was laid in Sprint 2, so this is purely the product surface. Growth/retention analytics dashboards (AN-002/003) and referral loop. Target: 2027-28 leagues renew in-place and keep their history.
- **2027-28 season:** Advanced formats (keeper, then dynasty), real-time push scoring + push notifications, and player trends. Native apps and AI features (draft assistant, weekly recaps, trade evaluator) remain Phase 5 "future expansion" — revisit once retention metrics justify them.

---
