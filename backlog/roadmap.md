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

These systems should be considered core platform functionality.

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

Status: Needed

New users need guidance.

Features:

- Welcome flow
- League setup wizard
- Draft preparation guide
- Replay explanation

Acceptance Criteria:

- User can create first league without documentation
- Replay mode clearly explained

---

## 3. Mobile Optimization

Status: Needed

Most users will interact on mobile.

Features:

- Responsive draft room
- Responsive matchup screens
- Mobile standings
- Mobile roster management

Acceptance Criteria:

- No horizontal scrolling
- Draft room usable on phones

---

## 4. Error Handling

Status: Needed

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

# Phase 2: Fantasy Essentials

Goal: Reach feature parity with major fantasy platforms.

Priority: HIGH

---

## 5. Waiver Wire System

Status: Partially Implemented

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

Features:

- Adds
- Drops
- Trades
- Waiver claims

Acceptance Criteria:

- League transaction log available

---

# Phase 3: Matchup Experience

Goal: Increase engagement throughout the season.

Priority: HIGH

Status: Largely Shipped — the team-scoped Matchup page (`/team/[teamId]/matchup`) is now
the primary in-season destination. The items below are mostly done; remaining polish noted.

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

## 24. Lineup Management v2 (Usability + Projected FPTS + Upcoming-Week Flag)

Phase: 3 (also a Phase 1 usability priority)

Priority: HIGH

Status: Not Implemented

Goal: make `/team/[teamId]/lineup` faster to operate and forward-looking, and make sure
managers never miss setting a lineup for the next matchup week.

Features:

- Lineup UX overhaul — fewer clicks to swap/set, clearer slot affordances, mobile-usable
  (ties into Mobile Optimization #3).
- Projected FPTS tab — projected fantasy points per rostered player for the *upcoming*
  matchup week, plus a projected starter total and a bench-vs-starter comparison so managers
  can optimize before lock.
- "Set lineup for upcoming week" flag on the matchup dashboard:
  - Appears once the current matchup week's last game is final and scores are set
    (period status SCORING_PENDING/COMPLETE).
  - Persists until the first game of the upcoming matchup week starts.
  - Deep-links to the lineup page pre-scoped to the upcoming period.
  - Clears when the user confirms a lineup for the upcoming week, or when that week's first
    game locks.

Implementation notes:

- Detect the "between weeks" window with `computeSeasonState`: current period
  COMPLETE/SCORING_PENDING and `nextPeriod` UPCOMING.
- Projected FPTS = `projectPlayer(...)` per player × that player's PWHL team games scheduled
  in the upcoming period (reuse the games-per-team batch query already used by the lineup/
  matchup pages).
- The flag is derived state — show when `nextPeriod` exists, the current period is done, and
  `nowMs < nextPeriod` first-game `startsAt`. To let it clear on *confirmation* (not just on
  first lock), persist a lightweight "lineup confirmed for week N+1" marker (a `LineupConfirmation`
  row or a `LeagueEvent`).
- The upcoming-week editor must only set future-period slots; respect existing lock + play-lock
  rules and never edit the active/locked period.
- Live-first; read `nowMs` via the dev/replay time helper so it still works under the QA harness.

Acceptance Criteria:

- Lineup page is materially faster to operate and works on mobile.
- A "Projected" tab shows per-player and team projected FPTS for the upcoming week.
- A persistent "Set your lineup for Week N+1" flag shows on the matchup dashboard from
  final-scores-set until the upcoming week's first game, and clears on confirmation.

Dependencies:

- Projections engine (exists)
- Season lifecycle period states (exists)

---

## 25. Team Analysis & Insights Tab

Phase: 3

Priority: HIGH (trade-suggestion portion gated by Trade System #7)

Status: Not Implemented

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

Phase 3 (Matchup Experience) is essentially shipped, and the Commissioner Dashboard +
immediate add/drop already exist. The highest-value gaps for a public beta are now:

1. Lineup Management v2 (#24) — high-value, near-zero new dependencies; fixes a real
   engagement/UX gap (easier lineup setting, projected FPTS, upcoming-week lineup flag) before beta
2. League Onboarding Wizard (#2) — still completely unbuilt; biggest blocker for self-serve signups
3. Mobile Optimization (#3) — draft room + matchup screens responsive (also unblocks #24's mobile goal)
4. Error Handling / empty + loading states (#4)
5. Trade System (#7) + Transaction History (#8) — the missing half of league management
6. Team Analysis & Insights tab (#25) — engagement differentiator; ship the analysis +
   free-agent half now, add trade suggestions once #7 lands
7. Waiver priority + processing jobs (#5) — upgrade the existing immediate add/drop into a real waiver wire

Stretch (differentiators, not beta blockers): league-wide matchup storylines (#11) and the
rivalry/Hall-of-Fame retention layer (#17–#18). Replay work (Phase 4) stays out of this
list — invest in it only when it unblocks testing of the above.

These provide the highest user value and are the remaining prerequisites for a public beta launch.

---

# Bugs or Additional Changes

These are bugs or additional changes that should be investigated and fixes added to the roadmap or within features already on the roadmap:

- (6/12) Lineup Page: the filters for "last week" "this week" and "season" should only alter the stats shown for the player, it should not change the lineup. there should also be a toggle for "Matchup Projection" that shows the projected FPTS for the upcoming matchup week. Let's have that instead of "this week"

- (6/12) Roster page: when the roster is in table view, the user should be able to sort by stat. table view should be the default view when someone switches to the Roster page. There should also be a dropdown box to look at other team rosters on this page. change the nav header for this page to "Rosters"

- (6/12) League Overview page: the matchups module should be de-prioritized, it takes up a lot of space and isn't all that helpful. it should at least showcase current matchup scores. I think the playoff race module is more important here. It would also be good to see every team and their lineup status (do they have any lineup errors? how many? is their lineup currently set?) what else do we think is important here that would also help complete Feature #1 on the roadmap?

- (6/12) League Dashboard Schedule page is not very helpful. Something more visual about the way the rankings are changing week to week for each team instead of being matchup focused here. Maybe some insights about which teams are rising in the ranks and who's tanking. I'd rather look through a table that I can click through week to week with teams and their stat breakdowns. It'd be cool to see point breakdowns by position by team over each week.

- (6/12) the playoff tab is fine for now, but once playoffs start, I'd like to see a playoff bracket here. we should also consider how the user experience will change during playoffs and what becomes most important to surface for the user.

- (6/12) there should eventually be a way for a player to track their performance/legacy/dynasty across their overall game play (teams, leagues, seasons etc) similar to Madden Coaching Legacy/Dynasty stats for "play as a coach" mode on madden. this should also include a ranking across all users!

---