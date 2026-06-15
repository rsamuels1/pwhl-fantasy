# Replay Season Simulator v2 — Spec v1.0

**Status:** Ready for implementation
**Priority:** P1 — Core replay experience; blocks compelling beta onboarding
**Dependencies:** Replay league mode (shipped), `advance-day` API (shipped), `SeasonControls` (shipped)

---

## Overview

The current replay simulator operates day-by-day: `ReplayDayBar` advances one game day at a time, automatically scoring a matchup week the moment its `endsAt` passes. This means when Day N is the last game day of Week 3 and the commissioner clicks "Next day", Week 3 is scored immediately and `replayCurrentDate` lands at the start of Week 4 — skipping the lineup adjustment window entirely.

This spec introduces a **week-boundary pause** for replay leagues: after a matchup week's games are complete, the simulator holds at a "Week scored — set your lineups" state before advancing into the next week. It also surfaces simulator controls directly in the league overview and the commissioner's matchup page, so the commissioner never has to hunt for the season admin page to advance the replay.

Live seasons (non-replay leagues) are unaffected by every change in this spec.

---

## Goals

- G1: Give replay commissioners a natural lineup adjustment window between every matchup week — mirroring the real in-season experience.
- G2: Surface the advance-week control on the league overview and the commissioner's matchup page so it is always one click away.
- G3: Keep controls invisible to non-commissioner users — both regular team owners and non-member visitors.
- G4: Persist "paused at week boundary" state in the database so it survives navigation, refreshes, and multi-tab use.
- G5: Leave live season scoring and the dev sim-date cookie path completely unchanged.

---

## Non-goals

- Changing how live (non-replay) seasons score or advance.
- Adding week-boundary pausing to the dev cookie path (`pwhl_dev_sim_date`).
- Exposing any replay controls to regular team owners (even in the same league).
- Building any new schema models for this feature.

---

## User stories

- As a commissioner running a replay league, I want the simulator to pause at the end of each matchup week so I can adjust my lineup and other managers' lineups before games in the next week start.
- As a commissioner, I want to see the "advance week" button on the league overview and my matchup page without navigating to the season admin page.
- As a commissioner, I want the paused state to survive if I navigate away and come back.
- As a regular team owner in a replay league, I want the simulator controls to be invisible to me — I should never see or be able to trigger week advances.
- As the founder, I want replay controls visible to me on any league I'm observing in the founder console.

---

## Functional requirements

### FR-001 — Week-boundary pause state

After `advance-day` scores a matchup week, the API must detect that the scored week has ended and the next week has not yet started, and enter a **paused state** rather than advancing `replayCurrentDate` into the next week.

Concretely:
- When `advanceSeason` scores week N, the API checks whether the next game day falls inside a new matchup week.
- If it does, the API sets `replayCurrentDate` to the `endsAt` of the just-scored week (i.e., the exact boundary) rather than the midnight of the next game day.
- This leaves `nowMs = period.endsAt` for all rendering — which means week N is COMPLETE (scored) and week N+1 is UPCOMING (not yet ACTIVE).

The existing `UPCOMING` period status in `SeasonState` is sufficient to represent this state. No new DB column is required.

### FR-002 — "Week N complete — set your lineups" UI state

When `replayCurrentDate` is at a week boundary (period N is COMPLETE, period N+1 is UPCOMING), the `ReplayDayBar` renders a distinct paused state:

- Label: "Week [N] complete"
- Sub-label: "Set your lineups for Week [N+1] ([date range]) before advancing."
- Single action button: "Start Week [N+1] →"
- The "Next day →" button is hidden during this state.
- The "Restart" button remains visible.

### FR-003 — "Start Week N+1" action

Clicking "Start Week [N+1] →" calls the existing `POST /api/leagues/[leagueId]/season/advance` with `action: "set-date"` and `simulatedDate` set to the `startsAt` of the next period (i.e., the exact moment the next week becomes ACTIVE). This resumes day-by-day navigation from the start of the new week.

After the response, `router.refresh()` re-renders all layouts with the new date.

### FR-004 — Day-by-day navigation within a week

During an active week (period status is ACTIVE and `replayCurrentDate` is mid-week), the "Next day →" button advances one game day at a time exactly as today. This is unchanged.

The pause only triggers at the week boundary — when the last game day of a week has been completed and `advanceSeason` scores that week.

### FR-005 — Simulator controls on league overview

The `ReplayDayBar` component must render inside `app/league/[leagueId]/layout.tsx` when the user is the commissioner of a replay league. It already does this today.

**New requirement:** The league overview page (`app/league/[leagueId]/page.tsx`) must also render a compact "Replay controls" card in the left (primary) column when:
- `league.isReplay === true`
- The viewer is the commissioner or a founder-email user.

This card shows the same week-boundary state described in FR-002 when paused, or the day progress bar + "Next day →" when mid-week. The card title is "Replay controls" with the indigo replay color. It is positioned above the playoff race table.

Implementation note: `app/league/[leagueId]/page.tsx` already fetches `league.isReplay`, `league.replayCurrentDate`, and `league.playoffStatus`. The page must also receive `isCommissioner` (derivable from `user.id === league.commissionerId`, which the page already computes for the commissioner action strip) to gate visibility.

### FR-006 — Simulator controls on commissioner matchup page

The commissioner's matchup page (`app/team/[teamId]/matchup/page.tsx`) must render a compact replay controls card when:
- The team belongs to a replay league (`league.isReplay === true`).
- The viewer owns this team (enforced by `requireTeamOwner`, which is always true on this page).
- The viewer is the commissioner of the league.

The card appears below the between-weeks lineup nudge banner and above the `MatchupHero`. It shows identical state to FR-005.

Implementation note: `matchup/page.tsx` already loads the full league row to compute `getDashboardData`. It must additionally check `league.commissionerId === user.id` to gate rendering. A non-commissioner team owner must never see these controls even if `isReplay` is true.

### FR-007 — Founder visibility

The founder console (`app/founder/leagues/[leagueId]/`) already has `SeasonControls` rendered for all leagues. No changes needed there.

If a founder user is browsing a replay league's standard league pages (i.e., they have joined as a member), the controls should render if they are also the commissioner. Founders who are not members of a league do not have a team and cannot reach `/team/[teamId]/matchup`, so FR-006 is naturally scoped to commissioners.

There is no requirement to grant founders replay-control access on league pages where they are not the commissioner. The founder console is the right surface for observing non-owned leagues.

### FR-008 — Playoff week handling

During playoffs (`playoffStatus === "IN_PROGRESS"`), playoff matchups are scored by `advance-playoff-round`, not `advanceSeason`. The week-boundary pause logic does not apply to playoff rounds.

The `ReplayDayBar` already has a separate "Advance playoff round" path. During playoffs, the bar continues to show game-day navigation and the "Advance playoff round" button, with no week-boundary pause. This is acceptable because playoff rounds are commissioner-driven and already require a deliberate action.

After the playoff round advances, the commissioner manually adjusts lineups for the next round, then clicks "Advance playoff round" again. This is sufficient for the playoff experience.

### FR-009 — No controls for non-commissioner team owners

Regular team owners must never see replay simulator controls. The visibility gate is:

```
isVisible = league.isReplay && user.id === league.commissionerId
```

This gate must be enforced server-side in every page server component that renders the controls (layout, league overview, matchup page). Client components must receive the visibility decision as a prop — they must not re-derive it from league data alone.

---

## Technical approach

### State representation

No new schema columns are needed. The "paused at week boundary" state is fully representable by the existing `replayCurrentDate` field and `SeasonState`:

| `replayCurrentDate` value | `SeasonState` interpretation | UI state |
|---|---|---|
| `period[N].endsAt` exactly | period N = COMPLETE, period N+1 = UPCOMING | Week boundary pause |
| Between period starts | period N = ACTIVE | Mid-week, day-by-day navigation |
| Start-of-game-day midnight | period may be ACTIVE or at boundary | Normal day navigation |

The advance-day route must be modified to detect the week boundary and set `replayCurrentDate` to `period.endsAt` when scoring occurs, instead of `replayDateAfterDay(nextGameDay)`.

### Changes to `POST /api/leagues/[leagueId]/replay/advance-day`

Current behavior: after calling `advanceSeason(leagueId, newMs, prisma)`, always sets `replayCurrentDate` to `replayDateAfterDay(next)` (midnight of the day after the game day).

New behavior:
1. Call `advanceSeason` as before.
2. If `scoredWeeks.length > 0` (a matchup week was just scored), look up the scored week's `endsAt` from the period list.
3. If the next game day falls on or after that `endsAt`, set `replayCurrentDate` to the scored period's `endsAt` exactly (entering the boundary pause state).
4. If no week was scored, set `replayCurrentDate` to `replayDateAfterDay(next)` as before (normal day advancement within a week).

The response should include `weekBoundaryPause: true | false` and `pausedAfterWeek: number | null` so the client can render the right UI state without recomputing.

Alternatively, the client can derive the pause state from the returned `SeasonState` by checking whether the first UPCOMING period's `startsAt` equals `replayCurrentDate`. Either approach works; the explicit flag is simpler.

### New action: `"start-week"` in the advance endpoint

Add `action: "start-week"` to `POST /api/leagues/[leagueId]/season/advance`. This action:
1. Finds the next UPCOMING period from the current season state.
2. Sets `replayCurrentDate` to `period.startsAt` (the moment the week becomes ACTIVE).
3. Returns `{ state, message: "Week N started. Set your lineup!" }`.

This is equivalent to calling `set-date` with `simulatedDate = nextPeriod.startsAt.toISOString()`, but named explicitly so the UI has a semantic action rather than computing the date client-side.

The `ReplayDayBar` "Start Week N+1 →" button calls this action.

### `ReplayDayBar` updates

Add a new conditional render branch:

```
isPaused = props.weekBoundaryPause (new prop, boolean)
nextWeekLabel = "Week N+1 (Mon – Sun)" (derived from SeasonState)
```

When `isPaused`:
- Progress bar label changes to "Week [N] complete"
- Sub-label: "Ready to start Week [N+1]"
- Primary button: "Start Week [N+1] →" — calls `start-week` action
- "Next day →" button hidden
- "Restart" button still visible

When not paused (mid-week):
- Current behavior unchanged

`ReplayDayBar` must receive the `nextPeriod` info (week number, date range) from its parent to render the sub-label. Pass it as a prop from the layout's server-side `getGameDays` / `getSeasonState` calls.

The layout already has `SeasonState` available (it calls `getSeasonState` indirectly via the replay day props computation). Surface it as a prop to `ReplayDayBar`.

### Compact `ReplayControlsCard` component

Create `components/ReplayControlsCard.tsx` — a client component that renders the same controls as `ReplayDayBar` but in a card format suitable for embedding inside page content (not the persistent layout bar).

Props mirror `ReplayDayBar` exactly. The only visual difference is it renders as a `<div>` with the indigo card style (same border/background as the `ReplayDayBar`) instead of the horizontal bar format. Internally, it can re-export or compose `ReplayDayBar` at the card layout variant, or duplicate the button logic if the layout divergence is too large.

This component is rendered in:
1. `app/league/[leagueId]/page.tsx` — primary column, above playoff race table
2. `app/team/[teamId]/matchup/page.tsx` — above `MatchupHero`, below the between-weeks nudge banner

Both pages receive the `replayDayProps` data they need from `prisma.fantasyLeague.findUnique` (already fetched) and `getGameDays` (needs to be added to those page fetches).

### Data fetching additions

Both `app/league/[leagueId]/page.tsx` and `app/team/[teamId]/matchup/page.tsx` need:
- `league.isReplay`, `league.replayCurrentDate` (already fetched in both)
- `league.commissionerId` (already fetched in both)
- `getGameDays(league.season, prisma)` — conditional on `isReplayCommissioner` to avoid unnecessary DB work
- `getSeasonState(leagueId, nowMs, prisma)` — already called in matchup page via `getDashboardData`; needs to be surfaced in the overview page

The `app/league/[leagueId]/layout.tsx` already computes `replayDayProps` via `getGameDays`. The overview page and matchup page can re-use the same query result if the layout passes it down as a slot prop, or they can fetch independently. Independent fetching is simpler and avoids layout-to-page coupling.

### Visibility guard pattern

In each server component page:

```typescript
const isReplayCommissioner = league.isReplay && user?.id === league.commissionerId;
// Pass to component:
// {isReplayCommissioner && <ReplayControlsCard ... />}
```

Do not use the founder email check on league-scoped pages. Founders who need controls use the founder console.

---

## Example states

### State A: Mid-week (Day 8 of 85, Week 2 active)

```
ReplayDayBar:   [⏪ Replay]  Day 8 / 85  |  Nov 29  [====      ]  [Next day →]  [↺ Restart]
League overview ReplayControlsCard:
  "⏪ Replay controls"
  Day 8 — Week 2 active (Nov 25 – Dec 1)
  [Next day →]  [↺ Restart]
```

### State B: Week boundary pause (Week 2 just scored)

```
ReplayDayBar:   [⏪ Replay]  Week 2 complete  |  Set lineups for Week 3 (Dec 2 – Dec 8)  [Start Week 3 →]  [↺ Restart]
League overview ReplayControlsCard:
  "⏪ Replay controls — Week 2 complete"
  Set your lineups for Week 3 (Dec 2 – Dec 8) before advancing.
  [Start Week 3 →]  [↺ Restart]
Commissioner matchup page:
  [amber between-weeks nudge banner — Set lineup for Week 3]
  [indigo ReplayControlsCard — Start Week 3 →]
  [MatchupHero — upcoming Week 3 score 0–0]
```

### State C: Week 3 active (commissioner clicked "Start Week 3 →")

```
ReplayDayBar:   [⏪ Replay]  Day 15 / 85  |  Dec 2  [======    ]  [Next day →]  [↺ Restart]
```

### State D: Playoffs in progress

```
ReplayDayBar:   [⏪ Replay]  Day 79 / 85  |  Mar 10  [==================]  [Advance playoff round →]  [↺ Restart]
```
No week-boundary pause during playoffs.

### State E: Season complete

```
ReplayDayBar:   [⏪ Replay]  🏆 Season complete  (unchanged from today)
```

---

## Edge cases and constraints

**EC-001 — Commissioner navigates away mid-pause.** The week-boundary state is stored in `replayCurrentDate = period.endsAt` in the DB. When they navigate back, `getSeasonState` sees period N COMPLETE + period N+1 UPCOMING, and the UI renders the paused state correctly. No session or cookie required.

**EC-002 — Commissioner advances multiple game days rapidly.** If the commissioner clicks "Next day" several times in quick succession before the pause is set, the API calls are sequential (each waits for the prior response). The last call will detect the week boundary and enter pause state. There is no race because `replayCurrentDate` is only written by commissioner actions; only one commissioner exists per league.

**EC-003 — First game day of the new week starts immediately after week ends.** For seasons where a game is scheduled on the exact `period.startsAt` time, the commissioner must click "Start Week N+1 →" before clicking "Next day" to see those games count correctly. The pause state protects against this — "Next day" is hidden at the boundary.

**EC-004 — Week with no games.** If a scoring period has `gamesTotal === 0` (e.g., the all-star break week), `advanceSeason` scores it immediately with all-zero stats. The boundary pause still fires — the commissioner sees "Week N complete" even though no games occurred. The nudge banner will not fire (no starters with 0 games) but the structural pause is correct.

**EC-005 — Multi-tab use.** Both the league layout and the page content make independent server fetches. Both read `replayCurrentDate` from the DB on each request. State is always consistent as long as `replayCurrentDate` is the source of truth.

**EC-006 — Playoff advance-round timing.** During playoffs, `ReplayDayBar` shows "Advance playoff round →" regardless of `replayCurrentDate` position relative to any period. The week-boundary pause detection must be skipped when `playoffStatus === "IN_PROGRESS"`. Add this guard in `advance-day`.

**EC-007 — Regular team owner in a replay league visits matchup page.** The matchup page uses `requireTeamOwner` — the user must own the team. `isReplayCommissioner` will be `false` for non-commissioner owners, so `ReplayControlsCard` is never rendered. No API is called. No additional guard needed.

**EC-008 — `replayCurrentDate` is `null` (draft complete, season not yet started).** `SeasonState.lifecycleStatus` is `"PRE_SEASON"`. The `ReplayDayBar` already handles this with its `canStartSeason` prop. No changes needed for this state.

**EC-009 — Live season leagues.** Live leagues have `isReplay === false`. All code paths in this spec are gated on `isReplay === true`. No live-season behavior changes.

---

## Acceptance criteria

**AC-001:** Given a replay league mid-week (Day 5 of Week 2), when the commissioner clicks "Next day", the day counter increments and the "Next day →" button remains available.

**AC-002:** Given a replay league on the last game day of Week 2, when the commissioner clicks "Next day", Week 2 is scored, `replayCurrentDate` is set to `period[2].endsAt`, and the UI renders "Week 2 complete — set lineups for Week 3" with the "Start Week 3 →" button and no "Next day →" button.

**AC-003:** Given the week-boundary pause state, when the commissioner navigates to a different page and returns, the paused state is still rendered correctly (no state was lost).

**AC-004:** Given the week-boundary pause state, when the commissioner clicks "Start Week 3 →", `replayCurrentDate` is set to `period[3].startsAt`, Week 3 becomes ACTIVE, the "Next day →" button returns, and the paused state is cleared.

**AC-005:** Given a replay league, a regular team owner visiting the league overview sees no replay controls anywhere on the page.

**AC-006:** Given a replay league, the commissioner's league overview shows a "Replay controls" card above the playoff race table in the primary column.

**AC-007:** Given a replay league, the commissioner's matchup page shows the "Replay controls" card above the MatchupHero when the period is upcoming (between-weeks state).

**AC-008:** Given a replay league in playoff mode (`playoffStatus === "IN_PROGRESS"`), the week-boundary pause does not fire on "Next day" clicks. The `ReplayDayBar` shows "Advance playoff round →" as the primary action.

**AC-009:** Given a live (non-replay) season, no code path in this spec executes. Dev sim-date cookie behavior is unchanged.

**AC-010:** Given the week-boundary pause state after a zero-game week (all-star break), the UI still renders the pause state correctly, and the commissioner can advance to the next week.

---

## Open questions

**Q1:** Should the "Replay controls" card on the matchup page appear only when the week is upcoming (between-weeks), or also mid-week when the period is active? Mid-week, the commissioner can still click "Next day" but it feels cluttered alongside an active matchup. Recommend: show the card during upcoming (boundary pause) state, hide it during active periods. The `ReplayDayBar` in the layout header remains visible throughout. Needs confirmation.

**Q2:** Should the commissioner's matchup page show a "Set your lineup first" gate before allowing "Start Week N+1"? Currently the between-weeks nudge banner serves this role. We could add a soft warning inside `ReplayControlsCard` ("Your lineup for Week N+1 is not set" — derived from `lineupAlerts`) but this requires passing lineup alert data to the card. Defer for now.

**Q3:** Should the "Start Week N+1 →" button be disabled until the commissioner has visited the lineup page? Too prescriptive — commissioners running solo (replay for testing) will click straight through. Recommend: keep it always enabled.

---

## Dependencies

- Replay league mode (shipped — `isReplay`, `replayCurrentDate`, `getReplayNow`)
- `advance-day` API route (shipped — `POST /api/leagues/[leagueId]/replay/advance-day`)
- `ReplayDayBar` component (shipped — `components/ReplayDayBar.tsx`)
- `SeasonControls` (shipped — only needs `start-week` action addition)
- `advanceSeason` in `lib/season/index.ts` (shipped — no changes needed)
- `computeSeasonState` in `lib/season/lifecycle.ts` (shipped — no changes needed)

---

## Effort estimate

| Area | Estimate | Notes |
|---|---|---|
| `advance-day` route: week-boundary detection | S | ~30 lines; detect scored week, compute `period.endsAt`, update `replayCurrentDate` |
| `advance` route: `start-week` action | S | ~15 lines; find next UPCOMING period, call `set-date` logic |
| `ReplayDayBar`: paused state branch | S | New conditional render block; add `weekBoundaryPause`, `nextPeriodWeek`, `nextPeriodRange` props |
| `ReplayControlsCard` component | S | Thin wrapper over `ReplayDayBar` logic in card layout; ~80 lines |
| League overview page: embed card | S | Add `isReplayCommissioner` gate, `getGameDays` call, render card |
| Matchup page: embed card | S | Same pattern; add commissioner check |
| Tests | M | Unit: boundary detection in advance-day; integration: pause → start-week cycle; visibility: non-commissioner sees no card |

**Total backend:** S (two small route changes)
**Total frontend:** M (new component + two page integrations)
**Total testing:** M
**Overall:** fits comfortably in a half-sprint

---

## Implementation checklist (for engineers)

- [ ] Modify `advance-day` route to detect week boundaries and set `replayCurrentDate = period.endsAt` after scoring
- [ ] Add `weekBoundaryPause: boolean` and `pausedAfterWeek: number | null` to `advance-day` response body
- [ ] Add `"start-week"` action to `POST /api/leagues/[leagueId]/season/advance` route
- [ ] Add `weekBoundaryPause`, `nextPeriodWeek`, `nextPeriodStartsAt`, `nextPeriodEndsAt` props to `ReplayDayBar`
- [ ] Add paused-state render branch to `ReplayDayBar` (hide "Next day →", show "Start Week N+1 →")
- [ ] Create `components/ReplayControlsCard.tsx`
- [ ] Update `app/league/[leagueId]/page.tsx`: add `isReplayCommissioner` check, `getGameDays` + `getSeasonState` calls, render `ReplayControlsCard`
- [ ] Update `app/team/[teamId]/matchup/page.tsx`: add `isReplayCommissioner` check, render `ReplayControlsCard`
- [ ] Verify non-commissioner team owner in a replay league sees no controls anywhere (test with `owner2@dev.local`)
- [ ] Verify live league commissioner sees no replay controls (test with non-replay league)
- [ ] Add guard: skip week-boundary pause when `playoffStatus === "IN_PROGRESS"`
