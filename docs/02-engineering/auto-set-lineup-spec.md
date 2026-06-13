# Auto-Set Lineup Feature Spec

**Status:** Scheduled for Sprint 5  
**Feature Key:** LM-001 (Lineup Management enhancement)  
**Effort:** ~8–10 points (staged save + auto-set algorithm + FA suggestions)

---

## Problem Statement

Managers who land on the lineup page via "Set lineup →" from the matchup/dashboard page encounter three UX gaps:

1. **No visible save action.** Each click-to-swap auto-saves silently. Users can't tell if they've saved, and the page gives no entry-state instruction.
2. **No automated help for zero-game scenarios.** If a team has no games remaining this week, the app provides no guidance on who to bench or which free agents to add.
3. **Games-remaining badges fail during playoffs.** The period derivation logic assumes regular-season structure and breaks once all regular-season periods have ended.

---

## Goals

1. **Make lineup-setting discoverability and confirmation explicit.** Entry tip → click to select → preview → save button → success state.
2. **Auto-optimize lineups by projected points**, pinning locked and already-played players.
3. **Proactively surface drop/add suggestions** when auto-set detects zero-game starters.
4. **Fix playoff-mode period fallback** so games-remaining and lock detection work during playoffs.

---

## User-Facing Features

### Feature 1: Staged Save Model

**Current behavior:** Each click-to-swap immediately persists via PUT. No confirmation. No save button.

**New behavior:**
- Click-to-swap applies moves **only to local React state** (optimistic update).
- A "**Save Lineup**" button appears in the page header, active (indigo, pulsing) when there are pending changes.
- Button shows a badge: "Save Lineup (3 changes)".
- Pressing "Save Lineup" fires a batch of PUT calls for all pending moves.
- On success: button animates to "Lineup saved ✓" (gray), briefly, then returns to default.
- On failure: roster rolls back and error is displayed.
- **Navigation guard:** `beforeunload` event fires if the user attempts to leave with unsaved changes.

**Entry-state UX:**
- A muted instruction strip appears at the top of the roster grid on first view: "Tap a player to select, then tap where to move them."
- Disappears after the first click (not persisted; per-session).

**Benefit:** Users know when they've made changes, and get confirmation when those changes are persisted. Dashboard action items can track "lineup not locked" as a distinct state from "lineup set."

---

### Feature 2: Auto-Set Lineup

**New "Auto-set lineup" button** in the page header (next to "Save Lineup"). Available only when `projectedStats` (next week's projections) is present.

**Algorithm:**
1. **Classify roster players:**
   - **Locked:** `lockedAt !== null` (team has played this period) → cannot move at all.
   - **Pinned-active:** `hasPlayedThisPeriod === true` AND currently in an active slot → can only swap with other active players, cannot demote to bench.
   - **Moveable:** all others.
2. **Rank moveable players** descending by `projectedStats[id]?.projectedFp ?? 0`.
3. **Fill active slots greedily** in this order:
   ```
   [FORWARD, FORWARD, FORWARD, DEFENSE, DEFENSE, GOALIE, UTIL]
   ```
   For each slot, assign the highest-ranked moveable player whose `eligibleSlots` includes that slot (already on `RosterEntryRow`). Skip players already placed. Skip locked players (they stay in their current slot, counted as occupied).
4. **Assign remaining moveable players to BENCH.**
5. **Display a diff** showing the changes (if any) and apply them to local state as pending moves.
6. User can review, adjust, then press "Save Lineup."

**Edge cases:**
- **All locked or pinned:** No moves possible → show toast "All starters are locked or pinned; no changes recommended."
- **No projections:** Button is disabled (grayed out) — "Next week's projections coming soon."
- **Playoff period:** Uses the playoff matchup window for `gamesThisPeriod` (see below).
- **Projections tie:** Secondary sort by `name` (deterministic).

**Benefit:** Managers spend seconds optimizing instead of minutes hand-tuning. Respects roster state constraints (lock, play-lock, position eligibility). Saves to draft as a suggestion, not automatic.

---

### Feature 3: Free Agent Suggestions

**When triggered:**
After "Auto-set lineup" applies changes, check each active-slot player for `gamesThisPeriod === 0` (no games scheduled).

**If any found:**
- Show a suggestion panel below the roster: "You have X starters with no games this week."
- List up to 3 drop/add pairs:
  ```
  Consider dropping [Player A] (0 games) and adding [FA Player B] (~X.X proj FP, N games).
  ```
- Sort suggestions by the free agent's `projectedFp` descending.
- Each suggestion is a clickable card that links to the roster page (`/team/[teamId]/roster`) pre-filtered to the suggested drop/add pair. (V1: just link; future: inline modal.)

**Data source: New API endpoint**

`GET /api/leagues/[leagueId]/fa-suggestions`
- **Response shape:**
  ```ts
  interface FaSuggestion {
    dropPlayerId: string;
    dropPlayerName: string;
    addPlayerId: string;
    addPlayerName: string;
    addPlayerTeam: string | null;
    addPlayerPosition: "FORWARD" | "DEFENSE" | "GOALIE";
    gamesThisPeriod: number;
    projectedFp: number;
    avgFpPerGame: number;
  }
  ```
- **Algorithm:**
  1. Fetch all active unrostered players in the league's season.
  2. Compute `gamesThisPeriod` (same query as lineup page: games in `[now, periodEnd]`).
  3. Compute `avgFpPerGame` (rolling 5-game average from last 90 days of stat lines).
  4. Compute `projectedFp = avgFpPerGame × gamesThisPeriod`.
  5. Filter to players with `gamesThisPeriod > 0`.
  6. Return top 10 by `projectedFp` descending.
- **Caching:** No caching needed; the endpoint is only called on demand after auto-set, and results are time-sensitive (games-remaining changes daily). Response time should be <200ms (single stat-line aggregation query).

**Benefit:** Closes the "zero-game starter" problem with concrete, ranked suggestions.

---

### Feature 4: Playoff Period Fallback

**Current bug:** During playoffs, `getSeasonState()` returns no active or upcoming periods (all regular-season periods are `COMPLETE`). The lineup page sources `periodForGames` entirely from `getSeasonState()`, so it falls back to `null`. Result: `gamesThisPeriod = null` for all players, and games-remaining badges disappear.

**Fix:**
In `app/team/[teamId]/lineup/page.tsx`, after the existing `getSeasonState` call:
```ts
if (periodForGames === null && league.playoffStatus !== "NOT_STARTED") {
  const playoffMatchup = await prisma.matchup.findFirst({
    where: {
      leagueId,
      isPlayoff: true,
      status: { not: "COMPLETE" },
      OR: [
        { homeTeamId: teamId },
        { awayTeamId: teamId },
      ],
    },
  });
  
  if (playoffMatchup) {
    periodForGames = {
      week: playoffMatchup.week,
      startsAt: playoffMatchup.startsAt,
      endsAt: playoffMatchup.endsAt,
    };
  }
}
```

Also use the same `periodForGames` as `periodStartMs` when calling `lockTime()` so lock detection works correctly during playoffs.

**Why it works:** Playoff `Matchup` rows carry their own `startsAt`/`endsAt` independent of `ScoringPeriod`. By querying the in-progress playoff matchup for this team, we get a valid period window. This pattern is already implemented in `lib/services/dashboard.ts` → `getPlayoffDashboardData()` (lines 430+).

**Benefit:** Games-remaining badges display correctly during playoffs. Lock detection (which depends on period boundaries) also works correctly.

---

## Data Model

**No schema changes needed.** The feature uses existing:
- `RosterEntryRow.projectedStats` (already passed to `LineupManager` when a next period exists)
- `RosterEntryRow.gamesThisPeriod` (already computed in `lineup/page.tsx`)
- `RosterEntryRow.lockedAt` and `hasPlayedThisPeriod` (already present)
- `Matchup.isPlayoff`, `status`, `startsAt`, `endsAt` for playoff period detection

**New API response only:** `FaSuggestion[]` shape defined above. No DB model.

---

## Implementation Plan

### Part 1: Playoff Period Fallback (~2h)

1. Read `app/team/[teamId]/lineup/page.tsx` fully.
2. Add `playoffStatus` to the `FantasyLeague` fields in the league query.
3. After `getSeasonState` call, add the playoff matchup fallback logic above.
4. Pass `periodForGames` as `periodStartMs` to all `lockTime()` calls.
5. Test: Sim to playoffs, navigate to lineup page, verify games-remaining badges appear.

### Part 2: Staged Save Model (~4h)

1. Add `pendingMoves: Map<playerId, { from, to }>` state to `LineupManager`.
2. Modify `moveTo()` to update `pendingMoves` instead of immediately calling PUT.
3. Add "Save Lineup" button (header, indigo, pulsing when `pendingCount > 0`).
4. Add Save button logic: compute minimal swaps (pairs of players exchanging), batch PUT calls.
5. Add entry-state tip strip (muted, shows once, disappears after first interaction).
6. Add `beforeunload` guard if `pendingCount > 0`.
7. Test: Make a swap, verify button appears and save works; navigate away with pending, verify guard fires.

### Part 3: Auto-Set Algorithm (~3h)

1. Extract/port the greedy algorithm from `scripts/set-optimal-lineups.ts` into a pure function in `lib/lineup.ts` or `lib/projections/index.ts`:
   ```ts
   function computeOptimalLineup(
     roster: RosterEntryRow[],
     rosterSettings: RosterSettings,
     projectedStats?: Record<string, ProjectedStatsRow | null>,
   ): Map<playerId, targetSlot>
   ```
2. Add "Auto-set lineup" button to header (next to Save, disabled if no projections).
3. On click: call optimizer, compute diff, apply to `pendingMoves` (same as manual swap), show diff summary.
4. Test: Click auto-set, verify roster rearranges to highest-projected players in correct active slots.

### Part 4: FA Suggestions (~3h)

1. Create `app/api/leagues/[leagueId]/fa-suggestions/route.ts`:
   - GET handler.
   - Auth guard: `apiRequireLeagueMember`.
   - Fetch active unrostered players (existing roster page query pattern).
   - Compute `gamesThisPeriod` and `avgFpPerGame` per player (batch stat-line query, same as lineup page).
   - Return top 10 by `projectedFp` descending, filtered to `gamesThisPeriod > 0`.
2. In `LineupManager`: after auto-set applies changes, fetch `/api/leagues/[leagueId]/fa-suggestions`.
3. Check active starters for `gamesThisPeriod === 0`; if any found, match them to top suggestions and render the panel.
4. Test: Auto-set with zero-game starters, verify suggestion panel appears with relevant FA options.

### Part 5: Docs + Roadmap (~1h)

1. Write test in `tests/lineup.test.ts` for the new optimizer function.
2. Update `docs/01-roadmap/roadmap-sprints.md`, `roadmap-features.md`, `roadmap-index.md` to add LM-001 to Sprint 5.
3. Update `CLAUDE.md` **Conventions** section to note the new optimizer export.

---

## Acceptance Criteria

- [ ] Games-remaining badges display correctly during playoffs
- [ ] "Save Lineup" button appears when pending changes exist; save persists all pending moves atomically
- [ ] Entry-state instruction tip displays once, then disappears after first interaction
- [ ] "Auto-set lineup" button optimizes roster by projected points, respecting lock/play-lock constraints
- [ ] FA suggestions panel appears when auto-set detects zero-game starters
- [ ] `beforeunload` guard prevents accidental loss of unsaved lineup changes
- [ ] All new code paths tested in `tests/lineup.test.ts` (optimizer) and E2E smoke test on dev server

---

## Testing Strategy

**Unit tests:**
- `computeOptimalLineup()` function: locked players, pinned-active players, slot filling order, empty roster, all-locked roster, no projections.

**E2E smoke test:**
1. Seed league and complete draft.
2. Sim to active period with known game schedule.
3. Make one manual swap → verify "Save Lineup (1 change)" appears → save → verify success state.
4. Click "Auto-set lineup" → verify roster rearranges to highest-projected players.
5. Sim to period end, advance to next week, navigate back to lineup page → verify auto-set applied changes were persisted.
6. Sim to playoffs → navigate to lineup → verify games-remaining badges appear; make a swap → verify save works.

---

## Future Enhancements (Post-Launch)

- **Undo/Redo:** Stack of previous auto-set suggestions or manual moves.
- **Lineup templates:** "Save as template" and "Load template" for next-week reuse.
- **Scheduled auto-set:** Commissioner can set a rule "auto-set all teams at [time] before games start."
- **Inline drop/add modal:** Instead of linking to roster page, show a modal to add the suggested FA directly.
- **Scoring history:** Show each player's projected vs. actual for prior weeks (feedback loop for the projections model).
