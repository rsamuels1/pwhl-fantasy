---
name: project-complexity-review-jun2026
description: First full complexity review of PWHL GM core services (Jun 2026); key findings and their severity
metadata:
  type: project
---

First full complexity review done against Sprints 29-32 state. Key findings:

1. `dashboard.ts` is 1325 lines — monolithic, duplicates `activeRosterInclude` const (defined twice, including as `activeRosterInclude2`), and duplicates the entire playoff branch rather than sharing helpers with the regular-season branch.
2. `validateTradeProposal` and `validateTradeExecution` are identical pass-throughs to `_validate()` — no justification to have two public names.
3. `projectTeamRemainingScore` and `getRemainingPlayersTonight` in `lib/projections/index.ts` call `projectPlayer()` serially in a for-loop — N separate DB queries for a 7-player active roster.
4. `(prisma as any).leagueEvent` guard appears in 10+ places — was justified before `prisma db push`; now a maintenance liability if the guard is stale.
5. `generateEdition()` in `morning-skate-service.ts` is labeled "pure" in its comment but takes `prisma: PrismaClient` and issues 4 DB queries — misleading architecture claim.
6. `REVERSED` is used as the terminal state for both pre-execution veto and post-execution undo — the name is slightly misleading (veto never actually reverses roster moves) but behavior is correct.
7. `enterWaiverWire()` uses raw `Date.now()` instead of the supplied `nowMs` parameter; only matters during dev simulation.

**Why:** codebase was built sprint-by-sprint at high velocity; dashboard.ts accumulated complexity through feature accretion without a consolidation pass.
**How to apply:** when reviewing new dashboard/scoring features, watch for further duplication between the `getDashboardData` regular-season and `getPlayoffDashboardData` branches.
