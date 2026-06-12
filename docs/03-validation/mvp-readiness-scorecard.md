# MVP Readiness Scorecard

*Updated: 2026-06-12 — post-sprint audit*

| Area | Status |
|--------|---------|
| League Creation | PASS |
| Draft | PASS WITH RISKS |
| Rosters | PASS |
| Weekly Matchups | PASS |
| VP Standings | PASS |
| Weekly Lineup Lock | PASS |
| Playoffs | PASS |
| Commissioner Tools | PASS WITH VALIDATION |
| End-to-End Season Simulation | PASS |
| Analytics | PARTIAL |

---

# League Creation

PASS

Evidence:

- League creation exists with correct defaults (8 teams, VP scoring mode, 4-team playoffs)
- Invitations supported
- Team creation supported

---

# Draft

PASS WITH RISKS

Evidence:

- Snake draft support
- Auto draft support (`auto-draft.ts`)
- Draft room UI (`app/draft/[leagueId]/`)
- Roster assignments match approved 13-slot configuration

Residual risks:

- Disconnect/reconnect and duplicate-tab behavior not fully load-tested
- Auto-escalation (consecutive auto-picks) only tested via unit tests, not end-to-end

---

# Rosters

PASS

Evidence:

- Canonical roster is now `{ forward: 3, defense: 2, goalie: 1, util: 1, bench: 6 }` = 13 slots, all drafted
- Consistent across: league create API, seed-draft, seed-replay, auto-draft, set-optimal-lineups, CLAUDE.md
- IR slot supported by code for backward compat but not in default rosterSettings
- `lib/lineup.ts` slot validation tests (19 tests) pass

---

# Weekly Matchups

PASS

Evidence:

- VP matchup scoring (`scoreVpWeek`) and standings (`computeVpStandings`) verified by 28 unit tests
- 1v1 round-robin matchup generation (`generateMatchups`) working
- `advanceSeason` scores all pending periods via a single call
- Replay tools allow stepping through weeks day-by-day

---

# VP Standings

PASS

Evidence:

- `computeVpStandings` is the single authoritative source in all standings surfaces
- Removed `isVpMode` / `scoringMode` branching from standings page, standings service, playoff service
- Schema default changed to `scoringMode = "VP"`
- `prisma/schema.prisma` default: `scoringMode @default("VP")`
- 28 VP tests cover: win/tie/loss VP, rank bonuses, tied-for-first, 8-team simulation, W-L-T derivation, PF tiebreaker

---

# Weekly Lineup Lock

PASS

Evidence:

- `lockTime` updated to period-based lock: player is locked for the full week once their team played any game in the current scoring period
- New signature: `lockTime(playerTeamId, games, nowMs?, periodStartMs?)`
- Both the lineup page and the lineup API route pass `activePeriod.startsAt.getTime()` as `periodStartMs`
- Period games fetched in full (not just today) for correct lock detection mid-week
- 6 lock tests in `tests/lineup.test.ts` covering period-based, today-only fallback, before-period cases

---

# Playoffs

PASS

Evidence:

- Default playoff format corrected to 4 teams, 0 byes (1v4, 2v3 in round 1)
- `prisma/schema.prisma` default: `playoffSettings @default("{\"teamsInPlayoff\": 4, \"topSeedsWithBye\": 0, ...}")`
- `lib/playoffs/brackets.ts` bracket generation fixed: best-vs-worst pairing (seed1 vs seed4, seed2 vs seed3)
- `lib/playoffs/lifecycle.ts` defaults updated: `teamsInPlayoff: 4, topSeedsWithBye: 0`
- 18 playoff tests verify: 2-round bracket, correct 1v4/2v3 pairings, VP-based seeding, tie-break rules

---

# Commissioner Tools

PASS WITH VALIDATION

Evidence:

- Force roster move
- Undo transaction
- Replace manager
- Commissioner admin center
- Draft pause visibility
- Audit log display
- Season renewal entry point

Remaining:

- Audit coverage validation
- Permission validation
- Transaction history integration

---

# End-to-End Season Simulation

PASS

Evidence:

- `scripts/simulate-season.ts` runs a full Create → Draft → Score Weeks → Playoffs → Champion flow
- Uses the 2025-26 fixture (207 players, 120 games, 4,793 stat lines)
- Run: `npx tsx scripts/simulate-season.ts`
- Dry-run mode available: `npx tsx scripts/simulate-season.ts --dry-run`
- TypeScript compiles cleanly (`npx tsc --noEmit` exits 0)

---

# Analytics

PARTIAL

Implemented:

- draft_started
- draft_completed
- draft_paused
- draft_resumed

Remaining:

- user_registered
- league_created
- league_joined
- lineup_saved

Target:

Complete MVP instrumentation before beta.

---

# MVP Launch Confidence

Current Estimate:

**~95%**

Major gameplay systems are implemented and validated.

Remaining launch risk is concentrated in:

- auditability
- transaction history
- draft reliability testing
- operational visibility

rather than missing fantasy functionality.

Remaining blockers:

1. (Minor) Commissioner audit logging / incident runbook — PARTIAL, not a hard blocker
2. Analytics — FAIL, explicitly post-launch

Resolved in this sprint:

- P0-001: Roster alignment — PASS
- P0-002: VP standings authority — PASS
- P0-003: Playoff format (4 teams, no byes) — PASS
- P0-004: Weekly lineup lock (period-based) — PASS
- End-to-end season simulation script — PASS
- Bracket generation bug fixed (best-vs-worst pairing)

All 114 tests pass (`npm test`).
