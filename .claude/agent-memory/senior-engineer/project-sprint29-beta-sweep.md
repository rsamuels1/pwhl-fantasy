---
name: project-sprint29-beta-sweep
description: Sprint 29 Beta Sweep & Transactions Fix — source changes pre-landed in 224a943/e5542bf; docs+tests added in 12df9b9
metadata:
  type: project
---

Sprint 29 shipped 6 items (Jun 24, 2026). All source code changes were pre-committed by a parallel agent in commits 224a943 and e5542bf before the sprint29 task was processed. The sprint29 task only added docs and tests.

**Items shipped:**
- S29-001: Rival improvements (commit a90a50c) — `getRival()` rewritten to closest-contested opponent by avg points-apart; rival moved to standings page
- BF-NEW: Removed `(prisma as any).leagueEvent` guard in `app/api/leagues/[leagueId]/waiver/route.ts` milestone-count (now uses direct `prisma.leagueEvent.count()`)
- TR-002: `processExpiredTrades()` passes `dedupeKey: \`trade-expired-${tradeId}\`` to `createNotification()` for idempotent expired-trade notifications
- TR-003: Added `PROPOSED → PENDING_REVIEW` transition in `lib/trades/engine.ts` (roles: proposer, commissioner). `proposeTrade()` creates as PROPOSED then auto-flips in same `$transaction` when `requireCommissionerTradeApproval=true`; notifies commissioner instead of receiver in that path
- OB-001: Verified `app/page.tsx` already links to `/register` — no code change needed
- BF-021: `components/LineupDnD.tsx` tap-to-swap on mobile ≤640px with purple selection ring, target highlight, cancel hint; DnD preserved on desktop

**Why:** Agent parallelism on Jun 24 meant the 224a943 commit landed all source changes before the sprint29 task ran. The sprint29 task confirmed changes were correct, added 3 new `canTransitionTo` tests, and updated CLAUDE.md + roadmap docs.

**How to apply:** When Sprint N task says changes are already in git, check recent commits before making edits. `git log --oneline -5` first.
