accelerated-test-season-mode.md

Version: 1.0

Date: 2026-06-12

Owner: Product

Status: Proposed

Priority: P0 (Sprint 3)

⸻

Executive Summary

Historical Replay mode is currently the primary mechanism for validating fantasy season functionality.

While Historical Replay is valuable for validating scoring correctness and season logic, it is not an effective workflow for:

* Alpha testing
* Commissioner onboarding
* UX validation
* Feature iteration
* Operational testing

The project requires a faster validation environment that allows a complete fantasy lifecycle to be exercised in minutes rather than weeks.

This document proposes the introduction of an Accelerated Test Season Mode.

⸻

Problem Statement

Current validation workflow:

League Creation

→ Draft

→ Historical Replay

→ Regular Season

→ Playoffs

→ Champion

→ Renewal

Issues:

Slow Iteration

A complete replay requires progressing through an entire historical season.

This dramatically slows:

* Bug reproduction
* Validation
* Regression testing

Poor Alpha Experience

Founding commissioners should not need to wait through a full replay season to evaluate:

* Playoffs
* Championship generation
* Renewal
* Commissioner tools

Difficult Lifecycle Testing

Current testing makes it difficult to repeatedly validate:

* VP standings
* Playoff qualification
* Championship generation
* Season renewal

within a single testing session.

⸻

Goals

Accelerated Test Season should allow validation of:

* League creation
* Draft completion
* Standings generation
* VP calculations
* Playoff qualification
* Championship generation
* Season renewal

within a single session.

Target runtime:

Less than 5 minutes.

⸻

Non-Goals

This mode is NOT intended to validate:

* Historical scoring accuracy
* Real player performance
* Production schedules
* Real-world standings

Historical Replay remains the source of truth for those validations.

⸻

Proposed League Type

Add a new league creation option:

League Type
○ Standard Season
○ Historical Replay
○ Test Season

Test Season should be clearly labeled:

For validation and commissioner testing only.

⸻

Test Season Configuration

Teams

4 teams

Purpose:

Reduce complexity and validation time.

⸻

Roster Rules

Use standard roster requirements.

Current approved format:

* 3 Forwards
* 2 Defense
* 1 UTIL
* 1 Goalie
* 6 Bench

This ensures roster validation remains identical to production.

⸻

Regular Season

4 weeks

Schedule:

Each team plays every opponent.

Goal:

Generate meaningful standings while minimizing duration.

⸻

Playoffs

Top 2 teams qualify.

No byes.

⸻

Championship

Single championship matchup.

Duration:

1 week.

⸻

Expected Lifecycle

League Created

→ Draft

→ Week 1

→ Week 2

→ Week 3

→ Week 4

→ Playoff Qualification

→ Championship

→ Champion

→ Renewal

Entire lifecycle should complete in under 5 minutes.

⸻

Simulation Controls

Test Season leagues should expose enhanced simulation controls.

Advance One Week

Button:

Advance Week

Purpose:

Validate week-by-week behavior.

⸻

Simulate Remaining Season

Button:

Simulate Season

Purpose:

Validate entire lifecycle.

Expected Result:

Champion generated.

⸻

Simulate Through Renewal

Optional Stretch Goal

Button:

Simulate Through Renewal

Purpose:

Validate:

* Champion creation
* League completion
* Renewal workflow
* parentLeagueId lineage

⸻

Required Validation Coverage

Test Season mode must exercise all MVP-critical systems.

Draft

Validate:

* Draft completion
* Roster creation

⸻

VP Standings

Validate:

* VP calculations
* Ranking calculations
* Standings generation

⸻

Playoffs

Validate:

* Qualification
* Seeding
* Bracket generation

⸻

Championship

Validate:

* Winner determination
* League completion

⸻

Renewal

Validate:

* Parent league creation
* Child league creation
* Rules version inheritance
* Scoring version inheritance

⸻

Historical Replay Positioning

Historical Replay should remain available.

Historical Replay is the source of truth for:

* Scoring validation
* Historical data validation
* Regression testing

Historical Replay should NOT be the primary alpha-testing workflow.

⸻

Roadmap Changes

Add Sprint 3 Story

VAL-002 — Accelerated Test Season Mode

Priority:

P0

⸻

Acceptance Criteria

Users can:

* Create Test Season league
* Complete draft
* Simulate season
* Generate playoffs
* Generate champion
* Renew league

without manual database edits.

Entire lifecycle completes in under 5 minutes.

⸻

Success Metrics

Internal team can validate:

* Draft
* VP standings
* Playoffs
* Championship
* Renewal

multiple times per day.

Goal:

Reduce fantasy lifecycle validation time from hours to minutes.

⸻

Claude Code Implementation Request

Review:

* league creation flow
* schedule generation
* playoff generation
* simulation services
* renewal services

Design and implement Test Season Mode using existing fantasy infrastructure wherever possible.

Prefer configuration-based behavior over duplicate implementations.

Produce:

1. Technical design proposal.
2. Database changes required.
3. API changes required.
4. UI changes required.
5. Validation plan.
6. Recommended roadmap updates.

Do not remove Historical Replay mode.
Test Season mode should supplement it.