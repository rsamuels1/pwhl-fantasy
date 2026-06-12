# MVP Audit Report

## Purpose

Audit implementation against:

- league-rules-v1.md
- mvp-definition.md
- implementation-alignment.md
- roadmap-gpt.md

---

# IA-001 — Roster Construction Mismatch

## Issue

Default roster settings do not match approved v1 rules.

## Expected Behavior

Roster:

- 3 Forward
- 2 Defense
- 1 Utility
- 1 Goalie
- 6 Bench

Total roster size: 13

## Current Behavior

League creation defaults:

```ts
forward: 2
defense: 2
goalie: 1
util: 1
bench: 4
```

Located:

```text
app/api/leagues/create/route.ts
```

## Severity

P0

## Recommended Fix

Update all default roster configuration sources to:

```ts
forward: 3
defense: 2
goalie: 1
util: 1
bench: 6
```

Audit:

- league creation
- draft setup
- roster validation
- lineup validation
- auto-draft

---

# IA-002 — VP Not Fully Authoritative

## Issue

Product rules require VP standings as the authoritative ranking system.

## Expected Behavior

Standings

→ VP

Playoff Qualification

→ VP

Playoff Seeding

→ VP

## Current Behavior

VP engine exists:

```text
lib/scoring/vp.ts
```

However:

```text
app/league/[leagueId]/standings/page.tsx
```

still computes traditional standings:

```ts
computeStandings(...)
```

and only conditionally uses:

```ts
computeVpStandings(...)
```

based on:

```ts
league.scoringMode === "VP"
```

Default scoring mode:

```ts
VTF
```

## Severity

P0

## Recommended Fix

Remove conditional behavior.

Make VP standings the single source of truth.

---

# IA-003 — Playoff Format Mismatch

## Issue

Default playoff configuration differs from approved v1 design.

## Expected Behavior

4 teams

Semifinals:

1 vs 4

2 vs 3

Championship

No byes

Single elimination

## Current Behavior

Schema default:

```json
{
  "teamsInPlayoff": 6,
  "topSeedsWithBye": 2
}
```

Located:

```text
prisma/schema.prisma
```

Bracket generator explicitly supports:

6 teams

2 byes

Located:

```text
lib/playoffs/brackets.ts
```

## Severity

P0

## Recommended Fix

Default:

```json
{
  "teamsInPlayoff": 4,
  "topSeedsWithBye": 0
}
```

Update bracket UI and seeding logic.

---

# IA-004 — Weekly Lineup Lock Mismatch

## Issue

Rules define weekly lock behavior.

Implementation appears daily-game based.

## Expected Behavior

A player becomes locked after playing during the matchup week.

Managers may only modify players who have not yet played.

## Current Behavior

Located:

```text
lib/lineup.ts
```

Current lock logic:

```ts
todayStart = current UTC day
```

Player becomes locked after game start on that day.

This is not matchup-week aware.

## Severity

P0

## Recommended Fix

Locking should evaluate:

- scoring period
- matchup week
- player's completed games within matchup period

---

# IA-005 — League Size Default Mismatch

## Issue

Product direction recommends 8-team leagues.

## Current Behavior

League creation defaults:

```ts
maxTeams = 10
```

## Severity

P1

## Recommended Fix

Default:

```ts
maxTeams = 8
```

Display:

"Recommended"

during league creation.

---

# IA-006 — Fantasy Season Boundary Validation Missing

## Issue

No evidence that fantasy playoffs are guaranteed to finish before PWHL playoffs.

## Severity

P1

## Recommended Fix

Schedule generation validation.

Reserve playoff weeks.

Prevent overlap.

---

# IA-007 — VP Education UX Missing

## Issue

Hybrid VP standings may be confusing to new users.

## Severity

P2

## Recommended Fix

Add standings explainer:

- Matchup VP
- Weekly Bonus VP
- Total VP