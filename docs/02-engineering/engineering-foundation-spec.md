# engineering-foundation-specs.md

Version: 1.0

Status: Approved Draft

Purpose: Define implementation contracts required to complete MVP validation, commissioner tooling, launch readiness, and multi-season support.

---

# 1. VP Standings Specification

## Purpose

VP (Victory Points) is the authoritative standings system for PWHL Fantasy.

All playoff qualification, playoff seeding, standings display, and league rankings must be derived from VP.

---

## Weekly VP Allocation

### Matchup Result

Win:

```text
+2 VP
```

Tie:

```text
+1 VP
```

Loss:

```text
+0 VP
```

---

### Weekly Performance Bonus

Highest Weekly Score:

```text
+2 VP
```

Second Highest Weekly Score:

```text
+1 VP
```

All Other Teams:

```text
+0 VP
```

---

## Weekly VP Formula

```text
Total Weekly VP =
Matchup VP
+
Performance Bonus VP
```

---

## Season VP

```text
Season VP =
Sum(Weekly VP)
```

---

## Standings Sort Order

Primary:

```text
Season VP DESC
```

Tiebreakers:

1. Head-to-head VP
2. Head-to-head record
3. Total fantasy points scored
4. Total wins
5. Commissioner coin flip

---

## Standings Source Of Truth

Must use:

```text
VP Standings
```

Must NOT use:

```text
Win/Loss Record
Raw Points
```

for playoff qualification.

---

# 2. Playoff Engine Specification

## Purpose

Generate playoff qualification, seeding, and bracket advancement.

---

## MVP Configuration

```text
League Size: 8–10

Playoff Teams: 4

Byes: 0
```

---

## Qualification

Top 4 teams by VP.

---

## Seeding

```text
Seed 1
Seed 2
Seed 3
Seed 4
```

ordered by VP.

---

## Semifinals

```text
1 vs 4

2 vs 3
```

---

## Championship

Winners advance.

Single-week championship matchup.

---

## Tiebreakers

Use VP tiebreakers.

---

## Future Support

Architecture should support:

```text
4 Team
6 Team
8 Team
```

playoffs through configuration.

---

# 3. Draft State Machine

## Purpose

Define all legal draft transitions.

---

## States

```text
CREATED
WAITING
ACTIVE
PAUSED
AUTOPICK
COMPLETED
CANCELLED
```

---

## CREATED

League draft configuration created.

Transitions:

```text
CREATED -> WAITING
CREATED -> CANCELLED
```

---

## WAITING

Waiting for scheduled start.

Transitions:

```text
WAITING -> ACTIVE
WAITING -> CANCELLED
```

---

## ACTIVE

Managers actively drafting.

Transitions:

```text
ACTIVE -> PAUSED
ACTIVE -> AUTOPICK
ACTIVE -> COMPLETED
```

---

## PAUSED

Commissioner initiated.

Transitions:

```text
PAUSED -> ACTIVE
PAUSED -> CANCELLED
```

---

## AUTOPICK

Draft timer expired.

Transitions:

```text
AUTOPICK -> ACTIVE
```

---

## COMPLETED

Terminal state.

No transitions.

---

## CANCELLED

Terminal state.

No transitions.

---

## Disconnect Behavior

Player disconnect:

```text
Remain ACTIVE
```

Timer continues.

Autopick may trigger.

---

## Duplicate Tab Behavior

Single active draft session per manager.

Newest session wins.

Old session becomes read-only.

---

# 4. Lineup Lock State Machine

## Purpose

Define player eligibility changes during matchup periods.

---

## States

```text
EDITABLE
PARTIALLY_LOCKED
FULLY_LOCKED
```

---

## EDITABLE

Player has not yet appeared in a game during matchup week.

Manager may:

- Start
- Bench
- Move

---

## PARTIALLY_LOCKED

At least one rostered player has played.

Unplayed players remain editable.

Played players locked.

---

## FULLY_LOCKED

All active roster players have played.

No edits permitted.

---

## State Transitions

```text
EDITABLE
   ↓
Player Plays
   ↓
PARTIALLY_LOCKED
   ↓
All Players Played
   ↓
FULLY_LOCKED
```

---

## Matchup Boundary

Lock evaluation must use:

```text
Matchup Week
```

not:

```text
Calendar Day
```

---

# 5. Commissioner Permissions Matrix

| Action | Commissioner | Manager |
|----------|----------|----------|
| Pause Draft | Yes | No |
| Resume Draft | Yes | No |
| Replace Manager | Yes | No |
| Force Add Player | Yes | No |
| Force Remove Player | Yes | No |
| Undo Transaction | Yes | No |
| Edit League Settings | Yes | No |
| Edit Own Lineup | Yes | Yes |
| Edit Other Lineups | Yes | No |

---

## Commissioner Overrides

All overrides must generate audit logs.

---

# 6. Audit Log Specification

## Purpose

Track all commissioner and system actions.

---

## Schema

```ts
AuditLog {
  id
  leagueId
  actorId
  actionType
  entityType
  entityId
  beforeState
  afterState
  createdAt
}
```

---

## Required Logged Actions

### Commissioner

- Pause Draft
- Resume Draft
- Replace Manager
- Force Add
- Force Remove
- Undo Transaction

### System

- Draft Completion
- Playoff Generation
- Season Renewal

---

## Retention

```text
Forever
```

Audit history is part of league history.

---

# 7. Notification Architecture

## MVP Channels

### In-App

Required

### Email

Required

### Push

Future

---

## Notification Types

### Draft

- Draft Starting Soon
- You're On The Clock

### Gameplay

- Lineup Incomplete
- Matchup Complete

### Transactions

- Trade Received
- Waiver Processed

### Season

- Playoff Clinched
- Championship Won

---

## Delivery Rules

Retry:

```text
3 Attempts
```

Failure:

```text
Dead Letter Queue
```

---

# 8. Analytics Implementation Specification

## Event Schema

```ts
AnalyticsEvent {
  id
  eventName
  userId
  leagueId
  timestamp
  properties
}
```

---

## Required Dimensions

### User

- userId

### League

- leagueId

### Season

- seasonId

### Event Time

- timestamp

---

## MVP Dashboards

### Acquisition

Visitor → Registration

---

### Activation

Registration → League Creation

League Creation → Draft

Draft → Week 1 Lineup

---

### Retention

Week 2 Retention

Season Completion

League Renewal

---

# 9. League Lifecycle Specification

## States

```text
CREATED
DRAFTING
ACTIVE
PLAYOFFS
COMPLETED
ARCHIVED
RENEWED
```

---

## Transitions

```text
Create League
   ↓
CREATED

Draft Starts
   ↓
DRAFTING

Draft Completes
   ↓
ACTIVE

Playoffs Begin
   ↓
PLAYOFFS

Champion Crowned
   ↓
COMPLETED

Archive Season
   ↓
ARCHIVED

Renew League
   ↓
RENEWED
```

---

# 10. Rules & Scoring Versioning

## Rules Version

```ts
rulesVersion
```

Examples:

```text
v1
v2
v3
```

Stored on league creation.

Never mutated.

---

## Scoring Version

```ts
scoringVersion
```

Stored on season creation.

Never mutated.

---

## Historical Integrity

Completed seasons always use:

```text
Stored Rules Version
Stored Scoring Version
```

even if future seasons change.

---

# Architecture Principles

1. VP is authoritative.
2. Playoffs derive from VP.
3. Commissioner actions are auditable.
4. Completed seasons are immutable.
5. Renewed seasons inherit league identity via parentLeagueId.
6. Rules and scoring are versioned.
7. No feature should require manual database intervention to complete a season.

Definition of Done:

A league can successfully complete:

Create League
→ Draft
→ Weekly Competition
→ VP Standings
→ Playoffs
→ Champion
→ Season Renewal

without administrator intervention.