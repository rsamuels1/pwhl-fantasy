# Code Review Framework

Version: 1.0

Owner: Product / Engineering

Purpose:

Establish a repeatable review process for AI-generated code.

The goal is not to optimize syntax or code style.

The goal is to ensure:

- Product correctness
- Workflow integrity
- Architectural consistency
- Operational reliability

---

# Review Philosophy

AI-generated systems should be reviewed similarly to third-party software.

Focus on:

1. Business rule correctness
2. State machine integrity
3. System consistency
4. Operational safety

Do not prioritize:

- Minor style issues
- Premature optimization
- Naming preferences

unless they materially impact maintainability.

---

# Layer 1 — Product Review

Highest Priority

Question:

Does the implementation match the product specification?

Review Against:

- league-rules-v1.md
- feature-matrix.md
- roadmap.md
- implementation-alignment-sprint.md

Validation Areas:

## Scoring

Verify:

- VP calculations
- Matchup scoring
- Weekly ranking scoring
- Standings generation

## Rosters

Verify:

- Starting lineup requirements
- Bench requirements
- Eligibility rules

## Playoffs

Verify:

- Qualification logic
- Seeding logic
- Championship generation

## League Renewal

Verify:

- parentLeagueId lineage
- Rules version inheritance
- Scoring version inheritance

Acceptance Criteria:

Implementation matches approved product documentation.

---

# Layer 2 — Workflow Review

Question:

Can users complete the intended lifecycle?

Review:

## Draft Lifecycle

CREATED
→ OPEN
→ IN_PROGRESS
→ PAUSED
→ COMPLETE

## Season Lifecycle

PRESEASON
→ REGULAR_SEASON
→ PLAYOFFS
→ CHAMPION
→ COMPLETE

## Renewal Lifecycle

COMPLETE
→ RENEWED
→ NEW_LEAGUE_CREATED

Review Requirements:

- No dead-end states
- No missing transitions
- Recovery paths documented

Acceptance Criteria:

All workflows complete without manual database intervention.

---

# Layer 3 — Architecture Review

Question:

Is there one source of truth?

Review:

## Scoring

Single owner:

lib/scoring/

## Standings

Single owner:

lib/standings/

## Draft Logic

Single owner:

lib/draft/

## Playoffs

Single owner:

lib/playoffs/

Red Flags:

- Duplicate calculations
- Multiple competing services
- Reimplemented business logic

Acceptance Criteria:

Business logic exists in one authoritative location.

---

# Layer 4 — Operational Review

Question:

What happens when something fails?

Review:

## Draft Failure

Can draft recover?

## Renewal Failure

Can renewal recover?

## Commissioner Actions

Are actions auditable?

## Replay Failures

Can simulation recover?

Acceptance Criteria:

Critical workflows have documented recovery paths.

---

# Sprint Exit Review

Before any sprint is considered complete:

- Product review complete
- Workflow review complete
- Architecture review complete
- Operational review complete

Result:

Sprint approved for roadmap completion.