---
name: sprint6-shipped
description: Sprint 6 COMPLETE — all 7/7 items shipped including Waiver Wire (#5); Sprint 7 is now current
metadata:
  type: project
---

Sprint 6 is COMPLETE as of 2026-06-19. All 7/7 items shipped.

**Shipped (Sprint 6 — all complete):**
- Auto-Set Lineup (#34) ✅ — `computeOptimalLineup()` in `lib/lineup.ts`; staged save model; "Auto-set" purple button in `LineupManager.tsx`; `beforeunload` guard; playoff period fallback for games-remaining badges; `GET /api/leagues/[leagueId]/fa-suggestions`. Commits: 3e6bbd0, f83468f, 1f06c9a. Spec: `docs/02-engineering/auto-set-lineup-spec.md`.
- FA Schedule Awareness + Add & Slot (#35) ✅ — games-remaining "Wk" badge on FA panel; `components/AddAndSlotModal.tsx`; bonus lineup nudge + alert fixes. Commit: 6a6b40f. No schema changes.
- Beta Feedback Infrastructure (#36) ✅ — `components/FeedbackWidget.tsx`; `FeedbackSubmission` / `FeedbackType` / `BetaStatus` schema; `POST /api/feedback`, `GET /api/founder/feedback`, `PATCH /api/founder/leagues/[leagueId]/beta-status`; Founder Console feed + Beta tab.
- Code Review & Pre-Beta Audit (#37) ✅ — staff-engineer-level audit complete; all P0 + P1 findings resolved; Go/No-Go: GREEN. Findings: `docs/04-operations/pre-beta-audit.md`.
- Team Analysis & Insights (#25) ✅ — `lib/services/analysis-service.ts` (`getTeamAnalysis()`); `components/MatchupTabs.tsx` + `AnalysisTab.tsx`; `app/api/leagues/[leagueId]/analysis/route.ts`. Trade suggestions scoped out — deferred to Trade System (#7).
- Waiver Wire System (#5) ✅ — Schema: `WaiverEntry` / `WaiverClaim` / `WaiverPriority` models + `WaiverStatus` enum + 4 new `EventType` values + `waiverWindowHours Int @default(48)` on `FantasyLeague`. Service: `lib/services/waiver-service.ts` (`initializeWaiverPriority`, `enterWaiverWire`, `submitClaim`, `processWaivers`). UI: `components/WaiverWirePanel.tsx` in "Waiver Wire" tab of `RosterManager.tsx`; "On Waivers" badge in FA table. Ops: `scripts/process-waivers.ts` cron script + founder console trigger. Season: `startSeason()` calls `initializeWaiverPriority()`. Transactions: "Waivers" filter tab + 4 new event types in `lib/services/activity.ts`. 13 new tests in `tests/waiver.test.ts` (174 total). FAAB and priority customization (static vs. rolling) explicitly deferred to Sprint 7.
- Weekly Performance Dashboard (#29) ✅ — (carried from Sprint 5) `lib/services/performance-service.ts`; Schedule tab → Performance history.

**Deferred from Sprint 6 (explicitly scoped out):**
- FAAB (Free Agent Acquisition Budget) — Feature #6, Sprint 7 item. Blind bidding on top of the waiver system now in place.
- Waiver priority customization (static vs. rolling) — defaulting to rolling; revisit if commissioners request it.
- Trade System (#7) — DEPRIORITIZED to backlog/someday-maybe. Beta cohort is small enough for out-of-band trades.

**Sprint 7 is now IN PROGRESS.**
Sprint 7 has 5 items: League History + HoF (#33/#18), Storylines (#11), FAAB (#6), Player Legacy (#31), Replay Sim V2 (#38) — though #39 (UX Overhaul) already shipped in Sprint 7.

**Why:** Sprint 6 closed with Waiver Wire (#5) completing the last item on the list. Sprint 7 starts now.

**How to apply:** When discussing the current sprint, it is Sprint 7. Sprint 6 is fully closed. The waiver system is live; FAAB (#6) is the immediate dependency to pick up in Sprint 7.
