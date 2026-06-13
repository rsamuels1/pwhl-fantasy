# Playoff Root Cause Analysis

**Date:** June 12, 2026  
**Symptom:** Historical replay leagues complete all regular season weeks but `playoffStatus` stays `NOT_STARTED`. Playoffs never begin.

---

## Root Cause

**`advanceSeason()` in `lib/season/index.ts` never calls `startPlayoffs()`.**

When the last regular-season week is scored, `advanceSeason()` updates `league.status → COMPLETE` and returns. There is no call to `startPlayoffs()` — or to the orphaned `shouldStartPlayoffs()` decision function — anywhere in the season advancement code path.

`playoffStatus` therefore stays `NOT_STARTED` indefinitely. No bracket is generated, no playoff `Matchup` rows are created, and the league hangs.

---

## Evidence

### The gap — `lib/season/index.ts:125–136`

```ts
// Advance FantasyLeague.status based on the post-scoring state.
if (due.length > 0) {
  const updated = await getSeasonState(leagueId, nowMs, prisma);
  if (updated.lifecycleStatus === "COMPLETE") {
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { status: "COMPLETE" },   // ← sets regular-season status
    });
    // ← nothing here; startPlayoffs() is never called
  } else if (updated.lifecycleStatus === "IN_PROGRESS") {
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { status: "IN_SEASON" },
    });
  }
}
```

### The orphan — `lib/playoffs/lifecycle.ts:27–46`

`shouldStartPlayoffs()` is exported but never imported by any other file. It was written to detect when playoffs should trigger but was never wired into the advancement flow.

```ts
export function shouldStartPlayoffs(
  league: FantasyLeague,
  completedMatchupCount: number,
  expectedMatchupCount: number,
  currentDate: Date = new Date()
): boolean { ... }
```

`grep -r "shouldStartPlayoffs"` → only its own declaration. Zero callers.

### `startPlayoffs` call sites — confirmed exhaustive

| Location | How triggered |
|---|---|
| `app/api/leagues/[leagueId]/start-playoffs/route.ts:16` | Manual HTTP POST |
| `scripts/simulate-season.ts:414` | Manual explicit call inside the script |

No page component, no season advancement handler, no service calls it automatically.

### The simulation script workaround — `scripts/simulate-season.ts:409–424`

The script explicitly guards against this gap:

```ts
const leaguePlayoff = await prisma.fantasyLeague.findUniqueOrThrow({
  where: { id: leagueId }, select: { playoffStatus: true },
});
if (leaguePlayoff.playoffStatus === "NOT_STARTED") {
  playoffResult = await startPlayoffs(leagueId, prisma);
```

The fact that the simulation script explicitly bridges this gap confirms the developers were aware that `advanceSeason()` doesn't do it automatically.

---

## Specific Questions

### 1. Why playoffs never start

`advanceSeason()` ends at `league.status = "COMPLETE"`. No code calls `startPlayoffs()` on the same path. The `SeasonControls.tsx` dev UI has score-week / advance-day buttons but no "Start Playoffs" button, so there is also no manual escape hatch in the replay interface.

### 2. Is this caused by IA-003?

**No.** IA-003 fixed bracket _pairing_ (was 1v2, now correctly 1v4 / 2v3) and playoff _format defaults_ (4 teams, no byes). It has no effect on whether playoffs are _triggered_ — `startPlayoffs()` works correctly once called. IA-003 is not a factor.

### 3. Is this caused by IA-004?

**No.** IA-004 (schedule boundary validation — prevent fantasy season from overlapping PWHL postseason) is unimplemented as of this writing; it only appears in `startSeason()` as a pre-flight check. It has no interaction with `advanceSeason()` or playoff initialization.

There is one IA-004-adjacent path to watch: `startSeason()` reads `league.pwhlPlayoffStartsAt` and calls `validateSeasonBoundary()`. If that field is non-null on a replay league, it could throw before the season starts. That is a separate issue from this one and does not affect playoff initiation.

### 4. Is this caused by replay mode logic?

**No.** The bug is mode-agnostic — `advanceSeason()` has the same gap for all leagues. Replay leagues surface it most visibly because:

- The simulation script (`simulate-season.ts`) papers over the gap by calling `startPlayoffs()` explicitly, so automated tests pass.
- The `SeasonControls.tsx` dev UI (the only way to advance a replay league through the browser) has no "Start Playoffs" button, so there is no manual escape hatch once the regular season ends.

Live leagues would hit the same gap if the `/start-playoffs` endpoint were not called separately by a commissioner action (which doesn't yet exist in the production UI either — the admin panel links to `/start-playoffs` via the bracket page but requires manual navigation).

### 5. Is standings qualification preventing playoff creation?

**No.** `startPlayoffs()` in `lib/services/playoff-service.ts` validates:

1. `playoffStatus === "NOT_STARTED"` — satisfied (it never changes)
2. At least `teamsInPlayoff` (default 4) teams exist in the league — satisfied for any real league
3. VP standings can be computed — satisfied after regular season is scored

None of these preconditions would block playoff creation for a league that completed its regular season. The function is simply never called.

---

## Affected Files

| File | Role | Change needed |
|---|---|---|
| `lib/season/index.ts` | `advanceSeason()` — the entry point for all season advancement | Add `startPlayoffs()` call after `status: "COMPLETE"` is written |
| `lib/playoffs/lifecycle.ts` | `shouldStartPlayoffs()` — exists but orphaned | Either wire it into `advanceSeason()` or remove it (its logic is a subset of the preconditions already in `startPlayoffs()`) |
| `app/league/[leagueId]/season/SeasonControls.tsx` | Dev UI for season advancement | Add a "Start Playoffs" button visible when `lifecycleStatus === "COMPLETE"` and `playoffStatus === "NOT_STARTED"` |

No changes needed in `lib/services/playoff-service.ts`, `lib/playoffs/brackets.ts`, or `lib/scoring/matchups.ts` — those work correctly once called.

---

## Recommended Fix

### Primary fix — `lib/season/index.ts`

After `advanceSeason()` sets `league.status = "COMPLETE"`, import and call `startPlayoffs()`:

```ts
import { startPlayoffs } from "@/lib/services/playoff-service";

// Inside advanceSeason(), after setting status: "COMPLETE":
if (updated.lifecycleStatus === "COMPLETE") {
  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { status: "COMPLETE" },
  });
  // Automatically initialize playoffs — the league is complete and ready.
  // startPlayoffs() is idempotent: it no-ops if playoffStatus !== "NOT_STARTED".
  await startPlayoffs(leagueId, prisma).catch((err: Error) => {
    // Log only — don't fail the scoring response if playoff init fails.
    console.error("[advanceSeason] auto-startPlayoffs failed:", err.message);
  });
}
```

`startPlayoffs()` already guards against double-initialization (`if playoffStatus !== "NOT_STARTED" → throws PlayoffNotStartedError`), so calling it unconditionally here is safe.

### Secondary fix — `app/league/[leagueId]/season/SeasonControls.tsx`

Add a "▶ Start Playoffs" button rendered when the page receives `playoffStatus === "NOT_STARTED"` and `lifecycleStatus === "COMPLETE"`. This gives commissioners a manual fallback and makes the state transition visible in the UI. The button POSTs to `/api/leagues/[leagueId]/start-playoffs`.

### Cleanup — `lib/playoffs/lifecycle.ts`

`shouldStartPlayoffs()` becomes redundant once the primary fix is in place. Either delete it or add a call from `advanceSeason()` as the guard condition before calling `startPlayoffs()` (though `startPlayoffs()` already enforces the same invariants internally).

---

## Validation Plan

1. **Unit:** Add a test in `tests/season-lifecycle.test.ts` asserting that after all periods score, the lifecycle engine returns `"COMPLETE"`. (Already passes — lifecycle engine is pure and correct.)

2. **Integration — primary fix:**
   ```bash
   npm run seed && npm run seed-draft
   # draft + start season
   npx tsx scripts/simulate-season.ts --league <id>
   ```
   After the script runs, verify in Prisma Studio that `playoffStatus = IN_PROGRESS` without the script's manual `startPlayoffs()` call (remove it from the script after the fix to confirm the auto-trigger works).

3. **Integration — replay league:**
   ```bash
   npm run seed-fixture -- --season 2025-26
   # Create a replay league through the UI or seed-replay script
   # Use SeasonControls to advance through all weeks
   # Verify playoff bracket appears automatically on the bracket page
   ```

4. **Edge case — already-started leagues:** Call `advanceSeason()` on a league where `playoffStatus = IN_PROGRESS`. Confirm `startPlayoffs()` no-ops (it checks `playoffStatus !== "NOT_STARTED"` and throws `PlayoffNotStartedError`, which the `.catch()` swallows).

5. **Regression:** Run `npm test` — all 114 existing tests must stay green.
