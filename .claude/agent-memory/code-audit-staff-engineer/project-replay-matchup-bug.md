---
name: project-replay-matchup-bug
description: Root cause of replay league "no matchups scheduled" bug — two bugs: wrong endpoint routing in ReplaySimulatorControls and missing startSeason call in replay setup
metadata:
  type: project
---

Replay leagues show "No matchups scheduled" even after scoring dates are set and weeks are advanced.

**Root cause 1 (HIGH — wrong endpoint for "advance" action):**
`components/ReplaySimulatorControls.tsx` `callAdvanceApi()` routes the "advance" action to the WRONG endpoint:
- `"advance"` → `/api/leagues/${leagueId}/season` (main route — ignores `simulatedDate`, uses cookie/wall-clock)
- `"set-date"` → `/api/leagues/${leagueId}/season/advance` (correct route — reads `simulatedDate` from body)

The mapping should be REVERSED: "advance" should go to `/season/advance` (which handles replay date persistence and simulatedDate correctly), and "set-date" should also go to `/season/advance`. The correct component for the season page (`SeasonControls.tsx`) always calls `/season/advance` for all actions.

**Root cause 2 (CRITICAL — `startSeason` never called in replay creation):**
`app/api/leagues/create/route.ts` creates replay leagues with `status = "PRE_DRAFT"` and `replayCurrentDate = "2026-10-01T09:00:00Z"`, but never calls `startSeason()`. Without `startSeason()`, no `Matchup` rows are ever created. When `getDashboardData` checks `matchupCheck` (line ~203), it finds no matchup rows and returns `empty` (activeMatchup: null), producing "no matchups scheduled" on the matchup page.

The flow to generate matchups is: `startSeason()` → `generateMatchups()` or `generateVtfMatchups()` → creates `Matchup` rows for all scoring periods.

**Root cause 3 (MEDIUM — initial replayCurrentDate is a future placeholder):**
Replay leagues are created with `replayCurrentDate = "2026-10-01T09:00:00Z"` — a date far after the 2025-26 season ends. `getReplayNow()` immediately returns this date as "now", making all 2025-26 periods appear as `SCORING_PENDING`. If `startSeason` were called, `advanceSeason` would try to score all weeks immediately.

**Fix sequence:**
1. In `ReplaySimulatorControls.tsx` `callAdvanceApi()`: swap endpoint routing — "advance" → `/season/advance`, "set-date" → `/season/advance` (same endpoint, different action).
2. In the replay league creation/setup flow: add a step to call `startSeason()` (or have `advance-day` auto-call it when `status === "PRE_DRAFT"` after draft completes).
3. Set `replayCurrentDate` to the start of the 2025-26 season (e.g., first game date) instead of 2026-10-01.

**Why:** `SeasonControls.tsx` (season page) works correctly — it always calls `/season/advance` with the simulatedDate. `ReplaySimulatorControls.tsx` (matchup page) is the buggy one. The season page's "Start season" button is the only correct path to generate matchups, but that button is only available on the admin/season page.

**How to apply:** When fixing replay features, always check that `startSeason` has been called before expecting matchup rows to exist. The `league.status` field reflects this: `PRE_DRAFT`/`DRAFT_IN_PROGRESS` = no matchups, `IN_SEASON`/`COMPLETE` = matchups generated.
