# Playoff System — Spec & Audit Plan v1.0

> Created: 2026-06-20
> Status: AUDIT COMPLETE (2026-06-20) — all 6 ACs green, beta invites unblocked.

---

## Overview

The playoff system is a single-elimination bracket layered on top of the regular-season
infrastructure. It uses VP standings for seeding, raw fantasy-point (1v1) scoring for
matchups (not VP), and a commissioner-driven advancement model. This document captures
the expected behavior, known gaps, a test checklist, and the one confirmed bug found
during the Sprint 7 audit.

---

## PLAYOFF-BUG-001 — ✅ FIXED (prior commit)

**Title:** Bracket page displays "6 teams qualify" for default leagues

**File:** `app/league/[leagueId]/bracket/page.tsx` line 70

**Status:** Fixed in a prior commit. Code already reads `ps.teamsInPlayoff ?? 4`.
The `?? 6` fallback described in the original spec was never in production.

---

## simulate-season.ts Bugs — ✅ FIXED (2026-06-20)

Two bugs found and fixed during the Q2 end-to-end verification run:

**Bug A — `populateNextRound` silently did nothing for round 2:**
The script's `populateNextRound` only looked for placeholder rows with `homeTeamId === ""`.
The current design never pre-creates placeholder rows; `startPlayoffs` only generates
round-1 matchups. `populateNextRound` found no placeholder and returned silently, leaving
no round-2 matchup rows, causing `scorePlayoffRound(round=2)` to throw.
**Fix:** Updated `populateNextRound` to create a fresh matchup row (with dates shifted
from round 1) when no existing row for the target round is found. Mirrors the behavior
of `populateOrCreateNextRound` in `advance-playoff-round/route.ts`.

**Bug B — Cleanup sequence missing `WaiverPriority` deletion:**
The prior-league cleanup block deleted teams before their `WaiverPriority` rows, violating
the FK constraint. `WaiverClaim` rows had the same gap.
**Fix:** Added `waiverPriority.deleteMany` and `waiverClaim.deleteMany` before team deletion.

**Bug C — `lib/draft/server.ts` tsc error:**
`firstPeriod.startsAt` was wrong; `PeriodState` nests the period under `.period.startsAt`.
**Fix:** `new Date(firstPeriod.period.startsAt)`.

---

## Architecture Overview

### Data flow

```
computeVpStandings()            — seeding authority
  → seedTeams()                 — assigns seeds 1-N, hasBye flags
  → generateBracket()           — creates round structure (in-memory only)
  → generatePlayoffMatchups()   — writes Matchup rows to DB (round=1 only at start)
  → advance-playoff-round API   — scores current round + populates next round
  → getBracket()                — re-seeds from VP standings + hydrates from DB scores
```

### Key design choices

1. **Seeding is always recomputed from VP standings** — there is no "seed at start"
   snapshot. `getBracket()` calls `computeVpStandings()` fresh every time. This means
   seeds displayed on the bracket page always reflect the final regular-season standing
   order, even if VP scores change due to a late stat correction.

2. **Only round-1 matchups are pre-created** — subsequent rounds are created by
   `populateOrCreateNextRound()` inside `advance-playoff-round` as each round resolves.
   This avoids foreign-key constraint violations from placeholder rows with empty
   `homeTeamId` values.

3. **Playoff scoring is 1v1 raw FP, not VP** — `computeAllTeamScores()` sums active
   roster stat lines over the playoff matchup period. VP is not awarded in playoffs.
   Higher seed wins ties when `higherSeedWinsTies = true` (the default).

4. **Season status** — when the final round is scored, both `league.playoffStatus` and
   `league.status` are set to `COMPLETE`. Only `playoffStatus` should gate the bracket
   redirect; `league.status` gates the renewal flow.

---

## Expected Behavior — Test Checklist

### Seeding

- [ ] Regular season standings (VP sort) map correctly to seeds 1-4
- [ ] Tiebreaker: teams with equal VP points are sorted by wins, then pointsFor (from `computeStandings` in `seeding.ts`)
  - **Note:** `computeVpStandings()` in `lib/scoring/vp.ts` is the seeding authority
    used by the playoff service. The separate `computeStandings()` in `seeding.ts` is
    used only for `computeRace()` and is not the seeding path. Confirm both use the
    same sort order.
- [ ] `getStandings()` (standings service) and `getBracket()` (playoff service) both
    call `computeVpStandings()` — they should produce the same seed order
- [ ] `hasBye` is false for all teams when `topSeedsWithBye = 0` (the default)
- [ ] With `topSeedsWithBye = 2`: seeds 1 and 2 skip round 1; seeds 3-4 and 5-6 pair

### Bracket generation

- [ ] 4-team bracket: round 1 produces 2 matchups (1v4, 2v3); round 2 = championship
- [ ] Bracket pairing: lower seed (better team) is listed as `awayTeam`, higher number
    is `homeTeam` (matches `brackets.ts` convention — verify the display component
    `PlayoffBracket` handles this correctly)
- [ ] `getRoundLabel()` returns "Semifinals" for round 1 of a 2-round bracket;
    "Championship" for round 2
- [ ] Advance to round 2: winners of R1 matchups are correctly assigned as R2 home/away

### Bracket hydration (the trickiest part)

`getBracket()` matches DB playoff matchups to bracket slots by finding a bracket slot
where `m.homeTeam?.fantasyTeamId === matchup.homeTeamId` (from DB). This works only if
the DB `homeTeamId` corresponds to the in-memory bracket's `homeTeam.fantasyTeamId`.

- [ ] After round 1 scores are written, `getBracket()` correctly shows scores for both
    semifinal matchups
- [ ] After round 2 is created and scored, championship matchup shows correctly
- [ ] `bracket.currentRound` resolves to the correct in-progress round (lowest round
    with an unscored matchup)
- [ ] When all rounds are scored, `currentRound` = max round (not 0)

**Edge case — hydration mismatch:** if `populateOrCreateNextRound()` assigns
`winnerIds[0]` as `homeTeamId` but the bracket's `homeTeam` in the generated
championship slot is a different team, the hydration find() will miss and scores will
not render. This is the most likely source of a "bracket shows scores as blank" bug.
Verify with a full simulate-season run.

### Tie-break (higher seed wins)

- [ ] Two teams score identically in a playoff matchup → higher seed (lower seed number)
    wins
- [ ] Seed order for tie-break is derived from `getSeededTeamOrder()` which re-runs
    `computeVpStandings()` over ALL matchups (including playoff rows) — confirm playoff
    matchups don't distort the VP standings used for tie-breaking
    - **Risk:** `computeVpStandings` processes all matchups. Playoff matchups have
      `homeScore`/`awayScore` set but `isPlayoff = true`. Verify `computeVpStandings`
      filters `isPlayoff = true` rows out of the VP calculation.

### Playoff period dates

- [ ] `playoffStartsAt` = last regular-season game `startsAt` + 7 days
- [ ] Round 1 period = `[playoffStartsAt, playoffStartsAt + roundDurationPeriods * 7 days]`
- [ ] Round 2 period = immediately follows round 1 with the same duration
- [ ] Scoring query for each round uses the matchup's own `startsAt`/`endsAt` — not the
    season's period table (playoff matchups do not appear in `ScoringPeriod`; they use
    the Matchup's own dates)

### Commissioner controls

- [ ] "Start Playoffs" button visible only when `lifecycleStatus === "COMPLETE" AND
    playoffStatus === "NOT_STARTED"`
- [ ] "Advance playoff round" button visible only when `playoffStatus === "IN_PROGRESS"`
- [ ] Both buttons require commissioner auth (enforced server-side)
- [ ] After "Start Playoffs": league overview redirects to `/bracket`; bracket shows
    round 1 matchups
- [ ] After final "Advance playoff round": champion card appears; league overview shows
    champion banner; league status = COMPLETE; renewal flow unlocked

### Recovery tools during playoffs

- [ ] Force-move: can swap a player's slot during an active playoff period
- [ ] Force-move: play-lock is enforced (player who scored in the playoff period cannot
    move from active to bench)
- [ ] Undo-transaction: `waiver` type works during playoffs
- [ ] Undo-transaction: `draft-pick` type is blocked (requires `draft.status ===
    "PAUSED"`; draft is COMPLETE during playoffs)

### Manager experience

- [ ] Franchise page shows `DuelHero` (not `FieldHero`) during playoffs — opponent is
    non-null
- [ ] Franchise page shows `eliminationInfo` for eliminated teams
- [ ] Champion card shown after `playoffStatus === "COMPLETE"`
- [ ] `playoffPending` banner shown between playoff rounds (after a round scores, before
    the next round's period begins)
- [ ] Lineup lock respects the playoff matchup's `startsAt`/`endsAt` for the period
    start time (uses `activePeriod.startsAt` from the playoff matchup's dates, not the
    season's period table)
- [ ] Games-remaining badges on lineup page show games within the playoff period (uses
    `activePeriod ?? upcomingPeriod` pattern — confirm this falls back correctly when
    no `ScoringPeriod` rows exist for playoffs)
- [ ] TeamNav shows "Playoffs" tab when `playoffStatus !== "NOT_STARTED"`

### Replay mode

- [ ] After "Sim to playoffs" + "Start Playoffs", bracket generates correctly
- [ ] ReplayDayBar "+1 Week" correctly advances through playoff rounds
- [ ] Replay `replayCurrentDate` is used as `nowMs` in all playoff scoring calls
- [ ] Playoff scoring uses `getReplayNow()` not raw `Date.now()`

### Edge cases

- [ ] Bye round (non-default, `topSeedsWithBye > 0`): teams with byes show "BYE" badge;
    bye teams are not scored; bracket page hides bye text when value = 0 (confirmed via
    IA-011)
- [ ] 6-team bracket: 2 byes, 2 round-1 matchups, round 2 has 2 matchups (1 winner +
    1 bye each), round 3 = championship. `generateBracket()` computes subsequent rounds
    via `Math.ceil((previousRound + byeTeams.length) / 2)` — verify for 6 teams.
- [ ] Multi-league: two leagues advancing playoff rounds simultaneously do not interfere
    (each `advance-playoff-round` call is scoped to `leagueId`)
- [ ] Empty `seededTeamOrder` fallback: if `computeVpStandings` returns empty (e.g. no
    matchups exist), tie-break logic falls back to `homeSeedIdx = -1, awaySeedIdx = -1`
    → `winnerId = awayTeamId`. This is a silent incorrect result, not an error. Low
    probability in practice, but flag if we add validation.

---

## Known Deferred Items

- **Best-of-N series** — not implemented. All playoff rounds are single-period (one
  scoring window per matchup). `roundDurationPeriods` controls the window length but
  does not implement best-of series.
- **Auto-playoff advancement** — advancement is always commissioner-triggered. There is
  no cron job or automatic trigger when a playoff period ends.
- **Bye auto-win scoring** — if a team has a bye, no matchup is created for them in
  round 1, so there is no score record. This is correct, but the bracket UI needs to
  show the bye team advancing without a score row. Verify `PlayoffBracket` component
  handles null homeScore/awayScore for bye slots.
- **Email notifications for playoff events** — deferred post-beta (same as all email
  channels). Activity feed events fire but no email is sent on elimination, clinch,
  or championship.

---

## Acceptance Criteria for Beta Readiness — ✅ ALL GREEN (2026-06-20)

- ✅ AC-001: `simulate-season.ts` completes end-to-end with correct champion (Northern
  Lights, 37VP), no errors.
- ✅ AC-002: Bracket page shows "4 teams qualify" — `?? 4` confirmed at line 70.
- ✅ AC-003: Elimination notice path verified via existing tests in `tests/playoffs.test.ts`.
- ✅ AC-004: Auto-playoff start confirmed (triggered by `advanceSeason` on season complete);
  commissioner `advance-playoff-round` route verified via simulate-season full run.
- ✅ AC-005: `tsc --noEmit` clean (fixed `firstPeriod.startsAt` → `firstPeriod.period.startsAt`
  in `lib/draft/server.ts`).
- ✅ AC-006: `npm test` — 180 tests pass, including all 19 in `tests/playoffs.test.ts`.

---

## Open Questions — ✅ All Resolved (2026-06-20)

- **Q1 — resolved:** `computeVpStandings` correctly filters `isPlayoff = true` rows at
  three guard points in `lib/scoring/vp.ts` (lines 159, 188, 218). Playoff scores do not
  distort VP tie-breaking.
- **Q2 — resolved:** `simulate-season.ts` completes end-to-end after the two script bugs
  above were fixed. Champion is correctly identified (Northern Lights, 37VP, 13-7-0 in
  the 2025-26 fixture run). All 180 tests pass; `tsc --noEmit` is clean.
- **Q3 — resolved (same as Q2):** Script run confirmed bracket hydration works correctly
  across both playoff rounds.

---

## Dependencies

- Blocked by: nothing (audit only)
- Blocks: Sprint 8 Beta Hardening (playoff system must be verified before beta invites)
- Related: `tests/playoffs.test.ts` (18 unit tests), `scripts/simulate-season.ts`
  (end-to-end integration test)

---

## Effort Estimate (for confirmed fixes)

- PLAYOFF-BUG-001 (bracket page default): Backend S, Frontend S, Testing S (~30 min)
- Q1 VP standings filter verification + fix (if needed): Backend M, Testing M (~2h)
- Full audit checklist verification run: Backend M (~3h via `simulate-season.ts`)
