---
name: project-playoff-audit
description: Sprint 7 playoff system audit results — 1 confirmed P1 bug, 2 open questions, full spec at docs/02-engineering/playoff-system-spec.md
metadata:
  type: project
---

Playoff system audit completed 2026-06-20 as PLAYOFF-AUDIT-001, added to Sprint 7.

**Why:** User requested comprehensive playoff system audit before beta invites. No user feedback was in the DB yet (FeedbackSubmission table has 0 rows — beta invites not yet sent). Audit was done by reading the playoff system source files.

**How to apply:** Before beta invites go out, the PLAYOFF-BUG-001 fix and the PLAYOFF-AUDIT-001 checklist must both be complete. Flag this if anyone asks about beta invite timing.

## Confirmed Bug

**PLAYOFF-BUG-001** (P1) — `app/league/[leagueId]/bracket/page.tsx` line 70:
```ts
const teamsInPlayoff = ps.teamsInPlayoff ?? 6;  // wrong: should be ?? 4
```
Default leagues (the vast majority) show "6 teams qualify" in the race banner while the playoff line is drawn at rank 4. User confusion, not data corruption. Fix is 1 line. Not yet fixed as of audit date.

## Open Questions (must verify before beta)

**Q1** — Does `computeVpStandings()` in `lib/scoring/vp.ts` filter `isPlayoff = true` matchups?
The `advance-playoff-round` route's `getSeededTeamOrder()` helper calls `computeVpStandings()` over ALL matchups. If playoff matchup rows (which have `homeScore`/`awayScore` but `isPlayoff = true`) are included, they distort the VP standings used for tie-breaking in round 2+. This is the highest-risk unknown.

**Q2** — Does `PlayoffBracket` component handle null/bye slots and the bracket hydration correctly?
The `getBracket()` hydration in `lib/services/playoff-service.ts` matches DB playoff matchups to bracket slots by `m.homeTeam?.fantasyTeamId === matchup.homeTeamId`. If `populateOrCreateNextRound()` assigns teams to the championship matchup in a different order than the bracket generator expected, scores will not render. Verify via `simulate-season.ts` end-to-end run.

## Architecture Notes (don't lose these)

- Seeding: always recomputed from current VP standings — no "seed snapshot" at playoff start.
- Playoff scoring: 1v1 raw FP via `computeAllTeamScores()`, NOT VP. Only round-1 matchups are pre-created; later rounds are created by `populateOrCreateNextRound()`.
- `league.status` AND `league.playoffStatus` are both set to COMPLETE at the end — `playoffStatus` gates the bracket redirect, `league.status` gates the renewal flow.
- The bracket page's `computeRace()` call correctly maps `totalVP` to `points` via `standings.map(s => ({ ...s, points: s.totalVP }))`.

## Spec Location

`docs/02-engineering/playoff-system-spec.md` — full test checklist (26 items), acceptance criteria, deferred items, open questions.

[[sprint6-shipped]]
[[project-sprint8-plan]]
