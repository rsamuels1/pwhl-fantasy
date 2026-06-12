You are working on a Next.js + Prisma fantasy hockey application.

There is a bug on the Matchups page for historical/replay seasons.

Observed behavior:
- When simulating through a historical season, game results and standings update correctly.
- The Standings page shows scores changing day-by-day as simulations advance.
- The Matchups page incorrectly shows:
  - "No current matchup"
  - "No scheduled matchup"
- This occurs specifically during historical seasons/replays.

Initial investigation suggests the scoring system and standings are driven from game schedules/stat data, while the Matchups page depends on records in the `Matchup` table.

Key files to inspect:
- `lib/services/dashboard.ts`
- `lib/services/season-state.ts`
- matchup generation code
- season initialization/startup flows
- historical season creation/replay flows

Relevant code pattern found:

```ts
const matchupCheck = await prisma.matchup.findFirst({
  where: {
    leagueId,
    week: displayPeriod.week,
    isPlayoff: false,
    OR: [
      { homeTeamId: myTeamId },
      { awayTeamId: myTeamId }
    ]
  }
});
```

If no matchup row exists for the derived week, the dashboard returns an empty matchup state.

Potential root causes:
1. Historical leagues are never generating regular-season matchup rows.
2. Matchups are generated, but week numbering does not align with `displayPeriod.week`.
3. Historical/replay league creation bypasses the normal `startSeason()` flow where matchups are created.
4. Matchups exist but are filtered incorrectly for historical season state calculations.

Your task:

1. Trace the entire flow from:
   - league creation
   - historical season creation
   - season initialization
   - matchup generation
   - matchup retrieval on the dashboard

2. Identify the exact root cause.

3. Implement a proper fix rather than a workaround.

4. Ensure:
   - Current seasons continue working.
   - Historical seasons display current and upcoming matchups correctly.
   - Matchup week numbers remain aligned with scoring periods.
   - Existing playoff logic is not broken.

5. Add defensive logging or validation where appropriate so missing matchup generation is easier to diagnose in the future.

6. After implementing the fix, explain:
   - What was broken.
   - Why standings still worked.
   - Why the Matchups page failed.
   - What code was changed.
   - Any database migration or backfill required.

Please analyze the codebase carefully before making changes. Do not assume the root cause above is correct—verify it by tracing the actual execution path and data flow first.