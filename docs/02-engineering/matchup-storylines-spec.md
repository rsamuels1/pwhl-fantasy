# League-Wide Matchup Storylines (#11) — Engineering Spec

**Sprint:** 7
**Feature key:** MS-001 (not to be confused with Multi-Season MS-001)
**Status:** Partially implemented (per-team chip ships; league-wide not built)
**Effort:** Backend S · Frontend S · Testing S

---

## What it does

Extends the existing per-team storyline chip ("🔥 X is leading your team") to generate
league-wide weekly storylines surfaced on the league overview page (`/league/[leagueId]/`):
closest matchup, biggest blowout, weekly point leader, and biggest rank climber.

The per-team chip (`lib/services/dashboard.ts` → `getTopPerformers`) is already shipped.
This spec covers the league-wide layer only.

---

## Data model

No schema changes. All data is in:
- `Matchup` — scored week scores, VP
- `StatLine` → `RosterEntry` → player — top performer per team
- `FantasyTeam` — team names

The storylines are ephemeral (recomputed each page load for the current week). No caching
needed at beta scale; add a cached `LeagueStoryline` table only if performance degrades.

---

## API routes

**`GET /api/leagues/[leagueId]/storylines?week=<n>`**

Returns:
```ts
interface LeagueStorylines {
  week: number;
  closestMatchup: {
    teamA: string; teamB: string;
    scoreA: number; scoreB: number;
    margin: number;
  } | null;
  biggestBlowout: {
    winner: string; loser: string;
    scoreW: number; scoreL: number;
    margin: number;
  } | null;
  weeklyPointLeader: {
    team: string; fp: number;
  } | null;
  biggestClimber: {
    team: string; rankChange: number;  // positive = climbed
  } | null;
  topScoringPlayer: {
    name: string; team: string; fp: number; position: string;
  } | null;
}
```

Member-accessible. `week` defaults to the most recently scored week.

---

## Key files

- `app/api/leagues/[leagueId]/storylines/route.ts` — new GET handler
- `lib/services/storylines-service.ts` — new; `getLeagueStorylines(leagueId, week, nowMs, prisma)`
- `app/league/[leagueId]/page.tsx` — add storylines fetch (server-side, parallel with existing
  queries); add `<StorylinesCard>` to the right sidebar column
- `components/StorylinesCard.tsx` — new; renders 2–3 storylines as brief chips (one line each),
  e.g. "Closest match: Team A def. Team B by 0.4 pts" · "Point leader: Team C (82.3 pts)"
  Collapsible to save vertical space on mobile

---

## Computation approach

`getLeagueStorylines`:
1. Load all `Matchup` rows with `week === N` and `status === "COMPLETE"` for the league.
2. **Closest matchup:** find the pair with smallest `|homeScore - awayScore|`. VTF mode has no
   head-to-head pairs — in VTF, define "closest" as the two teams with smallest FP difference
   in the weekly scores (sorted). For 1v1 playoff matchups use the actual pairing.
3. **Biggest blowout:** the pair with largest margin.
4. **Weekly point leader:** team with highest `homeScore` or `awayScore` (whichever applies).
5. **Biggest climber:** compute VP standings for week N vs week N-1 (same per-week rank logic
   as the performance dashboard); largest positive delta.
6. **Top scoring player:** for week N, join `StatLine` rows in `[period.startsAt, period.endsAt]`
   to `RosterEntry` (any team in this league), compute FP via `scoreStatLine`, return the max.

All logic in the service; route serializes. Expect < 100ms.

---

## Edge cases / gotchas

- **VTF mode:** there are no head-to-head pairs in regular season. "Closest matchup" and
  "biggest blowout" use rank-adjacent teams (rank 1 vs rank 2) as a proxy, or skip those
  two storylines and show "Weekly point leader" + "Biggest climber" only. Don't force the
  VTF concept into a 1v1 framing.
- **Week 1 / no prior week:** `biggestClimber` is null (no prior week to compare rank against).
- **Tie in top-scoring player:** return the first alphabetically; the exact tiebreak doesn't
  matter for a storyline chip.
- **Active week (not yet scored):** `week` defaults to the last **scored** week; if no weeks
  are scored yet, return an empty object (all nulls). The card hides when all storylines are null.
- **Playoff weeks:** use `isPlayoff: true` matchup rows for playoff-period storylines; the
  closest/blowout logic applies directly to 1v1 playoff scores.

---

## Acceptance criteria

- [ ] League overview sidebar shows a "This week" storylines card after week 1 is scored
- [ ] Card shows at minimum: weekly point leader + biggest rank climber
- [ ] Closest matchup and biggest blowout shown when data exists (VTF vs 1v1 mode handled)
- [ ] Top scoring player highlighted with name, team, and FP
- [ ] Card is empty / hidden when no weeks are scored
- [ ] Week navigation (prev/next) works; defaults to most recent scored week
