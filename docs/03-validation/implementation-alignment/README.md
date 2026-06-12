# Implementation Alignment

**Status: RESOLVED** — All P0 items fixed, June 12, 2026. 114/114 tests pass. `tsc --noEmit` clean.

## Contents

- [audit.md](audit.md) — Original alignment backlog: what needed to be fixed to match approved v1 product rules
- [fix-plan.md](fix-plan.md) — P0 fix specifications with resolution status for each blocker
- [status.md](status.md) — Sprint-level status audit table with evidence by feature area

## Summary

Four P0 implementation blockers were identified, tracked, and resolved during the MVP Season Validation Sprint:
- **P0-001** — Roster alignment (3F/2D/1G/1UTIL/6B canonical config)
- **P0-002** — VP standings as the authoritative source everywhere
- **P0-003** — 4-team playoff format with no byes
- **P0-004** — Default lineup lock validation (period-based)

See [fix-plan.md](fix-plan.md) for full resolution details. See `../mvp-readiness-scorecard.md` for the post-sprint confidence scorecard.

---

# Claude Code Prompt: MVP Implementation Alignment Sprint

You are working in the PWHL Fantasy codebase.

Before implementing any new features, perform a complete MVP implementation audit against the product documentation.

## Context

The product roadmap has been reprioritized.

The current priority is:

1. Fix implementation inconsistencies
2. Validate MVP gameplay loop
3. Harden draft reliability
4. Complete MVP launch requirements
5. Add new features only after MVP validation

The following documents should be treated as the source of truth:

### Product Docs

- docs/league-rules-v1.md
- docs/feature-matrix.md
- docs/implementation-alignment.md
- docs/draft-experience.md
- docs/mvp-definition.md
- docs/season-simulation-plan.md
- docs/analytics-events.md
- docs/commissioner-tools-spec.md
- docs/multi-season-strategy.md
- docs/season-renewal-system.md

### Roadmap

- docs/roadmap-gpt.md

---

# Phase 1 — Audit

Review the entire codebase and identify every mismatch between:

- documented rules
- roadmap priorities
- implemented behavior

Create a report:

docs/mvp-audit-report.md

For each discrepancy include:

## Issue

Description of mismatch

## Expected Behavior

What the documentation says

## Current Behavior

What the code currently does

## Severity

P0
P1
P2

## Recommended Fix

Specific implementation recommendation

---

# Phase 2 — Validate Existing High-Risk Areas

Specifically audit:

## Roster Construction

Validate implementation matches:

3 F
2 D
1 UTIL
1 G
6 Bench

---

## VP Standings

Validate:

- VP calculations
- weekly rank points
- playoff qualification
- playoff seeding

Determine whether VP standings are actually the source of truth.

---

## Playoffs

Validate:

- bracket generation
- qualification logic
- tiebreakers
- championship flow

Compare implementation against:

4-team playoff design

---

## Weekly Lineup Lock

Validate:

Managers may only move players who have not yet played during the matchup week.

Verify implementation.

---

## Draft System

Audit:

- reconnect behavior
- timer behavior
- autopick
- draft completion
- duplicate tab handling

Document findings.

---

# Phase 3 — Build MVP Readiness Scorecard

Create:

docs/mvp-readiness-scorecard.md

Sections:

## League Creation

PASS / FAIL

## Draft

PASS / FAIL

## Rosters

PASS / FAIL

## Weekly Matchups

PASS / FAIL

## VP Standings

PASS / FAIL

## Playoffs

PASS / FAIL

## Commissioner Tools

PASS / FAIL

## Analytics

PASS / FAIL

## End-to-End Season Simulation

PASS / FAIL

Include rationale for each score.

---

# Phase 4 — Fix P0 Items

After audit completion:

Implement all P0 implementation alignment fixes.

Focus on:

1. Roster alignment
2. VP standings authority
3. Playoff alignment
4. Weekly lineup lock validation

Before making changes:

- explain proposed changes
- identify affected files
- identify migration risks

After changes:

- provide diff summary
- provide validation steps

---

# Phase 5 — Season Simulation Preparation

Implement anything necessary to support:

docs/season-simulation-plan.md

Goal:

Allow a complete simulated season:

League Creation
→ Draft
→ Weekly Matchups
→ VP Standings
→ Playoffs
→ Champion

without manual database intervention.

If simulation tooling already exists:

document it.

If not:

recommend the smallest implementation required.

---

# Deliverables

Produce:

1. docs/mvp-audit-report.md
2. docs/mvp-readiness-scorecard.md
3. P0 implementation fixes
4. Validation checklist
5. Recommended next sprint

Do not implement new growth features, retention features, AI features, dynasty features, or referral features.

Stay focused on MVP launch readiness and implementation correctness.