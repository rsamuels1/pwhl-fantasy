# P0 Fix Plan

## Purpose

Resolve all MVP launch-blocking implementation inconsistencies identified during the implementation alignment audit.

**Status: ALL P0 ITEMS RESOLVED — June 12, 2026** ✅

All four P0 blockers were implemented, tested, and documented in the MVP Season Validation Sprint. 114/114 tests pass. `tsc --noEmit` clean. See `docs/mvp-readiness-scorecard.md` for current scorecard (confidence: 85–90%).

---

# P0-001 — Roster Alignment — ✅ RESOLVED

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

## Resolution

Updated all default roster configuration sources to `{ forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 }` across: `app/api/leagues/create/route.ts`, `scripts/seed-draft.ts`, `scripts/seed-replay.ts`, `scripts/seed-playoff.ts`, `scripts/auto-draft.ts`, `scripts/set-optimal-lineups.ts`, `scripts/replay-week.ts`, CLAUDE.md, and `prisma/schema.prisma`. All validation passes. 19 lineup tests pass.

---

# P0-002 — VP Standings Authority — ✅ RESOLVED

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

## Resolution

`computeVpStandings` is now the single authoritative source everywhere. Removed all `isVpMode` / `scoringMode` branching from `app/league/[leagueId]/standings/page.tsx`, `lib/services/standings-service.ts`, and `lib/services/playoff-service.ts`. Schema default changed to `scoringMode @default("VP")`. 28 VP tests in `tests/vp.test.ts` verify correctness.

---

# P0-003 — Playoff Alignment — ✅ RESOLVED

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

## Resolution

Schema default updated to `teamsInPlayoff: 4, topSeedsWithBye: 0`. `lib/playoffs/lifecycle.ts` defaults updated. Critical bracket generation bug fixed in `lib/playoffs/brackets.ts` — was pairing consecutive seeds (1v2, 3v4); now correctly pairs best-vs-worst (1v4, 2v3). 18 playoff tests in `tests/playoffs.test.ts` verify all cases including VP-based seeding. `scripts/simulate-season.ts` confirms full end-to-end flow.

---

# P0-004 — Weekly Lineup Lock Alignment — ✅ RESOLVED

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

## Resolution

`lockTime` signature updated to `lockTime(playerTeamId, games, nowMs?, periodStartMs?)`. When `periodStartMs` is provided, locks if the team played any game in `[periodStart, nowMs]` (full-week lock). Both `app/team/[teamId]/lineup/page.tsx` and `app/api/leagues/[leagueId]/lineup/route.ts` pass `activePeriod.startsAt.getTime()` as `periodStartMs` when an active period exists. 6 lock tests in `tests/lineup.test.ts` cover period-based, today-only fallback, and before-period cases.

---

# Definition of Done

All four P0 items were implemented, tested, and documented in the MVP Season Validation Sprint (June 12, 2026). 114/114 tests pass. `tsc --noEmit` clean. Launch confidence: 85–90%.