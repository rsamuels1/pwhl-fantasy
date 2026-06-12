# Implementation Alignment Backlog

**Purpose:** Align the current implementation with the approved v1 product rules and launch strategy.

**Related Documents:**
- `league-rules-v1.md`
- Product Roadmap
- MVP Scope

---

# Overview

The codebase was intentionally designed to support future flexibility, including advanced playoff formats, configurable league settings, and multiple competition models.

For v1, the product direction is intentionally simpler:

- Casual PWHL fans
- ESPN/Yahoo-style experience
- Opinionated defaults
- Minimal commissioner configuration
- Hybrid Victory Points (VP) standings system

This document tracks implementation work required to align the codebase with the approved product rules.

---

# P0 — Launch Critical

## IA-001: Update Default Roster Construction

### Problem

The approved v1 roster format differs from the current implementation defaults.

### Approved v1 Format

| Position | Count |
|-----------|---------|
| Forward | 3 |
| Defense | 2 |
| Utility | 1 |
| Goalie | 1 |
| Bench | 6 |

Total Roster Size: 13

### Current State

Some roster-cap definitions still use:

- 2 Forwards
- 2 Defense
- 1 Utility
- 1 Goalie
- 6 Bench

### Acceptance Criteria

- All roster-cap constants use the approved v1 format.
- Roster validation uses the updated configuration.
- Draft validation uses the updated configuration.
- Auto-draft logic uses the updated configuration.
- Lineup validation uses the updated configuration.
- Documentation reflects the approved roster format.

### Priority

P0

---

## IA-002: Make Victory Points (VP) the Authoritative Standings System

### Problem

The product rules define Victory Points as the primary standings mechanism.

Standings, playoff qualification, and seeding must all use VP totals.

### Approved VP Model

#### Matchup VP

| Result | VP |
|----------|----|
| Win | 2 |
| Tie | 1 |
| Loss | 0 |

#### Weekly Bonus VP

| Weekly Rank | VP |
|-------------|----|
| Highest Weekly Score | +2 |
| Second Highest Weekly Score | +1 |

Maximum weekly total:

- 4 VP

### Acceptance Criteria

- League standings are sorted by VP.
- Playoff qualification uses VP standings.
- Playoff seeding uses VP standings.
- Team records display VP totals prominently.
- Legacy win/loss standings calculations are removed or deprecated.

### Priority

P0

---

## IA-003: Simplify Default Playoff Format

### Problem

The implementation currently supports advanced playoff structures.

The approved v1 experience is intentionally simpler.

### Approved v1 Playoff Format

#### Standard 8-Team League

- Top 4 teams qualify

#### Semifinals

- #1 vs #4
- #2 vs #3

#### Championship

- Semifinal winners advance

### Acceptance Criteria

- Default playoff qualification = 4 teams.
- No first-round byes.
- Single-week playoff rounds.
- Single-elimination bracket.
- Playoff UI reflects simplified structure.

### Priority

P0

---

# P1 — Product Consistency

## IA-004: Ensure Fantasy Season Ends Before PWHL Playoffs

### Problem

The rules specify that fantasy playoffs conclude before the PWHL postseason begins.

This business rule should be enforced by schedule generation.

### Acceptance Criteria

- Schedule generation reserves playoff weeks.
- Fantasy championship concludes before PWHL playoffs begin.
- Commissioners cannot create schedules that overlap the PWHL postseason.
- Validation messaging explains scheduling constraints.

### Priority

P1

---

## IA-005: Recommend 8-Team Leagues During League Creation

### Problem

The product is optimized around 8-team leagues.

The current implementation appears neutral regarding league size.

### Acceptance Criteria

- League creation defaults to 8 teams.
- UI labels 8 teams as "Recommended".
- Help text explains why 8 teams are preferred.
- Other supported sizes remain available.

### Priority

P1

---

## IA-006: Add Victory Points Education UI

### Problem

Most users will be unfamiliar with the hybrid VP format.

Without explanation, standings may appear confusing.

### Examples

Users may ask:

- "How did I lose but gain points?"
- "Why am I behind someone with the same record?"
- "Why did I get extra points this week?"

### Acceptance Criteria

Standings page displays:

- Total VP
- Matchup VP
- Weekly Bonus VP

Provide:

- Tooltip
- Help modal
- Rules link

### Priority

P1

---

## IA-007: Rebalance Auto-Draft Logic for New Roster Structure

### Problem

Increasing forward slots from 2 to 3 changes positional demand.

Draft logic may not prioritize forwards appropriately.

### Acceptance Criteria

Simulation testing confirms:

- Teams fill all starting positions.
- Teams do not over-draft goalies.
- Teams draft enough forwards.
- Auto-drafted rosters remain competitive.

### Priority

P1

---

# P2 — Rules Finalization

## IA-008: Finalize Waiver System Specification

### Problem

The platform intends to use rolling waivers, but several rules remain undefined.

### Decisions Required

- Waiver duration
- Priority ordering
- Priority reset behavior
- Free-agent eligibility timing
- Claim processing schedule

### Acceptance Criteria

- Waiver rules documented.
- Platform implementation matches documentation.
- Commissioner controls are clearly defined.

### Priority

P2

---

## IA-009: Finalize VP Tiebreaker Rules

### Problem

The standings system requires deterministic tiebreakers.

### Proposed Order

1. Total VP
2. Matchup Wins
3. Head-to-Head Record
4. Total Fantasy Points
5. Random Draw

### Acceptance Criteria

- Tiebreakers documented.
- Tiebreakers implemented consistently.
- Playoff qualification uses identical logic.

### Priority

P2

---

## IA-010: Define Stat Correction Policy

### Problem

Official stat providers occasionally issue corrections after games complete.

The product requires a consistent correction policy.

### Decisions Required

- Can playoff results change after corrections?
- Is there a correction cutoff window?
- How are championship-week corrections handled?

### Acceptance Criteria

- Policy documented.
- Implementation follows policy.
- User-facing messaging explains adjustments.

### Priority

P2

---

# P2 — Scope Control

## IA-011: Hide Advanced Non-v1 Features

### Problem

The architecture supports more complexity than the v1 product vision.

Exposing advanced settings increases user confusion and support burden.

### Candidate Features

- Advanced playoff structures
- Multi-round playoff configuration
- Byes configuration
- Experimental scoring systems
- Excessive commissioner controls

### Acceptance Criteria

- Non-v1 features hidden from standard users.
- Future functionality remains available internally.
- UI remains focused on the approved v1 experience.

### Priority

P2

---

# Success Criteria

The implementation alignment effort is complete when:

- League Rules v1 and platform behavior match.
- Standings, playoffs, and scoring use the same logic.
- Default league settings reflect approved product decisions.
- New users can understand the game without commissioner intervention.
- The platform delivers an opinionated, beginner-friendly fantasy experience.

---

# Recommended Implementation Order

1. IA-001 — Update Default Roster Construction
2. IA-002 — Make VP the Authoritative Standings System
3. IA-003 — Simplify Default Playoff Format
4. IA-004 — End Fantasy Season Before PWHL Playoffs
5. IA-006 — Add VP Education UI
6. IA-007 — Rebalance Auto-Draft Logic
7. IA-011 — Hide Advanced Non-v1 Features
8. IA-008 through IA-010 — Finalize Remaining Rules