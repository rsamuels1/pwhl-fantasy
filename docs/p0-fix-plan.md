# P0 Fix Plan

## Purpose

Resolve all MVP launch-blocking implementation inconsistencies identified during the implementation alignment audit.

---

# P0-001 — Roster Alignment

## Problem

Current implementation does not match the approved roster configuration documented in:

- league-rules-v1.md
- mvp-definition.md

Approved roster:

```text
3 F
2 D
1 UTIL
1 G
6 Bench
```

Current implementation:

```ts
forward: 2
defense: 2
goalie: 1
util: 1
bench: 4
```

---

## Affected Files

```text
app/api/leagues/create/route.ts
```

Potential additional dependencies:

```text
lib/lineup.ts
lib/draft/*
app/api/leagues/[leagueId]/draft/*
```

---

## Required Change

Update all default roster configuration sources:

```ts
forward: 3
defense: 2
goalie: 1
util: 1
bench: 6
```

---

## Validation

- Create new league
- Verify roster configuration
- Verify lineup validation
- Verify draft roster generation
- Verify roster display UI

---

# P0-002 — VP Standings Authority

## Problem

VP scoring exists but is not consistently the authoritative standings source.

Current implementation allows traditional standings in some flows.

Approved product behavior:

```text
VP Standings
    ↓
Playoff Qualification
    ↓
Playoff Seeding
```

---

## Affected Files

```text
app/league/[leagueId]/standings/page.tsx
```

Potential dependencies:

```text
lib/scoring/vp.ts
lib/playoffs/*
lib/services/*
```

---

## Required Change

Remove standings mode branching.

Always:

```text
Compute VP
Sort by VP
Seed by VP
Qualify by VP
```

---

## Validation

- Simulate standings
- Verify VP ordering
- Verify playoff qualification
- Verify playoff seeding

---

# P0-003 — Playoff Alignment

## Problem

Current playoff defaults:

```json
{
  "teamsInPlayoff": 6,
  "topSeedsWithBye": 2
}
```

Approved playoff structure:

```text
4 Teams

1 vs 4
2 vs 3

Championship

No Byes
```

---

## Affected Files

```text
prisma/schema.prisma
lib/playoffs/brackets.ts
app/league/[leagueId]/bracket/*
```

---

## Required Change

Update defaults:

```json
{
  "teamsInPlayoff": 4,
  "topSeedsWithBye": 0
}
```

Update:

- bracket generation
- playoff UI
- playoff validation

---

## Validation

Verify:

```text
Top 4 qualify

Seed 1 vs 4
Seed 2 vs 3

Championship generated
```

---

# P0-004 — Weekly Lineup Lock Alignment

## Problem

Rules specify matchup-week locking.

Current implementation appears to lock players based on same-day game start.

---

## Approved Behavior

Managers may only move players who have not yet played during the current matchup week.

---

## Affected Files

```text
lib/lineup.ts
app/api/leagues/[leagueId]/lineup/*
```

---

## Required Change

Replace:

```text
Game-start locking
```

with:

```text
Matchup-week locking
```

Evaluation should consider:

- matchup period
- scoring period
- completed games within matchup

---

## Validation

Verify:

- pre-game moves allowed
- post-game moves blocked
- untouched players remain movable

---

# Definition of Done

All four P0 items:

- implemented
- tested
- documented

before beginning any new feature development.