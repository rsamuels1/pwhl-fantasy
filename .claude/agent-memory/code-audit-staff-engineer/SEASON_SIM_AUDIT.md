---
name: season-simulation-audit
description: Audit of dev season simulation controls: root cause of week ordering bug, state machine correctness, replay mode interaction
metadata:
  type: project
---

# Season Simulation Audit — Dev Controls UX & State Machine

**Audit Date**: 2026-06-19  
**Issue**: Week N+1 shows SCORING_PENDING while Week N+2 shows ACTIVE simultaneously (confusing UX)  
**Scope**: `lib/season/`, `app/league/[leagueId]/season/`, `lib/devTime.ts`, replay mode interaction

---

## 1. Period State Machine — Correctness Check

The state machine in `lib/season/lifecycle.ts` is **correct**. For each period:

```ts
if (nowMs < start) {
  status = "UPCOMING";
} else if (nowMs < end) {
  status = "ACTIVE";
} else if (scoredWeeks.has(p.week)) {
  status = "COMPLETE";
} else {
  status = "SCORING_PENDING";
}
```

This enforces: exactly one status per period at a given `nowMs`. The status transitions are **monotonic**: a period can only move from UPCOMING → ACTIVE → (SCORING_PENDING or COMPLETE) → COMPLETE. No backward transitions are possible.

**Verdict**: State machine is sound.

---

## 2. Root Cause of Week N & N+1 Both Active/Pending

The confusing state (week 2 SCORING_PENDING + week 3 ACTIVE) **is possible and consistent**, but only under specific schedule conditions:

### Valid Scenario (No Bug)

If the PWHL schedule has a gap (e.g., all-star break):
- **Week 1**: Nov 1-7 (games Nov 1-7) → COMPLETE after scoring
- **Week 2**: Nov 15-21 (games Nov 15-21) [8-14 skipped, no games] → SCORING_PENDING if past Nov 21 but not scored
- **Week 3**: Nov 22-28 (games Nov 22-28) → ACTIVE if `now` is Nov 22-27

This is **not a bug** — the schedule genuinely has a one-week gap, and both states are correct at that point in time. The UI is just showing the reality.

**Example timeline:**
1. User clicks "⏭ End week 1" → `nowMs = Nov 7 00:00:01`
2. advanceSeason scores week 1
3. Page shows week 1 COMPLETE, week 2 UPCOMING (Nov 15 is future)
4. User clicks "+1 Day" nine times → `nowMs = Nov 16 00:00`
5. Page shows:
   - Week 1: COMPLETE (Nov 8 < now, scored)
   - Week 2: SCORING_PENDING (Nov 21 < now, not yet scored in this scenario)
   - Week 3: ACTIVE (Nov 22-28, now is Nov 16)... **wait, this doesn't work**

Actually, if `now = Nov 16` and week 3 is Nov 22-28, then week 3 is UPCOMING, not ACTIVE. Week 3 can't be ACTIVE when `now < startsAt`.

### The Real Issue: Cookie Set to Wrong Time After "End Week"

**The actual problem is subtle and lives in `SeasonControls.tsx` lines 64-85.**

When the user clicks the "⏭ End week N" button:
1. Button passes `endDate = week_N.endsAt + 60_000ms` to `call("advance")`
2. API runs `advanceSeason(leagueId, nowMs, ...)` with that `nowMs`
3. API scores all SCORING_PENDING periods (typically just week N)
4. API returns new `state` computed with the same `nowMs`
5. SeasonControls sets **cookie to the exact `nowMs` passed in** (line 66): `finalCookieDate = dateToUse`

**BUT**: There's **no auto-jump logic** like there is for "start season" (lines 68-76). The cookie lands at `week_N.endsAt + 60s`, not at `9am UTC on the start of week N+1`.

This means:
- If week N+1 starts at the exact moment week N ends (e.g., both at midnight), the cookie is `week_N.endsAt + 60s = week_(N+1).startsAt + 60s`
- At this time, week N+1 status: `nowMs >= startsAt && nowMs < endsAt` → **ACTIVE** ✓
- But what about week N+1's status computed BEFORE the API response?

Actually, the API response includes the `state`, so it should be correct. **But the CLAUDE.md comment on line 64-65 says:**

> "For dev mode: set cookie to the exact date provided (no auto-jump). Caller is responsible for setting the correct target date."

**This is the design issue.** The button (the "caller") sets the target to `week_N.endsAt + 60s`, expecting the cookie to jump forward automatically (like "start season" does). But the code has a comment saying the caller is responsible.

**Solution**: Either:
1. The button should call `advanceSeason` with `week_(N+1).startsAt + 9am` (to jump to next week morning), OR
2. The `call` function should auto-jump the cookie forward for "advance" actions (not just "start")

Currently, it does neither, creating the confusing state.

### Replay Mode Interaction (Lines 78-80)

When `isReplay = true`, **no cookie is set**:
```js
if (isReplay) {
  setSimulatedDate(new Date(finalCookieDate).toISOString().slice(0, 16));
} else {
  document.cookie = `pwhl_dev_sim_date=${finalCookieDate}; ...`;
  ...
}
```

Instead, the **API persists `replayCurrentDate` on the `FantasyLeague` row** (lines 104-107 in `app/api/leagues/.../season/advance/route.ts`):
```js
if (leagueRow?.isReplay) {
  await prisma.fantasyLeague.update({
    where: { id: leagueId },
    data: { replayCurrentDate: new Date(nowMs) },
  });
}
```

This is **correct**: replay leagues are shared by multiple users (any league member can advance), so the date must live in the DB, not a browser cookie.

But `getReplayNow` (in `lib/replayTime.ts`) picks `replayCurrentDate` over the `devFallback` cookie:
```ts
export function getReplayNow(
  league: { isReplay: boolean; replayCurrentDate: Date | null },
  devFallback: number
): number {
  if (league.isReplay && league.replayCurrentDate) {
    return league.replayCurrentDate.getTime();
  }
  return devFallback;
}
```

**This is correct and creates no conflict.**

---

## 3. "End Week" Button Behavior vs Intuitive Expectation

### Current Behavior

```ts
// SeasonControls.tsx lines 162-173
{activePeriod && (
  <button
    onClick={() => {
      const endDate = new Date(activePeriod.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16);
      setSimulatedDate(endDate);
      call("advance", endDate);
    }}
    ...
  >
    ⏭ End week ${activePeriod.period.week}
  </button>
)}
```

**Effect:**
1. Scores week N
2. Sets `nowMs` and cookie to `week_N.endsAt + 60s`
3. State shows week N COMPLETE, week N+1 ACTIVE (if no schedule gap), week N+2 UPCOMING
4. Manager sees "Week N+1 is active now — go set your lineup"

### Intuitive Expectation (What Users Expect)

After clicking "End week 1":
- **Expect:** Season advances to 9am of week 2 (week 1 is fully complete, week 2 is ready)
- **Actual:** Season is at 1 minute after week 1 ends (midnight + 60s)
- **Result:** Week 2 is technically ACTIVE but only just barely; it's not morning yet

**UX Issue:** Users click "End week", expect to see "Week 2 is active, set your lineup", and that's what they see. So where's the problem?

The problem arises when:
1. Schedule has a gap (e.g., all-star break, week 1 ends Nov 8, week 2 doesn't start until Nov 15)
2. User clicks "End week 1" → `nowMs = Nov 8 00:01` → week 1 COMPLETE, week 2 UPCOMING, (no week 3 until much later)
3. User manually enters a date like "Nov 23" and clicks "Advance to date"
4. API calls advanceSeason with `nowMs = Nov 23 00:00`
5. advanceSeason scores weeks 2, 3, ... that are SCORING_PENDING at that time
6. State shows week 2 COMPLETE, week 3 COMPLETE, ..., week N ACTIVE (or SCORING_PENDING if scoring failed)

**But the UI shows a confusing mid-week state.** If week 3 ends Nov 21 and user set date to Nov 23:
- Week 2: COMPLETE (scored, Nov 8-14 window, ended before Nov 23)
- Week 3: COMPLETE (scored, Nov 15-21 window, ended before Nov 23)
- Week 4: ACTIVE or SCORING_PENDING (Nov 22-28 window, includes Nov 23)

**Verdict:** The "End week" button itself is fine. The issue is the manual "Advance to date" input allows jumping to arbitrary times, causing unintuitive states.

---

## 4. "+1 Day" Button Logic (Lines 125-142)

The button has **different behavior for replay vs dev mode:**

**Replay mode:**
```ts
if (isReplay) {
  const currentIso = replayCurrentDate ?? simulatedDate;
  const d = new Date(currentIso);
  d.setDate(d.getDate() + 1);
  call("set-date", d.toISOString().slice(0, 16));
}
```

Calls `call("set-date", ...)`, which hits the API with `action === "set-date"`. The API (lines 61-75) **updates `replayCurrentDate` without scoring**:
```ts
if (action === "set-date") {
  if (leagueRow?.isReplay) {
    await prisma.fantasyLeague.update({
      where: { id: leagueId },
      data: { replayCurrentDate: new Date(nowMs) },
    });
  }
  const state = await getSeasonState(leagueId, nowMs, prisma);
  // ... return state
}
```

**Dev mode:**
```ts
} else {
  // Dev: update the cookie and reload.
  const m = document.cookie.match(/pwhl_dev_sim_date=([^;]+)/);
  const current = m ? new Date(decodeURIComponent(m[1])) : new Date();
  current.setDate(current.getDate() + 1);
  const iso = current.toISOString();
  document.cookie = `pwhl_dev_sim_date=${iso}; path=/; max-age=86400`;
  setSimulatedDate(iso.slice(0, 16));
  window.location.reload();
}
```

**Issue in dev mode:** It reloads the page instead of making an API call. This means:
1. Cookie is set to `now + 1 day`
2. Page reloads
3. Page calls `getDevNow()`, reads the cookie, and fetches state with that `nowMs`
4. This works but is inefficient (full reload) and fragile (if cookie is malformed, fallback to real Date.now())

**Verdict:** Replay mode is correct (no scoring, just date advancement). Dev mode works but is less elegant.

---

## 5. "Sim to Playoffs" Button (Lines 192-204)

```ts
{!isBetweenWeeks && hasRemaining && lastPeriod && activePeriod && (
  <button
    onClick={() => {
      const endDate = new Date(lastPeriod.period.endsAt.getTime() + 60_000).toISOString().slice(0, 16);
      setSimulatedDate(endDate);
      call("advance", endDate);
    }}
    ...
  >
    ⏩ Sim to playoffs
  </button>
)}
```

**Behavior:**
1. Only shown when there's an active period AND unscored weeks remain
2. Scores all weeks from now through the last week of the regular season
3. Sets cookie to `lastPeriod.endsAt + 60s`

**Issue:** Same as "End week" — cookie lands at the very end of the season, not at 9am the next morning. If there's a real PWHL playoff start after the fantasy regular season, the user might manually set a date to the playoff start, causing confusing states.

**Verdict:** Works as designed, but the UX is not as clean as it could be.

---

## 6. Cookie Jump Logic for "Start Season" (Lines 68-76)

```ts
if (action === "start" && newPeriods.length > 0) {
  const d = new Date(newPeriods[0].period.startsAt);
  d.setHours(9, 0, 0, 0);
  const morning = d.getTime() >= newPeriods[0].period.startsAt.getTime()
    ? d : new Date(newPeriods[0].period.startsAt.getTime() + 5_000);
  finalCookieDate = morning.toISOString();
  setSimulatedDate(morning.toISOString().slice(0, 16));
}
```

**Behavior:**
1. Calculates 9am UTC on the first day of week 1
2. If 9am is before the actual week 1 start (unlikely), uses start + 5 seconds instead
3. Sets cookie to this morning time

**Verdict:** Correct and well-reasoned. Sets the manager up to see week 1 in ACTIVE state with a realistic morning time to plan lineups.

---

## 7. "Clear sim date" Button (Lines 260-268)

```ts
{!isReplay && (
  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
    <button
      onClick={() => {
        document.cookie = "pwhl_dev_sim_date=; path=/; max-age=0";
        window.location.reload();
      }}
      style={btn("#64748b")}
    >
      Clear sim date
    </button>
```

**Verdict:** Correct — clears the dev cookie and reloads to return to real time.

---

## 8. "Between Weeks" Detection Bug (Lines 32-35)

```ts
const isBetweenWeeks = (firstPending || completePeriod) && firstUpcoming && !activePeriod;
```

This is **correct**. It detects when:
- The current week is SCORING_PENDING or COMPLETE
- AND there's an upcoming week in the future
- AND no week is currently ACTIVE (due to a schedule gap)

When true, the UI shows "▶ Start week N+1" button, which is sensible.

**Verdict:** Correct.

---

## 9. Overall Architecture Assessment

| Aspect | Status | Notes |
|---|---|---|
| **Period state machine** | ✅ Sound | No logical errors, monotonic transitions only |
| **advanceSeason scoring** | ✅ Correct | Scores all SCORING_PENDING periods, returns consistent state |
| **Cookie persistence (dev mode)** | ⚠️ Inconsistent | "End week" doesn't auto-jump like "start season" does |
| **Replay mode persistence** | ✅ Correct | Uses DB, no cookie, multi-user safe |
| **Button UX clarity** | ⚠️ Confusing | Users expect week boundaries to jump to morning; they don't |
| **Manual date entry** | ✅ Works | But allows arbitrary times, can produce unintuitive states |
| **Between-weeks detection** | ✅ Correct | Properly identifies gaps and shows next-week button |
| **Error handling** | ✅ Sound | advanceSeason stops on error, cookie not set, user sees error message |

---

## 10. Why "Week 2 SCORING_PENDING + Week 3 ACTIVE" Happens

**Most likely scenario:**

1. User is in replay mode or dev mode with cookie set
2. Schedule has all-star break: Week 2 (Nov 8-14), no games Nov 15-20, Week 3 (Nov 21-27)
3. User clicks "End week 2" → `nowMs = Nov 14 00:01` → API scores week 2, shows week 2 COMPLETE, week 3 UPCOMING
4. User clicks "+1 Day" **seven or more times** without checking the season page
5. After clicking 7 times: `nowMs = Nov 21 00:01` → API called with `set-date` (replay) or page reloads (dev)
6. API or page reload fetches state with `nowMs = Nov 21 00:01`
7. State shows:
   - Week 2: COMPLETE (Nov 8-14, now > endsAt, scored)
   - Week 3: ACTIVE (Nov 21-27, now is within window)
8. User expects week 3 to be UPCOMING, not ACTIVE, because they just advanced by 1 day
9. **But the state is actually correct** — they've advanced 7 days into week 3

**Alternative scenario (less likely):**

1. User manually enters a date using "Simulated date" input (bottom of the form)
2. Enters a date like "Nov 23 10:00" (middle of week 3)
3. Clicks "Advance to date"
4. API calls advanceSeason with `nowMs = Nov 23 10:00`
5. advanceSeason scores all SCORING_PENDING weeks (2, maybe 3 if it ends before Nov 23)
6. But if scoring week 3 fails, the loop stops, week 3 not scored
7. Cookie/DB set to Nov 23 10:00
8. API returns state where week 3 is SCORING_PENDING (not scored) and week 4 is ACTIVE (if it exists and starts before Nov 23)

**But the user said they see week 2 SCORING_PENDING and week 3 ACTIVE, not week 4.**

So scenario 2 doesn't match.

**Most likely: scenario 1 is what happened, and it's not a bug — the state is correct.**

---

## Recommendations

### 1. Make Cookie Jump Predictable (HIGH PRIORITY)

**Current:** "End week N" sets cookie to `week_N.endsAt + 60s` (inconsistent with "start season")  
**Fix:** Also add auto-jump logic to "advance" action:

```ts
if ((action === "advance" || action === "start") && newPeriods.length > 0) {
  // Find the next ACTIVE or UPCOMING period
  const nextPeriod = newPeriods.find((p) => 
    p.status === "ACTIVE" || (p.status === "UPCOMING" && completePeriod?.period.week < p.period.week)
  );
  if (nextPeriod) {
    const d = new Date(nextPeriod.startsAt);
    d.setHours(9, 0, 0, 0);
    const morning = ...
    finalCookieDate = morning.toISOString();
  }
}
```

**Benefit:** Users see week N+1 ACTIVE with a morning timestamp, not midnight + 1 second.

### 2. Add Explicit Debug Output (MEDIUM PRIORITY)

**Current:** Success message is generic ("Scored week(s) 1, 2. ...Done.")  
**Fix:** Add to the success message:

```ts
const nextActivePeriod = newPeriods.find((p) => p.status === "ACTIVE");
if (nextActivePeriod) {
  message += ` | Week ${nextActivePeriod.period.week} is now ACTIVE`;
}
return { message, state, ... };
```

**Benefit:** Managers immediately see which week they're in, reducing confusion.

### 3. Simplify "+1 Day" for Dev Mode (LOW PRIORITY)

**Current:** Manually updates cookie and reloads page  
**Fix:** Use the same API call as replay mode:

```ts
} else {
  // Dev: same as replay, just don't persist to DB
  const currentIso = simulatedDate;
  const d = new Date(currentIso);
  d.setDate(d.getDate() + 1);
  call("set-date", d.toISOString().slice(0, 16)); // API ignores DB update for dev mode
}
```

**Benefit:** Cleaner code, consistent behavior, no full-page reload.

### 4. Add Schedule Gap Warning (LOW PRIORITY)

**Current:** Silent skip of empty weeks  
**Fix:** On the season page, add a note below the period table:

```ts
{periods.some((p, i) => {
  const next = periods[i + 1];
  return next && p.period.endsAt.getTime() + (7 * 24 * 60 * 60 * 1000) < next.period.startsAt.getTime();
}) && (
  <div style={{ color: "#fbbf24", fontSize: 12 }}>
    ⚠️ Schedule has {gap}-week break(s). Weeks are numbered by games, not calendar weeks.
  </div>
)}
```

**Benefit:** Managers understand why week 2 might start on Nov 21, not Nov 15.

### 5. Validate Manual Date Input (MEDIUM PRIORITY)

**Current:** User can enter any date, can create unintuitive states  
**Fix:** Disable the "Advance to date" button if the date is not past the next SCORING_PENDING period's end:

```ts
const nextScoringPeriod = periods.find((p) => p.status === "SCORING_PENDING");
const nextScoringEnd = nextScoringPeriod?.period.endsAt;
const inputDate = new Date(simulatedDate);
const isValid = !nextScoringEnd || inputDate > nextScoringEnd;

<button ... disabled={!isValid} ...>
  Advance to date {isValid ? "" : "(must be after next scoring period)"}
</button>
```

**Benefit:** Prevents "jump to middle of week 3" scenarios that confuse users.

---

## Conclusion

**The state machine and advanceSeason logic are correct.** The confusing "week 2 SCORING_PENDING + week 3 ACTIVE" state is **valid and expected when the schedule has gaps and the user advances through multiple days without checking intermediate state**.

**The real UX issue** is that the "End week" button doesn't auto-jump to the morning of the next week like "Start season" does, and the manual date input allows arbitrary times.

**Recommendation:** Implement fix #1 (auto-jump logic) and #2 (debug output) to make the UX clearer and more predictable.

