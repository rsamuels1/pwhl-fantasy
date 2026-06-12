# Current Sprint Audit

Sprint: MVP Season Validation Sprint

Audited against: `docs/recommended-next-sprint.md`, `docs/p0-fix-plan.md`, `docs/mvp-audit-report.md`

---

## P0 Fixes (from docs/p0-fix-plan.md)

| ID | Description | Status | Evidence |
|----|-------------|--------|----------|
| P0-001 | Roster alignment: forward: 3, bench: 6 | MISSING | `app/api/leagues/create/route.ts` sets `forward: 2, bench: 4`. Seed scripts use `forward: 2, bench: 6, ir: 1`. |
| P0-002 | VP as authoritative standings/seeding source | PARTIAL | `lib/scoring/vp.ts` fully implemented. Standings page conditionally uses VP only when `scoringMode === "VP"` (default is `"VTF"`). `lib/services/standings-service.ts` uses W-L standings for playoff seeding. |
| P0-003 | Playoff format: 4 teams, no byes | MISSING | `prisma/schema.prisma` defaults to `teamsInPlayoff: 6, topSeedsWithBye: 2`. `lib/playoffs/lifecycle.ts` defaults match schema. |
| P0-004 | Weekly lineup lock (period-based not daily) | MISSING | `lib/lineup.ts lockTime()` locks on `startsAt >= todayStart && startsAt <= now` — UTC calendar day only, not scoring-period-aware. |

---

## Story 1 — End-to-End Season Simulation Framework

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Simulation runner | PARTIAL | `scripts/seed-replay.ts` + `scripts/advance-replay.ts` can advance a VP league week by week. No single end-to-end script exists. |
| Simulation documentation | MISSING | No documented launch-gate simulation process. |
| Repeatable validation process | MISSING | No `simulate-season.ts` script or equivalent. |

---

## Story 2 — VP Standings Validation Suite

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Automated tests for VP calculations | MISSING | No `tests/vp.test.ts`. Existing `tests/scoring.test.ts` covers FP scoring only. |
| Automated tests for tie scenarios | MISSING | — |
| Automated tests for standings generation | MISSING | — |
| Expected-output fixtures | MISSING | — |

---

## Story 3 — Playoff Qualification Validation Suite

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Qualification tests | PARTIAL | `tests/playoffs.test.ts` exists but uses 6-team/2-bye format. No test for 4-team/0-bye format. |
| Seeding tests | PARTIAL | `seedTeams` tests exist but against 6-team config. No VP-ordered seeding test. |
| Bracket generation tests (4-team) | MISSING | All existing bracket tests use 6-team. |

---

## Story 4 — Draft Reliability Test Suite

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Reconnect test | PARTIAL | `tests/draft.test.ts` has `getRoom` dedup tests. No explicit reconnect scenario. |
| Disconnect/auto-pick test | DONE | `tests/draft.test.ts` covers `TIMEOUT` action producing auto-pick. |
| Pause/resume test | DONE | `tests/draft.test.ts` covers `PAUSE` and `RESUME` actions. |
| Duplicate tab test | PARTIAL | `getRoom` Map prevents duplicate rooms, but no explicit duplicate-join scenario test. |
| Draft test matrix documentation | MISSING | No written test matrix document. |

---

## Story 5 — MVP Readiness Dashboard

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Readiness scorecard | PARTIAL | `docs/mvp-readiness-scorecard.md` exists with ratings but reflects pre-sprint state (55–65% confidence). |
| Launch gate dashboard | MISSING | No automated dashboard. Scorecard is manual. |

---

## Summary

| Area | Pre-Sprint Status |
|------|-------------------|
| P0-001 Roster | FAIL |
| P0-002 VP Authority | PARTIAL |
| P0-003 Playoff Format | FAIL |
| P0-004 Lineup Lock | FAIL |
| Season Simulation | FAIL |
| VP Validation Tests | FAIL |
| Playoff Validation Tests | PARTIAL |
| Draft Reliability Tests | PARTIAL |
| MVP Readiness Scorecard | PARTIAL |
