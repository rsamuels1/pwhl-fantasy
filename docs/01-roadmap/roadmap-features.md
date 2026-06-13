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
- **IA-007** · Rebalance auto-draft for 3F demand (simulation-tested) — P1
- **IA-008** · Finalize waiver spec (duration, priority, reset, processing schedule) — P2
- **IA-009** · Finalize VP tiebreakers: VP → matchup wins → H2H → total FP → random draw — P2
- **IA-010** · Stat-correction policy (cutoff window, playoff/championship handling) — P2
- **IA-011** · Hide advanced non-v1 features (byes, multi-round config, experimental scoring) — ✅ DONE
  Bracket page hides bye text when `topSeedsWithBye === 0`; fixed default 2→0; settings page renders scoring/roster/playoff as human-readable rows (not raw JSON). Checklist: `docs/02-engineering/ia-011-checklist.md`

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
- **Draft room** — `useIsMobile(900)` hook collapses three-column layout into tabbed Pick/Board/Needs view at ≤900px; secondary stat columns hidden at ≤480px via `stat-secondary` class
- **Touch targets** — `minHeight: 44px` on all Drop/Add (RosterManager), Pick/star/queue/position-filter (DraftRoom), slot cards + Cancel (LineupManager)
- **BottomNav** — `env(safe-area-inset-bottom)` for iPhone 15 home indicator
- **Standings** — `minWidth: 520` → `380`
- **Matchup** — swing player names get ellipsis truncation; hero score font uses `clamp()`

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

## 28. Lineup Stats Tab: "Matchup Proj" Rename & Default Polish

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
