---
name: sprint8-plan
description: Sprint 8 Beta Hardening — P0+P1 audit fixes shipped Jun 20 (ahead of schedule); 7/14 done; remaining is Vercel cron wiring, load test, integration test, P2 notifications, polish
metadata:
  type: project
---

Sprint 8 is a dedicated 1-week hardening sprint (Jul 7–13, 2026) based on the staff-level code audit findings from Sprint 6 (#37). Audit verdict: GO TO BETA — no showstoppers.

**P0 + P1 items shipped Jun 20, 2026 — ahead of Sprint 8 schedule:**

- P0-1/P0-4: Waiver cron — `app/api/cron/process-waivers/route.ts` + `vercel.json` cron at `0 8 * * *` (08:00 UTC = 03:00 ET). Auth-gated by `CRON_SECRET` header. Ops: `CRON_SECRET` env var must be confirmed set in Vercel before public launch.
- P0-2: Auto-set projection safety — projection fetch in `lineup/page.tsx` wrapped in try/catch; `projectionsAvailable: boolean` prop disables button and "Matchup Proj" tab when unavailable.
- P0-3: Waiver priority init — verified: `startSeason()` calls `initializeWaiverPriority()` unconditionally. No code change.
- P1-A: Analysis tab error state — `getTeamAnalysis()` failure returns null; `AnalysisTab` renders "Analysis data unavailable. Try refreshing."
- P1-B: Auto-set between weeks — `computeOptimalLineup()` sort falls back to `gamesThisPeriod` when all `projectedFp` null.
- P1-C: Add/Slot capacity — `AddAndSlotModal` shows "roster is full, drop a player first" at max size.
- P1-E: Waiver cancel confirmation — `WaiverWirePanel.tsx` two-step inline confirm.
- P1-F: Analysis scoring freshness — verified: already fetches fresh settings on every call. No change.
- 174/174 tests pass. Zero new TypeScript errors.

**Remaining Sprint 8 scope (Jul 7–13, 2026):**
- P1-D: Schedule badge timezone (~0.25h) — add "ET" label to games-remaining badges. Open.
- Vercel cron wiring: confirm `CRON_SECRET` set in staging; `check-incomplete-lineups` entry added to `vercel.json`; both crons fire before beta invite.
- Load test: 10+ concurrent leagues drafting/scoring simultaneously.
- E2E integration test: full season with waivers + FAAB across 3+ leagues.
- P2 notification gaps (can slip to post-beta): lineup-incomplete cron, waiver claim awarded/denied notifications.
- Final UX polish.

**Progress: 7/14 items done.**

**Timeline:**
- Jun 20, 2026: P0+P1 fixes shipped (ahead of schedule)
- Jun 23 – Jul 6, 2026: Sprint 7 (History, FAAB, Storylines, Player Legacy)
- Jul 7–13, 2026: Sprint 8 — remaining hardening scope
- Jul 14, 2026: Beta invites to founding commissioners

**Feature card:** #40 Beta Hardening in `roadmap-features.md`

**FAAB note:** FAAB (#6) depends on the waiver cron being live. The cron route now exists in the codebase; it also depends on `CRON_SECRET` being wired in Vercel. Confirm before enabling FAAB in any live league.

See also: [[sprint6-sprint7-plan]], [[sprint6-shipped]]
