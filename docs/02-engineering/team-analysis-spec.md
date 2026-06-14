# Team Analysis & Insights Tab (#25) — Engineering Spec

**Sprint:** 6
**Feature key:** TA-001
**Status:** Not implemented
**Effort:** Backend L · Frontend M · Testing S
**Dependency:** Trade suggestions portion requires Trade System (#7) — ship analysis + FA recs first

---

## What it does

Adds an "Analysis" tab on the matchup page (`/team/[teamId]/matchup`). Surfaces three
actionable views from existing data: what's working / what's not (player vs projection),
position-group trend by week (vs league average), and free-agent upgrade suggestions.
Trade suggestions are deferred until Trade System (#7) exists.

All data is on existing `Matchup`, `StatLine`, `RosterEntry`, and `Player` rows. No schema
changes.

---

## Data model

No new tables. Reads:
- `StatLine` + `RosterEntry` — per-player weekly FP history for rostered players
- `projectPlayer` from `lib/projections/index.ts` — rolling 5-game baseline per player
- `Matchup` (scored) — per-team weekly FP, grouped by position for league-average baselines
- Free agent pool — same query as `app/team/[teamId]/roster/page.tsx` free-agent section

---

## API routes

**`GET /api/leagues/[leagueId]/analysis?team=<teamId>`**

Returns:
```ts
interface TeamAnalysis {
  players: PlayerTrend[];          // rostered players, performance vs projection
  positionTrends: PositionTrend[]; // per-position-group, last 4 scored weeks
  faUpgrades: FaUpgrade[];         // top FA picks for weakest position group
}

interface PlayerTrend {
  playerId: string;
  name: string;
  position: string;
  slot: string;
  recentWeeks: number[];           // FP per week, last 4 (null if on bench)
  projectedFpPerGame: number;
  avgFpPerWeekActual: number;      // over recentWeeks (ignoring nulls)
  gamesThisPeriod: number;
  verdict: "hot" | "cold" | "on-track" | "new";  // vs projection
}

interface PositionTrend {
  group: "F" | "D" | "G";
  weeklyFP: number[];              // last 4 scored weeks
  leagueAvgFP: number[];           // same weeks, league median for that group
  trend: "above" | "below" | "mixed";
}

interface FaUpgrade {
  playerId: string;
  name: string;
  position: string;
  projectedFp: number;
  gamesThisPeriod: number;
  suggestedDrop: { playerId: string; name: string } | null;
}
```

Member-accessible (`apiRequireLeagueMember`). `team` must belong to this league.

---

## Key files

- `app/team/[teamId]/matchup/page.tsx` — add `analysis` prop; fetch from analysis API
  server-side on load (parallel with existing `getDashboardData`)
- `app/api/leagues/[leagueId]/analysis/route.ts` — new GET handler
- `lib/services/analysis-service.ts` — new; `getTeamAnalysis(leagueId, teamId, nowMs, prisma)`
- `components/AnalysisTab.tsx` — new client component; three sections stacked vertically

**Tab integration:** The matchup page currently renders a single-column main content area.
Add a two-tab toggle ("My Matchup" | "Analysis") at the top using the same tab-button pattern
as the lineup page's stat toggle. The Analysis tab replaces the page content area; the matchup
hero and alert strips remain above the tab bar always.

---

## Computation approach

**Player trends (`lib/services/analysis-service.ts`):**
1. Load rostered players with the last 4 scored periods' `StatLine` rows.
2. For each player: sum FP per period via `scoreStatLine`. Periods where player was on BENCH
   → record `null` (excluded from avg).
3. Call `projectPlayer(playerId, position, scoringSettings, prisma, 5)` for each player
   (rolling 5-game baseline). Compare `avgFpPerWeekActual` vs `projectedFpPerGame × typical
   games/week (assume 3)`. Hot = 120%+ of baseline; cold = <70%; new = < 3 games data.
4. Cap to 10 most interesting players (active starters first; bench sorted by FP desc).

**Position trends:**
1. For each of the last 4 scored weeks, sum FP from `StatLine` rows for each position group
   for this team (same position-group join as weekly performance dashboard).
2. Compute the league-wide median FP for each group each week (same data from `Matchup` rows
   + per-team StatLine queries). Use median not mean — outlier teams don't skew it.
3. Identify weakest group: the one with the largest `below` gap over last 3 weeks.

**FA upgrade suggestions:**
1. Identify the weakest position group from (2).
2. Run the free-agent query (same as `app/team/[teamId]/roster/page.tsx`): active players not
   on any team in the league.
3. Filter to players whose `position` matches the weakest group (FORWARD/DEFENSE/GOALIE).
4. Compute `projectedFp = avgFpPerGame × gamesThisPeriod` for each.
5. Return top 3. For each, suggest dropping the lowest-projected active player at that position
   group on the current roster (as `suggestedDrop`).

---

## Edge cases / gotchas

- **Early season (< 2 weeks):** position trend data is sparse. Show "Not enough data yet (need 2+
  scored weeks)" in the position trends section. `PlayerTrend.verdict = "new"` for all players.
- **Bench players:** include in the table but flag as "on bench" — excluded from position-trend
  aggregation (they're not contributing to the lineup).
- **Goalies:** position-group FP for goalies is highly volatile (0 vs 10+ depending on W/shutout).
  Show with a note: "GP varies — check games scheduled."
- **`projectPlayer` is slow if called N times in a loop:** batch the stat-line fetch for all
  players first (one query with `playerId IN [...]`), then compute per-player averages in
  application code. Do not call the `projectPlayer` function as-is for all roster players in
  one API call — it does a separate DB query per player.
- **Trade suggestions deferred:** the `FaUpgrade` object has a `suggestedDrop` field but no
  "propose trade" CTA yet. Add a note in the UI: "Trade suggestions coming soon." Pre-fill is
  wired in when Trade System (#7) ships.
- **Replay mode:** pass `nowMs` from `getDevNow()` to `getTeamAnalysis` for period derivation
  and FA games-remaining queries.

---

## Acceptance criteria

- [ ] "Analysis" tab appears on the matchup page; toggles between matchup view and analysis view
- [ ] Player trends section shows last 4 weeks' FP per active starter, with hot/cold/on-track verdict
- [ ] Position-group trend chart (or table) shows F/D/G FP vs league median for last 4 weeks
- [ ] FA upgrade suggestions show top 3 free agents for the weakest position group, with projected FP
- [ ] Early-season empty state: "Not enough data yet" for position trends; < 3 week history handled
- [ ] Respects dev sim date cookie
- [ ] No new schema columns; all data from existing rows
