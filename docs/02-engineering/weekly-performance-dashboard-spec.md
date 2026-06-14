# Weekly Performance Dashboard (#29) — Engineering Spec

**Sprint:** 5 (remaining)
**Feature key:** WPD-001
**Status:** Not implemented
**Effort:** Backend M · Frontend M · Testing S

---

## What it does

Replaces `/team/[teamId]/schedule` with a week-over-week performance view. Shows the manager
how their team has ranked each scoring period: FP earned, VP won, standings rank change, and
position-group breakdown. The schedule's games-remaining section is retained as a secondary
strip below. All data is already in `Matchup` + `StatLine` rows; no schema changes.

---

## Data model

No schema changes. Reads from:
- `Matchup` — `homeScore`/`awayScore`, `homeVP`/`awayVP`, `week`, `status: COMPLETE`
- `StatLine` + `RosterEntry` — position-group FP split per team per period
- `ScoringPeriod` — week labels and date ranges (derived from `getSeasonState`)

Server-side aggregation only; no new tables or columns.

---

## API routes

**`GET /api/leagues/[leagueId]/performance?team=<teamId>&week=<n>`**

Returns:
```ts
interface WeekPerformance {
  week: number;
  weekLabel: string;           // "Week 3 (Nov 10–16)"
  myFP: number;
  myVP: number;
  rank: number;                // VP standings rank this week
  rankChange: number;          // vs prior week (+ = climbed)
  result: "W" | "L" | "T" | null;   // vs field
  positionBreakdown: {
    F: number;   // FP from forwards this week
    D: number;
    G: number;
  };
  leagueAvgFP: number;
  topTeam: { name: string; fp: number };
  worstTeam: { name: string; fp: number };
}

interface PerformanceResponse {
  weeks: WeekPerformance[];
  currentWeek: number;        // last scored week number
  teamName: string;
}
```

Route is member-accessible (`apiRequireLeagueMember`). The `team` param must belong to this
league (same security check as the roster page's `?view=` param).

No separate endpoint for the games-remaining section — that data is already fetched in the
existing `/team/[teamId]/schedule` page and can be lifted into this page's server component.

---

## Key files

- `app/team/[teamId]/schedule/page.tsx` — replace page content; keep the route (don't rename,
  the TeamNav links here). Rename the page heading from "Schedule" to "Performance" in the UI
  only.
- `app/api/leagues/[leagueId]/performance/route.ts` — new GET handler
- `lib/services/performance-service.ts` — new; `getWeeklyPerformance(leagueId, teamId, prisma)`
  aggregates all scored weeks server-side. Calls `computeVpStandings` per-week to derive ranks.
- `components/PerformanceDashboard.tsx` — client component; receives `PerformanceResponse` as
  initial props (no client-side fetch on load). Week picker is client-side state only.

**TeamNav.tsx:** rename tab label from "Schedule" to "Performance". Keep the href pointing to
`/team/[teamId]/schedule` (same route, no redirect needed).

---

## Computation approach

`getWeeklyPerformance` logic:
1. Load all `COMPLETE` `Matchup` rows for the league (not just this team) to compute league-wide
   context (avg FP, top/worst team).
2. For each completed `ScoringPeriod`, run `computeVpStandings` on matchups up to and including
   that week → derive each team's rank at end of that week.
3. For position-group FP: join `StatLine` → `RosterEntry` → `Player` on `[period.startsAt, period.endsAt]`.
   Group by `Player.position` → sum FP via `scoreStatLine` (league scoring settings).
4. `rankChange`: `rank[week N]` minus `rank[week N-1]`; null for week 1.
5. `result`: compare `myFP` to median of all teams' FP for that week (above = W, below = L,
   within ±0.5 = T). VTF uses weekly rank but "W/L" here means above/below median — label it
   clearly.

All aggregation happens in the service; the route just serializes. Expect <300ms on 20 weeks
of data with the 2025-26 fixture.

---

## Edge cases / gotchas

- **Season not started / no scored weeks:** return `weeks: []`; the page renders an empty state
  ("No performance data yet — check back after Week 1 is scored").
- **Playoff weeks:** exclude `isPlayoff: true` matchups from the regular-season performance
  table. Add a separate "Playoffs" section if `playoffStatus !== "NOT_STARTED"` (can be a
  simple champion/eliminated/eliminated card; no week-by-week needed for v1).
- **Replay mode:** respects `nowMs` from `getDevNow()` — only weeks with `status: COMPLETE` at
  `nowMs` appear. Pass `nowMs` to `getSeasonState` for consistency with other pages.
- **Position-group FP for goalies:** use `Player.position === "GOALIE"` (not slot); a goalie in
  UTIL still counts as G in the breakdown.
- **VP standings per-week derivation:** `computeVpStandings` runs on matchups filtered to
  `week <= N` to get the cumulative standings at end of week N. This is correct for `rank` but
  for `rankChange` you need the delta between week N and week N-1, so you need two calls per
  week — or cache cumulative standings array and walk it.

---

## Acceptance criteria

- [ ] Page replaces schedule content; TeamNav tab label reads "Performance"
- [ ] Week-by-week table shows FP, VP, rank, rank change (↑/↓/—), and W/L vs field
- [ ] Position-group FP breakdown visible for the selected week
- [ ] League context row: avg FP, top team, bottom team for that week
- [ ] Week navigation (prev/next); defaults to most recent scored week
- [ ] "Rising and falling teams" callout: best/worst FP change vs prior week highlighted
- [ ] Games-remaining schedule info shown as secondary section below
- [ ] Empty state when no weeks are scored yet
- [ ] Playoffs section (simple) when `playoffStatus !== "NOT_STARTED"`
- [ ] Respects dev sim date cookie
