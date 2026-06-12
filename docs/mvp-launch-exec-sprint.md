# MVP Launch Execution Sprint

You are working in the PWHL Fantasy repository.

Your role is Staff Engineer responsible for delivering MVP launch readiness.

You are NOT responsible for inventing new features.

You are responsible for ensuring implementation matches documentation and that a complete fantasy season can be successfully completed.

---

# Source of Truth Documents

Treat these as authoritative.

## Product

docs/league-rules-v1.md

docs/mvp-definition.md

docs/feature-matrix.md

---

## Roadmap

docs/roadmap-gpt.md

---

## Architecture

docs/season-renewal-system.md

docs/multi-season-strategy.md

docs/engineering-foundation-specs.md

---

## MVP Validation

docs/season-simulation-plan.md

docs/mvp-readiness-scorecard.md

docs/mvp-audit-report.md

docs/p0-fix-plan.md

docs/validation-checklist.md

docs/recommended-next-sprint.md

---

## Operations

docs/analytics-events.md

docs/commissioner-tools-spec.md

docs/growth-retention-spec.md

---

# Primary Objective

Complete all work required for:

"MVP Season Validation Sprint"

as defined in:

docs/recommended-next-sprint.md

---

# Step 1 — Repository Audit

Review current implementation.

Identify:

1. Completed stories
2. Partially completed stories
3. Missing stories

for:

- End-to-End Season Simulation Framework
- VP Standings Validation Suite
- Playoff Qualification Validation Suite
- Draft Reliability Test Suite
- MVP Readiness Dashboard

Create:

docs/current-sprint-audit.md

---

# Step 2 — Execute P0 Fixes

Implement all remaining items from:

docs/p0-fix-plan.md

Specifically validate:

## Roster Configuration

Must be:

3F
2D
1UTIL
1G
6 Bench

---

## VP Authority

VP must become:

- standings source
- playoff qualification source
- playoff seeding source

---

## Playoffs

Default:

4 teams

No byes

1v4

2v3

---

## Weekly Lineup Lock

Must follow:

Matchup-week locking

NOT daily locking

---

# Step 3 — Build Validation Framework

Create automated validation for:

## VP Standings

Validate:

- VP calculations
- tie breakers
- standings generation

---

## Playoffs

Validate:

- qualification
- seeding
- bracket generation

---

## Draft

Validate:

- disconnects
- reconnects
- autopick
- pause/resume
- duplicate tabs

---

# Step 4 — Season Simulation

Implement the minimum framework required to execute:

docs/season-simulation-plan.md

Goal:

Simulate:

League Creation
→ Draft
→ Weekly Matchups
→ VP Standings
→ Playoffs
→ Champion

without manual intervention.

If simulation tooling already exists:

extend it.

If not:

create it.

---

# Step 5 — MVP Readiness Dashboard

Create:

docs/mvp-readiness-scorecard.md

Update all categories:

PASS
PARTIAL
FAIL

using implementation evidence.

---

# Step 6 — Produce Deliverables

At completion provide:

## Code Changes

Files modified

Reason for modification

---

## Remaining Risks

Categorized:

P0
P1
P2

---

## MVP Readiness

Percentage estimate

---

## Recommended Next Sprint

Based on actual repository state.

---

# Constraints

Do NOT build:

- Dynasty
- Keeper leagues
- AI features
- Referrals
- Public leagues
- Native apps

Do NOT redesign product requirements.

Use documented requirements.

If implementation conflicts with documentation:

documentation wins.

If documentation conflicts with code:

documentation wins.

Only escalate when documentation conflicts with other documentation.

---

# Success Condition

A simulated league can complete:

Create League
→ Draft
→ Weekly Competition
→ VP Standings
→ Playoffs
→ Champion

and all P0 items from the MVP audit report are resolved.