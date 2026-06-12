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

Status: Partially Implemented

Most users will interact on mobile. Compact stats on the lineup page are now hidden at
≤480px via `.stat-secondary`. Broader responsive work remains.

Features:

- Responsive draft room
- Responsive matchup screens
- Mobile standings
- Mobile roster management

Acceptance Criteria:

- No horizontal scrolling on core pages
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

Status: Partially Implemented

Phase: 1

Priority: MEDIUM

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

Acceptance Criteria:

- "Projected" tab is labelled "Matchup Proj".
- Between-weeks: "Matchup Proj" is default and "This week" is disabled (no active period).
- Label clarity: users understand what the projection represents.

---

## 32. Draft Room: Team Distribution Panel

Status: Not Implemented

Phase: 1 (draft room feature)

Priority: MEDIUM

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
are shipped. The highest-value gaps for a public beta are:

1. **Draft Team Distribution Panel (#32)** — small client-only addition to the draft room;
   prevents concentration mistakes during the most critical league moment.
2. **Lineup Stats Tab Polish (#28)** — rename "Projected" → "Matchup Proj", hide "This week"
   between weeks. Near-zero scope; polish before beta.
3. **League Onboarding (#2)** — still completely unbuilt; biggest blocker for self-serve signups.
4. **Mobile Optimization (#3)** — draft room + matchup screens responsive; unblocks broader
   mobile use.
5. **Error Handling (#4)** — empty + loading states for all core pages.
6. **Weekly Performance Dashboard (#29)** — replaces the low-value Schedule tab with a
   week-over-week team ranking / position-group breakdown table.
7. **Trade System (#7) + Transaction History (#8)** — the missing half of league management.
8. **Playoff Experience UX (#30)** — bracket prominence, champion banner, between-round nudge;
   activate before first playoff bracket closes.
9. **Team Analysis & Insights (#25)** — engagement differentiator; ship the analysis +
   free-agent half first, add trade suggestions once #7 lands.
10. **Waiver priority + processing jobs (#5)** — upgrade immediate add/drop into a real waiver wire.
11. **Player Legacy & Cross-Season Tracking (#31)** — career dashboard, global leaderboard;
    long-term retention driver.

Stretch (differentiators, not beta blockers): league-wide matchup storylines (#11) and the
rivalry/Hall-of-Fame retention layer (#17–#18). Replay work (Phase 4) stays out of this
list — invest in it only when it unblocks testing of the above.

---
