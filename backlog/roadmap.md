# ROADMAP.md

# PWHL Fantasy Product Roadmap

Last Updated: June 2026

---

# Purpose

This document serves as the source of truth for future development priorities.

When choosing what to build next:

1. Prioritize unfinished items in the current phase before moving to later phases.
2. Favor user-facing functionality over technical optimization unless stability is at risk.
3. Maintain compatibility with both Live Season mode and Historical Replay mode.
4. Avoid introducing features that only work for live leagues.

---

# Product Vision

PWHL Fantasy is the premier fantasy platform for Professional Women's Hockey League fans.

The platform should support:

- Live fantasy leagues
- Historical replay leagues
- Commissioner customization
- Deep roster management
- Long-term league retention

Historical Replay should remain a first-class feature, not an afterthought.

---

# Current State

Implemented systems include:

- Authentication
- User accounts
- League creation
- League management
- Draft room
- Draft queue
- Auto draft
- Rosters
- Lineups
- Matchups
- Standings
- Playoffs
- Historical Replay
- Season advancement
- Schedule management
- Scoring engine

These systems should be considered core platform functionality.

---

# Phase 1: Beta Completion

Goal: Make the product stable enough for external users.

Priority: CRITICAL

---

## 1. Commissioner Dashboard

Status: Needed

Commissioners need a central administration interface.

Features:

- Advance replay week
- Pause replay season
- Restart replay season
- Force draft start
- Lock/unlock lineups
- Manage league settings

Acceptance Criteria:

- Single dashboard for all commissioner actions
- Permissions enforced
- Replay controls available

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

Status: Not Implemented

Features:

- Add/drop players
- Waiver priority
- Waiver processing jobs
- Commissioner settings

Acceptance Criteria:

- Players can be claimed
- Claims process correctly
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

---

## 9. Live Matchup Center

Features:

- Top performers
- Team comparisons
- Position battles
- Remaining players

Acceptance Criteria:

- Matchups become primary user destination

---

## 10. Win Probability Engine

Features:

- Projected scores
- Win percentages
- Historical comparison

Acceptance Criteria:

- Matchups display projected outcomes

Dependencies:

- Statistical modeling layer

---

## 11. Matchup Storylines

Features:

- Biggest upset
- Closest matchup
- League leader highlights

Acceptance Criteria:

- Automatically generated league insights

---

# Phase 4: Historical Replay Expansion

Goal: Make replay a flagship feature.

Priority: VERY HIGH

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

Features:

- Head-to-head records
- Rival badges
- Historical matchups

Acceptance Criteria:

- League history persists

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

Features:

- Real-time game updates
- Fantasy score updates

Acceptance Criteria:

- Scores update during games

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

All new features must support:

- Live leagues
- Historical replay leagues

Do not build features that assume future games exist.

Always ask:

"How does this behave in replay mode?"

before implementation.

---

# What To Build Next

Immediate Recommendation:

1. Commissioner Dashboard
2. League Onboarding Wizard
3. Mobile Draft Experience
4. Waiver Wire System
5. Trade System

These features provide the highest user value and are prerequisites for a public beta launch.