# Lineup Stats Tab Polish Specification

**Roadmap item:** #28 Lineup Stats Tab Polish (Sprint 4 — Product Polish)

**Priority:** P1 (Quick win, ~25K tokens)

**Status:** Draft

**Related documents:**
- `docs/01-roadmap/sprint-4-plan.md` (sprint overview)
- `docs/01-roadmap/roadmap.md` (features #28, lineup management v2 section)
- `app/league/[leagueId]/lineup/LineupManager.tsx` (primary implementation target)
- `app/team/[teamId]/lineup/page.tsx` (server-side data provisioning)

---

# Overview

The lineup page stats toggle has four views (Projected / This week / Last week / Season) but the tab labels and default selection are not yet fully polished. This spec defines the three remaining changes to ship the feature.

**No schema changes. Single-component edit** (plus one text string in the subtitle).

---

# Current State

## Component: `LineupManager.tsx`

The stats view toggle is rendered at lines 230–251 as a row of buttons:

```tsx
const [statsView, setStatsView] = useState<StatsView>(
    thisWeekLabel ? "thisWeek" : (nextWeekLabel ? "projected" : "season")
);

{(["projected", "thisWeek", "lastWeek", "season"] as StatsView[]).map((view) => {
    const label = view === "projected" ? "Projected"
        : view === "season" ? "Season"
        : view === "lastWeek" ? "Last week"
        : "This week";
    const disabled = (view === "thisWeek" && !thisWeekLabel)
        || (view === "projected" && !nextWeekLabel);
    // ...
})}
```

## Data flow (server-side, `page.tsx`)

| Prop | Source | Set when |
|---|---|---|
| `thisWeekLabel` | `activePeriod` exists | Period status === `ACTIVE` |
| `nextWeekLabel` | `nextPeriod` exists | Any period with status `UPCOMING` |
| `projectedStats` | `nextPeriod` exists | Rolling 5-game avg × scheduled games |
| `thisWeekStats` | `activePeriod` exists | Stat lines within active period |

## Current behaviors

| Scenario | Default tab | "This week" state | "Projected" tab label |
|---|---|---|---|
| Active period exists | `thisWeek` | Enabled | "Projected" |
| Between weeks (upcoming exists) | `projected` | Disabled (greyed out, still renders) | "Projected" |
| End of season (no periods) | `season` | Disabled | "Projected" |

---

# Required Changes

## 1. Rename "Projected" tab label to "Matchup Proj"

**File:** `app/league/[leagueId]/lineup/LineupManager.tsx`, line 233

```tsx
// Before:
const label = view === "projected" ? "Projected" : view === "season" ? "Season" : view === "lastWeek" ? "Last week" : "This week";

// After:
const label = view === "projected" ? "Matchup Proj" : view === "season" ? "Season" : view === "lastWeek" ? "Last week" : "This week";
```

**Rationale:** "Projected" is ambiguous — it could mean career projection, rest-of-season projection, or matchup projection. "Matchup Proj" clarifies that the values are projections for the **upcoming matchup week only**.

## 2. Update subtitle text to match new label

**File:** `app/league/[leagueId]/lineup/LineupManager.tsx`, lines 254–255

```tsx
// Before:
Projections for {nextWeekLabel} · rolling 5-game avg × scheduled games

// After:
Matchup projections for {nextWeekLabel} · rolling 5-game avg × scheduled games
```

## 3. Hide "This week" tab when no active period exists

**File:** `app/league/[leagueId]/lineup/LineupManager.tsx`, line 232

Filter the `thisWeek` option from the tab list when `thisWeekLabel` is null. The tab currently renders as a disabled (greyed-out) button, taking up UI space and confusing users since it has no content to show.

**Implementation A — filter the array (recommended):**
```tsx
const tabOptions: StatsView[] = [
    "projected",
    ...(thisWeekLabel ? ["thisWeek" as StatsView] : []),
    "lastWeek",
    "season",
];
```

**Implementation B — conditional render guard:**
```tsx
{(["projected", "thisWeek", "lastWeek", "season"] as StatsView[]).map((view) => {
    if (view === "thisWeek" && !thisWeekLabel) return null;
    // ...
})}
```

**Prefer Implementation A** — it produces a clean array that also naturally affects any downstream iteration over the tabs.

**Edge case:** When the active period ends and a new one hasn't started, the tab is hidden because `thisWeekLabel` is null. When a new period becomes ACTIVE, `thisWeekLabel` is set by the server page, and the tab reappears. No explicit lifecycle tracking needed.

---

# Verification (Default tab behavior — already correct)

The default selection logic at line 98-100:

```tsx
const [statsView, setStatsView] = useState<StatsView>(
    thisWeekLabel ? "thisWeek" : (nextWeekLabel ? "projected" : "season")
);
```

| Scenario | Evaluates as | Expected | Status |
|---|---|---|---|
| Active period exists | `thisWeekLabel` truthy → `"thisWeek"` | Show current week stats | ✅ Correct |
| Between weeks | `thisWeekLabel` null, `nextWeekLabel` truthy → `"projected"` | Show "Matchup Proj" | ✅ Correct |
| End of season | Both null → `"season"` | Show season totals | ✅ Correct |

No change required. The default already selects "Matchup Proj" (projected) when between weeks.

---

# Acceptance Criteria

1. **Tab label reads "Matchup Proj"** — not "Projected" — in all states (active, between weeks, end of season)
2. **"This week" tab is hidden** (not rendered) when no active period exists
3. **"This week" tab reappears** when a new period activates and `thisWeekLabel` is set
4. **Between-weeks default** is "Matchup Proj" (already correct, verify no regression)
5. **Subtitle reads** "Matchup projections for Week N (Date – Date) · rolling 5-game avg × scheduled games"
6. **No regressions** in tab switching or stat rendering during active periods

---

# Implementation Plan

## Files to modify

| File | Lines | Change |
|---|---|---|
| `app/league/[leagueId]/lineup/LineupManager.tsx` | 232 | Filter `thisWeek` from tab list when no active period |
| `app/league/[leagueId]/lineup/LineupManager.tsx` | 233 | Rename `"Projected"` → `"Matchup Proj"` |
| `app/league/[leagueId]/lineup/LineupManager.tsx` | 255 | Update subtitle: `"Projections for"` → `"Matchup projections for"` |

## Execution order

1. Rename label string (line 233) — trivially safe, visible immediately
2. Update subtitle string (line 255) — follows label rename for consistency
3. Hide "This week" tab when no active period — functional change, verify with dev sim

## Validation

1. Run `npm test` to confirm existing tests pass (130+ tests)
2. Run `npx tsc --noEmit` for type checking
3. Manual verification with dev sim:
   - Navigate to `/team/<id>/lineup` during an active period → "Matchup Proj", "This week", "Last week", "Season" tabs visible, "This week" selected
   - Advance to between-weeks state → "Matchup Proj" selected, "This week" tab hidden
   - Advance to end-of-season → "Season" selected, "This week" tab hidden


---

# Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tab filter removes "thisWeek" when active but `thisWeekLabel` is stale | Low | User can't see current week stats | `thisWeekLabel` is set server-side from `activePeriod` existence — reliable source of truth |
| Hidden tab causes confusion during active period transitions | Low | Tab briefly disappears between period scoring and next period start | This is the desired behavior — between weeks there are no "this week" stats to show |

---

# Appendix: Test Scenarios

## Manual test matrix

| Simulated state | `thisWeekLabel` | `nextWeekLabel` | Expected visible tabs | Expected selected |
|---|---|---|---|---|
| Active period (Week 4) | `"Week 4 (Jan 12 – Jan 18)"` | `"Week 5 (Jan 19 – Jan 25)"` | Matchup Proj, This week, Last week, Season | This week |
| Between weeks (Week 4 done, Week 5 upcoming) | `null` | `"Week 5 (Jan 19 – Jan 25)"` | Matchup Proj, Last week, Season | Matchup Proj |
| Between weeks (no upcoming period exists) | `null` | `null` | Matchup Proj, Last week, Season | Season |

## Pre-existing behavior (verify no regression)

- Clicking "Matchup Proj" (previously "Projected") → highlights tab, shows projection stats per player, shows starter total bar with bench upgrade hint
- Clicking "This week" (when visible) → shows actual stat lines for the current period
- Clicking "Last week" → shows stat lines for the most recently completed period
- Clicking "Season" → shows season-total stats
- Between-weeks: starter total bar and bench upgrade hint still render correctly when "Matchup Proj" is selected
