# Replay Season Simulator v2 Spec

**Status:** Ready for implementation  
**Version:** 1.0  
**Audience:** Engineers  
**Related:** `docs/02-engineering/mobile-optimization-spec.md`, CLAUDE.md (Season lifecycle section)

---

## Overview

The replay-season simulator allows commissioners to step through historical seasons week-by-week with natural pauses for lineup adjustments between matchup weeks. This spec defines the UX, state management, and persistence model for advancing through replayed seasons.

**Key behavioral change:** The simulator now operates on a **matchup-week basis** (not daily), pausing at week boundaries to allow lineup changes before the next week begins. Real-time scoring during live seasons remains unaffected.

---

## User Experience

### Visibility & Access Control

**Who sees the controls:**
- **Commissioner** of any league: always visible
- **Founder** (via FOUNDER_EMAILS env var): always visible when viewing a replay league via the commissioner's account
- **Regular team owners:** never visible

**Where controls appear:**
1. `/league/[leagueId]/` — League overview (if replay league and user is commissioner/founder)
2. `/team/[teamId]/matchup` — Commissioner's personal matchup page (if replay league)
3. `/league/[leagueId]/season/` — Season admin page (existing, no changes)

**Disabled states:**
- All buttons disabled when `playoffStatus === IN_PROGRESS` (playoff weeks are manually advanced; see [Playoff Weeks](#playoff-weeks))
- "Start week" button disabled if current week is already `ACTIVE`
- "End week now" button disabled if no weeks are `UPCOMING` or `SCORING_PENDING`

### Button Flows & States

#### **Week Navigation Model**

A replay season progresses through these states:

```
NOT_STARTED
  ↓
(commissioner clicks "Start week N")
  ↓
ACTIVE (games playing; optional: step day-by-day)
  ↓
(commissioner clicks "End week now" or week naturally ends + auto-score)
  ↓
COMPLETE (scores finalized, lineup locked, waiting for next week)
  ↓
(commissioner clicks "Start week N+1")
  ↓
ACTIVE
  ↓ ... (repeat)
```

#### **Button Set: Between Weeks** (when `status === COMPLETE` or `NOT_STARTED`)

| Button | Label | Action | Next State |
|--------|-------|--------|-----------|
| **Start week** | "▶ Start Week N" | Sets sim date to 9am UTC on first day of week N; fetches updated `SeasonState` | `ACTIVE` |
| **Skip to playoffs** | "⏩ Skip to Playoffs" | Scores all remaining regular-season weeks in one call; skips to 9am UTC on playoff start date | `COMPLETE` (regular season); enables "Start Playoffs" button |
| **Jump to date** | "📅 Jump to date" | Opens date picker; sets sim date to entered ISO string (9am UTC) | Refresh page; new `SeasonState` reflects jumped date |

**Visual state:** Amber-bordered panel (same as current), centered on the page or persistent in a sidebar/sticky footer (see [Component Placement](#component-placement)).

#### **Button Set: During a Week** (when `status === ACTIVE`)

| Button | Label | Action | Next State |
|--------|--------|--------|-----------|
| **+1 Day** | "+1 Day →" | Advances sim date by 24 hours; does NOT score | Still `ACTIVE` (next day's games visible) |
| **End week** | "⏭ End Week Now" | Scores the active week; sets sim date to 9am UTC on first day of next week | `SCORING_PENDING` → `COMPLETE` (automatic on page load) |
| **Jump to date** | "📅 Jump to date" | Opens date picker; allows jumping within or past the current week | Refresh page; new `SeasonState` |

**Visual state:** Same amber panel, swaps button set based on `SeasonState`.

#### **Playoff Weeks**

When `playoffStatus === IN_PROGRESS`:
- Simulator buttons are **disabled** (grayed out with tooltip: "Use Season Controls to advance playoff rounds")
- Season page shows a "Advance Playoff Round" button via `SeasonControls.tsx` (existing behavior—no change)
- Commissioners manually click "Advance" for each playoff round
- Between playoff rounds, lineups CAN be adjusted (same as regular season)

### Component Placement

#### **League Overview** (`app/league/[leagueId]/page.tsx`)

**When to show:** `league.isReplay === true && (user.id === league.commissionerId || isFounder)`

**Where:** Render a **sticky footer bar** at bottom of viewport (mobile & desktop):
```
┌─────────────────────────────────────────────┐
│ ⚠ Replay Mode · Week N (Mon – Sun)         │
│ [▶ Start] [+1 Day] [⏭ End Week] [📅 Jump]  │
│ Simulated: 2025-01-15 · [Clear]            │
└─────────────────────────────────────────────┘
```

- Bar is white text on dark indigo background (same palette as draft-room clock)
- Responsive at all breakpoints; buttons stack to 2 rows on ≤480px
- Click any button → sticky bar closes, page scrolls to `<ReplayControls>`, user interacts, page refreshes
- On refresh, sticky bar auto-closes if they navigate away before hitting a button

**Interaction flow:**
1. Commissioner clicks "⏭ End Week" in sticky footer
2. Page scrolls/navigates to a modal/inline component showing "Scoring week N..." + a loading spinner
3. API call completes; page refreshes; sim date is now in week N+1 (ACTIVE)
4. Sticky bar updates to show "Week N+1" + the "During a week" button set

#### **Commissioner's Matchup Page** (`app/team/[teamId]/matchup/page.tsx`)

**When to show:** Same visibility rule as league overview

**Where:** Render an **inline amber panel** above the matchup hero (between the lineup-alert strip and `MatchupHero`):

```
┌──────────────────────────────────────────────────┐
│ 🔧 Replay Controls                               │
│ Week 3 (Jan 15–21) — ACTIVE                      │
│ [▶ Start] [+1 Day] [⏭ End Week] [📅 Jump]       │
│ Simulated: 2025-01-15                            │
└──────────────────────────────────────────────────┘
```

- Same button set logic as league overview
- Positioned above the matchup card so it's always visible on first load
- Amber border; light background
- After any action, page refreshes and the panel updates

#### **Season Admin Page** (`app/league/[leagueId]/season/page.tsx`)

**No changes.** Existing `SeasonControls` component continues to work. When a button is clicked on the sticky footer (league overview) or matchup panel, it calls the same API endpoints, so the admin page stays in sync if the user navigates there.

---

## State Management & Persistence

### Sim Date Cookie

The existing `pwhl_dev_sim_date` cookie (ISO 8601 string) continues to hold the simulated "now" value.

**Changes:**
- When advancing a week, always set the cookie to **9am UTC on the first day of the next week** (existing behavior—no change)
- The "+1 Day →" button increments by exactly 24 hours (existing—no change)
- "Jump to date" allows the user to set any ISO date they wish (existing—no change)

**No new cookie fields needed.** The current model is sufficient because:
- The `SeasonState` engine (in `lib/season/lifecycle.ts`) derives all week statuses from `{ nowMs, games[], periodDates[] }`
- Pausing between weeks is implicit: the sim date lands on a day within the "between weeks" window (after one week ends, before the next begins)
- A page refresh always recomputes `SeasonState` from the cookie value, so no additional state is needed

### State Reconstruction on Page Load

When a commissioner navigates to any page showing replay controls:

1. **Read the sim date cookie** → `nowMs`
2. **Call `getSeasonState(leagueId, nowMs, prisma)`** (no changes to this function)
3. **Derive button set** from `SeasonState.periods[activeOrNext]`:
   - `ACTIVE` → show "+1 Day", "End Week", "Jump to date"
   - `UPCOMING`, `SCORING_PENDING`, `COMPLETE` → show "Start Week", "Skip to Playoffs", "Jump to date"
4. **Render buttons** with appropriate enabled/disabled states

No new DB columns or state machines needed.

---

## API Endpoints

All replay controls call existing endpoints; no new routes needed.

### `POST /api/leagues/[leagueId]/season`

**Request:**
```json
{
  "action": "advance",
  "simulatedDate": "2025-01-21T09:00:00Z"
}
```

**Response:**
```json
{
  "season": { "status": "IN_SEASON", ... },
  "state": { 
    "periods": [ ... ],
    "now": 1705848000000
  }
}
```

**Behavior (no changes):**
- Accepts an ISO date string in `simulatedDate`
- Scores all `SCORING_PENDING` periods between the old `nowMs` and new `nowMs`
- Sets the cookie to the new date
- Returns updated `SeasonState`

### `POST /api/leagues/[leagueId]/season/advance`

**Request:**
```json
{
  "simulatedDate": "2025-01-16T09:00:00Z"
}
```

**Response:** Same as above.

**Behavior (no changes):**
- Dev/test-only endpoint (gated by `NODE_ENV !== "production"`)
- Does not score weeks; just advances the cookie
- Used by "+1 Day" button and "Jump to date" picker

---

## UI Components

### New: `ReplaySimulatorControls` (shared component)

**File:** `components/ReplaySimulatorControls.tsx`

**Props:**
```ts
interface ReplaySimulatorControlsProps {
  leagueId: string
  seasonState: SeasonState
  nowMs: number
  isCommissioner: boolean
  isFounder: boolean
  placement: "sticky-footer" | "inline-panel" | "admin-page"
}
```

**Responsibilities:**
- Compute visible button set from `seasonState`
- Handle click events for each button
- Call `/api/leagues/[leagueId]/season/advance` (for "+1 Day" and "Jump to date")
- Call `/api/leagues/[leagueId]/season` with `action: "advance"` (for "End week")
- Show loading state during API calls
- Handle errors with an inline alert

**Exported sub-components:**
- `StickyFooter` — renders at bottom of viewport (league overview)
- `InlinePanel` — renders as a block element (matchup page)

### Updated: `SeasonControls.tsx`

**Changes:**
- Existing logic stays the same
- Used by the season admin page
- The new `ReplaySimulatorControls` is a separate, simpler component for non-admin pages

---

## Interaction Details

### Start Week N

```
Button click: "▶ Start Week N"
  ↓
API: POST /api/leagues/[leagueId]/season/advance
     { simulatedDate: "2025-01-15T09:00:00Z" }
  ↓
Cookie updated to "2025-01-15T09:00:00Z"
  ↓
Page refresh (router.refresh())
  ↓
SeasonState recomputed
  → periods[N].status === "ACTIVE"
  ↓
Button set changes to: ["+1 Day", "End Week", "Jump to date"]
  ↓
Lineup page (if navigated to) shows: "This week: Week N (Mon–Sun)"
```

### +1 Day →

```
Button click: "+1 Day →"
  ↓
API: POST /api/leagues/[leagueId]/season/advance
     { simulatedDate: "<current + 1 day>T09:00:00Z" }
  ↓
Cookie updated
  ↓
Page refresh
  ↓
SeasonState unchanged (still ACTIVE, just one day later)
  ↓
Matchup scores update (more games played)
  ↓
Games-remaining badges decrement
  ↓
Lineup shows updated "This week" stats (if any games completed)
```

### End Week Now

```
Button click: "⏭ End Week Now"
  ↓
Show inline spinner: "Scoring week N..."
  ↓
API: POST /api/leagues/[leagueId]/season
     { action: "advance", simulatedDate: "<first day of week N+1>T09:00:00Z" }
  ↓
Server: 
  - Calls scoreVtfWeek(N)
  - Updates all Matchup.homeScore, Matchup.awayScore for week N
  - Returns updated SeasonState
  ↓
Cookie updated to first day of week N+1
  ↓
Page refresh
  ↓
SeasonState recomputed
  → periods[N].status === "COMPLETE"
  → periods[N+1].status === "ACTIVE"
  ↓
Button set changes to: ["+1 Day", "End Week", "Jump to date"]
  ↓
Lineup page shows: "This week: Week N+1 (Mon–Sun)"
  → All week N stats locked (read-only display)
```

### Jump to Date

```
Button click: "📅 Jump to date"
  ↓
Modal opens: "Select a date"
  → Shows current week dates for reference
  → Date input (ISO string or calendar picker)
  → "Jump" and "Cancel" buttons
  ↓
User selects date: "2025-02-15"
  ↓
API: POST /api/leagues/[leagueId]/season/advance
     { simulatedDate: "2025-02-15T09:00:00Z" }
  ↓
Cookie updated
  ↓
Page refresh
  ↓
If jumped past any week end dates:
  → Those weeks are auto-scored on page load (existing `advanceSeason` logic)
  → SeasonState reflects the jumped date
  ↓
Button set updates accordingly
```

### Skip to Playoffs (NEW)

```
Button click: "⏩ Skip to Playoffs"
  ↓
Show confirmation: "This will score all remaining regular-season weeks."
  ↓
If confirmed:
  ↓
API: POST /api/leagues/[leagueId]/season
     { action: "advance", simulatedDate: "<playoff start date + buffer>T09:00:00Z" }
  ↓
Server:
  - Calls scoreVtfWeek() for all SCORING_PENDING regular-season weeks
  - Computes playoff seeding
  - Returns updated SeasonState with playoffStatus ready for next step
  ↓
Cookie updated
  ↓
Page refresh
  ↓
SeasonState shows all regular-season periods as COMPLETE
  → "▶ Start Playoffs" button appears (existing behavior)
```

---

## Playoff Weeks

**No changes to playoff logic.** Replay commissioners advance playoff rounds manually via the Season admin page (existing "Advance Playoff Round" button).

**Behavior:**
- Once `playoffStatus === IN_PROGRESS`, all replay controls are disabled
- Commissioners click "Advance Playoff Round" on `/league/[leagueId]/season/` once per round
- Between playoff rounds, lineups can be adjusted (same as regular season)
- The sticky footer / inline panel shows a tooltip: "Use Season Controls to advance playoff rounds"

---

## Edge Cases & Error Handling

### Commissioner navigates away mid-week, then back

**Scenario:** Commissioner clicks "Start Week 3", then navigates to `/dashboard` and back.

**Expected:** Replay controls show Week 3 state (ACTIVE), button set unchanged.

**Implementation:** `SeasonState` is always derived fresh from the sim-date cookie + game schedule. No session state needed.

### Commissioner jumps past a week's end date

**Scenario:** Commissioner clicks "Jump to date" and enters 2025-02-15, which is after Week 5 ends.

**Expected:** Week 5 is auto-scored on page load; cookie lands on 2025-02-15; button set shows Week 6 or 7 (depending on where 2025-02-15 falls).

**Implementation:** Existing `advanceSeason` already scores all weeks between old and new `nowMs`. No change needed.

### Playoff week (no button changes)

**Scenario:** Commissioner is viewing replay controls; `playoffStatus === IN_PROGRESS`.

**Expected:** All replay buttons are disabled; tooltip says "Playoff rounds are advanced via Season Controls".

**Implementation:** In `ReplaySimulatorControls`, check `league.playoffStatus`:
```ts
if (league.playoffStatus === "IN_PROGRESS") {
  return <DisabledPlayoffNotice />;
}
```

### Commissioner clicks "End Week" but the API fails

**Scenario:** Network error or DB constraint violation during `scoreVtfWeek`.

**Expected:** Modal shows error message; user can retry or cancel.

**Implementation:** Wrap API call in try-catch; display error alert with "Retry" button.

---

## Testing

### Manual Test Checklist

- [ ] Commissioner views league overview → sticky footer appears (non-commissioners don't see it)
- [ ] Commissioner clicks "Start Week 1" → page refreshes, shows Week 1 ACTIVE
- [ ] Commissioner clicks "+1 Day" 5 times → games-remaining badges decrement
- [ ] Commissioner adjusts lineup on the matchup page → lineup updates
- [ ] Commissioner returns to league overview → sticky footer shows "Week 1 (Jan 15–21) ACTIVE"
- [ ] Commissioner clicks "End Week Now" → spinner shows, page refreshes, now in Week 2 ACTIVE
- [ ] Commissioner clicks "Jump to date" → opens picker, selects Week 5, page refreshes, Weeks 2–4 auto-scored, now in Week 5
- [ ] Commissioner navigates to `/league/[id]/season/` → "Season Controls" panel shows same week state as sticky footer
- [ ] Commissioner clicks "Skip to Playoffs" → all remaining weeks scored, now shows playoff controls
- [ ] Regular team owner views league overview → no replay controls visible

### Automated Tests

- Unit: `lib/season/lifecycle.ts` already has 13 tests—no changes needed
- Integration: Add a test for the `/api/leagues/[leagueId]/season` and `/advance` endpoints with a replay league
- Component: Snapshot test for `ReplaySimulatorControls` in both "sticky-footer" and "inline-panel" placements

---

## Rollout Notes

1. **No schema changes** — uses existing sim-date cookie
2. **No new API endpoints** — reuses `/api/leagues/[leagueId]/season` and `/season/advance`
3. **New UI components** — `ReplaySimulatorControls.tsx` + sub-components
4. **Updated layouts** — `app/league/[leagueId]/layout.tsx` and `app/team/[teamId]/matchup/page.tsx` render new controls
5. **Backward compatible** — live leagues unaffected (controls only show for `isReplay === true`)

---

## Future Enhancements

- **Batch week scoring:** "Score next 3 weeks" button (low priority)
- **Scheduled week starts:** Commissioner sets a schedule on initial league setup (e.g., "Start a new week every Monday"); simulator auto-advances (deferred post-launch)
- **Multi-season playback:** Chain multiple replay seasons together (deferred post-launch)
