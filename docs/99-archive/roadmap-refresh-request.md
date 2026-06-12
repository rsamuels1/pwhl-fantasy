# Roadmap Refresh Findings & Required Updates

Date: June 2026

Repository Reviewed:

- docs/roadmap/roadmap.md
- docs/roadmap/roadmap-gpt.md
- docs/roadmap-prioritization-updates.md
- docs/current-sprint-audit.md
- docs/mvp-readiness-scorecard.md
- docs/engineering-foundation-spec.md
- docs/implent-parentleagueid.md
- tests/*
- scripts/*
- prisma/schema.prisma

---

# Executive Summary

The roadmap should be refreshed to reflect the fact that:

## Completed

Sprint 0 is complete.

Sprint 1 is complete.

Evidence:

- simulate-season.ts exists
- vp.test.ts exists
- playoffs.test.ts exists
- season-lifecycle.test.ts exists
- scoring.test.ts exists
- lineup.test.ts exists

The current GPT roadmap still treats much of this work as future-state planning.

---

# Major Prioritization Change

Move:

- parentLeagueId
- rulesVersion
- scoringVersion

from Post-MVP

to

Sprint 2 Platform Foundation.

Reason:

These are architectural decisions, not user-facing features.

The longer they are delayed, the more expensive future migrations become.

---

# Recommended Sprint Structure

## Sprint 0

Implementation Alignment

Status:

COMPLETE

Includes:

- IA-001 Roster Alignment
- IA-002 VP Authority
- IA-003 Playoff Alignment
- IA-007 Draft Rebalancing

No additional roadmap work required.

---

## Sprint 1

Season Validation

Status:

COMPLETE

Includes:

- End-to-End Season Simulation
- VP Validation Suite
- Playoff Validation Suite
- Lineup Validation
- MVP Readiness Validation

No additional roadmap work required.

---

## Sprint 2

League Operations + Platform Foundation

Status:

NEXT ACTIVE SPRINT

This should become the new roadmap focus.

### Commissioner Tools

CT-001 Force Roster Moves

CT-002 Undo Transactions

CT-003 Replace Managers

CT-004 Pause / Resume Draft

---

### Audit Infrastructure

AL-001 Audit Log Framework

AL-002 Commissioner Action Log

---

### Transaction Foundation

TH-001 Transaction History Framework

This should move ahead of Trades.

---

### Multi-Season Foundation

MS-001 parentLeagueId

MS-002 rulesVersion

MS-003 scoringVersion

These should be implemented before beta.

---

### Product Alignment

VP Education UX

Lineup Lock Validation

League Creation Guidance

Recommended:

8-team default league setup

---

## Sprint 3

Launch Readiness

### Onboarding

League onboarding flow

Draft onboarding

Commissioner onboarding

---

### Notifications

Draft starting

On the clock

Lineup incomplete

---

### Mobile Optimization

Draft room

Roster

Matchup

Standings

---

### Error Handling

Loading states

Empty states

Retry states

---

### Analytics Instrumentation

Add:

Registration

Login

League Created

League Joined

Draft Started

Draft Completed

Lineup Saved

Do NOT wait until after beta.

---

## Sprint 4

Transactions

### Foundation

Transaction History

---

### Features

Trade System

Trade Review

Waivers

FAAB

Recommended order:

Transaction History
→ Trades
→ Waivers
→ FAAB

---

## Sprint 5

Retention & Multi-Season UX

Built on Sprint 2 foundation.

Includes:

League Renewal

League History

Season Archives

Champion History

Hall of Fame

Historical Records

---

## Sprint 6+

Expansion

Keeper

Dynasty

Push Notifications

AI Features

Referral Systems

Growth Loops

Public Leagues

---

# Required Updates To roadmap.md

1. Keep Sprint 0 marked complete.
2. Keep Sprint 1 marked complete.
3. Replace current Sprint 2 section with:
   "League Operations + Platform Foundation"
4. Move:
   - parentLeagueId
   - rulesVersion
   - scoringVersion
   into Sprint 2.
5. Move Transaction History ahead of Trade System.
6. Add Core Analytics Instrumentation to Sprint 3.
7. Create a dedicated Sprint 5:
   Retention & Multi-Season UX.
8. Update timeline narrative to reflect the new sprint ordering.

---

# Required Updates To roadmap-gpt.md

roadmap-gpt.md currently reflects an earlier planning phase.

It should be rewritten to match roadmap.md.

Specific changes:

## Remove

Sprint 0 and Sprint 1 as future work.

Mark complete.

---

## Add

Current State:

Sprint 2 = Active Sprint

League Operations + Platform Foundation

---

## Promote

MS-001 parentLeagueId

MS-002 rulesVersion

MS-003 scoringVersion

from future enhancements to platform foundation.

---

## Reorder

Transaction History

before

Trade System.

---

## Add

Core Analytics Instrumentation

to Launch Readiness.

---

# Required Updates To HTML Roadmaps

Update:

- roadmap.html
- roadmap-gpt.html
- roadmap-gpt-v2.html
- roadmap-gpt-v3.html
- roadmap-gpt-v4.html
- roadmap-gpt-v5.html

All visual roadmaps should reflect:

Sprint 2
League Operations + Platform Foundation

Sprint 3
Launch Readiness

Sprint 4
Transactions

Sprint 5
Retention & Multi-Season UX

Sprint 6+
Expansion

---

# Final Recommendation

The repository has already crossed the line from:

Planning Product

to

Executing Toward Launch.

The roadmap should stop emphasizing:

Future Features

and start emphasizing:

Operational Readiness

Commissioner Success

Multi-Season Foundation

Beta Readiness

The single highest-leverage roadmap change is:

Promote

- parentLeagueId
- rulesVersion
- scoringVersion

into Sprint 2 before beta testing begins.