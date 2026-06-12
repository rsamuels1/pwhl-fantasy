# Roadmap Prioritization Recommendations

Version: 1.0

Purpose: Update roadmap prioritization based on implementation audit findings, MVP validation planning, and long-term platform architecture requirements.

---

# Executive Summary

The current roadmap is generally aligned with MVP launch priorities.

However, several foundational platform initiatives are currently scheduled too late and should be promoted earlier in the roadmap.

The most significant recommendation is to move the Multi-Season Foundation work (parentLeagueId, rulesVersion, scoringVersion) from a post-MVP enhancement into Sprint 2 platform infrastructure.

These items are architectural concerns rather than user-facing features and become increasingly expensive to implement after multiple seasons exist.

---

# Recommendation 1 — Promote Multi-Season Foundation

## Current State

The roadmap currently places:

- parentLeagueId
- rulesVersion
- scoringVersion

alongside future retention and league-history features.

Examples:

- League Renewal
- Hall of Fame
- Historical Records
- Keeper Leagues
- Dynasty Leagues

---

## Problem

These items are not feature work.

They are foundational architecture.

Without them:

```text
League 2026
League 2027
League 2028
```

exist as disconnected records.

Future support for:

- League Renewal
- Historical Champions
- League History
- Season Records
- Keeper Leagues
- Dynasty Leagues

becomes significantly more difficult.

---

## Recommendation

Move the following stories into Sprint 2:

### MS-001

Implement parentLeagueId

### MS-002

Implement rulesVersion

### MS-003

Implement scoringVersion

---

## Rationale

These schema-level decisions should be completed before:

- Beta testing
- Public launch
- Multi-season league operation

Early implementation minimizes:

- Database migration risk
- Historical data migration complexity
- Future architectural debt

---

# Recommendation 2 — Add Core Analytics Instrumentation Before Beta

## Current State

Analytics implementation occurs relatively late.

---

## Problem

Without analytics, beta testing cannot answer:

- Where users drop off
- Why leagues fail
- Whether onboarding is effective
- Whether drafts complete successfully

---

## Recommendation

Add a new Sprint 3 initiative:

### AN-001 Core Event Tracking

Implement instrumentation only.

Dashboards may remain in a later sprint.

---

## Required Events

### User Lifecycle

- Registration
- Login

### League Lifecycle

- League Created
- League Joined

### Draft

- Draft Started
- Draft Completed

### Gameplay

- Lineup Saved

---

## Rationale

A beta without analytics generates opinions rather than evidence.

Instrumentation should exist before public testing begins.

---

# Recommendation 3 — Move Transaction History Ahead of Trades

## Current State

Trade functionality is prioritized before transaction history infrastructure.

---

## Problem

Transaction history is a dependency of:

- Commissioner recovery
- Audit logs
- Trade review
- Waiver review
- Future dispute resolution

---

## Recommendation

Reorder roadmap sequence:

```text
Audit Log
    ↓
Transaction History
    ↓
Trade System
    ↓
Waivers
    ↓
FAAB
```

---

## Rationale

Transaction history is infrastructure.

Trades are a feature.

Infrastructure should precede feature development.

---

# Recommended Sprint Structure

## Sprint 0

Implementation Alignment Sprint

### Goals

Resolve all MVP implementation inconsistencies.

### Stories

- IA-001 Roster Alignment
- IA-002 VP Authority
- IA-003 Playoff Alignment
- IA-004 Weekly Lineup Lock
- IA-005 League Defaults
- IA-006 Fantasy Season Boundaries
- IA-007 VP Education

---

## Sprint 1

MVP Season Validation Sprint

### Goals

Prove a complete fantasy season can run successfully.

### Stories

- End-to-End Season Simulation Framework
- VP Validation Suite
- Playoff Validation Suite
- Draft Reliability Suite
- MVP Readiness Dashboard

---

## Sprint 2

League Operations + Platform Foundation

### Goals

Enable commissioner operations and establish long-term platform architecture.

### Commissioner Stories

- Force Roster Moves
- Undo Transactions
- Replace Managers
- Draft Pause / Resume

### Infrastructure Stories

- Audit Log Framework
- Transaction History Framework

### Platform Foundation Stories

- MS-001 parentLeagueId
- MS-002 rulesVersion
- MS-003 scoringVersion

### Product Stories

- VP Education UX
- Lineup Lock Validation

---

## Sprint 3

Launch Readiness Sprint

### Goals

Prepare for real-world beta usage.

### Stories

- Notifications
- Mobile Optimization
- Error Handling
- Commissioner Onboarding

### Analytics

- AN-001 Core Event Tracking

Required events:

- Registration
- Login
- League Created
- League Joined
- Draft Started
- Draft Completed
- Lineup Saved

---

## Sprint 4

Transactions Sprint

### Goals

Add league transaction systems.

### Stories

- Trade System
- Trade Review
- Waivers
- FAAB

Built on:

- Audit Log
- Transaction History

---

## Sprint 5

Retention & Multi-Season UX

### Goals

Expose capabilities enabled by the Sprint 2 foundation.

### Stories

- League Renewal
- League History
- Champion History
- Season Archives
- Historical Records

---

## Sprint 6+

Expansion Features

### Future Stories

- Keeper Leagues
- Dynasty Leagues
- Push Notifications
- AI Features
- Referral Loops
- Growth Systems

---

# Items That Should NOT Move

The following roadmap priorities remain correct and should not be reordered:

### Sprint 0

Implementation Alignment

Reason:

Launch-blocking defects.

---

### Sprint 1

Season Validation

Reason:

The product must successfully complete a season before new functionality is added.

---

### Sprint 3

Notifications, Mobile Optimization, and Error Handling

Reason:

These are critical launch-readiness concerns and directly impact beta success.

---

# Final Recommendation

The roadmap should continue to prioritize:

```text
Correctness
    ↓
Validation
    ↓
Operability
    ↓
Launch Readiness
    ↓
Retention
    ↓
Expansion
```

rather than:

```text
Features
    ↓
More Features
    ↓
Growth Features
```

The single most important roadmap change is promoting:

- parentLeagueId
- rulesVersion
- scoringVersion

from future enhancements to Sprint 2 platform infrastructure.