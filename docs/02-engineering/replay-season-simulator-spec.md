# GM Command Center Spec

**Status:** Implemented  
**Version:** 2.0  
**Audience:** Engineers  
**Related:** `CLAUDE.md` (Season lifecycle, Replay League Mode sections)

---

## Overview

The **GM Command Center** is a single dedicated interface for replaying historical PWHL seasons. Unlike the previous 3-surface control model (sticky footer, inline panel, admin page), the GM Command Center consolidates all simulation controls into one cohesive experience modeled after sports franchise/GM games (Madden, Front Office Football).

**Core UX principle:** The manager progresses through explicit phases — Setup → Simulate → Recap → Next Week — with no automatic progression. Each phase has a single clear action.

---

## Access & Authorization

- **Route:** `/league/[leagueId]/sim`
- **Access:** Commissioner only; returns 404 for non-commissioners or non-replay leagues
- **Auth guards:** `requireAuth` + `requireCommissioner` on the server page

---

## The 5-Phase State Machine

The GM Command Center derives its phase from the league's current season state. Phase derivation is deterministic and happens on every page load via `getSeasonState(leagueId, replayNow, prisma)`.

### Phase: PRE_SEASON

**Condition:** No periods have started (all UPCOMING or none exist)

**What it shows:**
- A welcome card explaining the experience
- Total week count for the season
- One button: **"▶ Start Season"**

**On "Start Season":**
- Calls `POST /api/leagues/[leagueId]/sim { action: "start" }`
- Invokes `startSeason(leagueId, prisma)` which generates VTF matchups and sets league status to IN_SEASON
- Sets `replayCurrentDate = firstPeriod.startsAt`
- Transitions to SETUP on next page load

### Phase: SETUP

**Condition:** An active period exists (period.status === "ACTIVE")

**What it shows:**
- Lineup summary: active slots + bench, games-remaining badges, projected FP
- Quick-link to edit lineup at `/team/[commTeamId]/lineup`
- Matchup preview: "You vs. Field (Vertical Trade Format)" summary
- Links to waiver wire and standings for reference
- One primary button: **"⚡ Simulate Week N →"**

**On "Simulate Week N":**
- Shows transient loading overlay: "Simulating Week N..."
- Calls `POST /api/leagues/[leagueId]/sim { action: "simulate" }`
- Server calls `advanceSeason(leagueId, activePeriod.endsAt + 1ms, prisma)` to score the active week
- Server updates `replayCurrentDate = activePeriod.endsAt + 1ms`
- After completion, `router.refresh()` re-derives phase → RECAP
- Overlay clears; page transitions to RECAP phase

### Phase: RECAP

**Condition:** The last period is scored AND an upcoming period exists, with no active period

This natural phase emerges after simulation: when `replayCurrentDate` moves just past the active period's end, `getSeasonState` sees:
- No ACTIVE period (it ended in the past)
- No COMPLETE period for the next one yet (it hasn't been scored)
- But an UPCOMING next period

The RECAP phase does not require an explicit database flag — it's derived from this specific combination.

**What it shows:**
- **Hero card:** Result (WIN/LOSS/TIE) color-coded, large (52px font)
- Score comparison: your score vs. field score, both centered
- Standings movement: "You were #N last week → #M this week" with clinch/elimination chip
- Top 3 performers table: player name, position, points this week
- League activity feed: major performances and notable events
- **One primary button:** **"▶ Start Week N+1"**

**On "Start Week N+1":**
- Shows transient loading overlay: "Starting Week N+1..."
- Calls `POST /api/leagues/[leagueId]/sim { action: "advance" }`
- Server updates `replayCurrentDate = nextPeriod.startsAt` (no scoring)
- Makes the next period ACTIVE
- After completion, `router.refresh()` re-derives phase → SETUP
- Overlay clears; page transitions to SETUP phase for the next week

### Phase: SEASON_COMPLETE

**Condition:** All regular-season periods are scored (lifecycleStatus === "COMPLETE")

**What it shows:**
- "🏁 Regular Season Complete" header
- Summary: final standings, commissioner's record
- Two info cards: "FINAL STANDINGS" and "PLAYOFFS READY"
- Link to standings page to view detailed final rankings
- One button: **"▶ Start Playoffs"**

**On "Start Playoffs":**
- Calls `POST /api/leagues/[leagueId]/start-playoffs` (existing endpoint)
- Server initializes playoff matchups, sets `playoffStatus = IN_PROGRESS`
- After completion, `router.refresh()` re-derives phase → PLAYOFFS
- Page transitions to PLAYOFFS phase

### Phase: PLAYOFFS

**Condition:** `league.playoffStatus === "IN_PROGRESS"`

**What it shows:**
- Message: "🏆 Playoffs In Progress"
- Info: "The playoff tournament is underway."
- One button: **"View Bracket →"** links to `/league/[leagueId]/bracket`

---

## API Endpoint

**Route:** `POST /api/leagues/[leagueId]/sim`

**Auth:** `apiRequireCommissioner` — returns 403 if not commissioner, 404 if not replay league

**Request body:**
```ts
{
  action: "simulate" | "advance" | "start" | "skip-to-playoffs"
}
```

**Response:** `{ ok: true, phase: "<next-phase>" }` on success, or `{ error: "..." }` with HTTP 400/500 on failure

### Action: `"simulate"`

**Precondition:** An active period exists

**Effect:**
- Calls `advanceSeason(leagueId, activePeriod.endsAt + 1ms, prisma)`
- Sets `replayCurrentDate = activePeriod.endsAt + 1ms`
- Returns `{ ok: true, phase: "RECAP" }`

### Action: `"advance"`

**Precondition:** A next period exists in UPCOMING state

**Effect:**
- Updates `replayCurrentDate = nextPeriod.startsAt`
- No scoring occurs
- Returns `{ ok: true, phase: "SETUP" }`

### Action: `"start"`

**Precondition:** Season not yet started (no periods scored)

**Effect:**
- Calls `startSeason(leagueId, prisma)`
- Sets `replayCurrentDate = firstPeriod.startsAt`
- Returns `{ ok: true, phase: "SETUP" }`

### Action: `"skip-to-playoffs"`

**Precondition:** Regular season periods exist

**Effect:**
- Calls `advanceSeason(leagueId, lastRegularSeasonPeriod.endsAt + 1ms, prisma)`
- Sets `replayCurrentDate = lastRegularSeasonPeriod.endsAt + 1ms`
- Returns `{ ok: true, phase: "SEASON_COMPLETE" }`

**Note:** `skip-to-playoffs` is not used by the UI; it's a developer convenience for testing.

---

## Component Architecture

### `app/league/[leagueId]/sim/page.tsx` (Server Component)

- Auth: `requireAuth` + `requireCommissioner`
- Calls `getSeasonState(leagueId, replayNow, prisma)` to derive phase
- Fetches: commissioner's team, last scored matchup (if RECAP), activity feed
- Passes all data as props to `<GMCommandCenter />`

### `components/sim/GMCommandCenter.tsx` (Client Component)

- Routes to the correct phase component based on phase prop
- Manages transient `isSimulating` state during API calls
- Shows loading overlay during simulation/advance
- Handles all four API actions (simulate, advance, start, startPlayoffs)
- Calls `router.refresh()` after each action to re-derive phase

### `components/sim/WeekSetup.tsx` (Client Component)

- Renders SETUP phase UI
- Shows lineup summary with link to `/team/[id]/lineup`
- Renders matchup preview
- One button: "⚡ Simulate Week N →"

### `components/sim/WeekRecap.tsx` (Client Component)

- Renders RECAP phase UI
- Shows WIN/LOSS/TIE hero card with scores
- Displays last matchup result
- Shows activity feed
- One button: "▶ Start Week N+1"

### `components/sim/SeasonComplete.tsx` (Client Component)

- Renders SEASON_COMPLETE phase UI
- Shows "Regular Season Complete" message
- One button: "▶ Start Playoffs"

### `components/sim/PlayoffsPanel.tsx` (Client Component)

- Renders PLAYOFFS phase UI
- Message: "Playoffs In Progress"
- Link to bracket view

---

## Data Flow

### On Page Load

1. Server page calls `getSeasonState(leagueId, replayNow, prisma)`
2. Server derives phase from SeasonState
3. Server fetches additional context (team, matchup, activity)
4. Server passes all props to `GMCommandCenter`
5. Page renders with the correct phase component

### On Action (Simulate / Advance / Start)

1. User clicks button
2. Client shows loading overlay and disables button
3. Client calls `POST /api/leagues/[leagueId]/sim`
4. Server updates `replayCurrentDate` and possibly scores periods
5. Server responds with success or error
6. Client calls `router.refresh()`
7. Page reloads, server re-derives phase from updated DB state
8. Page renders the next phase

---

## Differences from Previous Model

**Old model (deleted):**
- 3 overlapping control surfaces (sticky footer, inline panel, admin page)
- Two button granularities (day-by-day vs week-by-week) doing different things
- Dev-tool labeling visible to commissioners
- Week-boundary pause state spec'd but not implemented
- ~1,545 lines across 9 files

**New model:**
- Single dedicated route: `/league/[leagueId]/sim`
- Five explicit phases, each with one clear action
- Commissioner-only access (no dev-tool confusion)
- Phases naturally derive from season state; no extra flag needed
- ~500 lines across 8 files
- Follows sports-game UX pattern (Madden, FONF, etc.)

---

## Testing Checklist

- [ ] PRE_SEASON phase shows "Start Season" button; clicking transitions to SETUP
- [ ] SETUP phase shows lineup link, matchup preview, "Simulate Week N" button
- [ ] "Simulate Week N" shows loading overlay, scores the week, transitions to RECAP
- [ ] RECAP phase shows WIN/LOSS/TIE hero, scores, "Start Week N+1" button
- [ ] "Start Week N+1" shows loading overlay, transitions to SETUP for next week
- [ ] Repeat through all weeks of the fixture season
- [ ] SEASON_COMPLETE phase shows "Start Playoffs" button
- [ ] "Start Playoffs" transitions to PLAYOFFS phase (or bracket view)
- [ ] Non-commissioner visits `/league/[id]/sim` → 404
- [ ] Non-replay league visits `/league/[id]/sim` → 404
- [ ] sim date cookie is updated after each phase transition (via `replayCurrentDate` field)
- [ ] All pages (matchup, lineup, standings) reflect the sim date correctly

---

## Future Enhancements

- Add "quick advance" button to skip to playoffs (action already implemented)
- Add standings/playoff bracket preview cards in RECAP phase
- Email notifications for playoff round assignments (post-launch)
- Undo/rollback functionality for testing (post-launch)

